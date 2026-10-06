const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/race-dice-dialog.js'),'utf8');
test('shared dice artwork has exactly one to six separated pips and rejects invalid faces',()=>{
 const window={};vm.runInNewContext(source,{window});
 for(let value=1;value<=6;value++){
  const svg=window.RaceDiceDialog.faceMarkup(value);
  assert.equal((svg.match(/<circle /g)||[]).length,value);
  assert.match(svg,/<svg[^>]*aria-hidden="true"/);
  assert.match(svg,/<rect[^>]*fill="#fffaf0"/);
 }
 for(const value of [0,7,1.5,'1',null])assert.equal(window.RaceDiceDialog.faceMarkup(value),'');
});
function harness({reduced=false,time=10000,onAction=()=>{},enabled=true}={}){
 let clock=time,nextTimer=0;const timers=new Map();let document;
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs={};this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.listeners=new Map();this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.className='';this.isConnected=false;}
  append(...items){for(const item of items){item.parentElement=this;item.isConnected=this.isConnected;this.children.push(item);}}
  replaceChildren(...items){for(const item of this.children){item.parentElement=null;item.isConnected=false;}this.children=[];this.append(...items);}
  setAttribute(name,value){this.attrs[name]=String(value);}getAttribute(name){return this.attrs[name]??null;}removeAttribute(name){delete this.attrs[name];}
  addEventListener(type,callback){const callbacks=this.listeners.get(type)||[];callbacks.push(callback);this.listeners.set(type,callbacks);}
  fire(type,properties={}){const event={target:this,defaultPrevented:false,propagationStopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...properties};for(const callback of this.listeners.get(type)||[])callback(event);return event;}
  contains(target){return target===this||this.children.some(child=>child.contains(target));}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;this.modalShows=(this.modalShows||0)+1;}
  close(){this.open=false;this.fire('close');}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;this.isConnected=false;}
 }
 const head=new Element('head'),body=new Element('body');head.isConnected=body.isConnected=true;
 const all=(element=body)=>[element,...element.children.flatMap(child=>all(child))];
 document={head,body,activeElement:null,createElement:tag=>new Element(tag),getElementById:id=>[...all(head),...all(body)].find(el=>el.id===id)||null};
 const trigger=document.createElement('button');body.append(trigger);trigger.focus();
 const prefs=new Set(),window={MotionPolicy:{get:()=>({enabled}),allowsMotion:()=>enabled&&!reduced,subscribe(fn){prefs.add(fn);fn();return()=>prefs.delete(fn);}},document,matchMedia:()=>({matches:reduced}),setTimeout(callback,ms){const id=++nextTimer;timers.set(id,{callback,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,{window,Date:{now:()=>clock}});
 const api=window.RaceDiceDialog.mount({onAction}),dialog=all().find(el=>el.tagName==='DIALOG');
 const find=className=>all(dialog).find(el=>el.className.split(/\s+/).includes(className));
 const button=action=>all(dialog).find(el=>el.dataset.diceAction===action);
 const text=(el=dialog)=>String(el.textContent||'')+el.children.map(child=>text(child)).join(' ');
 function advance(ms){const end=clock+ms;for(;;){const entries=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);if(!entries.length)break;const [id,timer]=entries[0];clock=timer.at;timers.delete(id);timer.callback();}clock=end;}
 return{api,dialog,document,trigger,timers,all,find,button,text,advance,prefs,setEnabled(value){enabled=value;for(const fn of prefs)fn();},get now(){return clock;}};
}
function check(overrides={}){
 return{id:'C1',kind:'collision',title:'碰撞判定',condition:'依受推車與推進方向兩顆骰子結算。',owner:'A',status:'awaiting',participants:[{id:'A',name:'甲車隊',color:'#d0855a',car:{size:0},label:'進入車'},{id:'B',name:'乙車隊',color:'#63a184',car:{size:2},label:'原位車'}],dice:[{label:'受推車',faces:['進入車','原位車']},{label:'推進方向',faces:[1,2,3,4,5,6]}],...overrides};
}
const state=(diceCheck,me='A')=>({me,diceCheck});

test('awaiting check keeps condition, both participants and unknown faces visible; only owner can roll',()=>{
 const calls=[],h=harness({onAction:(action,data)=>calls.push([action,data])}),c=check();h.api.show(state(c));
 assert.equal(h.dialog.open,true);assert.match(h.text(),/碰撞判定.*依受推車.*甲車隊.*進入車.*乙車隊.*原位車/s);assert.equal(h.dialog.dataset.stage,'awaiting');
 assert.equal(h.button('rollDice').hidden,false);assert.equal(h.button('acceptDice').hidden,true);assert.equal(h.button('rerollDice').hidden,true);
 for(const face of h.all().filter(el=>el.className==='race-dice-face'))assert.equal(face.textContent,'?');
 h.api.show(state(c,'B'));assert.equal(h.button('rollDice').hidden,true);h.button('rollDice').fire('click');assert.equal(calls.length,0);assert.match(h.find('race-dice-status').textContent,/等待 甲車隊 擲骰/);
 h.api.show(state(c));h.button('rollDice').fire('click');assert.equal(calls[0][0],'rollDice');assert.equal(calls[0][1].check,'C1');
});

test('rolling masks an early cached result for a full local second despite short server time and clock skew',()=>{
 const h=harness({time:700000}),rolling=check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1900});h.api.show(state(rolling));assert.equal(h.dialog.dataset.stage,'rolling');
 h.advance(100);const result=check({...rolling,status:'result',serverNow:2000,result:{faces:['ENTERED_RESULT',999],text:'SECRET_RESULT_TEXT'}});h.api.show(state(result));
 assert.equal(h.dialog.dataset.stage,'rolling');assert.doesNotMatch(h.text(),/ENTERED_RESULT|999|SECRET_RESULT_TEXT/);assert.equal(h.button('acceptDice').hidden,true);
 h.advance(899);assert.equal(h.dialog.dataset.stage,'rolling');assert.doesNotMatch(h.text(),/SECRET_RESULT_TEXT/);
 h.advance(1);assert.equal(h.dialog.dataset.stage,'result');assert.match(h.text(),/ENTERED_RESULT.*999.*SECRET_RESULT_TEXT/s);assert.equal(h.button('acceptDice').hidden,false);
});

