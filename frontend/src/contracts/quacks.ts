import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot } from './room';
import type { GameSoundOwner } from './sounds';
export const ingredientNames = {
  white: '白色炸彈',
  orange: '南瓜',
  blue: '烏鴉頭骨',
  red: '毒蘑菇',
  yellow: '曼德拉草',
  green: '花園蜘蛛',
  black: '非洲骷髏天蛾',
  purple: '幽靈氣息',
  locoweed: '愚人草',
};
export type IngredientColor = keyof typeof ingredientNames;
export type WitchColor = 'gold' | 'copper' | 'silver';
export interface Ingredient {
  color: IngredientColor;
  value: number;
}
export interface QuacksChip extends Ingredient {
  id: string;
  position?: number;
  fromPosition?: number;
  effectColor?: IngredientColor;
  effectValue?: number;
  must?: boolean;
  noEffect?: boolean;
}
export interface QuacksBook {
  color: IngredientColor;
  name: string;
  set: number;
  faceName: string;
  effect: string;
  offers: { value: number; price: number }[];
}
export interface QuacksFortune {
  id: string;
  name: string;
  text: string;
  timing?: string;
}
export interface QuacksWitch {
  id: string;
  name: string;
  text: string;
  color?: WitchColor;
}
export interface QuacksPatient {
  id: string;
  name: string;
  text: string;
  track: { position: number; text: string }[];
}
export interface QuacksCalculation {
  colors: number;
  exactSeven: number;
  explosions: number;
  locoweed: number;
  fortune: number;
}
export interface QuacksAlchemy {
  patientId: string | null;
  essence: number;
  max: number;
  confirmed: boolean;
  diceRemaining: number;
  pool: QuacksChip[];
  drawablePool: QuacksChip[];
  returnable: QuacksChip[];
  patient: QuacksPatient | null;
  rewardText: string;
  calculation: QuacksCalculation | null;
}
export interface QuacksRecipe {
  id: string;
  name: string;
  potColor: string;
  potName: string;
  score: number;
  bagCount: number;
  rat: number;
  rubies: number;
  droplet: number;
  stopped: boolean;
  exploded: boolean;
  explosionId: string | null;
  ready: boolean;
  chosen: boolean;
  hidden: boolean;
  position: number | null;
  startPosition: number | null;
  pot: QuacksChip[] | null;
  overflow: QuacksChip[] | null;
  white: number | null;
  threshold: number | null;
  draws: number | null;
  coins: Partial<Record<WitchColor, boolean>> | null;
  bonusEligible: boolean | null;
  bonusDice: number[];
  alchemy: {
    patientId: string | null;
    essence: number;
    confirmed: boolean;
    calculation: QuacksCalculation | null;
  } | null;
}
export interface QuacksChoiceOption {
  id: string;
  label: string;
  disabled: boolean;
  coin?: WitchColor;
  ingredient?: Ingredient & { fromValue?: number; fromColor?: IngredientColor };
  ingredients?: (Ingredient & { fromValue?: number; fromColor?: IngredientColor })[];
  cost?: { resource: string; amount: number };
}
export interface QuacksPending {
  id: string;
  title: string;
  kind: string | null;
  options: QuacksChoiceOption[];
}
export interface QuacksEvent {
  id: string;
  at: number;
  decision?: boolean;
  step?: number;
}
export interface QuacksPurchase extends Ingredient {
  price: number;
  canUndo: boolean;
}
export interface QuacksMine {
  drawEvents: QuacksEvent[];
  potionEvents: QuacksEvent[];
  stopEvents: QuacksEvent[];
  settlementEvents: QuacksEvent[];
  alchemy: QuacksAlchemy | null;
  canVisit: boolean;
  visitorUsed: boolean;
  canGoodNeighbor: boolean;
  bagCount: number;
  bagPeek: { id: string; round: number; chips: Ingredient[] } | null;
  peekUsed: boolean;
  peekAvailable: boolean;
  potion: boolean;
  bonusEligible: boolean;
  bonusRolled: boolean;
  bonusDice: number[];
  effectSummary: { color: string; text: string; triggered?: boolean }[];
  coins: Partial<Record<WitchColor, boolean>>;
  position: number;
  white: number;
  threshold: number;
  reserve: QuacksChip[];
  pending: QuacksPending | null;
  budget: number;
  extraBudget: number;
  extraBought: QuacksPurchase[];
  bought: QuacksPurchase[];
  canBuy: boolean;
  canScore: boolean;
  discount: number;
  ready: boolean;
  draws: number;
  canDraw: boolean;
  canPotion: boolean;
  witchAvailable: Partial<Record<WitchColor, boolean>>;
  waitingEffect: boolean;
}
export interface QuacksResult {
  round: number;
  fortune: QuacksFortune;
  players: {
    id: string;
    name: string;
    score: number;
    exploded: boolean;
    position: number;
    draws: number;
    field: { position: number; coins: number; points: number; ruby: boolean };
    pot: QuacksChip[];
    overflow: QuacksChip[];
    bought: (Ingredient & { price?: number })[];
    rubies: number;
    dice: number[];
    alchemy?: { patientId: string | null; essence: number; calculation: QuacksCalculation | null };
  }[];
}
export interface QuacksSnapshot extends RoomSnapshot {
  events: { id: number; kind: string; text: string }[];
  type: 'quacks';
  phase:
    | 'waiting'
    | 'patients'
    | 'fortune'
    | 'brewing'
    | 'settlement'
    | 'round-intro'
    | 'between'
    | 'finished';
  round: number;
  roundLimit: number;
  roundId: string | null;
  interrupted: boolean;
  maxPlayers: number;
  step: number;
  stage: string | null;
  nextRoundAt: number | null;
  options: {
    witches: boolean;
    alchemists: boolean;
    hiddenProgress: boolean;
    bookSet: number;
    books?: Partial<Record<IngredientColor, number>>;
  };
  potColors: Record<string, { name: string; liquid: string[] }>;
  fortune: QuacksFortune | null;
  fortuneRevealId: string | null;
  fortuneDrawnAt: number | null;
  roundStarterId: string | null;
  bookSelection: {
    color: IngredientColor;
    name: string;
    candidates: QuacksBook[];
    selected: number;
    chosenBy: string | null;
  }[];
  books: QuacksBook[];
  recipes: QuacksRecipe[];
  mine: QuacksMine | null;
  witches: Partial<Record<WitchColor, QuacksWitch>>;
  visitingWitch: QuacksWitch | null;
  patients: QuacksPatient[];
  board: { position: number; coins: number; points: number; ruby: boolean }[];
  rollEvents: {
    id: string;
    playerId: string;
    name: string;
    potName: string;
    face: number;
    potColor: string;
    source: string;
    round: number;
    at: number;
  }[];
  results: QuacksResult[];
  winner: { score: number; names: string[] } | null;
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v),
  int = (v: unknown): v is number => Number.isSafeInteger(v);
