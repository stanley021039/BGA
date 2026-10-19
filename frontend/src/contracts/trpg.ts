import { record,array,text } from '../services/validation';
import { readRoomSnapshot,type RoomPlayer,type RoomSnapshot } from './room';
export type TrpgStance='assist'|'recover';
export interface TrpgRole {name:string;skill:string;description:string}
export interface TrpgPlayer extends RoomPlayer {role:string;roleName:string;focus:number;ready:boolean;offline:boolean}
export interface TrpgApproach {id:string;name:string;skill:string;difficulty:number;cost:number;reward:number;risk:number;description:string}
export interface TrpgPlan {stance:TrpgStance;approach:string|null;note:string;skipped:boolean}
export interface TrpgParticipant {id:string;name:string;note:string;stance:TrpgStance;charged:boolean;skipped:boolean}
export interface TrpgResult {sceneId:string;round:number;title:string;leaderName:string;approach:string;die:number;skill:number;support:number;total:number;difficulty:number;outcome:'success'|'partial'|'failure';clues:number;danger:number;text:string;participants:TrpgParticipant[]}
export interface TrpgWinner {restored:boolean;clues:number;danger:number;title:string;text:string}
export interface TrpgSnapshot extends RoomSnapshot {type:'trpg';phase:'waiting'|'planning'|'reveal'|'finished';round:number;roundLimit:6;sceneId:string|null;leaderId:string|null;narratorMode:'rules';adventure:string;supplies:number;clues:number;danger:number;players:TrpgPlayer[];scene:{title:string;text:string;zone:number}|null;approaches:TrpgApproach[];roles:Record<string,TrpgRole>;myPlan:TrpgPlan|null;readyCount:number;canResolve:boolean;results:TrpgResult[];winner:TrpgWinner|null}
const integer=(value:unknown,min=0,max=100):value is number=>Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;
function invalid():never{throw Error('霧港跑團房間資料格式不正確。');}
function required(value:unknown){if(!text(value))return invalid();return text(value);}
function note(value:unknown){if(typeof value!=='string'||[...value].length>160||/[\u0000-\u001f\u007f]/.test(value))return invalid();return value;}
function stance(value:unknown):TrpgStance{if(value!=='assist'&&value!=='recover')return invalid();return value;}
function result(value:unknown):TrpgResult{const r=record(value);if(!integer(r.round,1,6)||!integer(r.die,1,6)||![0,2].includes(r.skill as number)||!integer(r.support,0,2)||!integer(r.total,1,10)||r.total!==(r.die as number)+(r.skill as number)+(r.support as number)||!integer(r.difficulty,6,8)||!integer(r.clues,0,2)||!integer(r.danger,0,2)||!['success','partial','failure'].includes(text(r.outcome)))return invalid();
 const participants=array(r.participants).map(value=>{const p=record(value);if(typeof p.charged!=='boolean'||typeof p.skipped!=='boolean')return invalid();return {id:required(p.id),name:required(p.name),note:note(p.note),stance:stance(p.stance),charged:p.charged,skipped:p.skipped};});if(!participants.length||participants.length>6||new Set(participants.map(p=>p.id)).size!==participants.length)return invalid();
 return {sceneId:required(r.sceneId),round:r.round,title:required(r.title),leaderName:required(r.leaderName),approach:required(r.approach),die:r.die,skill:r.skill as number,support:r.support,total:r.total,difficulty:r.difficulty,outcome:r.outcome as TrpgResult['outcome'],clues:r.clues,danger:r.danger,text:required(r.text),participants};}
export function readTrpgSnapshot(value:unknown):TrpgSnapshot{
 const base=readRoomSnapshot(value),r=record(value);if(base.type!=='trpg'||!['waiting','planning','reveal','finished'].includes(base.phase)||!integer(r.round,0,6)||r.roundLimit!==6||r.narratorMode!=='rules'||!integer(r.supplies,0,4)||!integer(r.clues,0,12)||!integer(r.danger,0,12)||!integer(r.readyCount,0,6)||typeof r.canResolve!=='boolean')return invalid();
 const roles:Record<string,TrpgRole>={};for(const [key,value]of Object.entries(record(r.roles))){const role=record(value);roles[key]={name:required(role.name),skill:required(role.skill),description:required(role.description)};}if(!Object.keys(roles).length)return invalid();
 const players=base.players.map(p=>{if(!Object.hasOwn(roles,text(p.role))||!integer(p.focus,0,3)||typeof p.ready!=='boolean'||typeof p.offline!=='boolean')return invalid();return {...p,role:text(p.role),roleName:required(p.roleName),focus:p.focus,ready:p.ready,offline:p.offline};});
 if(players.length>6||r.readyCount!==players.filter(p=>p.ready).length)return invalid();
 let scene:TrpgSnapshot['scene']=null;if(r.scene!==null){const s=record(r.scene);if(!integer(s.zone,0,2))return invalid();scene={title:required(s.title),text:required(s.text),zone:s.zone};}
 const approaches=array(r.approaches).map(value=>{const a=record(value);if(!integer(a.difficulty,6,8)||!integer(a.cost,0,1)||!integer(a.reward,1,2)||!integer(a.risk,1,2))return invalid();return {id:required(a.id),name:required(a.name),skill:required(a.skill),difficulty:a.difficulty,cost:a.cost,reward:a.reward,risk:a.risk,description:required(a.description)};});
 let myPlan:TrpgPlan|null=null;if(r.myPlan!==null){const p=record(r.myPlan);if(typeof p.skipped!=='boolean'||p.approach!==null&&!approaches.some(a=>a.id===p.approach))return invalid();myPlan={stance:stance(p.stance),approach:typeof p.approach==='string'?p.approach:null,note:note(p.note),skipped:p.skipped};}
 let winner:TrpgWinner|null=null;if(r.winner!==null){const w=record(r.winner);if(typeof w.restored!=='boolean'||!integer(w.clues,0,12)||!integer(w.danger,0,12))return invalid();winner={restored:w.restored,clues:w.clues,danger:w.danger,title:required(w.title),text:required(w.text)};}
 const results=array(r.results).map(result);if(results.length>6||results.some((v,i)=>v.round!==i+1)||new Set(results.map(v=>v.sceneId)).size!==results.length)return invalid();
 if(base.phase==='waiting'?(r.sceneId!==null||r.leaderId!==null||r.round!==0||scene!==null||results.length>0):(!text(r.sceneId)||!text(r.leaderId)||!scene||r.round<1||approaches.length!==3))return invalid();
 if(base.phase==='finished'?!winner||results.length!==6:winner!==null)return invalid();
 return {...base,type:'trpg',phase:base.phase as TrpgSnapshot['phase'],round:r.round,roundLimit:6,sceneId:typeof r.sceneId==='string'?r.sceneId:null,leaderId:typeof r.leaderId==='string'?r.leaderId:null,narratorMode:'rules',adventure:required(r.adventure),supplies:r.supplies,clues:r.clues,danger:r.danger,players,scene,approaches,roles,myPlan,readyCount:r.readyCount,canResolve:r.canResolve,results,winner};
}