test('same-cycle polling preserves button identity, focus and original reveal deadline',()=>{
 const h=harness(),rolling=check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000});h.api.show(state(rolling));const action=h.button('acceptDice'),title=h.find('race-dice-header').children[0];title.focus();
 h.advance(700);h.api.show(state(check({...rolling,serverNow:1700})));assert.equal(h.button('acceptDice'),action);assert.equal(h.document.activeElement,title);assert.equal(h.dialog.modalShows,1);
 h.api.show(state(check({...rolling,status:'result',serverNow:2000,result:{faces:['原位車',3],text:'推進前右。'}})));h.advance(300);assert.equal(h.dialog.dataset.stage,'result');action.focus();
 h.api.show(state(check({...rolling,status:'result',serverNow:2500,result:{faces:['原位車',3],text:'推進前右。'}})));assert.equal(h.button('acceptDice'),action);assert.equal(h.document.activeElement,action);assert.equal(h.dialog.dataset.stage,'result');
});

test('first snapshot containing only a result reveals directly without replay; non-owner cannot accept or reroll',()=>{
 const calls=[],h=harness({onAction:(action,data)=>calls.push([action,data])}),result=check({status:'result',startedAt:1000,readyAt:2000,serverNow:3000,rerollAllowed:true,result:{faces:['原位車',4],text:'依結果推車。'}});
 h.api.show(state(result,'B'));assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.button('acceptDice').hidden,true);assert.equal(h.button('rerollDice').hidden,true);
 h.button('acceptDice').fire('click');h.button('rerollDice').fire('click');assert.equal(calls.length,0);
 h.api.show(state(result));assert.equal(h.button('acceptDice').hidden,false);assert.equal(h.button('rerollDice').hidden,false);assert.equal(h.timers.size,0);
 h.button('rerollDice').fire('click');assert.equal(calls[0][0],'rerollDice');assert.equal(calls[0][1].check,'C1');
});

