import { readRoomSnapshot, type RoomSnapshot } from './room';
import { record } from '../services/validation';
export interface DecryptoTeam {
  name: string;
  members: string[];
  interceptions: number;
  failures: number;
}
export interface DecryptoResult {
  round: number;
  team: number;
  encryptor: string;
  clues: string[];
  code: number[];
  decode: number[];
  intercept: number[] | null;
  decoded: boolean;
  intercepted: boolean;
}
export interface DecryptoSnapshot extends RoomSnapshot {
  type: 'decrypto';
  round: number;
  roundId: string | null;
  roundLimit: number;
  teams: DecryptoTeam[];
  myTeam: number;
  keywords: string[][];
  secretCode: number[] | null;
  clues: (string[] | null)[];
  clueReady: boolean[];
  encryptors: string[];
  decoders: string[];
  turn: number;
  history: string[][][];
  guessReady: { decode: boolean; intercept: boolean };
  myGuess: number[] | null;
  tieReady: boolean[];
  results: DecryptoResult[];
  interrupted: boolean;
  winner: { teams: number[]; names: string[]; reason: string; keywordHits: number[] | null } | null;
  tieGuesses: Record<string, string[]>;
}
const list = (v: unknown, n?: number): v is unknown[] =>
  Array.isArray(v) && (n === undefined || v.length === n);
const strings = (v: unknown): v is string[] => list(v) && v.every((x) => typeof x === 'string');
const validCode = (v: unknown): v is number[] =>
  list(v, 3) &&
  v.every((x) => Number.isInteger(x) && Number(x) >= 1 && Number(x) <= 4) &&
  new Set(v).size === 3;
const bools = (v: unknown): v is boolean[] => list(v, 2) && v.every((x) => typeof x === 'boolean');
const int = (v: unknown, max = 16): v is number =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= max;
export function readDecryptoSnapshot(value: unknown): DecryptoSnapshot {
  const b = readRoomSnapshot(value),
    s = record(value),
    g = record(s.guessReady);
  const setup = s.phase === 'waiting';
  if (
    b.type !== 'decrypto' ||
    !['waiting', 'clues', 'guessing', 'reveal', 'tiebreak', 'finished'].includes(b.phase) ||
    !int(s.round, 8) ||
    s.roundLimit !== 8 ||
    !int(s.myTeam, 1) ||
    !int(s.turn, 1) ||
    !(s.roundId === null || typeof s.roundId === 'string') ||
    !list(s.teams, 2) ||
    !s.teams.every((t) => {
      const r = record(t);
      return (
        typeof r.name === 'string' &&
        strings(r.members) &&
        r.members.length <= 4 &&
        int(r.interceptions) &&
        int(r.failures)
      );
    }) ||
    !list(s.keywords, 2) ||
    !s.keywords.every((w) => strings(w) && [0, 4].includes(w.length)) ||
    !(s.secretCode === null || validCode(s.secretCode)) ||
    !list(s.clues, 2) ||
    !s.clues.every((c) => c === null || (strings(c) && c.length === 3)) ||
    !bools(s.clueReady) ||
    !bools(s.tieReady) ||
    !strings(s.encryptors) ||
    !strings(s.decoders) ||
    (s.encryptors.length !== (setup ? 0 : 2) && s.round !== 0) ||
    (s.decoders.length !== (setup ? 0 : 2) && s.round !== 0) ||
    typeof g.decode !== 'boolean' ||
    typeof g.intercept !== 'boolean' ||
    !(s.myGuess === null || validCode(s.myGuess)) ||
    !list(s.history, 2) ||
    !s.history.every((t) => list(t, 4) && t.every(strings)) ||
    !list(s.results) ||
    s.results.length > 16 ||
    !s.results.every((v) => {
      const r = record(v);
      return (
        int(r.round, 8) &&
        int(r.team, 1) &&
        strings(r.clues) &&
        r.clues.length === 3 &&
        validCode(r.code) &&
        validCode(r.decode) &&
        (r.intercept === null || validCode(r.intercept)) &&
        typeof r.decoded === 'boolean' &&
        typeof r.intercepted === 'boolean'
      );
    }) ||
    typeof s.interrupted !== 'boolean'
  )
    throw Error('截碼戰狀態格式不正確');
  if (s.winner !== null) {
    const w = record(s.winner);
    if (
      !list(w.teams) ||
      !w.teams.every((x) => x === 0 || x === 1) ||
      !strings(w.names) ||
      typeof w.reason !== 'string'
    )
      throw Error('截碼戰結果格式不正確');
  }
  record(s.tieGuesses);
  return { ...b, ...s } as DecryptoSnapshot;
}
