const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app');
const {openDatabase}=require('../src/db');
const {createAuth}=require('../src/auth');
const vm=require('node:vm');
const {mediaHarness,json}=require('./helpers/media-browser.cjs');

test('all five games broadcast emoji without changing character expressions or avatars',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-emoji-'));
 const config={host:'127.0.0.1',port:0,dbFile:path.join(root,'app.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('emojiadmin','test-password-123');db.close();
 const app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const post=async(route,cookie,data)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const host=(await post('auth/login',null,{username:'emojiadmin',password:'test-password-123'})).cookie;
  const options=await (await fetch(base+'/api/social/options',{headers:{Cookie:host}})).json();assert.ok(options.emojis.includes('❤️'));
  for(const [index,type] of ['poker','thunder','majority','gift','draw'].entries()){
   const invite=(await post('admin/invites',host,{days:1})).data.code;
   const friend=(await post('auth/register',null,{username:'emoji_friend_'+index,password:'test-password-123',confirmPassword:'test-password-123',invite})).cookie;
   const {code}=(await post('create',host,{type})).data;
   const forbidden=await post('social',friend,{code,kind:'emoji',emoji:'🎉'});assert.notEqual(forbidden.status,200);
   await post('join',friend,{code});
   const before=await (await fetch(base+'/api/state?code='+code,{headers:{Cookie:friend}})).json();
   assert.equal((await post('social',friend,{code,kind:'emoji',emoji:'<img onerror=alert(1)>'})).data.code,'INVALID_EMOJI');
   const sent=await post('social',friend,{code,kind:'emoji',emoji:'🎉'});assert.equal(sent.status,200);
   assert.equal(sent.data.barrages[0].kind,'emoji');assert.equal(sent.data.barrages[0].emoji,'🎉');
   assert.deepEqual(sent.data.expressions,before.expressions);assert.deepEqual(sent.data.players.map(player=>player.avatar),before.players.map(player=>player.avatar));
   const hostView=await (await fetch(base+'/api/state?code='+code,{headers:{Cookie:host}})).json();assert.equal(hostView.barrages[0].emoji,'🎉');
   assert.equal((await post('social',friend,{code,kind:'emoji',emoji:'😂'})).status,429);
  }
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});

test('character expression cards preserve their images and send action with image-only accessible shared hints',async()=>{
 const label='很長的角色表情名稱 <img onerror="bad">',f=mediaHarness({fetchHandler:request=>{
  if(request.route==='/api/social/options')return json({emojis:['🎉']});
  if(request.route==='/api/auth/me')return json({appearance:{characterId:'user:owned'}});
  if(request.route==='/api/profile/options')return json({defaults:{characterId:'user:owned'},characters:[{id:'user:owned',labels:{happy:label},expressions:{happy:'/happy.gif'}}],expressionLabels:{}});
  return json({type:'majority',code:'ABC123',version:2,me:'host',phase:'waiting',players:[{id:'host',name:'朋友'}],social:[],expressions:[]});
 }});
 const layout=f.document.createElement('div');layout.className='play-layout';const arena=f.document.createElement('main'),aside=f.document.createElement('aside'),actions=f.document.createElement('section');actions.setAttribute('data-game-action-slot','');aside.append(actions);layout.append(arena,aside);f.document.body.append(layout);
 f.window.TableMedia={mount(){},update(){},stop(){},disconnected(){}};f.context.MotionPolicy=f.window.MotionPolicy={createBarrageController:()=>({update(){},disconnect(){},dispose(){}})};f.window.UIPopover={bind:()=>({sync(){}}),bindDetails(){},bindOverlay(){}};f.window.GameUI.setBusy=()=>{};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/shared/game-shell.js'),'utf8'),f.context);await f.flush();f.window.GameShell.update({type:'majority',code:'ABC123',version:1,me:'host',phase:'waiting',players:[{id:'host',name:'朋友'}],social:[],expressions:[]});await f.flush();
 const card=f.node('shared-expressions').children[0];assert.deepEqual(card.children.map(node=>node.tagName),['IMG']);assert.equal(card.querySelector('img').src,'/happy.gif');assert.equal(card.textContent,'');assert.equal(card.hasAttribute('data-ui-hint'),true);assert.equal(card.classList.contains('ui-icon-button'),false);assert.equal(card.getAttribute('aria-label'),'送出「'+label+'」表情');assert.equal(card.title,'送出「'+label+'」');
 f.node('shared-emote-toggle').click();await card.click();await f.flush();assert.deepEqual(f.network.find(request=>request.body?.kind==='expression').body,{code:'ABC123',kind:'expression',expression:'happy'});assert.equal(f.node('shared-emoji-picker').hidden,true);
 const css=fs.readFileSync(path.join(__dirname,'../public/shared/ui-foundation.css'),'utf8');assert.match(css,/shared-emoji-picker \.shared-expressions button\{[^}]*width:var\(--ui-expression-card-size\)[^}]*height:var\(--ui-expression-card-size\)/);assert.match(css,/shared-emoji-picker \.shared-expressions img\{[^}]*height:100%/);
});
