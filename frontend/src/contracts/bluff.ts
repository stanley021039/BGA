import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot } from './room';
export type BluffRole = 'thinker' | 'honest' | 'bluffer';
export const bluffRoles: Record<BluffRole,string> = { thinker:'想想', honest:'老實人', bluffer:'瞎掰人' };
export interface BluffExplanation { detail:string; example:string; clarification:string }
export interface BluffResult {
  resultId:string; questionId:string; round:number; title:string; level:number; answer:string; explanation:BluffExplanation|null;
  source:{title:string;url:string}; thinkerName:string; honestName:string; selectedName:string; correct:boolean; challenges:string[];
  roles:{name:string;role:BluffRole;delta:number;score:number}[];
  ban:{votes:number;required:number;banned:boolean;voted:boolean;canVote:boolean}|null;
}
export interface BluffReaction { id:string;name:string;text:string;at:number;roundId:string }
export interface BluffSnapshot extends RoomSnapshot {
  type:'bluff'; phase:'waiting'|'selecting'|'preparing'|'discussion'|'reveal'|'finished';
  round:number;roundLimit:number;roundId:string|null;interrupted:boolean;canGuess:boolean;
  options:{levels:number[];roleSeconds:number};deadline:number|null;thinkerId:string|null;myRole:BluffRole|null;
  secretAnswer:string|null;secretExplanation:BluffExplanation|null;prompt:{title:string;level:number;hints:string[]}|null;
  choices:{id:string;title:string;level:number}[];readyIds:string[];spokenIds:string[];challenges:string[];
  botStatements:Record<string,string>;reactions:BluffReaction[];results:BluffResult[];winner:{score:number;names:string[]}|null;
}
const integer=(v:unknown):v is number=>Number.isSafeInteger(v);
const natural=(v:unknown):v is number=>integer(v)&&v>=0;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const role=(v:unknown):v is BluffRole=>['thinker','honest','bluffer'].includes(String(v));
const level=(v:unknown):v is number=>integer(v)&&[1,2,3].includes(v);
function invalid():never{throw Error('瞎掰王房間資料格式不正確。');}
function strings(v:unknown){const items=array(v);if(!items.every(x=>typeof x==='string'))return invalid();return items as string[];}
function explanation(v:unknown):BluffExplanation|null{if(v===null)return null;const r=record(v);if(!['detail','example','clarification'].every(k=>typeof r[k]==='string'))return invalid();return {detail:String(r.detail),example:String(r.example),clarification:String(r.clarification)};}
export function readBluffSnapshot(value:unknown):BluffSnapshot{
  const base=readRoomSnapshot(value),r=record(value),options=record(r.options),levels=array(options.levels);
  if(base.type!=='bluff'||!['waiting','selecting','preparing','discussion','reveal','finished'].includes(base.phase)||!natural(r.round)||!natural(r.roundLimit)||r.round>r.roundLimit||typeof r.interrupted!=='boolean'||typeof r.canGuess!=='boolean'||!base.players.every(p=>integer(p.score)))return invalid();
  if(base.phase==='waiting'?r.roundId!==null:!text(r.roundId))return invalid();
  if(!levels.length||levels.length>3||!levels.every(level)||new Set(levels).size!==levels.length||![10,30,60].includes(Number(options.roleSeconds))||!integer(options.roleSeconds))return invalid();
  if(r.deadline!==null&&!finite(r.deadline)||r.thinkerId!==null&&!text(r.thinkerId)||r.myRole!==null&&!role(r.myRole)||r.secretAnswer!==null&&typeof r.secretAnswer!=='string')return invalid();
  const secretExplanation=explanation(r.secretExplanation);
  if((r.myRole!==null&&base.phase!=='preparing')||((r.secretAnswer!==null||secretExplanation!==null)&&(r.myRole!=='honest'||base.phase!=='preparing')))return invalid();
  let prompt:BluffSnapshot['prompt']=null;
  if(r.prompt!==null){const p=record(r.prompt);if(!text(p.title)||!level(p.level))return invalid();prompt={title:text(p.title),level:p.level,hints:strings(p.hints)};}
  const choices=array(r.choices).map(v=>{const c=record(v);if(!text(c.id)||!text(c.title)||!level(c.level))return invalid();return {id:text(c.id),title:text(c.title),level:c.level};});
  if(choices.length>3||choices.length&&(base.phase!=='selecting'||r.thinkerId!==base.me))return invalid();
  const readyIds=strings(r.readyIds),spokenIds=strings(r.spokenIds),challenges=strings(r.challenges);
  if(challenges.length>2||[readyIds,spokenIds,challenges].some(ids=>new Set(ids).size!==ids.length||ids.some(id=>!base.players.some(p=>p.id===id))))return invalid();
  const statements=record(r.botStatements);if(!Object.values(statements).every(v=>typeof v==='string'))return invalid();
  const reactions=array(r.reactions).map(v=>{const e=record(v);if(!text(e.id)||!text(e.name)||!text(e.text)||!text(e.roundId)||!finite(e.at))return invalid();return {id:text(e.id),name:text(e.name),text:text(e.text),at:e.at,roundId:text(e.roundId)};});
  const results=array(r.results).map(v=>{const a=record(v),source=record(a.source);if(!text(a.resultId)||!text(a.questionId)||!natural(a.round)||!a.round||!text(a.title)||!level(a.level)||typeof a.answer!=='string'||typeof a.correct!=='boolean'||!['thinkerName','honestName','selectedName'].every(k=>text(a[k]))||!text(source.title)||!/^https?:\/\//i.test(text(source.url)))return invalid();
    const roles=array(a.roles).map(v=>{const p=record(v);if(!text(p.name)||!role(p.role)||!integer(p.delta)||!integer(p.score))return invalid();return {name:text(p.name),role:p.role,delta:p.delta,score:p.score};});
    let ban:BluffResult['ban']=null;if(a.ban!==null){const b=record(a.ban);if(!natural(b.votes)||!natural(b.required)||b.required<1||!['banned','voted','canVote'].every(k=>typeof b[k]==='boolean'))return invalid();ban={votes:b.votes,required:b.required,banned:b.banned===true,voted:b.voted===true,canVote:b.canVote===true};}
    return {resultId:text(a.resultId),questionId:text(a.questionId),round:a.round,title:text(a.title),level:a.level,answer:a.answer,explanation:explanation(a.explanation),source:{title:text(source.title),url:text(source.url)},thinkerName:text(a.thinkerName),honestName:text(a.honestName),selectedName:text(a.selectedName),correct:a.correct,challenges:strings(a.challenges),roles,ban};
  });
  if(new Set(results.map(x=>x.resultId)).size!==results.length)return invalid();
  let winner:BluffSnapshot['winner']=null;if(r.winner!==null){const w=record(r.winner),names=strings(w.names);if(!integer(w.score)||!names.length)return invalid();winner={score:w.score,names};}
  return {...base,type:'bluff',phase:base.phase as BluffSnapshot['phase'],round:r.round,roundLimit:r.roundLimit,roundId:typeof r.roundId==='string'?r.roundId:null,interrupted:r.interrupted,canGuess:r.canGuess,options:{levels:levels as number[],roleSeconds:Number(options.roleSeconds)},deadline:typeof r.deadline==='number'?r.deadline:null,thinkerId:typeof r.thinkerId==='string'?r.thinkerId:null,myRole:role(r.myRole)?r.myRole:null,secretAnswer:typeof r.secretAnswer==='string'?r.secretAnswer:null,secretExplanation,prompt,choices,readyIds,spokenIds,challenges,botStatements:statements as Record<string,string>,reactions,results,winner};
}
