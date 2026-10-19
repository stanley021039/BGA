import { record, text } from '../services/validation';
import type { DrawArtist } from './draw-results';
export interface DrawMatchSummary {
  startedAt: number | null; endedAt: number | null; rounds: number; eligibleGuesses: number; correctGuesses: number; strokeCount: number;
  correctByPlayer: Record<string, number>;
  fastest: { playerId: string; name: string; milliseconds: number; round: number } | null;
  bestArtwork: { resultId: string; answer: string | null; artist: DrawArtist; round: number; guessedCount: number } | null;
}
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const timestamp = (value: unknown): value is number | null => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
function invalid(): never { throw Error('畫猜結算摘要格式不正確。'); }
export function readDrawSummary(value: unknown): DrawMatchSummary {
  const row = record(value); if (!timestamp(row.startedAt) || !timestamp(row.endedAt)) return invalid();
  for (const key of ['rounds', 'eligibleGuesses', 'correctGuesses', 'strokeCount']) if (!integer(row[key])) return invalid();
  if (Number(row.correctGuesses) > Number(row.eligibleGuesses) || row.startedAt !== null && row.endedAt !== null && row.endedAt < row.startedAt) return invalid();
  const correctByPlayer: Record<string, number> = {};
  for (const [id, count] of Object.entries(record(row.correctByPlayer))) { if (!id || !integer(count)) return invalid(); Object.defineProperty(correctByPlayer, id, { value: count, enumerable: true }); }
  let fastest: DrawMatchSummary['fastest'] = null, bestArtwork: DrawMatchSummary['bestArtwork'] = null;
  if (row.fastest !== null) { const item = record(row.fastest); if (!text(item.playerId) || !text(item.name) || !integer(item.milliseconds) || !integer(item.round)) return invalid(); fastest = { playerId: text(item.playerId), name: text(item.name), milliseconds: item.milliseconds, round: item.round }; }
  if (row.bestArtwork !== null) { const item = record(row.bestArtwork), artist = record(item.artist); if (!text(item.resultId) || item.answer !== null && typeof item.answer !== 'string' || !integer(item.round) || !integer(item.guessedCount) || !text(artist.id) || !text(artist.name)) return invalid(); bestArtwork = { resultId: text(item.resultId), answer: item.answer as string | null, round: item.round, guessedCount: item.guessedCount, artist: { id: text(artist.id), name: text(artist.name), avatar: text(artist.avatar) || null } }; }
  return { startedAt: row.startedAt, endedAt: row.endedAt, rounds: row.rounds as number, eligibleGuesses: row.eligibleGuesses as number, correctGuesses: row.correctGuesses as number, strokeCount: row.strokeCount as number, correctByPlayer, fastest, bestArtwork };
}
