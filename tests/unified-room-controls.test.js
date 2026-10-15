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

test('changing a settings source preserves unrelated native actions, and one-player cruel mode can start',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/shared/room-controls.js'),'utf8');
 const attrs=new Map(),original={dataset:{},hidden:false,disabled:false,parentElement:null,tabIndex:0,setAttribute:(k,v)=>attrs.set(k,v),hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)||null};
 const b=()=>({dataset:{},hidden:false,disabled:false,parentElement:null,getAttribute:()=>null}),row={append(n){n.parentElement=this;}};
 const controls={classList:{contains:()=>false}},previous={classList:{contains:c=>c==='ui-room-settings-source'},remove(){slot.children=slot.children.filter(n=>n!==this);}};
 const next={dataset:{},classList:{},closest:()=>null,querySelectorAll:()=>[]},slot={children:[previous,controls],prepend(n){this.children.unshift(n);},textContent:''},card={hidden:false};
 const scope={state:{type:'majority',phase:'waiting',host:true,me:'P',players:[{}],cruel:{rules:'individual'},botSupport:{supported:false,canAdd:false}},panel:{dataset:{},closest:()=>null,prepend(n){n.parentElement=this;},querySelector:s=>s==='.ui-room-settings-card'?card:s==='.ui-room-session-actions'?row:slot},native:{},proxies:{start:b(),bot:b(),leave:b(),heading:{hidden:false,parentElement:null}},leaving:false,settingsSource:previous,scheduled:false,minimumPlayers:{majority:3},actions:{start:{label:'開始遊戲',icon:'play'}},window:{GameUI:{decorateButton(){}},RoomWaiting:{setRosterBusy(){}}},getComputedStyle:()=>({display:'block',visibility:'visible'}),mount(){},findAction:()=>original,syncPlayPanels(){},normalizeFields(){},node:()=>({}),document:{body:{dataset:{}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:s=>s==='.room-settings-panel'?[next]:[]}};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf(' function owner('),source.indexOf(' function findAction('))+source.slice(source.indexOf(' function normalize(){'),source.indexOf(' function schedule(){')),scope);scope.normalize();assert.ok(slot.children.includes(controls));assert.ok(slot.children.includes(next));assert.ok(!slot.children.includes(previous));assert.equal(scope.proxies.start.disabled,false);
 scope.state.cruel.rules='teams';scope.normalize();assert.equal(scope.proxies.start.disabled,true);
});
