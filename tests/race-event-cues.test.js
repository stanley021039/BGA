const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function presenter(){
 const listeners=new Map(),elements=new Map();
 for(const id of ['raceEventPopup','raceEventTitle','raceEventDetail','raceEventSymbol','raceEventSkip','raceMotionToggle'])elements.set(id,{hidden:id==='raceEventPopup',dataset:{},textContent:'',addEventListener(type,fn){listeners.set(id+':'+type,fn);}});
 let reduced=false,hidden=false,nextTimer=0;
 const timers=new Map(),document={getElementById:id=>elements.get(id),addEventListener(type,fn){listeners.set('document:'+type,fn);},get hidden(){return hidden;}};
 const window={matchMedia:()=>({get matches(){return reduced;},addEventListener(type,fn){listeners.set('motion:'+type,fn);}})};
 const context={window,document,setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public/shared/race-event-cues.js'),'utf8'),context);
 const cues=window.RaceEventCues.mount({allowsMotion:()=>!reduced});
 return {cues,elements,listeners,timers,setReduced(value){reduced=value;},setHidden(value){hidden=value;}};
}

test('race event card prefers a collision and treats event text as text',()=>{
 const ui=presenter(),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:1,kind:'hazard',hazard:'mine',text:'地雷'},{id:2,kind:'shot',hit:true,text:'射擊命中'},{id:3,kind:'slam',text:'<img src=x onerror=alert(1)>'}]);
 assert.equal(panel.hidden,false);
 assert.equal(panel.dataset.kind,'slam');
 assert.equal(ui.elements.get('raceEventTitle').textContent,'車輛碰撞');
 assert.equal(ui.elements.get('raceEventDetail').textContent,'<img src=x onerror=alert(1)>');
 assert.equal(ui.timers.size,1);
 ui.cues.show([]);
 assert.equal(ui.timers.size,1);
 ui.listeners.get('raceEventSkip:click')();
 assert.equal(panel.hidden,true);
 assert.equal(ui.timers.size,0);
});

test('race event card handles hazards, misses and reduced motion',()=>{
 const ui=presenter(),panel=ui.elements.get('raceEventPopup');
 ui.cues.show([{id:4,kind:'hazard',hazard:'worm',text:'沙蟲出現'}]);
 assert.equal(ui.elements.get('raceEventSymbol').textContent,'〰');
 ui.cues.show([{id:5,kind:'shot',hit:false,text:'未命中'}]);
 assert.equal(ui.elements.get('raceEventTitle').textContent,'射擊落空');
 assert.equal(panel.dataset.hit,'miss');
 ui.setReduced(true);
 ui.listeners.get('motion:change')();
 assert.equal(panel.hidden,true);
 ui.cues.show([{id:6,kind:'slam',text:'碰撞'}]);
 assert.equal(panel.hidden,true);
 ui.setReduced(false);
 ui.cues.show([{id:7,kind:'jump',text:'飛躍'}]);
 ui.setHidden(true);
 ui.listeners.get('document:visibilitychange')();
 assert.equal(panel.hidden,true);
});