function bad(): never {
  throw Error('郎中闖江湖房間資料格式不正確。');
}
const num = (v: unknown, fallback = 0) => (v === undefined ? fallback : finite(v) ? v : bad());
const natural = (v: unknown, fallback = 0) => {
  const n = num(v, fallback);
  return int(n) && n >= 0 ? n : bad();
};
const bool = (v: unknown) => (v === undefined ? false : typeof v === 'boolean' ? v : bad());
const string = (v: unknown) => (typeof v === 'string' ? v : bad());
const nullable = (v: unknown) => (v === null || v === undefined ? null : string(v));
const color = (v: unknown): IngredientColor =>
  Object.hasOwn(ingredientNames, text(v)) ? (v as IngredientColor) : bad();
const coin = (v: unknown): WitchColor =>
  ['gold', 'copper', 'silver'].includes(text(v)) ? (v as WitchColor) : bad();
function ingredient(v: unknown): Ingredient {
  const r = record(v),
    value = natural(r.value);
  if (value < 1 || value > 6) return bad();
  return { color: color(r.color), value };
}
function chip(v: unknown): QuacksChip {
  const r = record(v);
  if (!text(r.id)) return bad();
  return {
    ...ingredient(r),
    id: string(r.id),
    ...(r.position !== undefined ? { position: natural(r.position) } : {}),
    ...(r.fromPosition !== undefined ? { fromPosition: natural(r.fromPosition) } : {}),
    ...(r.effectColor !== undefined ? { effectColor: color(r.effectColor) } : {}),
    ...(r.effectValue !== undefined ? { effectValue: natural(r.effectValue) } : {}),
    ...(r.must !== undefined ? { must: bool(r.must) } : {}),
    ...(r.noEffect !== undefined ? { noEffect: bool(r.noEffect) } : {}),
  };
}
const chips = (v: unknown) => array(v).map(chip);
function book(v: unknown): QuacksBook {
  const r = record(v);
  return {
    color: color(r.color),
    name: string(r.name),
    set: natural(r.set),
    faceName: string(r.faceName),
    effect: string(r.effect),
    offers: array(r.offers).map((v) => {
      const o = record(v);
      return { value: natural(o.value), price: natural(o.price) };
    }),
  };
}
function fortune(v: unknown): QuacksFortune {
  const r = record(v);
  return {
    id: string(r.id),
    name: string(r.name),
    text: string(r.text),
    ...(typeof r.timing === 'string' ? { timing: r.timing } : {}),
  };
}
function witch(v: unknown): QuacksWitch {
  const r = record(v);
  return {
    id: string(r.id),
    name: string(r.name),
    text: string(r.text),
    ...(r.color !== undefined ? { color: coin(r.color) } : {}),
  };
}
function calculation(v: unknown): QuacksCalculation | null {
  if (v === null || v === undefined) return null;
  const r = record(v);
  return {
    colors: natural(r.colors),
    exactSeven: natural(r.exactSeven),
    explosions: natural(r.explosions),
    locoweed: natural(r.locoweed),
    fortune: natural(r.fortune),
  };
}
function patient(v: unknown, raw = false): QuacksPatient {
  const r = record(v);
  return {
    id: string(r.id),
    name: string(r.name),
    text: string(r.text),
    track: array(r.track).map((v, index) => {
      const t = record(v);
      return {
        position: natural(t.position, index),
        text: raw && t.text === undefined ? '' : string(t.text),
      };
    }),
  };
}
function alchemy(v: unknown): QuacksAlchemy | null {
  if (v === null) return null;
  const r = record(v);
  return {
    patientId: nullable(r.patientId),
    essence: natural(r.essence),
    max: natural(r.max),
    confirmed: bool(r.confirmed),
    diceRemaining: natural(r.diceRemaining),
    pool: chips(r.pool),
    drawablePool: chips(r.drawablePool),
    returnable: chips(r.returnable),
    patient: r.patient === null ? null : patient(r.patient, true),
    rewardText: string(r.rewardText),
    calculation: calculation(r.calculation),
  };
}
const coins = (v: unknown): Partial<Record<WitchColor, boolean>> =>
  Object.fromEntries(Object.entries(record(v)).map(([k, v]) => [coin(k), bool(v)]));
