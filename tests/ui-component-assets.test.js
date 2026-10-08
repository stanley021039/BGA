const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app');
const assets=['color-scheme.js','ui-widgets.js','ui-widgets.css','ui-notifications.js','ui-notifications.css','ui-celebrations.js','ui-celebrations.css'];
test('new shared component assets are fixed routes with correct content types and immutable source bytes',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bga-ui-pattern-assets-'));
 const app=createApp({port:0,host:'127.0.0.1',dbFile:path.join(directory,'app.sqlite'),historyDir:path.join(directory,'history'),communityDir:path.join(directory,'community'),musicDir:path.join(directory,'music'),externalSideEffectsEnabled:false});
 try{
  const {port}=await app.listen();
  for(const asset of assets){const response=await fetch('http://127.0.0.1:'+port+'/shared/'+asset);assert.equal(response.status,200,asset);assert.match(response.headers.get('content-type'),asset.endsWith('.css')?/^text\/css/:/^text\/javascript/);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await response.text(),fs.readFileSync(path.join(__dirname,'../public/shared',asset),'utf8'));}
  assert.equal((await fetch('http://127.0.0.1:'+port+'/shared/ui-widgets.js-extra')).status,404);
 }finally{await app.close();fs.rmSync(directory,{recursive:true,force:true});}
});
test('game feedback pages load common helpers before game controllers and retain native media',()=>{
 for(const name of ['index','poker','draw','gift','majority','race']){
  const html=fs.readFileSync(path.join(__dirname,'../public',name+'.html'),'utf8');
  for(const asset of assets)assert.ok(html.includes('/shared/'+asset),name+' '+asset);
  assert.ok(html.indexOf('src="/shared/ui-components.js"')<html.indexOf('src="/shared/ui-widgets.js"'));
  assert.ok(html.indexOf('src="/shared/motion-policy.js"')<html.indexOf('src="/shared/ui-notifications.js"'));
  if(name!=='index')assert.ok(html.includes('/shared/table-media.js'));
 }
});
