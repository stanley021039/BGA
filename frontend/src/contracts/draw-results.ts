import { array, record, text } from '../services/validation';
import { readArtwork } from './libraries';
import type { Artwork } from './libraries';
import type { CanvasSnapshot, DrawingStroke } from './drawing';
import type { RoomSnapshot } from './room';

export interface DrawArtist { id: string; name: string; avatar: string | null }
export interface DrawScore extends DrawArtist { score: number; roundPoints: number }
export interface PublicDrawResult extends Record<string, unknown> {
  resultId: string; gameRunId: string | null; canvasEpoch: string; round: number; revealedAt: number;
  artist: DrawArtist; answer: string | null; aliases: string[]; reason: string; guessedIds: string[]; eligibleGuessers: number; strokeCount: number; scores: DrawScore[];
}
export interface PublicDrawSnapshot { result: PublicDrawResult; canvas: CanvasSnapshot }
export interface ResultVote { resultId: string; votes: number; total: number; required: number; voted: boolean; canVote: boolean; banned: boolean }
export interface ResultSaveReceipt { resultId: string; gameRunId: string | null; canvasEpoch: string; artwork: Artwork; duplicate: boolean }
export type ResultError = Error & { code?: string };
export interface ResultSave { status: 'pending' | 'saved' | 'error'; receipt?: ResultSaveReceipt; error?: ResultError }
export interface ResultVoteView { resultId: string | null; summary: PublicDrawResult | null; vote: ResultVote | null; pending: boolean; error: ResultError | null; recent: boolean }
export interface ResultsView {
  room: string; gameRunId: string | null; results: PublicDrawResult[]; selectedId: string | null; summary: PublicDrawResult | null;
  snapshot: PublicDrawSnapshot | null; loading: boolean; error: ResultError | null; savingId: string | null; save: ResultSave | null; vote: ResultVoteView;
}
export interface VotePresentation { label: string; disabled: boolean; summary: string; status: string; kind: 'error' | 'success' | 'info' }
export interface ResultsEngine {
  update(snapshot: RoomSnapshot): void; view(): ResultsView; reset(): void; forgetSave(id: string): void;
  load(id: string, reload?: boolean): Promise<PublicDrawSnapshot>;
  select(id?: string | null, options?: { reload?: boolean }): Promise<PublicDrawSnapshot | null>;
  save(id?: string | null, options?: { recollect?: boolean }): Promise<ResultSaveReceipt | null>;
  vote(id?: string | null): Promise<unknown>; voteView(id?: string | null): ResultVoteView;
}
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function ids(value: unknown): string[] { const values = array(value); if (!values.every(value => typeof value === 'string')) throw Error('結果名單格式不正確'); return values as string[]; }
function artist(value: unknown): DrawArtist { const row = record(value); if (!text(row.id) || !text(row.name)) throw Error('畫者資料格式不正確'); return { id: text(row.id), name: text(row.name), avatar: text(row.avatar) || null }; }
export function readPublicDrawResult(value: unknown): PublicDrawResult {
  const row = record(value);
  if (!text(row.resultId) || !text(row.canvasEpoch) || !integer(row.round) || typeof row.revealedAt !== 'number' || !Number.isFinite(row.revealedAt) || !integer(row.eligibleGuessers) || !integer(row.strokeCount) || row.answer !== null && typeof row.answer !== 'string') throw Error('公開畫作結果格式不正確');
  const scores = array(row.scores).map(value => {
    const score = record(value);
    if (typeof score.score !== 'number' || !Number.isFinite(score.score) || typeof score.roundPoints !== 'number' || !Number.isFinite(score.roundPoints)) throw Error('結果分數格式不正確');
    return { ...artist(score), score: score.score, roundPoints: score.roundPoints };
  });
  return { ...row, resultId: text(row.resultId), canvasEpoch: text(row.canvasEpoch), gameRunId: text(row.gameRunId) || null,
    round: row.round, revealedAt: row.revealedAt, eligibleGuessers: row.eligibleGuessers, strokeCount: row.strokeCount,
    artist: artist(row.artist), answer: row.answer as string | null, aliases: ids(row.aliases), reason: text(row.reason), guessedIds: ids(row.guessedIds), scores };
}
export function readResultVote(value: unknown): ResultVote {
  const row = record(value);
  if (!text(row.resultId) || !integer(row.votes) || !integer(row.total) || !integer(row.required)) throw Error('投票資料格式不正確');
  return { resultId: text(row.resultId), votes: row.votes, total: row.total, required: row.required, voted: row.voted === true, canVote: row.canVote === true, banned: row.banned === true };
}
export function readPublicDrawSnapshot(value: unknown, validateCanvas: (value: unknown) => boolean): PublicDrawSnapshot {
  const row = record(value), result = readPublicDrawResult(row.result), canvas = record(row.canvas);
  if (canvas.canvasEpoch !== result.canvasEpoch || canvas.round !== result.round || !integer(canvas.version) || !Array.isArray(canvas.strokes) || !validateCanvas(canvas)) throw Error('這輪畫作資料不完整，請重試載入。');
  return { result, canvas: { ...canvas, canvasEpoch: result.canvasEpoch, round: result.round, version: canvas.version, strokes: canvas.strokes as DrawingStroke[] } };
}
export function readResultSave(value: unknown): ResultSaveReceipt {
  const row = record(value), artwork = readArtwork(row.artwork);
  if (!text(row.resultId) || !text(row.canvasEpoch) || !artwork.id) throw Error('收藏回應格式不正確，請重新確認。');
  return { resultId: text(row.resultId), gameRunId: text(row.gameRunId) || null, canvasEpoch: text(row.canvasEpoch), artwork, duplicate: row.duplicate === true };
}
declare global {
  interface Window {
    DrawResults?: { createStore(options: {
      loadResult: (id: string, room: string) => Promise<PublicDrawSnapshot>;
      saveResult: (snapshot: PublicDrawSnapshot, options: { recollect?: boolean; isCurrent: () => boolean }, room: string) => Promise<ResultSaveReceipt>;
      voteResult: (id: string, room: string) => Promise<unknown>; onState: (value: unknown) => void;
      validateCanvas: (value: unknown) => boolean; onChange: (view: ResultsView) => void;
    }): ResultsEngine; votePresentation(view: ResultVoteView): VotePresentation };
    ArtworkExport?: { png(snapshot: PublicDrawSnapshot): Promise<Blob>; zip(entries: { name: string; blob: Blob }[]): Promise<Blob>; download(blob: Blob, name: string): void; name(snapshot: PublicDrawSnapshot): string };
  }
}
