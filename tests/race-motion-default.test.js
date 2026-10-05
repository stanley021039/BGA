const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./helpers/motion');
function mount(prefix,options={}){
 const h=fixture(options),elements=new Map();for(const suffix of ['MotionToggle','Spotlight','FocusContent','ReplayFocus','SkipFocus'])elements.set(prefix+suffix,{hidden:true,textContent:'',setAttribute(){}});
 h.document.getElementById=id=>elements.get(id);h.document.querySelector=()=>null;h.window.AudioSettings={stopEffects(){}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/shared/immersion.js'),'utf8'),h.context);
 return{...h,elements,instance:h.window.GameImmersion.mount(prefix,{alwaysAnimate:true,focusDuration:2200})};
}
test('race respects OS reduced motion even if a legacy caller requests alwaysAnimate',()=>{
 const ui=mount('race',{reduced:true});assert.equal(ui.instance.allowsMotion(),false);ui.instance.startFocus(['終點']);assert.equal(ui.elements.get('raceSpotlight').hidden,true);assert.equal(ui.elements.get('raceMotionToggle').hidden,true);
});
test('shared preferences stop an active focus without replaying it after re-enabling or returning from hidden',()=>{
 const ui=mount('poker');ui.instance.startFocus(['結果']);assert.equal(ui.elements.get('pokerSpotlight').hidden,false);assert.equal(ui.timers.size,1);
 ui.policy.set({enabled:false});assert.equal(ui.elements.get('pokerSpotlight').hidden,true);assert.equal(ui.timers.size,0);ui.policy.set({enabled:true});assert.equal(ui.elements.get('pokerSpotlight').hidden,true);
 ui.elements.get('pokerReplayFocus').onclick();assert.equal(ui.elements.get('pokerSpotlight').hidden,false);ui.hide(true);assert.equal(ui.elements.get('pokerSpotlight').hidden,true);assert.equal(ui.timers.size,0);ui.hide(false);assert.equal(ui.elements.get('pokerSpotlight').hidden,true);
});
