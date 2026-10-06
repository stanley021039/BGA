const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const source=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
const shellSource=source('shared/game-shell.js');
function section(text,start,end){const from=text.indexOf(start),to=text.indexOf(end,from+start.length);assert.ok(from>=0&&to>from,'real frontend section exists: '+start);return text.slice(from,to);}
const sendSource=section(shellSource,' async function send(',' q(\'#shared-barrage\').onsubmit');
const rowSource=section(shellSource,' function playerRow(',' let historyNotice;');
const stableSource=section(shellSource,' function stableMarkup(',' function settingsActions(');
const customGif='/assets/characters/user/12345678-1234-4234-8234-123456789abc/emote-22345678-1234-4234-8234-123456789abc?v='+ 'a'.repeat(64);
const noOp=()=>{};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}

function snapshot(type='poker',changes={}){
 const players=['P','Q'].map((id,index)=>({id,name:id==='P'?'甲玩家':'乙玩家',avatar:'/characters/'+id,online:true,color:index?'#63a184':'#ca9563',score:0,giveScore:0,getScore:0,stack:1000,bet:0,cards:[],dice:[],commandUsed:false,chopper:null}));
 return {type,code:'ABC123',me:'P',version:7,serverNow:10000,name:'表情測試',phase:'waiting',host:true,hostId:'P',presenterId:'P',actor:'P',turn:0,players,
  round:1,roundLimit:3,options:{seconds:90,customPercent:null},target:10,customPercent:null,includeAdult:false,gifts:[],ownAssignments:null,ownRanking:null,delivery:null,result:null,winner:null,gaveIds:[],wishedIds:[],
  ownAnswer:null,groups:[],question:null,candidates:[],answeredIds:[],participantIds:[],guessedIds:[],guesses:[],canvasEpoch:'canvas-epoch',strokeVersion:0,
  hand:1,board:[],results:[],log:[],pot:0,button:0,currentBet:0,minRaise:20,canRaise:false,cars:[],tiles:[],events:[],motions:[],deadline:20000,...changes};
}
function expressionState(base,changes={}){return {...base,serverNow:base.serverNow+1,players:base.players.map(player=>player.id==='P'?{...player,avatar:customGif}:player),expressions:[{id:'event',playerId:'P',expression:'emote-custom',label:'flip',image:customGif,at:base.serverNow+1}],...changes};}

