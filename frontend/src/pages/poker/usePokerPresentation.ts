import { computed,nextTick,onScopeDispose,ref,shallowRef,watch,type Ref } from 'vue';
import { useRoomStore } from '../../stores/room';
import { usePokerStore } from '../../stores/poker';
import { useAchievementsStore } from '../../stores/achievements';
import type {} from '../../stores/preferences';
export function usePokerPresentation(root:Ref<HTMLElement|null>){
 const room=useRoomStore(),poker=usePokerStore(),achievements=useAchievementsStore(),newCards=ref<number[]>([]),focusIndex=ref(-1),earned=ref<string[]>([]),motion=ref(!!window.MotionPolicy?.allowsMotion()),chips=shallowRef<{id:string;left:number;top:number;x:number;y:number}[]>([]);
 const focusItems=computed(()=>poker.state?.results.slice(0,3).map(r=>`${r.name} · ${r.hand} · ＋${r.amount.toLocaleString()}`)||[]),focus=computed(()=>focusItems.value[focusIndex.value]||''),canReplay=computed(()=>motion.value&&focusItems.value.length>0&&poker.state?.phase==='showdown');
 let disposed=false,baseline=true,generation=0,focusTimer:ReturnType<typeof setTimeout>|null=null,cardTimer:ReturnType<typeof setTimeout>|null=null,chipTimer:ReturnType<typeof setTimeout>|null=null,known:Set<string>|null=null;const clips=new Set<HTMLAudioElement>();
 function stopFocus(){if(focusTimer)clearTimeout(focusTimer);focusTimer=null;focusIndex.value=-1;}
 function replay(){stopFocus();if(!canReplay.value||document.hidden)return;focusIndex.value=0;function next(){focusTimer=setTimeout(()=>{if(++focusIndex.value>=focusItems.value.length)stopFocus();else next();},1350);}next();}
 function stopEffects(){generation++;stopFocus();if(cardTimer)clearTimeout(cardTimer);if(chipTimer)clearTimeout(chipTimer);cardTimer=chipTimer=null;newCards.value=[];chips.value=[];for(const clip of clips)window.AudioSettings?.stopEffect(clip);clips.clear();}
 function sound(cue:string){if(document.hidden||!room.connected)return;const clip=window.AudioSettings?.playEffect?.(cue);if(clip){clips.add(clip);const forget=()=>clips.delete(clip);clip.addEventListener('ended',forget,{once:true});clip.addEventListener('error',forget,{once:true});if(clips.size>4){const old=clips.values().next().value;window.AudioSettings?.stopEffect(old);if(old)clips.delete(old);}}}
 async function checkAchievements(initial=false){const scope=room.scope;await achievements.load();if(disposed||scope!==room.scope||!achievements.loaded||achievements.error)return;const current=achievements.items.filter(item=>item.unlockedAt);if(!initial&&known)earned.value=current.filter(item=>!known!.has(item.id)).map(item=>item.title);known=new Set([...(known||[]),...current.map(item=>item.id)]);}
 watch(()=>poker.state,async(value,previous)=>{
  if(!value)return;const live=!baseline&&room.connected&&!document.hidden&&!!previous&&previous.hand===value.hand&&value.serverNow-previous.serverNow<=5000;baseline=false;
  if(previous?.hand!==value.hand){stopEffects();earned.value=[];}
  if(!live)return;
  const revealed=value.board.length>previous!.board.length,finished=value.phase==='showdown'&&previous!.phase!=='showdown';
  if(revealed||finished)sound('reveal');
  if(finished){if(motion.value)replay();void checkAchievements();}
  if(!motion.value)return;
  if(revealed){newCards.value=Array.from({length:value.board.length-previous!.board.length},(_,i)=>previous!.board.length+i);if(cardTimer)clearTimeout(cardTimer);cardTimer=setTimeout(()=>{newCards.value=[];cardTimer=null;},550);}
  if(value.phase==='showdown'||value.pot<=previous!.pot)return;const movers=value.players.filter(p=>{const old=previous!.players.find(q=>q.id===p.id);return old&&p.total>old.total;});if(!movers.length)return;
  const token=generation;await nextTick();if(disposed||token!==generation||!motion.value||!root.value||!room.connected||poker.state!==value||document.hidden)return;const bounds=root.value.getBoundingClientRect(),target=root.value.querySelector('[data-poker-pot]')?.getBoundingClientRect();if(!target)return;const left=target.left+target.width/2-bounds.left,top=target.top+target.height/2-bounds.top;
  chips.value=movers.flatMap(p=>{const origin=document.querySelector('[data-player-id="'+CSS.escape(p.id)+'"]')?.getBoundingClientRect();return origin?[{id:crypto.randomUUID(),left,top,x:origin.left+origin.width/2-target.left-target.width/2,y:origin.top+origin.height/2-target.top-target.height/2}]:[];}).slice(-6);if(chipTimer)clearTimeout(chipTimer);chipTimer=setTimeout(()=>{chips.value=[];chipTimer=null;},600);
 },{flush:'post'});
 watch(()=>room.connected,value=>{if(!value){baseline=true;stopEffects();}});watch(()=>room.scope,()=>{baseline=true;stopEffects();earned.value=[];});
 function visibility(){baseline=true;if(document.hidden)stopEffects();}
 function escape(event:KeyboardEvent){if(event.key==='Escape'&&!document.querySelector('dialog[open]'))stopFocus();}
 document.addEventListener('visibilitychange',visibility);document.addEventListener('keydown',escape);
 const unbind=window.MotionPolicy?.subscribe(()=>{motion.value=!!window.MotionPolicy?.allowsMotion();if(!motion.value)stopEffects();});void checkAchievements(true);
 onScopeDispose(()=>{disposed=true;stopEffects();unbind?.();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',escape);});
 return {newCards,focus,canReplay,replay,stopFocus,earned,chips};
}
