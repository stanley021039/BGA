import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot, type RoomPlayer } from './room';
export interface RacePoint {
  x: number;
  y: number;
}
export interface RaceCar extends Record<string, unknown> {
  id: string;
  owner: string | null;
  size: number;
  x: number | null;
  y: number;
  damage: boolean[];
  dead: boolean;
  wreck: boolean;
  moved: boolean;
  burning: boolean;
  coasts: number;
  motionGhost?: boolean;
}
export interface RacePlayer extends RoomPlayer {
  color: string;
  out: boolean;
  turns: number;
  commandUsed: boolean;
  dice: { value: number; used: boolean }[];
  chopper: RacePoint | null;
}
export interface RaceCell {
  kind: string;
  hazard?: { face: boolean; kind: string };
}
export interface RaceTile {
  start: number;
  name: string;
  map: number;
  side: number;
  cells: RaceCell[][];
}
export interface RaceEvent extends Record<string, unknown> {
  id: number;
  kind: string;
  text: string;
  afterMotion?: number;
}
export interface RaceMotion {
  id: number;
  kind: string;
  moves: { car?: string; player?: string; from: { x: number | null; y: number }; to: RacePoint }[];
}
export interface RaceDiceCheck {
  id: number;
  kind: string;
  title: string;
  condition: string;
  owner: string | null;
  status: 'awaiting' | 'rolling' | 'result';
  participants: { id: string | null; name: string; color: string; car?: string; label?: string }[];
  dice: { label: string; faces: (string | number)[]; participant?: string }[];
  startedAt?: number;
  readyAt?: number;
  serverNow?: number;
  rerollAllowed?: boolean;
  result?: { faces: (string | number)[]; text: string };
}
export interface RaceActive extends Record<string, unknown> {
  car: string;
  remaining: number;
  coast: boolean;
  roadEligible: boolean;
  bonusUsed: boolean;
  drift: boolean;
  driftUsed: boolean;
  stopped: boolean;
  saltBonus?: boolean;
}
export interface RaceSlam {
  top: string;
  bottom: string;
  topMoves: boolean;
  direction: number;
  owner: string | null;
}
export type RacePhase =
  | 'waiting'
  | 'assign'
  | 'move'
  | 'bonus'
  | 'shoot'
  | 'airplace'
  | 'airshoot'
  | 'effects'
  | 'finished';
export interface RaceSnapshot extends RoomSnapshot {
  type: 'thunder';
  phase: RacePhase;
  round: number;
  version: number;
  options: { devilsRun: boolean };
  turn: number;
  first: number;
  roadDie: number | null;
  deadline: number | null;
  actor: string | null;
  active: RaceActive | null;
  pending: RaceSlam | null;
  diceCheck: RaceDiceCheck | null;
  finishAt: number | null;
  tileCount: number;
  winner: { id: string | null; name: string; reason: string } | null;
  legalMoves: RacePoint[];
  targets: string[];
  available: string[];
  players: RacePlayer[];
  cars: RaceCar[];
  tiles: RaceTile[];
  events: RaceEvent[];
  motions: RaceMotion[];
  log: string[];
}
export interface RaceAnnotation extends RacePoint {
  label: string;
  color?: string;
}
export interface RaceDomain {
  state: RaceSnapshot | null;
  busy: boolean;
  connected: boolean;
  canAct: boolean;
  notice: string;
  failed: boolean;
  uncertain?: boolean;
  now: number;
  offset: number;
  lesson: boolean;
  run(action: string, data?: Record<string, unknown>): Promise<boolean>;
  lessonGoal?: RacePoint | null;
  lessonAnnotations?: RaceAnnotation[];
  lessonFocus?: string;
  setLessonMoving?(moving: boolean): void;
}
export interface RaceRoute extends RacePoint {
  cost: number;
  risk: number;
  path: RacePoint[];
  warnings: string[];
}
const integer = (v: unknown, min = 0, max = 1000000): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function invalid(): never {
  throw Error('雷霆之路房間資料格式不正確。');
}
const required = (v: unknown) => text(v) || invalid(),
  color = (v: unknown) => (/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(text(v)) ? text(v) : invalid());
