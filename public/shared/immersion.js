'use strict';
window.GameImmersion={mount(prefix,{focusDuration=720}={}){
 const byId=id=>document.getElementById(id);
 const motionButton=byId(prefix+'MotionToggle');
 const focus=byId(prefix+'Spotlight'),focusContent=byId(prefix+'FocusContent'),replayButton=byId(prefix+'ReplayFocus'),skipButton=byId(prefix+'SkipFocus');
 let timer=null,items=[],step=0;
 function allowsMotion(){return window.MotionPolicy?window.MotionPolicy.allowsMotion():!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches&&!document.hidden;}
 function update(){if(motionButton)motionButton.hidden=true;replayButton.hidden=!allowsMotion()||!items.length;}
 function stopFocus(){clearTimeout(timer);timer=null;focus.hidden=true;focusContent.textContent='';}
 function show(){if(step>=items.length){stopFocus();return;}focus.hidden=false;focusContent.textContent=items[step++];timer=setTimeout(show,focusDuration);}
 function prepareFocus(nextItems){items=nextItems.slice(0,3).map(String);update();}
 function startFocus(nextItems){items=nextItems.slice(0,3).map(String);stopFocus();step=0;update();if(!allowsMotion()||document.hidden||!items.length)return;show();}
 function playSound(kind){window.AudioSettings.playEffect(kind);}
 function stopSound(){window.AudioSettings.stopEffects();}
 window.MotionPolicy?.subscribe(()=>{if(!allowsMotion())stopFocus();update();});
 replayButton.onclick=()=>startFocus(items);
 skipButton.onclick=stopFocus;
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))stopFocus();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFocus();stopSound();}});
 update();return {allowsMotion,prepareFocus,startFocus,stopFocus,playSound};
}};
