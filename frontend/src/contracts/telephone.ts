import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot } from './room';
import type { DrawingTool, Point } from './drawing';

export interface TelephoneStroke { tool:DrawingTool; color:string; size:number; points:Point[]; filled?:boolean }
export type TelephoneDraft = {strokes:TelephoneStroke[]} | {text:string};
export interface TelephonePage { kind:'drawing'|'text'; authorName:string; authorId?:string; skipped?:boolean; timedOut?:boolean; strokes?:TelephoneStroke[]; text?:string }
export interface TelephoneBook { ownerId:string; ownerName:string; promptId:string; pages:TelephonePage[] }
export interface TelephoneTask { kind:'drawing'|'text'; previous:TelephonePage; submitted:boolean; draft:TelephoneDraft|null }
export interface TelephoneSnapshot extends RoomSnapshot {
  type:'telephone'; phase:'waiting'|'passing'|'finished'; round:number; roundLimit:number; stepId:string|null;
  deadline:number|null; interrupted:boolean; options:{sources:string[];seconds:90}; sources:{id:string;label:string}[];
  task:TelephoneTask|null; books:TelephoneBook[];
}
const integer=(v:unknown):v is number=>Number.isSafeInteger(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
function invalid():never { throw Error('傳情畫意房間資料格式不正確。'); }
export function readTelephoneStrokes(value:unknown):TelephoneStroke[] {
  const rows=array(value);let points=0;
  if(rows.length>100)return invalid();
  return rows.map(value=>{
    const s=record(value),ps=array(s.points);points+=ps.length;
    if(!['brush','erase','line','rect','ellipse','fill'].includes(text(s.tool))||!/^#[a-f0-9]{6}$/i.test(text(s.color))||!integer(s.size)||s.size<1||s.size>40||!ps.length||ps.length>256||points>3000||s.filled!==undefined&&typeof s.filled!=='boolean')return invalid();
    const coordinates=ps.map(value=>{const p=array(value);if(p.length!==2||!integer(p[0])||!integer(p[1])||p[0]<0||p[0]>511||p[1]<0||p[1]>255)return invalid();return [p[0],p[1]] as Point;});
    return {tool:s.tool as DrawingTool,color:text(s.color),size:s.size,points:coordinates,...(typeof s.filled==='boolean'?{filled:s.filled}:{})};
  });
}
function page(value:unknown):TelephonePage {
  const p=record(value);
  if(!['drawing','text'].includes(text(p.kind))||!text(p.authorName)||p.authorId!==undefined&&!text(p.authorId)||p.skipped!==undefined&&typeof p.skipped!=='boolean'||p.timedOut!==undefined&&typeof p.timedOut!=='boolean')return invalid();
  const metadata={authorName:text(p.authorName),...(typeof p.authorId==='string'?{authorId:p.authorId}:{}),...(typeof p.skipped==='boolean'?{skipped:p.skipped}:{}),...(typeof p.timedOut==='boolean'?{timedOut:p.timedOut}:{})};
  if(p.kind==='drawing'){const strokes=readTelephoneStrokes(p.strokes);if(!strokes.length&&!p.skipped)return invalid();return {...metadata,kind:'drawing',strokes};}
  if(typeof p.text!=='string'||!p.text||p.text.length>2048)return invalid();
  return {...metadata,kind:'text',text:p.text};
}
export function readTelephoneSnapshot(value:unknown):TelephoneSnapshot {
  const base=readRoomSnapshot(value),r=record(value),options=record(r.options),sources=array(r.sources).map(value=>{const s=record(value);if(!text(s.id)||!text(s.label))return invalid();return {id:text(s.id),label:text(s.label)};});
  const selected=array(options.sources);
  if(base.type!=='telephone'||!['waiting','passing','finished'].includes(base.phase)||!integer(r.round)||r.round<0||!integer(r.roundLimit)||r.roundLimit<0||r.roundLimit>8||r.round>r.roundLimit||typeof r.interrupted!=='boolean'||options.seconds!==90||!selected.length||selected.length>2||!selected.every(id=>typeof id==='string'&&sources.some(s=>s.id===id))||new Set(selected).size!==selected.length||new Set(sources.map(s=>s.id)).size!==sources.length)return invalid();
  if(base.phase==='waiting'?(r.stepId!==null||r.round!==0||r.roundLimit!==0):!text(r.stepId))return invalid();
  if(base.phase==='passing'?(!finite(r.deadline)||r.round<1||r.roundLimit<2):r.deadline!==null)return invalid();
  if(!base.players.every(p=>typeof p.ready==='boolean'||p.ready===undefined))return invalid();
  let task:TelephoneTask|null=null;
  if(base.phase==='passing'){
    const t=record(r.task),kind=r.round%2?'drawing':'text',previous=page(t.previous);
    if(t.kind!==kind||previous.kind===kind||typeof t.submitted!=='boolean'||t.submitted&&t.draft!==null)return invalid();
    let draft:TelephoneDraft|null=null;
    if(t.draft!==null){const d=record(t.draft);if(kind==='drawing')draft={strokes:readTelephoneStrokes(d.strokes)};else{if(typeof d.text!=='string'||[...d.text].length>80||/[\u0000-\u001f\u007f]/.test(d.text))return invalid();draft={text:d.text};}}
    task={kind,previous,submitted:t.submitted,draft};
  }else if(r.task!==null)return invalid();
  const books=array(r.books).map(value=>{const b=record(value),pages=array(b.pages).map(page);if(!text(b.ownerId)||!text(b.ownerName)||!text(b.promptId)||!pages.length||pages.length>9||pages[0]?.kind!=='text'||pages.some((p,i)=>p.kind!==(i%2?'drawing':'text')))return invalid();return {ownerId:text(b.ownerId),ownerName:text(b.ownerName),promptId:text(b.promptId),pages};});
  // Interrupted books may have fewer pages because only explicit submissions are committed.
  if(base.phase!=='finished'&&books.length||books.length>8||new Set(books.map(b=>b.ownerId)).size!==books.length)return invalid();
  return {...base,type:'telephone',phase:base.phase as TelephoneSnapshot['phase'],round:r.round,roundLimit:r.roundLimit,stepId:typeof r.stepId==='string'?r.stepId:null,deadline:typeof r.deadline==='number'?r.deadline:null,interrupted:r.interrupted,options:{sources:selected as string[],seconds:90},sources,task,books};
}
