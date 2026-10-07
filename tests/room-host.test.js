const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/room-host.js'),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const json=(body,ok=true)=>({ok,json:async()=>structuredClone(body)});
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};

function snapshot({role='host',type='gift',...changes}={}){
 const me=role==='host'?'host':role==='manager'?'manager':'member';
 return {code:'ABC123',me,type,version:1,serverNow:1000,host:role==='host',hostId:'host',phase:'waiting',media:{roomInstanceId:'room-a',revision:0},permissions:{role,isHost:role==='host',canManageMedia:role!=='member',canManagePlayers:role!=='member',canPromote:role==='host'},players:[
  {id:'host',name:'房主',roomRole:'host'},{id:'manager',name:'管理者',roomRole:'manager'},{id:'member',name:'一般玩家',roomRole:'member'},{id:'peer',name:'另一位管理者',roomRole:'manager'},{id:'bot',name:'電腦',bot:true,roomRole:null},{id:'departed',name:'已離席',kicked:true,roomRole:null}
 ],...changes};
}

// Exercise the real RoomHost controls/callbacks, not a second implementation of
// its ACL. The DOM stand-in does not provide CSS layout or browser focus trapping.
function harness(initial=snapshot(),fetchHandler){
 const ids=new Map(),network=[],applied=[],shellUpdates=[],opens=[],storage=new Map();let current=initial;
 const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.attributes=new Map();this.handlers=new Map();this.dataset={};this.children=[];this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this._html='';}
  setAttribute(name,value){value=String(value);this.attributes.set(name,value);if(name==='id'){this.id=value;ids.set(value,this);}if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;}
  getAttribute(name){return this.attributes.get(name)??null;}
  set innerHTML(value){this._html=value;this.children=[];
   for(const match of value.matchAll(/<([a-z][\w-]*)\b([^>]*)>([^<]*)/gi)){
    if(!/\bid="/.test(match[2])&&match[1]!=='button')continue;
    const node=new Node(match[1]);for(const attr of match[2].matchAll(/\b([a-z][\w-]*)="([^"]*)"/gi))node.setAttribute(attr[1],decode(attr[2]));node.hidden=/\bhidden\b/.test(match[2]);node.disabled=/\bdisabled\b/.test(match[2]);node.textContent=decode(match[3]);this.children.push(node);
   }
  }
  get innerHTML(){return this._html;}
  append(...nodes){this.children.push(...nodes);}
  querySelectorAll(selector){return selector==='button'?this.children.filter(node=>node.tagName==='BUTTON'):[];}
  closest(selector){return selector==='[data-kick]'&&this.dataset.kick||selector==='[data-role-player]'&&this.dataset.rolePlayer?this:null;}
  addEventListener(type,listener){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(listener);}
  showModal(){this.open=true;}
  close(){if(!this.open)return;this.open=false;for(const handler of this.handlers.get('close')||[])handler({});}
  focus(){document.activeElement=this;}
  cancel(){let prevented=false;for(const handler of this.handlers.get('cancel')||[])handler({preventDefault(){prevented=true;}});if(!prevented)this.close();return prevented;}
  click(){if(this.disabled)return false;return this.onclick?.({target:this});}
 }
 const document={body:new Node('body'),activeElement:null,createElement:tag=>new Node(tag),querySelector:selector=>ids.get(selector.slice(1)),querySelectorAll:selector=>selector==='dialog[open]'?[...ids.values()].filter(node=>node.tagName==='DIALOG'&&node.open):[]};
 const window={GameShell:{update:state=>shellUpdates.push(state)},GameUI:{openDialog(dialog,trigger){opens.push({dialog:dialog.id,trigger:trigger?.id});dialog.showModal();}}};
 const fetch=async(url,options)=>{const request={url,options,body:JSON.parse(options.body)};network.push(request);return fetchHandler?fetchHandler(request):json(current);};
 vm.runInNewContext(source,{window,document,fetch,AbortController,localStorage:{getItem:key=>storage.get(key)??null,removeItem:key=>storage.delete(key)}});
 function update(state){current=state;window.RoomHost.update(state,receive);}
 function receive(state){applied.push(state);update(state);}
 update(initial);
 const node=id=>ids.get(id);
 const buttons=()=>node('hostPlayerList').querySelectorAll('button');
 const button=(kind,id)=>buttons().find(control=>control.dataset[kind]===id);
 const delegate=control=>node('hostPlayerList').onclick({target:control});
 const role=id=>delegate(button('rolePlayer',id));
 const kick=id=>delegate(button('kick',id));
 return {window,node,storage,network,applied,shellUpdates,opens,update,buttons,button,role,kick,delegate,Node,current:()=>current,open:()=>node('managePlayers').click()};
}

