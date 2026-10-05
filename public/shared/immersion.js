'use strict';
window.GameImmersion={mount(prefix,{alwaysAnimate=false,focusDuration=720}={}){
 const byId=id=>document.getElementById(id);
 const motionButton=byId(prefix+'MotionToggle');
 const focus=byId(prefix+'Spotlight'),focusContent=byId(prefix+'FocusContent'),replayButton=byId(prefix+'ReplayFocus'),skipButton=byId(prefix+'SkipFocus');
 let motion=true,timer=null,items=[],step=0;
 try{if(!alwaysAnimate)motion=localStorage.getItem('ah-'+prefix+'-motion')!=='off';}catch{}
 function allowsMotion(){return alwaysAnimate||motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 function update(){if(motionButton){motionButton.textContent=allowsMotion()?'關閉演出':motion?'系統已減少動態':'開啟演出';motionButton.setAttribute('aria-pressed',String(allowsMotion()));}replayButton.hidden=!allowsMotion()||!items.length;}
 function stopFocus(){clearTimeout(timer);timer=null;focus.hidden=true;focusContent.textContent='';}
 function show(){if(step>=items.length){stopFocus();return;}focus.hidden=false;focusContent.textContent=items[step++];timer=setTimeout(show,focusDuration);}
 function prepareFocus(nextItems){items=nextItems.slice(0,3).map(String);update();}
 function startFocus(nextItems){items=nextItems.slice(0,3).map(String);stopFocus();step=0;update();if(!allowsMotion()||document.hidden||!items.length)return;show();}
 function playSound(kind){window.AudioSettings.playEffect(kind);}
 function stopSound(){window.AudioSettings.stopEffects();}
 if(motionButton)motionButton.onclick=()=>{motion=!motion;try{localStorage.setItem('ah-'+prefix+'-motion',motion?'on':'off');}catch{}if(!allowsMotion())stopFocus();update();};
 replayButton.onclick=()=>startFocus(items);
 skipButton.onclick=stopFocus;
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))stopFocus();});
 if(!alwaysAnimate)window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change',()=>{if(!allowsMotion())stopFocus();update();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFocus();stopSound();}});
 update();return {allowsMotion,prepareFocus,startFocus,stopFocus,playSound};
}};
