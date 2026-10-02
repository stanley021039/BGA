'use strict';
window.GameImmersion={mount(prefix){
 const byId=id=>document.getElementById(id);
 const motionButton=byId(prefix+'MotionToggle'),soundButton=byId(prefix+'SoundToggle'),soundControl=byId(prefix+'SoundControl'),volumeSlider=byId(prefix+'SoundVolume');
 const focus=byId(prefix+'Spotlight'),focusContent=byId(prefix+'FocusContent'),replayButton=byId(prefix+'ReplayFocus'),skipButton=byId(prefix+'SkipFocus');
 const clips=new Set(),files={confirm:'/assets/gift-sounds/confirmation_001.wav',reveal:'/assets/gift-sounds/open_001.wav'};
 let motion=true,sound=false,volume=.25,timer=null,items=[],step=0;
 try{motion=localStorage.getItem('ah-'+prefix+'-motion')!=='off';const saved=localStorage.getItem('ah-'+prefix+'-volume');if(saved!==null&&Number.isFinite(Number(saved))&&Number(saved)>=0&&Number(saved)<=1)volume=Number(saved);}catch{}
 function allowsMotion(){return motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 function update(){motionButton.textContent=allowsMotion()?'關閉演出':motion?'系統已減少動態':'開啟演出';motionButton.setAttribute('aria-pressed',String(allowsMotion()));soundButton.textContent=sound?'關閉音效':'開啟音效';soundButton.setAttribute('aria-pressed',String(sound));soundControl.hidden=!sound;volumeSlider.value=String(Math.round(volume*100));replayButton.hidden=!allowsMotion()||!items.length;}
 function stopFocus(){clearTimeout(timer);timer=null;focus.hidden=true;focusContent.textContent='';}
 function show(){if(step>=items.length){stopFocus();return;}focus.hidden=false;focusContent.textContent=items[step++];timer=setTimeout(show,720);}
 function prepareFocus(nextItems){items=nextItems.slice(0,3).map(String);update();}
 function startFocus(nextItems){items=nextItems.slice(0,3).map(String);stopFocus();step=0;update();if(!allowsMotion()||document.hidden||!items.length)return;show();}
 function playSound(kind){if(!sound||!volume||document.hidden||!files[kind])return;try{const clip=new Audio(files[kind]);clip.volume=volume;clips.add(clip);clip.onended=clip.onerror=()=>clips.delete(clip);clip.play().catch(()=>clips.delete(clip));}catch{}}
 function stopSound(){for(const clip of clips)try{clip.pause();clip.currentTime=0;}catch{}clips.clear();}
 motionButton.onclick=()=>{motion=!motion;try{localStorage.setItem('ah-'+prefix+'-motion',motion?'on':'off');}catch{}if(!allowsMotion())stopFocus();update();};
 soundButton.onclick=()=>{sound=!sound;if(!sound)stopSound();update();if(sound)playSound('confirm');};
 volumeSlider.oninput=()=>{volume=Number(volumeSlider.value)/100;try{localStorage.setItem('ah-'+prefix+'-volume',String(volume));}catch{}for(const clip of clips)clip.volume=volume;};
 replayButton.onclick=()=>startFocus(items);
 skipButton.onclick=stopFocus;
 window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change',()=>{if(!allowsMotion())stopFocus();update();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFocus();stopSound();}});
 update();return {allowsMotion,prepareFocus,startFocus,stopFocus,playSound};
}};