// Use the real RoomHost, social sender, game callbacks and avatar markup. The
// stand-ins below exclude unrelated canvas/FX work and do not simulate layout.
function harness(type='poker'){
 const nodes=new Map(),network=[],feedback=[],shellUpdates=[];
 class Element{
  constructor(){this.attrs=new Map();this.children=[];this.hidden=false;this.disabled=false;this.open=false;this.innerHTML='';this.textContent='';this.dataset={};this.style={};this.classList={add:noOp,remove:noOp,toggle:noOp};}
  append(...items){this.children.push(...items);}
  addEventListener(){}focus(){}close(){this.open=false;}showModal(){this.open=true;}
  setAttribute(name,value){this.attrs.set(name,String(value));}removeAttribute(name){this.attrs.delete(name);}
  querySelectorAll(){return [];}querySelector(){return null;}
 }
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);};
 const document={body:new Element(),activeElement:null,hidden:false,visibilityState:'visible',createElement:()=>new Element(),querySelector:node,querySelectorAll:()=>[]};
 const base=snapshot(type),trigger=node('#sendExpression');let reply=expressionState(base),scope;
 const window={GameUI:{setBusy(button,busy){button.setAttribute('aria-busy',String(busy));}},GameShell:{update(s){shellUpdates.push(s);}}};
 const motionGate={update:()=>false,take:()=>false};
 scope={window,document,$:node,q:node,escape,esc:escape,Date,Promise,Number,Array,JSON,Map,Set,localStorage:{getItem:()=>null,removeItem:noOp},
  state:base,code:base.code,signature:'',disconnected:false,streamDisconnected:false,motionNeedsBaseline:false,lastReceivedAt:0,lastLiveState:false,clockOffset:0,
  motionGate,gameSounds:null,resultsView:null,canvasRound:base.round,canvasVersion:0,choice:null,draft:'',draftGifts:{},draftLikes:[],activeGiftRecipient:null,activeResultRecipient:null,
  lastVersion:base.version,onlineSignature:base.players.map(player=>player.online).join(','),sizes:['輕型','中型','重型'],raceSounds:{update:noOp},
  panel:{querySelectorAll:()=>[trigger]},expressions:{querySelectorAll:()=>[]},sending:false,
  feedback(message,kind){feedback.push({message,kind});},
  fetch:async(url,options)=>{network.push({url,options,body:JSON.parse(options.body)});return {ok:true,json:async()=>await reply};},
  immersion:{allowsMotion:()=>false,prepareFocus:noOp,startFocus:noOp,stopFocus:noOp,playSound:noOp},phases:{waiting:'等待'},card:()=>'',animateChipTransfers:noOp,updateTimer:noOp,checkPokerAchievements:noOp,
  render:noOp,progress:noOp,stopGather:noOp,stopFocus:noOp,restoreAchievementNotice:noOp,gatherPlayers:noOp,startFocus:noOp,playSound:noOp,checkNewAchievement:noOp,
  celebrateVictory:noOp,drawFeedback:noOp,updateConnection:noOp,animatePhase:noOp,updateFeed:noOp,updateStagePreview:noOp,decorateActions:noOp,
  showCorrectFeedback:noOp,playDrawSounds:noOp,connectEvents:noOp,tick:noOp,
 };
 vm.createContext(scope);
 vm.runInContext(source('shared/room-host.js'),scope,{filename:'public/shared/room-host.js'});scope.RoomHost=window.RoomHost;
 vm.runInContext(rowSource+'\n'+stableSource,scope);window.GameShell.playerRow=scope.playerRow;window.GameShell.stableMarkup=scope.stableMarkup;scope.GameShell=window.GameShell;
 let callback,output;
 if(type==='poker'){
  vm.runInContext(section(source('app.js'),'function render(s)','function updateTimer('),scope);callback=scope.render;output='#seats';
 }else if(type==='gift'){
  const text=source('gift.js');vm.runInContext(section(text,'function playerRow(item)','function actionFeedback(')+section(text,'function receive(next)','function render('),scope);callback=scope.receive;output='#players';
 }else if(type==='majority'){
  const text=source('majority.js');vm.runInContext(section(text,'function playerMetrics(','function progress('),scope);callback=scope.receive;output='#players';
 }else if(type==='draw'){
  const text=source('draw.js');vm.runInContext(section(text,'function playerStatus(','function updateConnection(')+section(text,'function receive(next)','function tick('),scope);callback=scope.receive;output='#players';
 }else{
  const text=source('race.js');vm.runInContext(section(text,'function crewCard(','function heli(')+section(text,'function snapshotRaceState(','function render(')+section(text,'function renderCrews(','async function refresh('),scope);callback=scope.receive;output='#crews';
  // New versions enter the full board renderer. Its motion/dice integration is
  // exercised with the real renderer in race-presentation.test.js; preserve its
  // state/roster/callback contract here without inventing a fake board layout.
  scope.render=s=>{scope.state=scope.snapshotRaceState(s);scope.onlineSignature=s.players.map(player=>player.online).join(',');scope.lastVersion=s.version;scope.renderCrews(s);scope.RoomHost.update(s,scope.receive);};
 }
 callback(base);
 vm.runInContext(sendSource,scope,{filename:'public/shared/game-shell.js:send'});
 return {scope,window,base,network,feedback,shellUpdates,trigger,node,callback,markup:()=>node(output).innerHTML,setReply(value){reply=value;},send:()=>scope.send({kind:'expression',expression:'emote-custom'},'已送出 flip 表情',trigger)};
}

test('a shared expression ACK reaches the real callback and visible avatar markup immediately in all five games',async t=>{
 for(const type of ['poker','thunder','majority','gift','draw'])await t.test(type,async()=>{
  const h=harness(type),ack=expressionState(h.base);h.setReply(ack);
  assert.ok(!h.markup().includes(customGif));assert.equal(await h.send(),true);
  assert.equal(h.scope.state.version,h.base.version);assert.equal(h.scope.state.players[0].avatar,customGif);assert.ok(h.markup().includes(customGif));
  assert.equal(h.network.length,1);assert.equal(h.network[0].url,'/api/social');assert.equal(h.network[0].options.method,'POST');
  assert.deepEqual(h.network[0].body,{code:h.base.code,kind:'expression',expression:'emote-custom'});
  assert.equal(h.trigger.disabled,false);assert.equal(h.scope.sending,false);assert.equal(h.node('#shared-barrage').attrs.has('aria-busy'),false);
  const expired={...h.base,serverNow:ack.serverNow+5000,expressions:[]};assert.equal(h.window.RoomHost.acceptSnapshot(expired),true);
  assert.equal(h.scope.state.players[0].avatar,h.base.players[0].avatar);assert.ok(!h.markup().includes(customGif));assert.equal(h.network.length,1);
 });
});

