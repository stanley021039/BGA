const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function mount(prefix,alwaysAnimate){
 const elements=new Map(),listeners=new Map();
 for(const suffix of ['SoundToggle','SoundControl','SoundVolume','Spotlight','FocusContent','ReplayFocus','SkipFocus',...(alwaysAnimate?[]:['MotionToggle'])]){
  elements.set(prefix+suffix,{hidden:true,textContent:'',value:'',setAttribute(){}});
 }
 let reduced=true;
 const document={getElementById:id=>elements.get(id),get hidden(){return false;},addEventListener(type,fn){listeners.set('document:'+type,fn);}};
 const window={matchMedia:()=>({get matches(){return reduced;},addEventListener(type,fn){listeners.set('motion:'+type,fn);}})};
 const localStorage={getItem:key=>key.endsWith('-motion')?'off':null,setItem(){}};
 const context={window,document,localStorage,setTimeout:()=>1,clearTimeout(){},Audio:class{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public/shared/immersion.js'),'utf8'),context);
 return {instance:window.GameImmersion.mount(prefix,{alwaysAnimate}),elements,listeners,setReduced(value){reduced=value;}};
}

test('race animation works without a toggle even with saved off and reduced-motion preference',()=>{
 const ui=mount('race',true);
 assert.equal(ui.elements.has('raceMotionToggle'),false);
 assert.equal(ui.instance.allowsMotion(),true);
 ui.instance.startFocus(['終點']);
 assert.equal(ui.elements.get('raceSpotlight').hidden,false);
 assert.equal(ui.listeners.has('motion:change'),false);
});

test('poker retains its existing motion preference',()=>{
 const ui=mount('poker',false);
 assert.equal(ui.instance.allowsMotion(),false);
 ui.elements.get('pokerMotionToggle').onclick();
 assert.equal(ui.instance.allowsMotion(),false);
 ui.setReduced(false);
 ui.listeners.get('motion:change')();
 assert.equal(ui.instance.allowsMotion(),true);
});
