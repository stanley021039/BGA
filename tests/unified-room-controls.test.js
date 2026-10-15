const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm');
test('all eleven room entry points load the common actions before their controllers',()=>{
 for(const type of ['poker','race','draw','gift','majority','telephone','trpg','musicquiz','minimal','bluff','quacks']){
  const html=fs.readFileSync(path.join(__dirname,'../public',type+'.html'),'utf8');
  for(const asset of ['room-controls.js','room-controls.css','chat.js','game-shell.js','table-media.js'])assert.equal(html.split('/shared/'+asset).length-1,1,type+' '+asset);
  assert.ok(html.indexOf('/shared/room-controls.js')<html.indexOf('/shared/game-shell.js'),type+' controls ready before shell');
 }
});

function fixture(type='minimal'){
 const {dom}=require('./helpers/widget-dom.cjs'),h=dom('<div class="room-sidebar"><div id="controls"></div></div><div class="ui-room-roster-add"></div><div id="resultActions"></div>'),jobs=[],listeners=new Map();
 h.document.dispatchEvent=()=>{};
 const window={addEventListener(name,fn){listeners.set(name,fn);},GameUI:{framePanel(root,{header,content,footer}){root.append(header,content,footer);},frameFields(){},decorateButton(button,_icon,{label}){button.textContent=label;}}};
 const roster=h.document.querySelector('.ui-room-roster-add');window.RoomWaiting={setRosterAction(button){roster.replaceChildren(...(button?[button]:[]));}};
 const ctx=vm.createContext({window,document:h.document,queueMicrotask:fn=>jobs.push(fn),CustomEvent:class{},getComputedStyle:()=>({display:'block',visibility:'visible'}),URL,location:{origin:'http://example.test'},AbortController,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/shared/room-controls.js'),'utf8'),ctx);
 const flush=()=>{while(jobs.length)jobs.shift()();};
 let state={type,code:'ABC123',me:'A',hostId:'A',host:true,phase:'waiting',version:1,players:[{id:'A'},{id:'B'},{id:'C'}]},model={setup:true,start:{enabled:true,step:'start',label:'開始'},bot:{enabled:true}},run=async()=>{};
 const binding=window.RoomControls.bindActions({type,read:()=>model,run:(...args)=>run(...args)});
 const update=changes=>{state={...state,...changes};window.RoomControls.update(state);flush();};update({});
 return {...h,window,roster,binding,flush,update,model,run(fn){run=fn;},button:kind=>h.document.querySelector('[data-room-action="'+kind+'"]'),status:()=>h.document.querySelector('.ui-room-control-status').textContent};
}
test('common actions own roster placement, serialize clicks and restore focus after failure',async()=>{
 const f=fixture();assert.equal(f.button('start').disabled,false);const bot=f.roster.querySelector('button');assert.ok(bot);assert.equal(f.node('controls').querySelector('[data-room-action="bot"]').hidden,true);
 let reject,calls=0;f.run(()=>{calls++;return new Promise((_resolve,no)=>reject=no);});bot.focus();const pending=bot.onclick();assert.equal(bot.disabled,true);assert.equal(f.button('start').disabled,true);await bot.onclick();assert.equal(calls,1);
 reject(Error('請重試'));await pending;assert.equal(f.status(),'請重試');assert.equal(bot.disabled,false);assert.equal(f.document.activeElement,bot);
 f.run(async()=>{calls++;});await bot.onclick();assert.equal(calls,2);assert.equal(f.status(),'');
});
test('common actions enforce host, capacity and phase at invocation as well as rendering',async()=>{
 const f=fixture();let calls=0;f.run(async()=>{calls++;});const start=f.button('start');
 f.update({host:false,hostId:'B'});assert.equal(start.disabled,true);assert.equal(f.roster.children.length,0);await start.onclick();assert.equal(calls,0);
 f.update({host:true,hostId:'A'});f.model.bot.enabled=false;f.binding.refresh();f.flush();assert.equal(f.roster.querySelector('button').disabled,true);await f.roster.querySelector('button').onclick();assert.equal(calls,0);
 f.model.setup=false;f.update({phase:'playing'});assert.equal(start.hidden,true);await start.onclick();assert.equal(calls,0);
 f.model.setup=true;f.model.start.step='prepare';f.model.start.label='下一手';f.update({phase:'finished'});let step;f.run(async action=>{step=action;});await start.onclick();assert.equal(step,'prepare');assert.equal(start.textContent,'下一手');
});
test('result actions use the declared host and settings are exposed only for supported phases',()=>{
 for(const type of ['draw','bluff','telephone','quacks']){
  const f=fixture(type);f.model.host=f.node('resultActions');f.update({phase:'finished'});assert.equal(f.button('start').parentElement,f.node('resultActions'));assert.equal(f.document.querySelector('.ui-room-settings-card').hidden,false);
 }
 const f=fixture();f.update({phase:'finished'});assert.equal(f.document.querySelector('.ui-room-settings-card').hidden,true);
});
test('late action rejection cannot write feedback into another room',async()=>{
 const f=fixture();let reject;f.run(()=>new Promise((_yes,no)=>reject=no));const pending=f.button('start').onclick();f.update({code:'DEF456'});reject(Error('old room error'));await pending;assert.equal(f.status(),'');assert.equal(f.button('start').disabled,false);
});
test('tutorial snapshots and lobby navigation do not become live-room leave operations',()=>{
 const f=fixture();f.window.RaceLesson={};f.window.RoomControls.update({code:'OTHER1',me:'P',version:2});f.flush();assert.equal(f.window.RoomControls.inviteContext().code,'ABC123');
 const link=f.document.createElement('a');link.setAttribute('href','/');link.href='http://example.test/';f.document.body.append(link);const event=link.dispatch('click',{button:0});assert.equal(event.defaultPrevented,false);
});

test('changing a settings source preserves unrelated native actions',()=>{
 const f=fixture('majority'),slot=f.document.querySelector('.ui-room-settings-slot');
 const previous=f.document.createElement('div');previous.className='room-settings-panel';f.node('controls').append(previous);f.update({version:2});
 assert.equal(previous.parentElement,slot);
 const control=f.document.createElement('button');control.textContent='其他原生操作';let calls=0;control.onclick=()=>calls++;slot.append(control);
 const next=f.document.createElement('div');next.className='room-settings-panel';f.node('controls').append(next);f.update({version:3});
 assert.equal(next.parentElement,slot);assert.equal(previous.isConnected,false);assert.equal(control.parentElement,slot);control.onclick();assert.equal(calls,1);
 f.update({version:4});assert.equal(next.parentElement,slot);assert.equal(control.parentElement,slot);
});

test('majority command adapter permits solo cruel play and enforces team and normal minimums',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/majority.js'),'utf8'),start=source.indexOf('const roomActions='),end=source.indexOf('let focusTimer=',start);
 assert.ok(start>=0&&end>start,'majority command adapter declaration exists');
 const actions=require('./helpers/room-actions.cjs')(),scope={window:{RoomControls:actions},state:{phase:'waiting',players:[{id:'A'}],cruel:{rules:'individual'}},busy:false,roomAction(){}};
 vm.runInNewContext(source.slice(start,end),scope,{filename:'majority-command-adapter'});
 const enabled=()=>actions.binding.read().start.enabled;
 assert.equal(enabled(),true);scope.state.cruel.rules='teams';assert.equal(enabled(),false);
 scope.state.players=['A','B','C','D'].map(id=>({id}));assert.equal(enabled(),true);
 scope.state.players[3].kicked=true;assert.equal(enabled(),false);
 scope.state.cruel=null;assert.equal(enabled(),true);scope.state.players.pop();scope.state.players.pop();assert.equal(enabled(),false);
 scope.state.players.push({id:'C'});scope.busy=true;assert.equal(enabled(),false);
});