test('late shared ACKs cannot replace another room, another seat, another game or a newer accepted snapshot',async t=>{
 const invalid={room:{code:'BBBBBB'},seat:{me:'Q'},type:{type:'gift'},version:{version:6,serverNow:20000},clock:{serverNow:9999}};
 for(const [name,changes] of Object.entries(invalid))await t.test(name,async()=>{
  const h=harness(),before=h.scope.state,markup=h.markup(),updates=h.shellUpdates.length;h.setReply(expressionState(h.base,changes));
  // HTTP succeeded, but the acceptance guard must leave current presentation intact.
  assert.equal(await h.send(),true);assert.equal(h.scope.state,before);assert.equal(h.markup(),markup);assert.equal(h.shellUpdates.length,updates);assert.equal(h.network.length,1);
 });
 const h=harness(),pending=deferred();h.setReply(pending.promise);const sending=h.send();
 await Promise.resolve();await Promise.resolve();
 const nextRoom=snapshot('poker',{code:'BBBBBB',serverNow:20000});h.callback(nextRoom);const currentMarkup=h.markup();
 pending.resolve(expressionState(h.base));assert.equal(await sending,true);assert.equal(h.scope.state,nextRoom);assert.equal(h.markup(),currentMarkup);assert.equal(h.network.length,1);
});

test('accepted newer versions dominate server time while equal-version responses respect the latest clock sample',()=>{
 const h=harness(),host=h.window.RoomHost;
 const newer={...expressionState(h.base),version:h.base.version+1,serverNow:9000};assert.equal(host.acceptSnapshot(newer),true);assert.equal(h.scope.state,newer);
 const same={...newer,serverNow:9001};assert.equal(host.acceptSnapshot(same),true);assert.equal(h.scope.state,same);
 assert.equal(host.acceptSnapshot({...newer,serverNow:9000}),false);assert.equal(h.scope.state,same);
 assert.equal(host.acceptSnapshot({...h.base,serverNow:50000}),false);assert.equal(h.scope.state,same);
 assert.equal(h.network.length,0);
});

test('all five real game receivers reject an old poll arriving after the expression ACK, but accept a fresh expiry and a newer version',async t=>{
 for(const type of ['poker','thunder','majority','gift','draw'])await t.test(type,async()=>{
  const h=harness(type);assert.equal(await h.send(),true);
  const accepted=h.scope.state,markup=h.markup(),updates=h.shellUpdates.length;
  h.callback(h.base); // Earlier in-flight GET: same version, older serverNow, neutral image.
  assert.equal(h.scope.state,accepted);assert.equal(h.markup(),markup);assert.equal(h.shellUpdates.length,updates);
  assert.equal(h.scope.state.players[0].avatar,customGif);
  const expiry={...h.base,serverNow:accepted.serverNow+5000,expressions:[]};h.callback(expiry);
  assert.equal(h.scope.state.serverNow,expiry.serverNow);assert.equal(h.scope.state.players[0].avatar,h.base.players[0].avatar);assert.ok(!h.markup().includes(customGif));
  const newer=expressionState(h.base,{version:h.base.version+1,serverNow:h.base.serverNow-1000});h.callback(newer);
  assert.equal(h.scope.state.version,newer.version);assert.equal(h.scope.state.serverNow,newer.serverNow);assert.equal(h.scope.state.players[0].avatar,customGif);assert.ok(h.markup().includes(customGif));
  assert.equal(h.network.length,1,'out-of-order handling and expiry add no requests beyond the explicit expression POST');
 });
});

test('shared freshness rules compare clocks only within the same room, seat, game and version',()=>{
 const h=harness(),stale=h.window.RoomHost.isStaleSnapshot,previous=h.base;
 assert.equal(typeof stale,'function');
 assert.equal(stale({...previous,serverNow:previous.serverNow-1},previous),true);
 assert.equal(stale({...previous,serverNow:previous.serverNow},previous),false);
 assert.equal(stale({...previous,serverNow:previous.serverNow+1},previous),false);
 assert.equal(stale({...previous,version:previous.version-1,serverNow:previous.serverNow+1000},previous),true);
 assert.equal(stale({...previous,version:previous.version+1,serverNow:previous.serverNow-1000},previous),false);
 for(const change of [{code:'BBBBBB'},{me:'Q'},{type:'gift'}])assert.equal(stale({...previous,...change,serverNow:previous.serverNow-1},previous),false);
 assert.equal(stale({...previous,type:undefined,serverNow:previous.serverNow-1},previous),true,'legacy no-type poker shares the same context');
 for(const serverNow of [undefined,NaN,Infinity]){
  assert.equal(stale({...previous,serverNow},previous),false);
  assert.equal(stale(previous,{...previous,serverNow}),false);
 }
 assert.equal(stale(previous,null),false);
});

test('legacy poker snapshots with no type still accept the canonical poker response',()=>{
 const h=harness();h.callback({...h.base,type:undefined});const next=expressionState(h.base);
 assert.equal(h.window.RoomHost.acceptSnapshot(next),true);assert.equal(h.scope.state,next);assert.ok(h.markup().includes(customGif));
});
