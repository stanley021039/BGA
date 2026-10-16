/* Personal sound preferences shared by every game; room transport stays on the server. */
(()=>{
 const key='ah-audio-settings',listeners=new Set(),effects=new Map(),gameEffects=new Set();
 const defaults=()=>({version:2,music:{enabled:false,volume:.3},effects:{enabled:true,volume:.25}});
 const validVolume=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
 function normalize(value){const result=defaults();for(const kind of ['music','effects']){if(typeof value?.[kind]?.enabled==='boolean')result[kind].enabled=value[kind].enabled;if(validVolume(value?.[kind]?.volume))result[kind].volume=value[kind].volume;}return result;}
 function read(){try{const saved=localStorage.getItem(key);if(saved!==null){const savedValue=JSON.parse(saved),result=normalize(savedValue);if(savedValue?.version!==2)result.effects.enabled=true;return result;}const result=defaults();result.music.enabled=localStorage.getItem('ah-music-listen')==='on';for(const [kind,keys] of [['music',['ah-music-volume']],['effects',['ah-gift-volume','ah-majority-volume','ah-race-volume','ah-poker-volume']]])for(const old of keys){const raw=localStorage.getItem(old);if(raw!==null&&raw.trim()!==''&&validVolume(Number(raw))){result[kind].volume=Number(raw);break;}}return result;}catch{return defaults();}}
 let preferences=read();
 const get=()=>normalize(preferences);
 function persist(){try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}}
 function stopEffect(clip){const cleanup=effects.get(clip);if(!cleanup)return false;effects.delete(clip);gameEffects.delete(clip);cleanup();return true;}
 function stopEffects(){for(const clip of [...effects.keys()])stopEffect(clip);}
 function notify(gesture=false){const settings=get();if(!settings.effects.enabled||!settings.effects.volume)stopEffects();else for(const clip of effects.keys())clip.volume=settings.effects.volume;for(const listener of listeners)listener(settings,{gesture});}
 function set(kind,patch,{gesture=false}={}){if(!['music','effects'].includes(kind))return;if(typeof patch.enabled==='boolean')preferences[kind].enabled=patch.enabled;if(validVolume(patch.volume))preferences[kind].volume=patch.volume;persist();notify(gesture);}
 function subscribe(listener){listeners.add(listener);listener(get(),{gesture:false});return ()=>listeners.delete(listener);}
 function bindPreview(audio){const unbind=subscribe(settings=>{audio.volume=settings.music.volume;audio.muted=!settings.music.enabled;});const play=()=>set('music',{enabled:true},{gesture:true});const change=()=>{const current=preferences.music;if(audio.volume!==current.volume||audio.muted===current.enabled)set('music',{volume:audio.volume,enabled:!audio.muted},{gesture:true});};audio.addEventListener('play',play);audio.addEventListener('volumechange',change);return ()=>{unbind();audio.removeEventListener('play',play);audio.removeEventListener('volumechange',change);};}
 function playClip(url,durationMs,{onError,onStop,game=false,maxStartDelayMs=10000}={}){
  const settings=preferences.effects;if(!settings.enabled||!settings.volume||document.hidden||effects.size>=4||(game&&gameEffects.size>=2))return;
  let clip;try{
   clip=new Audio(url);clip.volume=settings.volume;
   let playing=false,deadline=setTimeout(()=>stopEffect(clip),maxStartDelayMs);
   effects.set(clip,()=>{clearTimeout(deadline);clip.onplaying=null;clip.onended=null;clip.onerror=null;try{clip.pause();clip.currentTime=0;clip.removeAttribute('src');clip.load();}catch{}try{onStop?.(clip);}catch{}});
   if(game)gameEffects.add(clip);
   if(game&&document.body.dataset.gameKind==='quacks'&&new URLSearchParams(location.search).has('ui-verify'))clip.addEventListener('playing',()=>console.debug('[quacks-audio] playing '+new URL(clip.src,location.origin).pathname));
   if(game&&url.startsWith('/assets/game-sounds/ping-'))clip.addEventListener('playing',()=>console.debug('[ping-audio] playing '+url));
   const started=()=>{if(!effects.has(clip)){try{clip.pause();}catch{}return;}if(playing)return;playing=true;clearTimeout(deadline);deadline=setTimeout(()=>stopEffect(clip),Math.min(10000,durationMs));};
   const failed=()=>{if(stopEffect(clip))onError?.();};clip.onplaying=started;clip.onended=()=>stopEffect(clip);clip.onerror=failed;
   Promise.resolve(clip.play()).then(started,failed);return clip;
  }catch{if(clip)stopEffect(clip);onError?.();}
 }
 function playEffect(kind,options={}){
  // The 580ms draw recording uses onended; a 1s safety margin tolerates delayed media clocks.
  // Reuse the existing short double tone; warning is a distinct once-per-round cue.
  if(kind==='countdown-warning')kind='turn';
  const cues={'ping-ping':['/assets/game-sounds/ping-ping.wav',360],'ping-attention':['/assets/game-sounds/ping-attention.wav',360],'ping-question':['/assets/game-sounds/ping-question.wav',360],'ping-help':['/assets/game-sounds/ping-help.wav',360],'ping-look':['/assets/game-sounds/ping-look.wav',360],'majority-settlement':['/assets/game-sounds/quacks-settlement-user.wav',660],'quacks-stop':['/assets/game-sounds/quacks-decline-user.wav',1811],'quacks-settlement':['/assets/game-sounds/quacks-settlement-user.wav',660],'quacks-explosion':['/assets/game-sounds/quacks-explosion-fish.wav',1428],'quacks-draw':['/assets/game-sounds/quacks-draw.wav',540],'quacks-danger':['/assets/game-sounds/quacks-danger.wav',420],'quacks-potion':['/assets/game-sounds/quacks-potion-synth.wav',550],'quacks-buy':['/assets/game-sounds/quacks-buy.wav',380],'quacks-ruby':['/assets/game-sounds/quacks-ruby.wav',460],'quacks-witch':['/assets/game-sounds/quacks-witch.wav',750],settlement:['/assets/game-sounds/quacks-settlement.wav',420],'potion-drink':['/assets/game-sounds/quacks-potion.wav',600],'ingredient-draw':['/assets/game-sounds/quacks-push-user.wav',1580],'card-draw':['/assets/game-sounds/quacks-card.wav',1500],'bluff-reaction':['/assets/game-sounds/bluff-reaction.mp3',1700],confirm:['/assets/gift-sounds/confirmation_001.wav',10000],reveal:['/assets/gift-sounds/open_001.wav',10000],turn:['/assets/game-sounds/turn.wav',320],correct:['/assets/game-sounds/correct.wav',220],'dice-roll':['/assets/game-sounds/dice-roll.wav',650],shot:['/assets/game-sounds/shot.wav',280],slam:['/assets/game-sounds/slam.wav',350],explosion:['/assets/game-sounds/quacks-explosion.wav',900],nitro:['/assets/game-sounds/nitro.wav',500],skid:['/assets/game-sounds/skid.wav',480]};
  const cue=Object.hasOwn(cues,kind)?cues[kind]:null;
  if(cue)return playClip(cue[0],cue[1],{onError:options.onError,onStop:options.onStop,game:true,maxStartDelayMs:kind==='confirm'||kind==='reveal'?10000:1000});
 }
 // Only server-issued character sound resources may use the controlled effect player.
 function playExpression(sound,options={}){
  if(!sound||typeof sound.url!=='string'||!Number.isInteger(sound.durationMs)||sound.durationMs<1||sound.durationMs>10000)return;
  try{
   const url=new URL(sound.url,location.origin),uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
   if(url.origin!==location.origin||url.username||url.password||url.hash||!new RegExp('^/assets/characters/sounds/'+uuid+'/(?:happy|sad|surprised|thinking|angry|emote-'+uuid+')$','i').test(url.pathname))return;
   const queries=[...url.searchParams];if(queries.length>1||(queries.length===1&&(queries[0][0]!=='v'||!/^[a-f0-9]{64}$/i.test(queries[0][1]))))return;
   return playClip(url.pathname+url.search,sound.durationMs,options);
  }catch{}
 }
 // Browsers may require a fresh gesture after navigation, including default-enabled effects.
 const unlock=event=>{if(event.isTrusted)notify(true);};
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEffects();});window.addEventListener('pagehide',stopEffects);
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preferences=read();notify();}});
 persist();window.AudioSettings={canPlayGameEffect:()=>effects.size<4&&gameEffects.size<2,get,set,subscribe,bindPreview,playEffect,playExpression,stopEffect,stopEffects};
})();
