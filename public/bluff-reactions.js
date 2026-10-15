(()=>{
'use strict';
const notice=document.createElement('div');notice.id='bluffReaction';notice.className='bluff-reactions';notice.hidden=true;notice.setAttribute('data-game-focus-overlay','');notice.setAttribute('role','log');notice.setAttribute('aria-live','polite');notice.setAttribute('aria-relevant','additions');document.body.append(notice);
const seen=new Set(),active=new Map();let initialized=false,context=null,clip,lastPlayed=-Infinity;
function remove(id){const entry=active.get(id);if(!entry)return;clearTimeout(entry.timer);entry.row.remove();active.delete(id);notice.hidden=active.size===0;}
function stop(){for(const id of [...active.keys()])remove(id);notice.hidden=true;if(clip)window.AudioSettings?.stopEffect(clip);clip=null;}
window.BluffReactions={update(state){
 if(context!==state.roundId){stop();context=state.roundId;initialized=false;seen.clear();lastPlayed=-Infinity;}
 const events=state.reactions||[];if(!initialized){for(const e of events)seen.add(e.id);initialized=true;return;}
 if(state.phase!=='discussion'||document.hidden)stop();
 for(const e of events){if(seen.has(e.id))continue;seen.add(e.id);if(document.hidden||state.phase!=='discussion'||e.roundId!==state.roundId||state.serverNow-e.at>4000)continue;
  while(active.size>=12)remove(active.keys().next().value);
  const row=document.createElement('div');row.className='bluff-reaction';row.textContent=e.name+' 質疑你';row.dataset.reactionId=e.id;notice.append(row);notice.hidden=false;
  active.set(e.id,{row,timer:setTimeout(()=>remove(e.id),5000)});
  if(performance.now()-lastPlayed>=5000){lastPlayed=performance.now();if(clip)window.AudioSettings?.stopEffect(clip);clip=window.AudioSettings?.playEffect('bluff-reaction');}
 }
 while(seen.size>100)seen.delete(seen.values().next().value);
}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
})();
