const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function presenter(options={}){
 const listeners=new Map(),elements=new Map();
 for(const id of ['raceEventPopup','raceEventTitle','raceEventDetail','raceEventSymbol','raceEventSkip'])elements.set(id,{hidden:id==='raceEventPopup',dataset:{},style:{},textContent:'',addEventListener(type,fn){listeners.set(id+':'+type,fn);}});
 const stageBounds={left:100,top:50,width:800,height:400,...options.stage},carBounds={left:600,top:230,width:40,height:30,...options.car};
 const stage={getBoundingClientRect:()=>stageBounds};
 const car={dataset:{car:'car-1'},getBoundingClientRect:()=>carBounds};
 const tiles=new Map(Object.entries(options.tiles||{}).map(([key,bounds])=>[key,{getBoundingClientRect:()=>bounds}]));
 const panel=elements.get('raceEventPopup');Object.assign(panel,{style:{},closest:()=>stage});
 Object.defineProperties(panel,{offsetWidth:{get:()=>Math.min(290,parseFloat(panel.style.maxWidth)||290)},offsetHeight:{get:()=>Math.min(180,parseFloat(panel.style.maxHeight)||180)}});
 let hidden=false,nextTimer=0;
 const timers=new Map(),delays=new Map(),document={getElementById:id=>elements.get(id),querySelectorAll:()=>options.noCar?[]:[car],querySelector(selector){const cell=selector.match(/\[data-x="(-?\d+)"\]\[data-y="(-?\d+)"\]/);return cell?tiles.get(cell[1]+','+cell[2])||null:options.noCar?null:car;},addEventListener(type,fn){listeners.set('document:'+type,fn);},get hidden(){return hidden;}};
 const window={...options.viewport,addEventListener(type,fn){listeners.set('window:'+type,fn);}};
 const context={window,document,setTimeout(fn,delay){const id=++nextTimer;timers.set(id,fn);delays.set(id,delay);return id;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public/shared/race-event-cues.js'),'utf8'),context);
 const cues=window.RaceEventCues.mount({allowsMotion:()=>options.motion!==false});
 return {cues,elements,listeners,timers,delays,stageBounds,carBounds,window,setHidden(value){hidden=value;}};
}

test('race event card prefers a collision and treats event text as text',()=>{
 const ui=presenter(),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:1,kind:'hazard',hazard:'mine',text:'地雷'},{id:2,kind:'shot',hit:true,text:'射擊命中'},{id:3,kind:'slam',car:'car-1',text:'<img src=x onerror=alert(1)>'}]);
 assert.equal(panel.hidden,false);
 assert.equal(panel.dataset.kind,'slam');assert.equal(panel.style.left,'375px');assert.equal(panel.style.top,'105px');assert.equal(panel.style.right,'auto');
 assert.equal(ui.elements.get('raceEventTitle').textContent,'連鎖賽道事件');
 assert.equal(ui.elements.get('raceEventDetail').textContent,'危險揭露：地雷\n射擊事件：射擊命中\n車輛碰撞：<img src=x onerror=alert(1)>');
 assert.equal(ui.timers.size,1);
 ui.cues.show([]);
 assert.equal(ui.timers.size,1);
 ui.listeners.get('raceEventSkip:click')();
 assert.equal(panel.hidden,true);
 assert.equal(ui.timers.size,0);
});

test('race event card handles hazards, misses and background tabs without a motion toggle',()=>{
 const ui=presenter(),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:4,kind:'hazard',hazard:'worm',text:'沙蟲出現'}]);
 assert.equal(ui.elements.get('raceEventSymbol').textContent,'〰');
 ui.cues.show([{id:5,kind:'shot',hit:false,text:'未命中'}]);
 assert.equal(ui.elements.get('raceEventTitle').textContent,'射擊落空');
 assert.equal(panel.dataset.hit,'miss');
 ui.cues.show([{id:6,kind:'slam',text:'碰撞'}]);
 assert.equal(panel.hidden,false);
 ui.cues.show([{id:7,kind:'jump',text:'飛躍'}]);
 ui.setHidden(true);
 ui.listeners.get('document:visibilitychange')();
 assert.equal(panel.hidden,true);
});

test('race event card stays inside the visible stage intersection and follows scrolling',()=>{
 const ui=presenter({viewport:{innerWidth:300,innerHeight:200},stage:{left:-200,top:150},car:{left:250,top:170}}),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:1,kind:'slam',car:'car-1',text:'碰撞'}]);
 const bounds=()=>({left:parseFloat(panel.style.left)+ui.stageBounds.left,top:parseFloat(panel.style.top)+ui.stageBounds.top,width:panel.offsetWidth,height:panel.offsetHeight});
 assert.deepEqual(bounds(),{left:8,top:158,width:284,height:34});
 Object.assign(ui.stageBounds,{top:-250});Object.assign(ui.carBounds,{top:40});ui.listeners.get('document:scroll')();
 const after=bounds();assert.equal(after.top,8);assert.equal(after.height,134);assert(after.left>=8&&after.left+after.width<=292);
 ui.window.innerHeight=100;ui.listeners.get('window:resize')();assert(bounds().top+bounds().height<=92);
 ui.stageBounds.top=250;ui.listeners.get('document:scroll')();assert.equal(panel.hidden,true);
});

test('race event card uses nearby space above a car when the full card fits',()=>{
 const ui=presenter({viewport:{innerWidth:1000,innerHeight:600},car:{top:350}}),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:1,kind:'damage',car:'car-1',text:'受損'}]);
 assert.equal(parseFloat(panel.style.top)+ui.stageBounds.top+panel.offsetHeight,342);
});

