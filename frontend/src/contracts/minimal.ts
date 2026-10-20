import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot } from './room';
export type MinimalShape =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };
export interface MinimalAttempt {
  artistId: string;
  artistName: string;
  text: string;
  correct: boolean;
}
export interface MinimalDrawing {
  name: string;
  count: number;
  shapes: MinimalShape[];
}
export interface MinimalRound {
  round: number;
  title: string;
  guesserName: string;
  attempts: MinimalAttempt[];
  drawings: MinimalDrawing[];
}
export interface MinimalSnapshot extends RoomSnapshot {
  type: 'minimal';
  phase: 'waiting' | 'drawing' | 'guessing' | 'reveal' | 'finished';
  round: number;
  roundLimit: number;
  roundId: string | null;
  guesserId: string | null;
  deadline: number | null;
  readyIds: string[];
  prompt: string | null;
  myShapes: MinimalShape[];
  submitted: boolean;
  currentDrawing: MinimalDrawing | null;
  order: { name: string; count: number }[];
  attempts: MinimalAttempt[];
  results: MinimalRound[];
  interrupted: boolean;
  winner: { score: number; names: string[] } | null;
}
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
function invalid(): never {
  throw Error('極簡畫家資料格式不正確。');
}
export function readMinimalShapes(value: unknown): MinimalShape[] {
  const values = array(value);
  if (values.length > 40) return invalid();
  return values.map((value) => {
    const row = record(value);
    if (row.kind === 'line') {
      const { x1, y1, x2, y2 } = row;
      if (
        ![x1, y1, x2, y2].every(integer) ||
        Number(x1) > 511 ||
        Number(x2) > 511 ||
        Number(y1) > 255 ||
        Number(y2) > 255 ||
        (x1 === x2 && y1 === y2)
      )
        return invalid();
      return { kind: 'line', x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2) };
    }
    if (row.kind === 'circle') {
      const { cx, cy, r } = row;
      if (
        ![cx, cy, r].every(integer) ||
        Number(r) < 2 ||
        Number(r) > 128 ||
        Number(cx) - Number(r) < 2 ||
        Number(cx) + Number(r) > 509 ||
        Number(cy) - Number(r) < 2 ||
        Number(cy) + Number(r) > 253
      )
        return invalid();
      return { kind: 'circle', cx: Number(cx), cy: Number(cy), r: Number(r) };
    }
    return invalid();
  });
}
function attempts(value: unknown): MinimalAttempt[] {
  return array(value).map((value) => {
    const row = record(value);
    if (
      !text(row.artistId) ||
      !text(row.artistName) ||
      typeof row.text !== 'string' ||
      typeof row.correct !== 'boolean'
    )
      return invalid();
    return {
      artistId: text(row.artistId),
      artistName: text(row.artistName),
      text: row.text,
      correct: row.correct,
    };
  });
}
function drawing(value: unknown): MinimalDrawing {
  const row = record(value),
    shapes = readMinimalShapes(row.shapes);
  if (!text(row.name) || !integer(row.count) || row.count !== shapes.length) return invalid();
  return { name: text(row.name), count: row.count, shapes };
}
export function readMinimalSnapshot(value: unknown): MinimalSnapshot {
  const room = readRoomSnapshot(value),
    row = record(value);
  if (
    room.type !== 'minimal' ||
    !['waiting', 'drawing', 'guessing', 'reveal', 'finished'].includes(room.phase) ||
    !integer(row.round) ||
    !integer(row.roundLimit) ||
    row.round > row.roundLimit ||
    typeof row.submitted !== 'boolean' ||
    typeof row.interrupted !== 'boolean' ||
    !room.players.every((player) => integer(player.score))
  )
    return invalid();
  if (
    room.phase === 'waiting'
      ? row.roundId !== null || row.guesserId !== null
      : !text(row.roundId) || !text(row.guesserId)
  )
    return invalid();
  if (row.deadline !== null && (typeof row.deadline !== 'number' || !Number.isFinite(row.deadline)))
    return invalid();
  if (row.prompt !== null && typeof row.prompt !== 'string') return invalid();
  if (row.prompt !== null && (room.phase !== 'drawing' || row.guesserId === room.me))
    return invalid();
  if (room.phase === 'drawing' && row.guesserId !== room.me && !text(row.prompt)) return invalid();
  const readyIds = array(row.readyIds);
  if (!readyIds.every((id) => typeof id === 'string') || new Set(readyIds).size !== readyIds.length)
    return invalid();
  const order = array(row.order).map((value) => {
    const item = record(value);
    if (!text(item.name) || !integer(item.count) || item.count < 1 || item.count > 40)
      return invalid();
    return { name: text(item.name), count: item.count };
  });
  const results = array(row.results).map((value) => {
    const result = record(value);
    if (
      !integer(result.round) ||
      result.round < 1 ||
      !text(result.title) ||
      !text(result.guesserName)
    )
      return invalid();
    return {
      round: result.round,
      title: text(result.title),
      guesserName: text(result.guesserName),
      attempts: attempts(result.attempts),
      drawings: array(result.drawings).map(drawing),
    };
  });
  if (new Set(results.map((result) => result.round)).size !== results.length) return invalid();
  let winner: MinimalSnapshot['winner'] = null;
  if (row.winner !== null) {
    const item = record(row.winner),
      names = array(item.names);
    if (
      !integer(item.score) ||
      !names.length ||
      !names.every((name) => typeof name === 'string' && name)
    )
      return invalid();
    winner = { score: item.score, names: names as string[] };
  }
  return {
    ...room,
    type: 'minimal',
    phase: room.phase as MinimalSnapshot['phase'],
    round: row.round,
    roundLimit: row.roundLimit,
    roundId: typeof row.roundId === 'string' ? row.roundId : null,
    guesserId: typeof row.guesserId === 'string' ? row.guesserId : null,
    deadline: typeof row.deadline === 'number' ? row.deadline : null,
    readyIds: readyIds as string[],
    prompt: typeof row.prompt === 'string' ? row.prompt : null,
    myShapes: readMinimalShapes(row.myShapes),
    submitted: row.submitted,
    currentDrawing: row.currentDrawing === null ? null : drawing(row.currentDrawing),
    order,
    attempts: attempts(row.attempts),
    results,
    interrupted: row.interrupted,
    winner,
  };
}
