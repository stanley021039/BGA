/* Personal sound preferences shared by every game; room transport stays on the server. */
(()=>{
 const key='ah-audio-settings',listeners=new Set(),effects=new Set();
 const defaults=()=>({version:1,music:{enabled:false,volume:.3},effects:{enabled:false,volume:.25}});
 const validVolume=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
 function normalize(value){const result=defaults();for(const kind of ['music','effects']){if(typeof value?.[kind]?.enabled==='boolean')result[kind].enabled=value[kind].enabled;if(validVolume(value?.[kind]?.volume))result[kind].volume=value[kind].volume;}return result;}
 function read(){try{const saved=localStorage.getItem(key);if(saved!==null)return normalize(JSON.parse(saved));const result=defaults();result.music.enabled=localStorage.getItem('ah-music-listen')==='on';for(const [kind,keys] of [['music',['ah-music-volume']],['effects',['ah-gift-volume','ah-majority-volume','ah-race-volume','ah-poker-volume']]])for(const old of keys){const raw=localStorage.getItem(old);if(raw!==null&&raw.trim()!==''&&validVolume(Number(raw))){result[kind].volume=Number(raw);break;}}return result;}catch{return defaults();}}
 let preferences=read();
 const get=()=>normalize(preferences);
 function persist(){try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}}
 function stopEffects(){for(const clip of effects){clip.pause();try{clip.currentTime=0;}catch{}}effects.clear();}
 function notify(gesture=false){const settings=get();if(!settings.effects.enabled||!settings.effects.volume)stopEffects();else for(const clip of effects)clip.volume=settings.effects.volume;for(const listener of listeners)listener(settings,{gesture});}
 function set(kind,patch,{gesture=false}={}){if(!['music','effects'].includes(kind))return;if(typeof patch.enabled==='boolean')preferences[kind].enabled=patch.enabled;if(validVolume(patch.volume))preferences[kind].volume=patch.volume;persist();notify(gesture);}
 function subscribe(listener){listeners.add(listener);listener(get(),{gesture:false});return ()=>listeners.delete(listener);}
 function bindPreview(audio){const unbind=subscribe(settings=>{audio.volume=settings.music.volume;audio.muted=!settings.music.enabled;});const play=()=>set('music',{enabled:true},{gesture:true});const change=()=>{const current=preferences.music;if(audio.volume!==current.volume||audio.muted===current.enabled)set('music',{volume:audio.volume,enabled:!audio.muted},{gesture:true});};audio.addEventListener('play',play);audio.addEventListener('volumechange',change);return ()=>{unbind();audio.removeEventListener('play',play);audio.removeEventListener('volumechange',change);};}
 function playEffect(kind,{onError}={}){const files={confirm:'/assets/gift-sounds/confirmation_001.wav',reveal:'/assets/gift-sounds/open_001.wav'},settings=preferences.effects;if(!settings.enabled||!settings.volume||document.hidden||!files[kind])return;try{const clip=new Audio(files[kind]);clip.volume=settings.volume;effects.add(clip);const release=()=>effects.delete(clip);clip.onended=release;clip.onerror=()=>{release();onError?.();};clip.play().catch(()=>{release();onError?.();});return clip;}catch{onError?.();}}
 // A saved opt-in still requires a fresh browser gesture after navigation.
 const unlock=event=>{if(event.isTrusted)notify(true);};
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEffects();});window.addEventListener('pagehide',stopEffects);
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preferences=read();notify();}});
 persist();window.AudioSettings={get,set,subscribe,bindPreview,playEffect,stopEffects};
})();