test('host management shows visible roles for all seats and only valid promotion/demotion actions',()=>{
 const state=snapshot();state.players[2].name='<img src=x onerror=alert(1)>';
 const h=harness(state);h.open();
 assert.equal(h.node('managePlayers').hidden,false);assert.equal(h.node('hostPlayers').open,true);
 assert.deepEqual(h.opens,[{dialog:'hostPlayers',trigger:'managePlayers'}]);
 const html=h.node('hostPlayerList').innerHTML;
 for(const label of ['房主','管理者','一般玩家','電腦',' · 你'])assert.ok(html.includes(label));
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));
 assert.ok(!html.includes('已離席'));
 assert.equal(h.button('rolePlayer','member').textContent,'設為管理者');
 assert.equal(h.button('rolePlayer','manager').textContent,'改為一般玩家');
 for(const id of ['host','bot','departed'])assert.equal(h.button('rolePlayer',id),undefined);
 assert.ok(h.button('kick','bot'));assert.equal(h.button('kick','host'),undefined);
 assert.equal(h.node('hostPlayers').getAttribute('aria-labelledby'),'hostPlayers-title');
 assert.equal(h.node('managePlayers').getAttribute('aria-haspopup'),'dialog');
 assert.equal(h.node('hostError').getAttribute('role'),'status');
 h.node('closeHostPlayers').click();assert.equal(h.node('hostPlayers').open,false);assert.equal(h.window.RoomHost.acceptSnapshot({...state,version:2}),true);
});

test('manager can open the same dialog and kick only ordinary humans; members and lessons cannot open it',async()=>{
 const h=harness(snapshot({role:'manager'}));h.open();
 assert.equal(h.node('hostPlayers').open,true);assert.equal(h.node('managePlayers').hidden,false);
 assert.equal(h.buttons().filter(button=>button.dataset.rolePlayer).length,0);
 assert.deepEqual(h.buttons().map(button=>button.dataset.kick),['member']);
 for(const id of ['host','peer','bot'])assert.equal(h.button('kick',id),undefined);
 const forged=new h.Node('button');forged.dataset={rolePlayer:'member',roomRole:'manager'};await h.delegate(forged);assert.equal(h.network.length,0);
 forged.dataset={kick:'peer'};await h.delegate(forged);assert.equal(h.node('kickWarning').open,false);
 h.update(snapshot({role:'member',host:true}));assert.equal(h.node('managePlayers').hidden,true);assert.equal(h.node('hostPlayers').open,false);h.open();assert.equal(h.node('hostPlayers').open,false);
 h.window.RaceLesson={};h.update(snapshot());assert.equal(h.node('managePlayers').hidden,true);h.open();assert.equal(h.node('hostPlayers').open,false);
});

test('real role commands reach callbacks immediately in all five games and retain session compatibility',async t=>{
 for(const type of ['gift','majority','draw','thunder','poker'])await t.test(type,async()=>{
  const initial=snapshot({type});initial.players[2].roomRole='member';
  const next={...initial,version:2,serverNow:1001,players:initial.players.map(player=>player.id==='member'?{...player,roomRole:'manager'}:player)};
  const h=harness(initial,()=>json(next));const key=type==='poker'?'ah-session':'ah-'+type;h.storage.set(key+':ABC123',JSON.stringify({token:'fixture-token'}));h.open();
  await h.role('member');
  assert.equal(h.network.length,1);assert.equal(h.network[0].url,'/api/room-role');
  assert.deepEqual(h.network[0].body,{code:'ABC123',playerId:'member',role:'manager'});
  assert.equal(h.network[0].options.headers.Authorization,'Bearer fixture-token');assert.equal(h.network[0].options.credentials,'same-origin');
  assert.equal(h.current().version,2);assert.equal(h.applied.length,1);assert.equal(h.button('rolePlayer','member').textContent,'改為一般玩家');
  assert.equal(h.node('hostPlayers').getAttribute('aria-busy'),'false');assert.equal(h.node('hostError').textContent,'已設為管理者。');
 });
});

