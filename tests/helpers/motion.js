const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function events(target={}){
 const listeners=new Map();
 return Object.assign(target,{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type,event={}){for(const fn of [...listeners.get(type)||[]])fn(event);}});
}
function fixture({reduced=false,saved=null,legacy={}}={}){
 let now=1000,nextTimer=0;const timers=new Map(),storage=new Map([...Object.entries(legacy),...(saved?[['ah-motion-settings',JSON.stringify(saved)]]:[])]),classes=new Set(),media=events({matches:reduced});
 const document=events({hidden:false,documentElement:{classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}}}}),window=events({document,matchMedia:()=>media});
 const context=vm.createContext({window,document,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},Date:{now:()=>now},setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../public/shared/motion-policy.js'),'utf8'),context);
 context.MotionPolicy=window.MotionPolicy;
 function tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;const[id,timer]=next;now=timer.at;timers.delete(id);timer.fn();}now=end;}
 return{context,window,document,media,storage,classes,timers,tick,policy:window.MotionPolicy,get now(){return now;},hide(hidden){document.hidden=hidden;document.dispatch('visibilitychange');},reduce(value){media.matches=value;media.dispatch('change');}};
}
module.exports={fixture,events};
