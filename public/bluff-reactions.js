(()=>{
'use strict';
const notice=document.createElement('div');notice.id='bluffReaction';notice.className='bluff-reaction';notice.hidden=true;notice.setAttribute('data-game-focus-overlay','');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.body.append(notice);
let seen=new Set(),initialized=false,clip,timer,lastPlayed=-Infinity;
function stop(){clearTimeout(timer);notice.hidden=true;if(clip)window.AudioSettings?.stopEffect(clip);clip=null;}
window.BluffReactions={update(state){const events=state.reactions||[];if(!initialized){for(const e of events)seen.add(e.id);initialized=true;return;}for(const e of events){if(seen.has(e.id))continue;seen.add(e.id);if(document.hidden||state.phase!=='discussion'||e.roundId!==state.roundId||state.serverNow-e.at>4000)continue;notice.textContent=e.name+'：'+e.text;notice.hidden=false;clearTimeout(timer);timer=setTimeout(()=>notice.hidden=true,5000);if(performance.now()-lastPlayed>=5000){lastPlayed=performance.now();if(clip)window.AudioSettings?.stopEffect(clip);clip=window.AudioSettings?.playEffect('bluff-reaction',{onError:()=>{notice.textContent=e.name+'：'+e.text+'（音效暫時無法播放）';}});}}if(seen.size>100)seen=new Set(events.map(e=>e.id));if(state.phase!=='discussion')stop();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
})();