test('role submissions lock every player action and prevent duplicate commands while preserving the open dialog',async()=>{
 const pending=deferred(),initial=snapshot(),h=harness(initial,()=>pending.promise);h.open();
 const sending=h.role('member');await flush();
 assert.equal(h.network.length,1);assert.equal(h.node('hostPlayers').getAttribute('aria-busy'),'true');
 assert.ok(h.buttons().every(button=>button.disabled));await h.role('manager');assert.equal(h.network.length,1);
 assert.equal(h.node('hostPlayers').open,true);
 pending.resolve(json({...initial,version:2,players:initial.players.map(player=>player.id==='member'?{...player,roomRole:'manager'}:player)}));await sending;
 assert.ok(h.buttons().every(button=>!button.disabled));assert.equal(h.node('hostPlayers').open,true);
});

test('ordinary polls preserve management focus and legacy watch IDs are not compared with media IDs',()=>{
 const initial=snapshot(),h=harness(initial);h.open();const control=h.button('rolePlayer','member');control.focus();
 h.update({...initial,serverNow:1001});assert.equal(h.button('rolePlayer','member'),control);
 const legacy={...initial,media:undefined,watch:{roomInstanceId:'legacy-watch-instance'}};h.update(legacy);
 const unified={...legacy,version:2,media:{roomInstanceId:'unified-media-instance'},watch:{roomInstanceId:'legacy-watch-instance'}};
 assert.equal(h.window.RoomHost.acceptSnapshot(unified),true);
 assert.equal(h.window.RoomHost.acceptSnapshot({...unified,watch:{roomInstanceId:'other-watch-instance'}}),false);
});

test('late role ACKs cannot overwrite another room, seat, game, or room instance and cannot clear a new pending operation',async t=>{
 for(const change of [{code:'DEF456'},{me:'new-host',players:snapshot().players.map(player=>player.id==='host'?{...player,id:'new-host'}:player),hostId:'new-host'},{type:'draw'},{media:{roomInstanceId:'room-b',revision:0}}])await t.test(JSON.stringify(change),async()=>{
  const old=deferred(),fresh=deferred(),initial=snapshot();let count=0;
  const h=harness(initial,()=>++count===1?old.promise:fresh.promise);h.open();const sending=h.role('member');await flush();
  const next={...initial,...change,version:5,serverNow:5000};h.update(next);assert.equal(h.network[0].options.signal.aborted,true);
  h.open();const newer=h.role('member');await flush();assert.equal(h.network.length,2);
  const feedback=h.node('hostError').textContent;old.resolve(json({...initial,version:2}));await sending;
  assert.equal(h.current().code,next.code);assert.equal(h.current().me,next.me);assert.equal(h.current().type,next.type);assert.equal(h.applied.length,0);
  assert.equal(h.node('hostPlayers').getAttribute('aria-busy'),'true');assert.equal(h.node('hostError').textContent,feedback);assert.ok(h.buttons().every(button=>button.disabled));
  fresh.resolve(json({...next,version:6,players:next.players.map(player=>player.id==='member'?{...player,roomRole:'manager'}:player)}));await newer;
  assert.equal(h.applied.length,1);assert.equal(h.node('hostPlayers').getAttribute('aria-busy'),'false');
 });
});