function point(value: unknown): RacePoint {
  const p = record(value);
  if (!integer(p.x, -64, 64) || !integer(p.y, -1000000)) return invalid();
  return { x: p.x, y: p.y };
}
function ids(value: unknown) {
  return array(value).map((v) => required(v));
}
function diceCheck(value: unknown): RaceDiceCheck | null {
  if (value == null) return null;
  const d = record(value);
  if (
    !integer(d.id) ||
    !['awaiting', 'rolling', 'result'].includes(text(d.status)) ||
    (d.owner !== null && typeof d.owner !== 'string')
  )
    return invalid();
  const dice = array(d.dice).map((value) => {
    const r = record(value),
      faces = array(r.faces);
    if (
      !faces.length ||
      faces.length > 6 ||
      !faces.every((v) => (typeof v === 'string' && v.length > 0) || finite(v))
    )
      return invalid();
    return {
      label: required(r.label),
      faces: faces as (number | string)[],
      ...(typeof r.participant === 'string' ? { participant: r.participant } : {}),
    };
  });
  if (!dice.length || dice.length > 17) return invalid();
  const participants = array(d.participants).map((value) => {
    const p = record(value);
    if (p.id !== null && typeof p.id !== 'string') return invalid();
    return {
      id: typeof p.id === 'string' ? p.id : null,
      name: required(p.name),
      color: color(p.color),
      ...(typeof p.car === 'string' ? { car: p.car } : {}),
      ...(typeof p.label === 'string' ? { label: p.label } : {}),
    };
  });
  if (participants.length > 4) return invalid();
  let result: RaceDiceCheck['result'];
  if (d.result !== undefined) {
    const r = record(d.result),
      faces = array(r.faces);
    if (
      d.status !== 'result' ||
      faces.length !== dice.length ||
      !faces.every((v, i) => dice[i]!.faces.includes(v as string | number))
    )
      return invalid();
    result = { faces: faces as (string | number)[], text: required(r.text) };
  }
  if (d.status === 'result' && !result) return invalid();
  if (d.status === 'rolling' && (!finite(d.startedAt) || !finite(d.readyAt))) return invalid();
  return {
    id: d.id,
    kind: required(d.kind),
    title: required(d.title),
    condition: required(d.condition),
    owner: typeof d.owner === 'string' ? d.owner : null,
    status: d.status as RaceDiceCheck['status'],
    participants,
    dice,
    ...(finite(d.startedAt) ? { startedAt: d.startedAt } : {}),
    ...(finite(d.readyAt) ? { readyAt: d.readyAt } : {}),
    ...(finite(d.serverNow) ? { serverNow: d.serverNow } : {}),
    ...(typeof d.rerollAllowed === 'boolean' ? { rerollAllowed: d.rerollAllowed } : {}),
    ...(result ? { result } : {}),
  };
}
export function readRaceSnapshot(value: unknown, _local = false): RaceSnapshot {
  const base = readRoomSnapshot(value),
    s = record(value),
    options = record(s.options);
  if (
    base.type !== 'thunder' ||
    ![
      'waiting',
      'assign',
      'move',
      'bonus',
      'shoot',
      'airplace',
      'airshoot',
      'effects',
      'finished',
    ].includes(base.phase) ||
    !integer(s.round) ||
    !integer(s.version) ||
    !integer(s.turn, -1, 3) ||
    typeof options.devilsRun !== 'boolean'
  )
    return invalid();
  const players = base.players.map((p) => {
    if (typeof p.out !== 'boolean' || !integer(p.turns, 0, 3)) return invalid();
    const dice = array(p.dice).map((value) => {
      const d = record(value);
      if (!integer(d.value, 1, 6) || typeof d.used !== 'boolean') return invalid();
      return { value: d.value, used: d.used };
    });
    if (dice.length !== 0 && dice.length !== 4) return invalid();
    return {
      ...p,
      color: color(p.color),
      out: p.out,
      turns: p.turns,
      commandUsed: p.commandUsed === true,
      dice,
      chopper: p.chopper == null ? null : point(p.chopper),
    };
  });
  if (!players.length || players.length > 4) return invalid();
  const cars = array(s.cars).map((value) => {
    const c = record(value);
    if (
      !text(c.id) ||
      (c.owner !== null && typeof c.owner !== 'string') ||
      !integer(c.size, 0, 2) ||
      (c.x !== null && !integer(c.x, -64, 64)) ||
      !integer(c.y, -1000000) ||
      !Array.isArray(c.damage) ||
      c.damage.length > 2 ||
      !c.damage.every((v) => v === true) ||
      typeof c.dead !== 'boolean'
    )
      return invalid();
    return {
      ...c,
      id: text(c.id),
      owner: typeof c.owner === 'string' ? c.owner : null,
      size: c.size,
      x: typeof c.x === 'number' ? c.x : null,
      y: c.y,
      damage: c.damage as boolean[],
      dead: c.dead,
      wreck: c.wreck === true,
      moved: c.moved === true,
      burning: c.burning === true,
      coasts: integer(c.coasts, 0, 2) ? c.coasts : 0,
    } as RaceCar;
  });
  if (cars.length > 16 || new Set(cars.map((c) => c.id)).size !== cars.length) return invalid();
  const tiles = array(s.tiles).map((value) => {
    const t = record(value);
    if (
      !integer(t.start) ||
      !integer(t.map, 0, 9) ||
      !integer(t.side, 0, 1) ||
      !Array.isArray(t.cells) ||
      t.cells.length !== 6
    )
      return invalid();
    const cells = t.cells.map((value) => {
      if (!Array.isArray(value) || value.length !== 8) return invalid();
      return value.map((value) => {
        const c = record(value);
        if (!['R', 'O', 'M', 'X', 'G', 'V', 'J', 'F', 'S'].includes(text(c.kind))) return invalid();
        if (c.hazard == null) return { kind: text(c.kind) };
        const h = record(c.hazard);
        if (typeof h.face !== 'boolean' || !text(h.kind) || (!h.face && h.kind !== 'unknown'))
          return invalid();
        return { kind: text(c.kind), hazard: { face: h.face, kind: text(h.kind) } };
      });
    });
    return { start: t.start, name: required(t.name), map: t.map, side: t.side, cells };
  });
  if (tiles.length > 3 || tiles.some((t, i) => i > 0 && t.start !== tiles[i - 1]!.start + 8))
    return invalid();
  let active: RaceActive | null = null;
  if (s.active != null) {
    const a = record(s.active);
    if (!text(a.car) || !integer(a.remaining, 0, 16)) return invalid();
    active = {
      ...a,
      car: text(a.car),
      remaining: a.remaining,
      coast: a.coast === true,
      roadEligible: a.roadEligible === true,
      bonusUsed: a.bonusUsed === true,
      drift: a.drift === true,
      driftUsed: a.driftUsed === true,
      stopped: a.stopped === true,
      saltBonus: a.saltBonus === true,
    };
  }
  let pending: RaceSlam | null = null;
  if (s.pending != null) {
    const p = record(s.pending);
    if (
      !text(p.top) ||
      !text(p.bottom) ||
      typeof p.topMoves !== 'boolean' ||
      !integer(p.direction, 0, 5)
    )
      return invalid();
    pending = {
      top: text(p.top),
      bottom: text(p.bottom),
      topMoves: p.topMoves,
      direction: p.direction,
      owner: typeof p.owner === 'string' ? p.owner : null,
    };
  }
  const check = diceCheck(s.diceCheck),
    events = array(s.events).map((value) => {
      const e = record(value);
      if (!integer(e.id) || !text(e.kind) || typeof e.text !== 'string') return invalid();
      return {
        ...e,
        id: e.id,
        kind: text(e.kind),
        text: e.text,
        ...(integer(e.afterMotion) ? { afterMotion: e.afterMotion } : {}),
      } as RaceEvent;
    }),
    motions = array(s.motions).map((value) => {
      const g = record(value);
      if (!integer(g.id) || !text(g.kind)) return invalid();
      const moves = array(g.moves).map((value) => {
        const m = record(value),
          from = record(m.from);
        if (
          (!text(m.car) && !text(m.player)) ||
          (from.x !== null && !integer(from.x, -64, 64)) ||
          !integer(from.y, -1000000)
        )
          return invalid();
        return {
          ...(text(m.car) ? { car: text(m.car) } : { player: text(m.player) }),
          from: { x: typeof from.x === 'number' ? from.x : null, y: from.y },
          to: point(m.to),
        };
      });
      return { id: g.id, kind: text(g.kind), moves };
    });
  if (
    events.length > 64 ||
    motions.length > 64 ||
    motions.reduce((sum, g) => sum + g.moves.length, 0) > 128
  )
    return invalid();
  let winner: RaceSnapshot['winner'] = null;
  if (s.winner != null) {
    const w = record(s.winner);
    winner = {
      id: typeof w.id === 'string' ? w.id : null,
      name: required(w.name),
      reason: required(w.reason),
    };
  }
  if (
    check?.kind === 'round' &&
    (s.turn !== -1 || s.first !== -1 || s.roadDie !== null || players.some((p) => p.dice.length))
  )
    return invalid();
  return {
    ...base,
    type: 'thunder',
    phase: base.phase as RacePhase,
    round: s.round,
    version: s.version,
    options: { devilsRun: options.devilsRun },
    turn: s.turn,
    first: integer(s.first, -1, 3) ? s.first : -1,
    roadDie: integer(s.roadDie, 1, 3) ? s.roadDie : null,
    deadline: finite(s.deadline) ? s.deadline : null,
    actor: typeof s.actor === 'string' ? s.actor : null,
    active,
    pending,
    diceCheck: check,
    finishAt: integer(s.finishAt) ? s.finishAt : null,
    tileCount: integer(s.tileCount) ? s.tileCount : 0,
    winner,
    legalMoves: array(s.legalMoves).map(point),
    targets: ids(s.targets),
    available: ids(s.available),
    players,
    cars,
    tiles,
    events,
    motions,
    log: array(s.log)
      .map((v) => text(v))
      .slice(0, 60),
  };
}
export interface RaceVisual {
  min: number;
  tiles: RaceTile[];
  cars: RaceCar[];
  players: RacePlayer[];
}
export interface RaceMovementOwner {
  prepare(
    s: RaceSnapshot,
    events: RaceEvent[],
    fallback: unknown[],
    options: { live: boolean; previous: RaceSnapshot | null },
  ): void;
  view(s: RaceSnapshot): RaceVisual;
  attach(svg: SVGSVGElement, min: number): void;
  locked(): boolean;
  inCue(): boolean;
  claims(id: number): boolean;
  skipCue(): boolean;
  cancel(): void;
  reset(): void;
  destroy(): void;
}
export interface RaceSoundFrame {
  live: boolean;
  epoch: number;
  events: RaceEvent[];
  motions: RaceMotion[];
}
export interface RaceSoundOwner {
  update(s: RaceSnapshot, o: { connected: boolean }): RaceSoundFrame;
  events(e: RaceEvent[], o?: { reveal?: boolean }): void;
  motion(g: RaceMotion): void;
  motions(g: RaceMotion[]): void;
  rolling(cycle: { cycleKey: string; live: boolean; epoch: number }): void;
  disconnect(): void;
  reset(): void;
  destroy(): void;
}
declare global {
  interface Window {
    RacePaths?: {
      routes(s: RaceSnapshot): Map<string, RaceRoute>;
      key(x: number, y: number): string;
    };
    RaceMovement?: {
      mount(o: {
        onCue(v: { events: RaceEvent[]; duration: number }): void;
        onMove(g: RaceMotion): void;
        onSettled(v: { cancelled: boolean }): void;
      }): RaceMovementOwner;
    };
    RaceDiceDialog?: {
      faceMarkup(value: number): string;
      mount(o: {
        onRolling(cycle: { checkId: number; cycleKey: string; live: boolean; epoch: number }): void;
        onAction(action: string, data: Record<string, unknown>): Promise<void>;
      }): {
        show(
          s: RaceSnapshot,
          o: { live: boolean; deferred?: boolean; soundLive?: boolean; soundEpoch?: number },
        ): void;
        reset(): void;
        destroy(): void;
      };
    };
    RaceGameSounds?: { create(): RaceSoundOwner };
    RaceVehicleEffects?: {
      mount(): {
        show(e: RaceEvent[], s: RaceSnapshot, o: { min: number }): void;
        reset(): void;
        destroy(): void;
      };
    };
  }
}