test('reduced motion preserves event text for the full reading period',()=>{
 const ui=presenter({motion:false}),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:1,kind:'hazard',hazard:'glass',text:'踩中玻璃：檢定輪胎受損。'}]);
 assert.equal(panel.hidden,false);assert.equal(ui.elements.get('raceEventDetail').textContent,'踩中玻璃：檢定輪胎受損。');assert.equal([...ui.delays.values()].at(-1),3200);
 [...ui.timers.values()][0]();assert.equal(panel.hidden,true);
});

test('one checkpoint keeps every supported event readable in event order while its symbol uses the highest priority',()=>{
 const ui=presenter();
 const events=[{id:12,kind:'damage',text:'輪胎受損'},{id:10,kind:'glass',text:'滑到下一格'},{id:13,kind:'shot',hit:false,text:'子彈擦身而過'},{id:11,kind:'hazard',hazard:'oil',text:'踩到油漬'}];
 ui.cues.show(events);
 assert.deepEqual(events.map(event=>event.id),[12,10,13,11]);
 assert.equal(ui.elements.get('raceEventDetail').textContent,'玻璃滑移：滑到下一格\n危險揭露：踩到油漬\n車輛受損：輪胎受損\n射擊落空：子彈擦身而過');
 assert.equal(ui.elements.get('raceEventDetail').style.whiteSpace,'pre-line');
 assert.equal(ui.elements.get('raceEventSymbol').textContent,'⚙');
 assert.equal(ui.elements.get('raceEventPopup').dataset.kind,'damage');
 ui.cues.show([{id:14,kind:'glass',text:'玻璃讓車子繼續滑移'}]);
 assert.equal(ui.elements.get('raceEventTitle').textContent,'玻璃滑移');
 assert.equal(ui.elements.get('raceEventSymbol').textContent,'◇');
});

test('checkpoint duration can be 1600ms and the ordinary card still defaults to 3200ms without notifying skip',()=>{
 const ui=presenter();let skipped=0;
 ui.cues.show([{id:1,kind:'glass',text:'滑移'}],[],{duration:1600,onSkip:()=>skipped++});
 assert.equal([...ui.delays.values()].at(-1),1600);
 [...ui.timers.values()][0]();
 assert.equal(ui.elements.get('raceEventPopup').hidden,true);
 ui.listeners.get('raceEventSkip:click')();assert.equal(skipped,0);
 ui.cues.show([{id:2,kind:'damage',text:'受損'}]);
 assert.equal([...ui.delays.values()].at(-1),3200);
});

test('an event cell anchors the card before the car final position, with car and cell fallbacks',()=>{
 const ui=presenter({tiles:{'2,1':{left:240,top:250,width:40,height:30}}}),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:1,kind:'glass',car:'car-1',x:2,y:1,text:'在事件格滑移'}],[{id:'car-1',x:8,y:1}]);
 assert.equal(panel.style.left,'15px');assert.equal(panel.style.top,'12px');
 ui.cues.show([{id:2,kind:'glass',car:'car-1',x:99,y:99,text:'格子已不在地圖'}]);
 assert.equal(panel.style.left,'375px');assert.equal(panel.style.top,'105px');
 const noCar=presenter({noCar:true,tiles:{'2,1':{left:240,top:250,width:40,height:30}}});
 noCar.cues.show([{id:1,kind:'glass',car:'car-1',text:'車輛節點不存在'}],[{id:'car-1',x:2,y:1}]);
 assert.equal(noCar.elements.get('raceEventPopup').style.left,'15px');
});

test('skip and Escape notify only the visible checkpoint once, and replacement never keeps the old callback',()=>{
 const ui=presenter();let old=0,current=0;
 ui.cues.show([{id:1,kind:'glass',text:'舊事件'}],[],{onSkip:()=>old++});
 ui.cues.show([{id:2,kind:'damage',text:'新事件'}],[],{onSkip:()=>current++});
 ui.listeners.get('document:keydown')({key:'Escape'});
 ui.listeners.get('raceEventSkip:click')();
 ui.listeners.get('document:keydown')({key:'Escape'});
 assert.equal(old,0);assert.equal(current,1);assert.equal(ui.timers.size,0);
 ui.cues.show([{id:3,kind:'glass',text:'沒有回呼'}]);
 ui.listeners.get('raceEventSkip:click')();assert.equal(old,0);assert.equal(current,1);
});

test('ordinary hide, a background tab and an offscreen stage clear callbacks without skipping the timeline',()=>{
 const ui=presenter();let skipped=0;
 const show=id=>ui.cues.show([{id,kind:'glass',text:'滑移'}],[],{onSkip:()=>skipped++});
 show(1);ui.cues.hide();ui.listeners.get('document:keydown')({key:'Escape'});
 show(2);ui.setHidden(true);ui.listeners.get('document:visibilitychange')();ui.listeners.get('raceEventSkip:click')();
 ui.setHidden(false);ui.cues.show([{id:3,kind:'glass',text:'新卡沒有回呼'}]);ui.listeners.get('raceEventSkip:click')();
 show(4);ui.stageBounds.top=1000;ui.window.innerHeight=500;ui.listeners.get('window:resize')();ui.listeners.get('raceEventSkip:click')();
 assert.equal(skipped,0);assert.equal(ui.elements.get('raceEventPopup').hidden,true);assert.equal(ui.timers.size,0);
});
