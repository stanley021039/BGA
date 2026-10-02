const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('./src/app');
const {openDatabase}=require('./src/db/index');
const {createAuth}=require('./src/auth/index');
const {clientAddress}=require('./src/http/security');
const {BoardStore}=require('./src/community/board');

test('public crawler rules, response headers, and Cloudflare login limits',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-security-'));
 const config={port:0,host:'127.0.0.1',publicUrl:'https://shhuang.cc',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile);
 await createAuth(db).bootstrap('testadmin','test-password-123');
 db.close();
 const app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const robots=await fetch(base+'/robots.txt');
  assert.equal(robots.status,200);
  assert.match(await robots.text(),/^User-agent: \*\r?\nDisallow: \/\r?\n$/);
  assert.equal(robots.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
  assert.equal(robots.headers.get('x-content-type-options'),'nosniff');
  assert.equal(robots.headers.get('strict-transport-security'),'max-age=31536000');
  const post=ip=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify({username:'absent',password:'invalid'})});
  for(let n=0;n<20;n++)assert.equal((await post('203.0.113.1')).status,401);
  assert.equal((await post('203.0.113.1')).status,429);
  assert.equal((await post('203.0.113.2')).status,401);
  assert.equal((await post('not-an-ip')).status,401);
  const injection=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.3'},body:JSON.stringify({username:"testadmin' OR 1=1 --",password:'test-password-123'})});
  assert.equal(injection.status,400);
  const crossOrigin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example','CF-Connecting-IP':'203.0.113.4'},body:'{}'});
  assert.equal(crossOrigin.status,400);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('forwarded client address is ignored unless the peer is trusted loopback',()=>{
 assert.equal(clientAddress({socket:{remoteAddress:'198.51.100.5'},headers:{'cf-connecting-ip':'203.0.113.1'}},true),'198.51.100.5');
 assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'cf-connecting-ip':'203.0.113.1'}},false),'127.0.0.1');
 assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'cf-connecting-ip':'203.0.113.1'}},true),'203.0.113.1');
});

test('stored GitHub issue links cannot inject a browser URL scheme',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-url-'));
 const db=openDatabase(path.join(root,'app.sqlite'));
 try{
  const board=new BoardStore(db);
  const row={id:'one',title:'title',body:'body',name:'name',game:'general',status:'open',at:'2026-01-01',github_url:'javascript:alert(1)'};
  assert.equal(board.publicIssue(row).githubUrl,null);
  row.github_url='https://github.com/stanley021039/BGA/issues/123';
  assert.equal(board.publicIssue(row).githubUrl,row.github_url);
  row.github_url='https://github.com.evil.example/stanley021039/BGA/issues/123';
  assert.equal(board.publicIssue(row).githubUrl,null);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