test('stale role ACKs preserve the newest accepted snapshot and failures leave retry controls available',async()=>{
 const pending=deferred(),initial=snapshot(),h=harness(initial,()=>pending.promise);h.open();const sending=h.role('member');await flush();
 const newer={...initial,version:8,serverNow:8000};h.update(newer);
 pending.resolve(json({...initial,version:2,serverNow:2000}));await sending;
 assert.equal(h.current(),newer);assert.equal(h.applied.length,0);assert.match(h.node('hostError').textContent,/等待最新/);assert.ok(h.buttons().every(button=>!button.disabled));
 const failed=harness(initial,()=>json({error:'權限已變更'},false));failed.open();await failed.role('member');
 assert.equal(failed.node('hostError').textContent,'權限已變更');assert.equal(failed.applied.length,0);assert.ok(failed.buttons().every(button=>!button.disabled));
});

test('manager kick retains confirmation, cancellation fencing and fresh callbacks without changing host identity',async()=>{
 const initial=snapshot({role:'manager',phase:'drawing',type:'draw'}),pending=deferred(),h=harness(initial,()=>pending.promise);h.open();await h.kick('member');
 assert.equal(h.node('hostPlayers').open,false);assert.equal(h.node('kickWarning').open,true);assert.match(h.node('kickEffect').textContent,/揭曉本輪/);
 const sending=h.node('confirmKick').click();await flush();
 assert.equal(h.node('confirmKick').disabled,true);assert.equal(h.node('cancelKick').disabled,true);assert.equal(h.node('kickWarning').cancel(),true);
 assert.deepEqual(h.network[0].body,{code:'ABC123',playerId:'member',confirmed:true});assert.equal(h.network[0].url,'/api/kick');
 pending.resolve(json({...initial,version:2,players:initial.players.filter(player=>player.id!=='member')}));await sending;
 assert.equal(h.current().hostId,'host');assert.equal(h.current().permissions.role,'manager');assert.equal(h.applied.length,1);assert.equal(h.node('kickWarning').open,false);
});

test('target promotion or actor demotion closes an obsolete kick prompt and prevents stale confirmed actions',async()=>{
 const initial=snapshot({role:'manager'}),h=harness(initial);h.open();await h.kick('member');
 h.update({...initial,version:2,players:initial.players.map(player=>player.id==='member'?{...player,roomRole:'manager'}:player)});
 assert.equal(h.node('kickWarning').open,false);await h.node('confirmKick').click();assert.equal(h.network.length,0);
 h.update(initial);h.open();await h.kick('member');h.update(snapshot({role:'member'}));assert.equal(h.node('kickWarning').open,false);assert.equal(h.node('managePlayers').hidden,true);
 await h.node('confirmKick').click();assert.equal(h.network.length,0);
});

test('closing a pending role dialog does not duplicate the write or drop its valid response',async()=>{
 const pending=deferred(),initial=snapshot(),h=harness(initial,()=>pending.promise);h.open();const sending=h.role('member');await flush();
 h.node('closeHostPlayers').click();assert.equal(h.node('hostPlayers').open,false);h.open();assert.ok(h.buttons().every(button=>button.disabled));
 pending.resolve(json({...initial,version:2,players:initial.players.map(player=>player.id==='member'?{...player,roomRole:'manager'}:player)}));await sending;
 assert.equal(h.network.length,1);assert.equal(h.applied.length,1);assert.equal(h.node('hostPlayers').getAttribute('aria-busy'),'false');
});

test('kicked cleanup aborts pending commands, clears room sessions and blocks late ACKs',async()=>{
 const pending=deferred(),initial=snapshot(),h=harness(initial,()=>pending.promise);h.open();h.storage.set('ah-gift:ABC123',JSON.stringify({code:'ABC123',token:'fixture'}));h.storage.set('ah-gift',JSON.stringify({code:'ABC123',token:'fixture'}));
 const sending=h.role('member');await flush();h.window.RoomHost.kicked({code:'ABC123'});
 assert.equal(h.network[0].options.signal.aborted,true);assert.equal(h.storage.has('ah-gift:ABC123'),false);assert.equal(h.storage.has('ah-gift'),false);
 assert.equal(h.node('managePlayers').hidden,true);assert.equal(h.node('hostPlayers').open,false);assert.equal(h.node('kickedNotice').open,true);assert.equal(h.node('kickedNotice').cancel(),true);
 pending.resolve(json({...initial,version:2}));await sending;assert.equal(h.applied.length,0);assert.equal(h.node('kickedNotice').open,true);
});