test('reroll gets a fresh cycle and cannot reuse or show the preceding result',()=>{
 const h=harness(),first=check({status:'result',startedAt:1000,readyAt:2000,result:{faces:['原位車',6],text:'FIRST_RESULT'}});h.api.show(state(first));
 const rolling=check({status:'rolling',startedAt:5000,readyAt:6000,serverNow:5900});h.api.show(state(rolling));assert.equal(h.dialog.dataset.stage,'rolling');assert.doesNotMatch(h.text(),/FIRST_RESULT/);
 h.api.show(state(check({...rolling,status:'result',serverNow:6000,rerollAllowed:false,result:{faces:['進入車',1],text:'SECOND_RESULT'}})));h.advance(999);assert.doesNotMatch(h.text(),/SECOND_RESULT/);h.advance(1);assert.match(h.text(),/SECOND_RESULT/);assert.equal(h.button('rerollDice').hidden,true);
});

test('rolling timeout never invents a result; incomplete results remain blocked',()=>{
 const h=harness(),rolling=check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000});h.api.show(state(rolling));h.advance(1000);
 assert.equal(h.dialog.dataset.stage,'waiting');assert.equal(h.button('acceptDice').hidden,true);assert.equal(h.find('race-dice-result').textContent,'');
 h.api.show(state(check({...rolling,status:'result',serverNow:2100,result:{faces:[1],text:'INCOMPLETE_RESULT'}})));assert.equal(h.dialog.dataset.stage,'waiting');assert.doesNotMatch(h.text(),/INCOMPLETE_RESULT/);assert.equal(h.button('acceptDice').hidden,true);
});

test('reduced motion keeps faces unknown and observes the same masking delay',()=>{
 const h=harness({reduced:true}),rolling=check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1700});h.api.show(state(rolling));
 for(const face of h.all().filter(el=>el.className==='race-dice-face'))assert.equal(face.textContent,'?');assert.equal(h.timers.size,1);
 h.api.show(state(check({...rolling,status:'result',serverNow:2000,result:{faces:['原位車',5],text:'FINAL_RESULT'}})));h.advance(999);assert.doesNotMatch(h.text(),/FINAL_RESULT/);h.advance(1);assert.equal(h.dialog.dataset.stage,'result');assert.match(h.text(),/FINAL_RESULT/);
});

test('rolling hydration remains static on later polls, and shared disable cancels cosmetics without revealing early results',()=>{
 const rolling=check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000}),result=check({...rolling,status:'result',serverNow:2000,result:{faces:['原位車',5],text:'FINAL_RESULT'}});
 const hydrated=harness();hydrated.api.show(state(rolling),{live:false});assert.equal(hydrated.dialog.dataset.motion,'false');assert.equal(hydrated.timers.size,1);hydrated.api.show(state(rolling),{live:true});assert.equal(hydrated.dialog.dataset.motion,'false');
 const h=harness();h.api.show(state(rolling));assert.equal(h.dialog.dataset.motion,'true');assert.equal(h.timers.size,2);h.advance(200);h.setEnabled(false);assert.equal(h.dialog.dataset.motion,'false');assert.equal(h.timers.size,1);h.api.show(state(result));assert.doesNotMatch(h.text(),/FINAL_RESULT/);
 h.setEnabled(true);assert.equal(h.dialog.dataset.motion,'false');h.advance(799);assert.doesNotMatch(h.text(),/FINAL_RESULT/);h.advance(1);assert.match(h.text(),/FINAL_RESULT/);h.api.destroy();assert.equal(h.prefs.size,0);
});

test('four crews retain all sixteen dice, plus a separate shared road die and full result text',()=>{
 const h=harness(),participants=Array.from({length:4},(_,index)=>({id:'P'+index,name:'車隊 '+index,color:'#ab7654'})),dice=participants.flatMap(p=>Array.from({length:4},(_,index)=>({participant:p.id,label:'行動骰 '+(index+1),faces:[1,2,3,4,5,6]})));dice.push({label:'公路骰',faces:[1,1,1,2,2,3]});
 h.api.show(state(check({kind:'round',owner:'P0',participants,dice,status:'result',result:{faces:dice.map((_,index)=>index%6+1),text:'最低總和並列，全員重擲。'}}),'P0'));
 assert.equal(h.dialog.dataset.kind,'round');assert.equal(h.find('race-dice-participants').children.length,4);for(const participant of h.find('race-dice-participants').children)assert.equal(participant.children[2].children.length,4);
 assert.equal(h.find('race-dice-general').children[1].children.length,1);assert.match(h.text(),/共同公路骰.*公路骰.*最低總和並列/s);assert.equal(h.button('rerollDice').hidden,true);
 const style=h.document.head.children[0].textContent;assert.match(style,/max-height:calc\(100dvh - 32px\)/);assert.match(style,/min-height:44px/);assert.match(style,/prefers-reduced-motion/);
});

