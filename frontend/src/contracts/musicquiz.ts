import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot } from './room';
export interface MusicAnswer { name:string; text:string; pass:boolean; correct:boolean }
export interface MusicRound { round:number; title:string; answers:MusicAnswer[] }
export interface MusicQuizSnapshot extends RoomSnapshot {
  type:'musicquiz'; phase:'waiting'|'answering'|'reveal'|'finished'; round:number; roundLimit:number; roundId:string|null;
  interrupted:boolean; submitted:boolean; myAnswer:string; readyIds:string[]; canReveal:boolean;
  clipSeconds:6; audioUrl:string|null; results:MusicRound[]; winner:{score:number; names:string[]}|null;
}
const integer = (value:unknown):value is number => Number.isSafeInteger(value) && Number(value) >= 0;
function invalid():never { throw Error('猜歌房間資料格式不正確。'); }
export function readMusicQuizSnapshot(value:unknown):MusicQuizSnapshot {
  const room = readRoomSnapshot(value), row = record(value);
  if (room.type !== 'musicquiz' || !['waiting','answering','reveal','finished'].includes(room.phase) || !integer(row.round) || !integer(row.roundLimit) || row.round > row.roundLimit || row.clipSeconds !== 6 || !['submitted','canReveal','interrupted'].every(key=>typeof row[key] === 'boolean') || typeof row.myAnswer !== 'string') return invalid();
  if (room.phase === 'waiting' ? row.roundId !== null : !text(row.roundId)) return invalid();
  if (!room.players.every(player=>integer(player.score))) return invalid();
  const readyIds = array(row.readyIds); if (!readyIds.every(id=>typeof id === 'string') || new Set(readyIds).size !== readyIds.length) return invalid();
  const results = array(row.results).map(value=>{
    const result = record(value); if (!integer(result.round) || result.round < 1 || !text(result.title)) return invalid();
    const answers = array(result.answers).map(value=>{ const answer = record(value); if (!text(answer.name) || typeof answer.text !== 'string' || typeof answer.pass !== 'boolean' || typeof answer.correct !== 'boolean') return invalid(); return {name:text(answer.name),text:answer.text,pass:answer.pass,correct:answer.correct}; });
    return {round:result.round,title:text(result.title),answers};
  });
  if (new Set(results.map(result=>result.round)).size !== results.length) return invalid();
  let winner:MusicQuizSnapshot['winner'] = null;
  if (row.winner !== null) { const item = record(row.winner); if (!integer(item.score)) return invalid(); const names = array(item.names); if (!names.length || !names.every(name=>typeof name === 'string' && name)) return invalid(); winner = {score:item.score,names:names as string[]}; }
  let audioUrl:string|null = null;
  if (row.audioUrl !== null) {
    if (typeof row.audioUrl !== 'string' || !row.audioUrl.startsWith('/api/musicquiz-clip?')) return invalid();
    const url = new URL(row.audioUrl,'http://afterhours.invalid');
    if (url.pathname !== '/api/musicquiz-clip' || url.searchParams.get('code')?.toUpperCase() !== room.code || url.searchParams.get('roundId') !== row.roundId) return invalid();
    audioUrl = row.audioUrl;
  }
  if (room.phase === 'answering' && !audioUrl) return invalid();
  return {...room,type:'musicquiz',phase:room.phase as MusicQuizSnapshot['phase'],round:row.round,roundLimit:row.roundLimit,roundId:typeof row.roundId === 'string'?row.roundId:null,interrupted:row.interrupted===true,submitted:row.submitted===true,myAnswer:row.myAnswer,readyIds:readyIds as string[],canReveal:row.canReveal===true,clipSeconds:6,audioUrl,results,winner};
}