const dice = (v: unknown) =>
  array(v === undefined ? [] : v).map((v) => {
    const n = natural(v);
    return n <= 5 ? n : bad();
  });
function recipe(v: unknown): QuacksRecipe {
  const r = record(v),
    hidden = bool(r.hidden),
    pot = r.pot === null ? null : chips(r.pot),
    overflow = r.overflow === null ? null : chips(r.overflow);
  if (
    hidden &&
    [r.position, r.startPosition, r.white, r.threshold, r.draws, r.pot, r.overflow].some(
      (v) => v !== null,
    )
  )
    return bad();
  let a: QuacksRecipe['alchemy'] = null;
  if (r.alchemy !== null && r.alchemy !== undefined) {
    const x = record(r.alchemy);
    a = {
      patientId: nullable(x.patientId),
      essence: natural(x.essence),
      confirmed: bool(x.confirmed),
      calculation: calculation(x.calculation),
    };
  }
  return {
    id: string(r.id),
    name: string(r.name),
    potColor: string(r.potColor),
    potName: string(r.potName),
    score: num(r.score),
    bagCount: natural(r.bagCount),
    rat: natural(r.rat),
    rubies: natural(r.rubies),
    droplet: natural(r.droplet),
    stopped: bool(r.stopped),
    exploded: bool(r.exploded),
    explosionId: nullable(r.explosionId),
    ready: bool(r.ready),
    chosen: bool(r.chosen),
    hidden,
    position: r.position === null ? null : natural(r.position),
    startPosition: r.startPosition === null ? null : natural(r.startPosition),
    pot,
    overflow,
    white: r.white === null ? null : natural(r.white),
    threshold: r.threshold === null ? null : natural(r.threshold, 7),
    draws: r.draws === null ? null : natural(r.draws),
    coins: r.coins === null ? null : coins(r.coins),
    bonusEligible: r.bonusEligible === null ? null : bool(r.bonusEligible),
    bonusDice: dice(r.bonusDice),
    alchemy: a,
  };
}
function choiceIngredient(v: unknown) {
  const r = record(v);
  return {
    ...ingredient(r),
    ...(r.fromValue !== undefined ? { fromValue: natural(r.fromValue) } : {}),
    ...(r.fromColor !== undefined ? { fromColor: color(r.fromColor) } : {}),
  };
}
function pending(v: unknown): QuacksPending | null {
  if (v === null) return null;
  const r = record(v);
  return {
    id: string(r.id),
    title: string(r.title),
    kind: nullable(r.kind),
    options: array(r.options).map((v) => {
      const o = record(v);
      return {
        id: string(o.id),
        label: string(o.label),
        disabled: bool(o.disabled),
        ...(o.coin !== undefined ? { coin: coin(o.coin) } : {}),
        ...(o.ingredient ? { ingredient: choiceIngredient(o.ingredient) } : {}),
        ...(o.ingredients ? { ingredients: array(o.ingredients).map(choiceIngredient) } : {}),
        ...(o.cost
          ? {
              cost: {
                resource: string(record(o.cost).resource),
                amount: natural(record(o.cost).amount),
              },
            }
          : {}),
      };
    }),
  };
}
function events(v: unknown): QuacksEvent[] {
  return array(v).map((v) => {
    const r = record(v);
    return {
      id: string(r.id),
      at: num(r.at),
      ...(r.decision !== undefined ? { decision: bool(r.decision) } : {}),
      ...(r.step !== undefined ? { step: natural(r.step) } : {}),
    };
  });
}
function purchase(v: unknown): QuacksPurchase {
  const r = record(v);
  return { ...ingredient(r), price: natural(r.price), canUndo: bool(r.canUndo) };
}
function mine(v: unknown): QuacksMine | null {
  if (v === null) return null;
  const r = record(v);
  let peek: QuacksMine['bagPeek'] = null;
  if (r.bagPeek) {
    const p = record(r.bagPeek);
    peek = { id: string(p.id), round: natural(p.round), chips: array(p.chips).map(ingredient) };
  }
  return {
    drawEvents: events(r.drawEvents),
    potionEvents: events(r.potionEvents),
    stopEvents: events(r.stopEvents),
    settlementEvents: events(r.settlementEvents),
    alchemy: alchemy(r.alchemy),
    canVisit: bool(r.canVisit),
    visitorUsed: bool(r.visitorUsed),
    canGoodNeighbor: bool(r.canGoodNeighbor),
    bagCount: natural(r.bagCount),
    bagPeek: peek,
    peekUsed: bool(r.peekUsed),
    peekAvailable: bool(r.peekAvailable),
    potion: bool(r.potion),
    bonusEligible: bool(r.bonusEligible),
    bonusRolled: bool(r.bonusRolled),
    bonusDice: dice(r.bonusDice),
    effectSummary: array(r.effectSummary).map((v) => {
      const x = record(v);
      return {
        color: string(x.color),
        text: string(x.text),
        ...(x.triggered !== undefined ? { triggered: bool(x.triggered) } : {}),
      };
    }),
    coins: coins(r.coins),
    position: natural(r.position),
    white: natural(r.white),
    threshold: natural(r.threshold),
    reserve: chips(r.reserve),
    pending: pending(r.pending),
    budget: natural(r.budget),
    extraBudget: natural(r.extraBudget),
    extraBought: array(r.extraBought).map(purchase),
    bought: array(r.bought).map(purchase),
    canBuy: bool(r.canBuy),
    canScore: bool(r.canScore),
    discount: natural(r.discount),
    ready: bool(r.ready),
    draws: natural(r.draws),
    canDraw: bool(r.canDraw),
    canPotion: bool(r.canPotion),
    witchAvailable: coins(r.witchAvailable),
    waitingEffect: bool(r.waitingEffect),
  };
}
export function readQuacksSnapshot(value: unknown): QuacksSnapshot {
  const base = readRoomSnapshot(value),
    r = record(value),
    o = record(r.options);
  if (
    base.type !== 'quacks' ||
    ![
      'waiting',
      'patients',
      'fortune',
      'brewing',
      'settlement',
      'round-intro',
      'between',
      'finished',
    ].includes(base.phase) ||
    natural(r.round) > 9
  )
    return bad();
  const optionBooks =
    o.books === undefined
      ? undefined
      : Object.fromEntries(Object.entries(record(o.books)).map(([k, v]) => [color(k), natural(v)]));
  const recipes = array(r.recipes).map(recipe);
  if (
    recipes.length > 8 ||
    new Set(recipes.map((p) => p.id)).size !== recipes.length ||
    !recipes.some((p) => p.id === base.me)
  )
    return bad();
  const potColors = Object.fromEntries(
    Object.entries(record(r.potColors)).map(([k, v]) => {
      const x = record(v),
        liquid = array(x.liquid).map(string);
      if (liquid.length !== 3 || !liquid.every((c) => /^#[a-f0-9]{6}$/i.test(c))) return bad();
      return [k, { name: string(x.name), liquid }];
    }),
  );
  const results = array(r.results).map((v) => {
    const q = record(v);
    return {
      round: natural(q.round),
      fortune: fortune(q.fortune),
      players: array(q.players).map((v) => {
        const p = record(v);
        return {
          id: string(p.id),
          name: string(p.name),
          score: num(p.score),
          exploded: bool(p.exploded),
          position: natural(p.position),
          draws: natural(p.draws),
          field: {
            position: natural(record(p.field).position),
            coins: natural(record(p.field).coins),
            points: natural(record(p.field).points),
            ruby: bool(record(p.field).ruby),
          },
          pot: chips(p.pot),
          overflow: chips(p.overflow),
          bought: array(p.bought).map((v) => ({
            ...ingredient(v),
            ...(record(v).price !== undefined ? { price: natural(record(v).price) } : {}),
          })),
          rubies: natural(p.rubies),
          dice: dice(p.dice),
          ...(p.alchemy
            ? {
                alchemy: {
                  patientId: nullable(record(p.alchemy).patientId),
                  essence: natural(record(p.alchemy).essence),
                  calculation: calculation(record(p.alchemy).calculation),
                },
              }
            : {}),
        };
      }),
    };
  });
  let winner: QuacksSnapshot['winner'] = null;
  if (r.winner) {
    const w = record(r.winner);
    winner = { score: num(w.score), names: array(w.names).map(string) };
  }
  return {
    ...base,
    events: array(r.events).map((v) => {
      const e = record(v);
      return { id: natural(e.id), kind: string(e.kind), text: string(e.text) };
    }),
    type: 'quacks',
    phase: base.phase as QuacksSnapshot['phase'],
    round: natural(r.round),
    roundLimit: natural(r.roundLimit),
    roundId: nullable(r.roundId),
    interrupted: bool(r.interrupted),
    maxPlayers: natural(r.maxPlayers),
    step: natural(r.step),
    stage: nullable(r.stage),
    nextRoundAt: r.nextRoundAt === null ? null : num(r.nextRoundAt),
    options: {
      witches: bool(o.witches),
      alchemists: bool(o.alchemists),
      hiddenProgress: bool(o.hiddenProgress),
      bookSet: natural(o.bookSet),
      ...(optionBooks ? { books: optionBooks } : {}),
    },
    potColors,
    fortune: r.fortune === null ? null : fortune(r.fortune),
    fortuneRevealId: nullable(r.fortuneRevealId),
    fortuneDrawnAt:
      r.fortuneDrawnAt === null || r.fortuneDrawnAt === undefined ? null : num(r.fortuneDrawnAt),
    roundStarterId: nullable(r.roundStarterId),
    bookSelection: array(r.bookSelection).map((v) => {
      const b = record(v);
      return {
        color: color(b.color),
        name: string(b.name),
        candidates: array(b.candidates).map(book),
        selected: natural(b.selected),
        chosenBy: nullable(b.chosenBy),
      };
    }),
    books: array(r.books).map(book),
    recipes,
    mine: mine(r.mine),
    witches: Object.fromEntries(
      Object.entries(record(r.witches)).map(([k, v]) => [coin(k), witch(v)]),
    ),
    visitingWitch: r.visitingWitch === null ? null : witch(r.visitingWitch),
    patients: array(r.patients).map((v) => patient(v)),
    board: array(r.board).map((v) => {
      const b = record(v);
      return {
        position: natural(b.position),
        coins: natural(b.coins),
        points: natural(b.points),
        ruby: bool(b.ruby),
      };
    }),
    rollEvents: array(r.rollEvents).map((v) => {
      const e = record(v);
      return {
        id: string(e.id),
        playerId: string(e.playerId),
        name: string(e.name),
        potName: string(e.potName),
        face: natural(e.face),
        potColor: string(e.potColor),
        source: string(e.source),
        round: natural(e.round),
        at: num(e.at),
      };
    }),
    results,
    winner,
  };
}
export interface QuacksInsight {
  title: string;
  effect: string;
  caption: string;
  color: string;
}
export interface QuacksLeafOwner {
  update(state: QuacksSnapshot, live: boolean): void;
  clear(): void;
  destroy(): void;
}
declare global {
  interface Window {
    QuacksArt?: {
      token(chip: Ingredient, options?: { size?: number; decorative?: boolean }): SVGElement;
      resource(kind: string, options?: { size?: number; decorative?: boolean }): SVGElement;
      cauldron(
        state: QuacksSnapshot,
        recipe: QuacksRecipe,
        inspect: (details: QuacksInsight, event: Event, anchor: Element) => void,
        dismiss: (anchor?: Element) => void,
      ): SVGElement;
      patientPortrait(id: string): SVGElement;
      essenceFlask(value: number): SVGElement;
      canInspect(state: QuacksSnapshot, recipe: QuacksRecipe): boolean;
      names: typeof ingredientNames;
    };
    QuacksFx?: {
      create(host: HTMLElement): QuacksLeafOwner;
      createExplosion(host: HTMLElement): QuacksLeafOwner & {
        show(events: { id: string; playerId?: string; name: string }[]): void;
      };
      createAudio(
        sounds: GameSoundOwner | undefined,
        options: {
          onExplosion(events: { id: string; playerId: string; name: string }[]): void;
          onClear(): void;
        },
      ): QuacksLeafOwner;
      createScoreboard(
        host: HTMLElement,
        legend: HTMLElement,
      ): { update(state: QuacksSnapshot, live: boolean): void };
      die(face: number, size?: number, tones?: string[]): HTMLElement;
    };
  }
}