test('Escape, native cancel and unexpected close cannot bypass an active check; reset restores focus',()=>{
 const h=harness();h.api.show(state(check()));assert.equal(h.dialog.fire('cancel').defaultPrevented,true);const escape=h.dialog.fire('keydown',{key:'Escape'});assert.equal(escape.defaultPrevented,true);assert.equal(escape.propagationStopped,true);assert.equal(h.dialog.open,true);
 h.dialog.close();assert.equal(h.dialog.open,true);h.api.show(state(null));assert.equal(h.dialog.open,false);assert.equal(h.document.activeElement,h.trigger);
});

test('actions prevent duplicate submission, expose request errors and release only on changed server state',async()=>{
 let reject,calls=0;const h=harness({onAction:()=>{calls++;return new Promise((resolve,fail)=>{reject=fail;});}});h.api.show(state(check()));const roll=h.button('rollDice');roll.focus();roll.fire('click');roll.fire('click');assert.equal(calls,1);assert.equal(roll.disabled,true);assert.equal(roll.getAttribute('aria-busy'),'true');
 h.api.show(state(check()));assert.equal(roll.disabled,true);assert.equal(h.document.activeElement,roll);
 reject(Error('連線中斷，請重試'));await new Promise(resolve=>setImmediate(resolve));assert.equal(roll.disabled,false);assert.match(h.find('race-dice-error').textContent,/連線中斷/);
 roll.fire('click');assert.equal(calls,2);h.api.show(state(check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000})));assert.equal(h.find('race-dice-error').textContent,'');assert.equal(h.dialog.dataset.stage,'rolling');
});

test('owner changes update authorization and condition without replacing focused controls',()=>{
 const calls=[],h=harness({onAction:(action,data)=>calls.push([action,data])}),first=check({status:'result',result:{faces:['原位車',2],text:'等待確認。'}});h.api.show(state(first));const accept=h.button('acceptDice');accept.focus();
 h.api.show(state(check({...first,owner:'B',condition:'由乙車隊確認本次判定。'})));assert.equal(h.button('acceptDice'),accept);assert.equal(accept.hidden,true);assert.notEqual(h.document.activeElement,accept);accept.fire('click');assert.equal(calls.length,0);assert.match(h.text(),/由乙車隊確認.*等待 乙車隊 確認/s);
 h.api.show(state(check({...first,owner:'B'}),'B'));assert.equal(accept.hidden,false);accept.fire('click');assert.equal(calls[0][0],'acceptDice');
});

test('same-team collision retains two named vehicle cards and never displays private-looking car identifiers',()=>{
 const h=harness(),participants=[{id:'A',name:'甲車隊',car:'7c969cf4-e7f6-4a6b-95c0-b3bc0a5561cf',label:'進入車 · 輕型'},{id:'A',name:'甲車隊',car:'26b456b4-01d8-4947-a0e8-5f62d22f6d1c',label:'原位車 · 重型'}];h.api.show(state(check({participants})));
 const cards=h.find('race-dice-participants').children;assert.equal(cards.length,2);assert.equal(cards[0].children[0].textContent,'甲車隊');assert.equal(cards[1].children[0].textContent,'甲車隊');assert.equal(cards[0].children[1].textContent,'進入車 · 輕型');assert.equal(cards[1].children[1].textContent,'原位車 · 重型');assert.doesNotMatch(h.text(),/7c969cf4|26b456b4/);
 h.api.show(state(check({participants:participants.map(p=>({...p,name:'車隊改名'}))})));assert.equal(h.find('race-dice-participants').children[0],cards[0]);for(const card of cards)assert.equal(card.children[0].textContent,'車隊改名');
});

test('reset and destroy cancel animation timers and ignore late updates',()=>{
 const h=harness(),rolling=check({status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000});h.api.show(state(rolling));assert.ok(h.timers.size>0);h.api.reset();assert.equal(h.timers.size,0);assert.equal(h.dialog.open,false);h.advance(2000);assert.equal(h.dialog.open,false);
 h.api.show(state(rolling));h.api.destroy();assert.equal(h.dialog.isConnected,false);assert.equal(h.timers.size,0);h.api.show(state(check()));assert.equal(h.dialog.open,false);assert.equal(h.document.body.children.length,1);
});
