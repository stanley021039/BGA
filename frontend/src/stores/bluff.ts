import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { useQueuedSave } from '../composables/queued-save';
import type { BluffReaction, BluffSnapshot } from '../contracts/bluff';
import type { GameSoundOwner } from '../contracts/sounds';
export const useBluffStore=defineStore('bluff',()=>{
  const room=useRoomStore(),state=computed(()=>room.snapshot as BluffSnapshot|null),setup=computed(()=>!!state.value&&['waiting','finished'].includes(state.value.phase)),editable=computed(()=>room.host&&setup.value&&!room.terminal);
  const draft=reactive({levels:[1,2,3],roleSeconds:30}),canonical=ref(''),key=()=>JSON.stringify({levels:[...draft.levels].sort(),roleSeconds:draft.roleSeconds}),dirty=computed(()=>!!canonical.value&&key()!==canonical.value);
  const save=useQueuedSave<{levels:number[];roleSeconds:number}>({allowed:()=>editable.value,blocked:()=>room.busy,save:value=>room.command('settings',value),failure:()=>room.message});
  watch([()=>JSON.stringify(state.value?.options),editable,()=>room.scope],()=>{const value=state.value?.options;if(!value)return;const adopt=!canonical.value||!editable.value||!save.pending.value&&!dirty.value;canonical.value=JSON.stringify({levels:[...value.levels].sort(),roleSeconds:value.roleSeconds});if(adopt){draft.levels=[...value.levels];draft.roleSeconds=value.roleSeconds;}if(!editable.value)save.reset();},{immediate:true});
  function queue(){if(!editable.value)return;if(!draft.levels.length){draft.levels=[...(state.value?.options.levels||[1,2,3])];save.invalidate('題目難度至少選一種。');return;}save.enqueue({levels:[...draft.levels],roleSeconds:draft.roleSeconds});}
  async function start(){if(!editable.value||!state.value||state.value.players.length<3)return;if(dirty.value&&!save.pending.value)queue();if(await save.flush()&&!save.error.value)await room.command('start',{});}
  const foreground=ref(!document.hidden),now=ref(Date.now()),serverTime=ref(Date.now()),offset=computed(()=>now.value-serverTime.value),seconds=computed(()=>state.value?.deadline?Math.ceil(Math.max(0,state.value.deadline-serverTime.value)/1000):0);
  const secretVisible=computed(()=>!!state.value&&room.connected&&foreground.value&&state.value.phase==='preparing'&&seconds.value>0&&!!state.value.myRole);
  const liveReactions=shallowRef<(BluffReaction&{until:number})[]>([]),sounds:GameSoundOwner|undefined=window.GameSounds?.create();
  let timer:ReturnType<typeof setInterval>|null=null,expiry:ReturnType<typeof setTimeout>|null=null,anchor=Date.now(),at=performance.now(),round='',previousSeconds:number|null=null,initialized=false,lastPlayed=-Infinity,clip:HTMLAudioElement|undefined;
  const seen=new Set<string>();
  function stopClock(){if(timer)clearInterval(timer);timer=null;}
  function clearReactions(){if(expiry)clearTimeout(expiry);expiry=null;liveReactions.value=[];window.AudioSettings?.stopEffect(clip);clip=undefined;}
  function expire(){if(expiry)clearTimeout(expiry);liveReactions.value=liveReactions.value.filter(e=>e.until>Date.now());expiry=liveReactions.value.length?setTimeout(expire,Math.max(1,Math.min(...liveReactions.value.map(e=>e.until))-Date.now())):null;}
  function tick(){now.value=Date.now();serverTime.value=anchor+performance.now()-at;const left=seconds.value,value=state.value;if(value?.phase==='preparing'&&room.connected&&!document.hidden){if(left>0&&left<=5&&previousSeconds!==null&&left===previousSeconds-1)sounds?.play('turn','bluff-role:'+value.roundId+':'+left,{live:now.value-room.lastReceivedAt<=2500});if(!left){stopClock();sounds?.stop();}}previousSeconds=left;}
  function resetLive(){stopClock();clearReactions();initialized=false;previousSeconds=null;sounds?.disconnect();}
  watch(state,value=>{if(!value)return;anchor=value.serverNow;at=performance.now();now.value=Date.now();serverTime.value=anchor;
    if((value.roundId||'')!==round){round=value.roundId||'';clearReactions();seen.clear();initialized=false;lastPlayed=-Infinity;previousSeconds=null;}
    const connected=room.connected&&!document.hidden;sounds?.update(value,{connected});
    if(!connected){resetLive();return;}tick();stopClock();if(value.phase==='preparing'&&seconds.value>0)timer=setInterval(tick,250);else sounds?.stop();
    if(value.phase!=='discussion')clearReactions();
    const baseline=!initialized;initialized=true;
    for(const e of value.reactions){if(seen.has(e.id))continue;seen.add(e.id);if(baseline||value.phase!=='discussion'||e.roundId!==value.roundId||value.serverNow-e.at>4000||value.serverNow<e.at-1000)continue;liveReactions.value=[...liveReactions.value,{...e,until:Date.now()+5000}].slice(-12);expire();if(performance.now()-lastPlayed>=5000){lastPlayed=performance.now();window.AudioSettings?.stopEffect(clip);clip=window.AudioSettings?.playEffect?.('bluff-reaction');}}
    while(seen.size>100)seen.delete(seen.values().next().value!);
  },{immediate:true,flush:'sync'});
  watch(()=>room.connected,connected=>{if(!connected)resetLive();});
  function visibility(){foreground.value=!document.hidden;if(document.hidden)resetLive();else tick();}
  document.addEventListener('visibilitychange',visibility);
  onScopeDispose(()=>{resetLive();sounds?.destroy();document.removeEventListener('visibilitychange',visibility);});
  return {state,setup,editable,draft,dirty,settingsPending:save.pending,settingsError:save.error,settingsSaved:save.saved,queue,start,now,offset,seconds,secretVisible,liveReactions};
});
