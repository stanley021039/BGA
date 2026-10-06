const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function presenter(options={}){
 const listeners=new Map(),elements=new Map();
 for(const id of ['raceEventPopup','raceEventTitle','raceEventDetail','raceEventSymbol','raceEventSkip'])elements.set(id,{hidden:id==='raceEventPopup',dataset:{},textContent:'',addEventListener(type,fn){listeners.set(id+':'+type,fn);}});
 const stageBounds={left:100,top:50,width:800,height:400,...options.stage},carBounds={left:600,top:230,width:40,height:30,...options.car};
 const stage={getBoundingClientRect:()=>stageBounds};
 const car={dataset:{car:'car-1'},getBoundingClientRect:()=>carBounds};
 const panel=elements.get('raceEventPopup');Object.assign(panel,{style:{},closest:()=>stage});
 Object.defineProperties(panel,{offsetWidth:{get:()=>Math.min(290,parseFloat(panel.style.maxWidth)||290)},offsetHeight:{get:()=>Math.min(180,parseFloat(panel.style.maxHeight)||180)}});
 let hidden=false,nextTimer=0;
 const timers=new Map(),delays=new Map(),document={getElementById:id=>elements.get(id),querySelectorAll:()=>[car],querySelector:()=>car,addEventListener(type,fn){listeners.set('document:'+type,fn);},get hidden(){return hidden;}};
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
 assert.equal(ui.elements.get('raceEventTitle').textContent,'車輛碰撞');
 assert.equal(ui.elements.get('raceEventDetail').textContent,'<img src=x onerror=alert(1)>');
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
