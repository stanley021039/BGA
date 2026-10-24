import { readRoomSnapshot, type RoomSnapshot } from './room';
import { array, record, text } from '../services/validation';
export interface AthleteCard {
  id: string;
  name: string;
  summary: string;
  notes: string;
}
export interface Athlete {
  id: string;
  racerId: string;
  playerId: string;
  position: number;
  tripped: boolean;
  finished: boolean;
  eliminated: boolean;
  copiedPowers: string[];
  transformed: boolean;
}
export interface AthleteResult {
  race: number;
  trackId: string;
  reason: string;
  scores: Record<string, number>;
  ranking: { playerId: string; racerId: string; rank: number; points: number }[];
}
export interface AthleteGame {
  revision: number;
  phase: string;
  race?: number;
  turnId: string | null;
  first?: string;
  players: string[];
  teams: Record<string, string[]>;
  scores?: Record<string, number>;
  catalog: AthleteCard[];
  market?: string[];
  draftRound?: number;
  rolls?: Record<string, number>;
  ownSelection: string | null;
  selectedIds: string[];
  racers?: Athlete[];
  trackId?: string;
  direction?: number;
  twistHistory?: string[];
  twistCards?: { id: string; summary: string }[];
  coins?: number[];
  monster?: number | null;
  pending?: {
    id: string;
    playerId: string;
    title: string;
    options: { value: string; label: string }[];
  } | null;
  events: {
    id: number;
    type: string;
    text?: string;
    value?: number;
    playerId?: string;
    racerId?: string;
  }[];
  results?: AthleteResult[];
  winners?: string[];
  awards: number[][];
}
export interface AthleteSnapshot extends RoomSnapshot {
  type: 'second-wind';
  game: AthleteGame | null;
  roundId: string | null;
  interrupted?: boolean;
}
const phases = [
  'draft-rolloff',
  'drafting',
  'race-rolloff',
  'choosing',
  'racing',
  'race-result',
  'finished',
];
function invalid(): never {
  throw Error('運動員房間資料格式不正確');
}
function integer(v: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(v) || (v as number) < minimum) invalid();
  return v as number;
}
function strings(v: unknown): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.length > 0)) invalid();
  return v;
}
export function readAthleteSnapshot(value: unknown): AthleteSnapshot {
  const base = readRoomSnapshot(value);
  if (base.type !== 'second-wind' || !['waiting', 'playing', 'finished'].includes(base.phase))
    invalid();
  if (base.game !== null) {
    const g = record(base.game);
    integer(g.revision);
    if (!phases.includes(text(g.phase))) invalid();
    const players = strings(g.players);
    if (players.length < 3 || players.length > 6 || new Set(players).size !== players.length)
      invalid();
    for (const [id, cards] of Object.entries(record(g.teams))) {
      if (!players.includes(id)) invalid();
      strings(cards);
    }
    for (const v of array(g.catalog)) {
      const c = record(v);
      if (![c.id, c.name, c.summary, c.notes].every((s) => typeof s === 'string')) invalid();
    }
    if (array(g.catalog).length !== 36) invalid();
    strings(g.selectedIds);
    if (g.ownSelection !== null && !text(g.ownSelection)) invalid();
    if (g.turnId !== null && !players.includes(text(g.turnId))) invalid();
    if (g.scores !== undefined)
      for (const [id, score] of Object.entries(record(g.scores))) {
        if (!players.includes(id)) invalid();
        integer(score);
      }
    if (g.racers !== undefined)
      for (const v of array(g.racers)) {
        const r = record(v);
        if (
          !text(r.id) ||
          !text(r.racerId) ||
          !players.includes(text(r.playerId)) ||
          integer(r.position) > 30
        )
          invalid();
        for (const key of ['tripped', 'finished', 'eliminated', 'transformed'])
          if (typeof r[key] !== 'boolean') invalid();
        strings(r.copiedPowers);
      }
    if (g.pending) {
      const p = record(g.pending);
      if (!text(p.id) || !players.includes(text(p.playerId)) || !text(p.title)) invalid();
      for (const v of array(p.options)) {
        const o = record(v);
        if (!text(o.value) || !text(o.label)) invalid();
      }
    }
    for (const v of array(g.events)) {
      const e = record(v);
      integer(e.id, 1);
      if (!text(e.type)) invalid();
    }
    for (const v of array(g.awards)) {
      if (!Array.isArray(v) || v.length !== 2) invalid();
      v.forEach((n) => integer(n));
    }
  }
  return base as AthleteSnapshot;
}
