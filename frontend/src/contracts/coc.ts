import { array, record, text, number, strings } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot } from './room';
function readCocMedia(value: unknown): CocSnapshot['exploration'] {
  const media = value ? record(value) : { map: null, illustrations: [] },
    map = media.map ? record(media.map) : null;
  return {
    map: map
      ? {
          title: text(map.title),
          note: text(map.note),
          width: number(map.width),
          height: number(map.height),
          nodes: array(map.nodes).map((value) => {
            const node = record(value);
            return {
              id: text(node.id),
              label: text(node.label),
              name: text(node.name),
              x: number(node.x),
              y: number(node.y),
              status: text(node.status),
            };
          }),
          links: array(map.links).map((value) => {
            const link = record(value);
            return { from: text(link.from), to: text(link.to) };
          }),
        }
      : null,
    illustrations: array(media.illustrations)
      .map((value) => {
        const art = record(value);
        return {
          id: text(art.id),
          scene: text(art.scene),
          title: text(art.title),
          alt: text(art.alt),
          current: art.current === true,
          url: text(art.url),
          smallUrl: text(art.smallUrl),
          mediumUrl: text(art.mediumUrl),
        };
      })
      .filter((art) =>
        [art.url, art.smallUrl, art.mediumUrl].every((url) =>
          /^\/api\/coc\/media\/[a-f0-9-]{36}\/[a-z0-9-]+\?size=(256|512|1024)&v=[a-f0-9]{64}$/.test(
            url,
          ),
        ),
      ),
  };
}
export interface CocDraft {
  name: string;
  age: number;
  archetype: string;
  core: string;
  occupation: string;
  attributes: Record<string, number>;
  luck: number;
  talents: string[];
  equipment: string[];
  background: Record<string, string>;
  allocations: Record<string, Record<string, number>>;
  skills?: Record<string, number>;
}
export interface CocCharacter {
  id: string;
  name: string;
  status: string;
  revision: number;
  draft: CocDraft;
  continued: boolean;
  budgets: Record<string, number>;
  sheet: Record<string, unknown> | null;
}
export interface CocCatalog {
  attributes: Record<string, string>;
  skills: { id: string; name: string; base: number | string }[];
  archetypes: { id: string; name: string; cores: string[]; skills: string[] }[];
  occupations: { id: string; name: string; formula: string; credit: number[]; skills: string[] }[];
  talents: { id: string; name: string; effect: string }[];
  support: string;
}
const numbers = (value: unknown) =>
  Object.fromEntries(Object.entries(record(value)).map(([id, v]) => [id, number(v)]));
export function readCocDraft(value: unknown): CocDraft {
  const r = record(value);
  return {
    name: text(r.name),
    age: number(r.age),
    archetype: text(r.archetype),
    core: text(r.core),
    occupation: text(r.occupation),
    attributes: numbers(r.attributes),
    luck: number(r.luck),
    talents: strings(r.talents),
    equipment: strings(r.equipment),
    background: Object.fromEntries(
      Object.entries(record(r.background)).map(([id, v]) => [id, text(v)]),
    ),
    allocations: Object.fromEntries(
      Object.entries(record(r.allocations)).map(([id, v]) => [id, numbers(v)]),
    ),
    ...(r.skills ? { skills: numbers(r.skills) } : {}),
  };
}
export function readCocCharacter(value: unknown): CocCharacter {
  const r = record(value);
  return {
    id: text(r.id),
    name: text(r.name),
    status: text(r.status),
    revision: number(r.revision),
    draft: readCocDraft(r.draft),
    continued: r.continued === true,
    budgets: numbers(r.budgets),
    sheet: r.sheet ? record(r.sheet) : null,
  };
}
export function readCocLibrary(value: unknown): {
  catalog: CocCatalog;
  characters: CocCharacter[];
} {
  const root = record(value),
    c = record(root.catalog);
  return {
    characters: array(root.characters).map(readCocCharacter),
    catalog: {
      attributes: Object.fromEntries(
        Object.entries(record(c.attributes)).map(([id, v]) => [id, text(v)]),
      ),
      skills: array(c.skills).map((v) => {
        const r = record(v);
        return {
          id: text(r.id),
          name: text(r.name),
          base: typeof r.base === 'number' ? r.base : text(r.base),
        };
      }),
      archetypes: array(c.archetypes).map((v) => {
        const r = record(v);
        return {
          id: text(r.id),
          name: text(r.name),
          cores: strings(r.cores),
          skills: strings(r.skills),
        };
      }),
      occupations: array(c.occupations).map((v) => {
        const r = record(v);
        return {
          id: text(r.id),
          name: text(r.name),
          formula: text(r.formula),
          credit: array(r.credit).map((v) => number(v)),
          skills: strings(r.skills),
        };
      }),
      talents: array(c.talents).map((v) => {
        const r = record(v);
        return { id: text(r.id), name: text(r.name), effect: text(r.effect) };
      }),
      support: text(c.support),
    },
  };
}
export interface CocRoll {
  roll: number;
  target: number;
  level: number;
  bonus: number;
  luckSpent?: number;
}
export interface CocHero extends CocDraft {
  seat: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  san: number;
  condition: string;
  skills: Record<string, number>;
  knowsChant: boolean;
  phobias: string[];
  ammunition: { loaded: number; reserve: number };
  blazeUsed: boolean;
  consciousLuckRounds: number;
  held: number;
}
export interface CocBattle {
  id: string;
  kind: string;
  round: number;
  turn: string;
  foundDuncan: boolean;
  dig: number;
  escaped: string[];
  prepared: Record<string, { weapon: string; readied: boolean }>;
  waiting: { kind: string; actor: string; monster: string } | null;
  injury: { id: string; actor: string; reason: string; condition: string } | null;
  resolution: {
    id: string;
    kind: string;
    actor: string;
    target: string;
    roll: CocRoll | null;
    rolls: CocRoll[];
    attack: CocRoll | null;
    defense: CocRoll | null;
    poison: CocRoll | null;
  } | null;
  monsters: {
    id: string;
    kind: string;
    name: string;
    hp: number | null;
    maxHp: number;
    limbs: number[];
    corporeal: boolean;
  }[];
}
export interface CocSnapshot extends RoomSnapshot {
  tutorial: boolean;
  playEnabled: boolean;
  canEndInvestigation: boolean;
  replacementDeferred: boolean;
  skillLabels: Record<string, string>;
  attributeLabels: Record<string, string>;
  campaignId: string;
  campaignRevision: number;
  minutes: number;
  session: number;
  recovery: { session: number; pending: string[] } | null;
  development: { actor: string; status: string; skills: string[] }[];
  modules: { id: string; title: string }[];
  module: {
    id: string;
    title: string;
    originalTitle: string;
    author: string;
    era: string;
    place: string;
    source: string;
    license: string;
    note: string;
  };
  scene: { id: string; name: string; description: string };
  exploration: {
    map: null | {
      title: string;
      note: string;
      width: number;
      height: number;
      nodes: { id: string; label: string; name: string; x: number; y: number; status: string }[];
      links: { from: string; to: string }[];
    };
    illustrations: {
      id: string;
      scene: string;
      title: string;
      alt: string;
      current: boolean;
      url: string;
      smallUrl: string;
      mediumUrl: string;
    }[];
  };
  ai: { provider: string; source: string; tokenLimit: number };
  cli: { enabled: boolean; ready: boolean; model: string; message: string };
  usage: { input: number; output: number; budgetUsed: number };
  heroes: CocHero[];
  clues: { id: string; title: string; text: string }[];
  journal: { id: string; kind: string; text: string; minutes: number }[];
  pending: { id: string; actor: string; stage: string; status: string; error: string } | null;
  offer: {
    id: string;
    actor: string;
    label: string;
    risk: string;
    minutes: number;
    party: boolean;
    unanimous: boolean;
    votes: Record<string, boolean | null>;
    electorate: string[];
  } | null;
  check: {
    id: string;
    actor: string;
    label: string;
    skill: string;
    difficulty: string;
    status: string;
    pushed: boolean;
    noPush: boolean;
    tiebreak: boolean;
    opposition: { level: number; roll: number | null } | null;
    roll: CocRoll | null;
  } | null;
  combat: CocBattle | null;
  sanity: {
    id: string;
    actor: string;
    reason: string;
    status: string;
    result: { loss: number; roll: CocRoll | null } | null;
  } | null;
  actions: { id: string; label: string; minutes: number; confirm: boolean; risk: string }[];
  destinations: { id: string; name: string; minutes: number }[];
  pauseReason: string;
  result: Record<string, unknown> | null;
}
function readRoll(value: unknown): CocRoll | null {
  if (!value) return null;
  const r = record(value);
  return {
    roll: number(r.roll),
    target: number(r.target),
    level: number(r.level),
    bonus: number(r.bonus),
    ...(typeof r.luckSpent === 'number' ? { luckSpent: r.luckSpent } : {}),
  };
}
export function readCocSnapshot(value: unknown): CocSnapshot {
  const base = readRoomSnapshot(value),
    r = record(value),
    m = record(r.module),
    s = record(r.scene),
    ai = record(r.ai),
    u = record(r.usage),
    cli = record(r.cli);
  if (base.type !== 'coc' || !text(r.campaignId) || !Number.isSafeInteger(r.campaignRevision))
    throw Error('冒險存檔格式不正確');
  const pending = r.pending ? record(r.pending) : null,
    offer = r.offer ? record(r.offer) : null,
    check = r.check ? record(r.check) : null,
    sanity = r.sanity ? record(r.sanity) : null;
  const sr = sanity?.result ? record(sanity.result) : null;
  return {
    ...base,
    tutorial: r.tutorial === true,
    playEnabled: r.playEnabled === true,
    canEndInvestigation: r.canEndInvestigation === true,
    replacementDeferred: r.replacementDeferred === true,
    campaignId: text(r.campaignId),
    campaignRevision: number(r.campaignRevision),
    minutes: number(r.minutes),
    session: number(r.session),
    recovery: r.recovery
      ? {
          session: number(record(r.recovery).session),
          pending: strings(record(r.recovery).pending),
        }
      : null,
    development: array(r.development).map((v) => {
      const x = record(v);
      return { actor: text(x.actor), status: text(x.status), skills: strings(x.skills) };
    }),
    skillLabels: Object.fromEntries(
      Object.entries(record(r.skillLabels)).map(([id, v]) => [id, text(v)]),
    ),
    attributeLabels: Object.fromEntries(
      Object.entries(record(r.attributeLabels)).map(([id, v]) => [id, text(v)]),
    ),
    modules: array(r.modules).map((value) => {
      const m = record(value);
      return { id: text(m.id), title: text(m.title) };
    }),
    module: {
      id: text(m.id),
      title: text(m.title),
      originalTitle: text(m.originalTitle),
      author: text(m.author),
      era: text(m.era),
      place: text(m.place),
      source: text(m.source),
      license: text(m.license),
      note: text(m.note),
    },
    scene: { id: text(s.id), name: text(s.name), description: text(s.description) },
    exploration: readCocMedia(r.exploration),
    ai: { provider: text(ai.provider), source: text(ai.source), tokenLimit: number(ai.tokenLimit) },
    cli: {
      enabled: cli.enabled === true,
      ready: cli.ready === true,
      model: text(cli.model),
      message: text(cli.message),
    },
    usage: { input: number(u.input), output: number(u.output), budgetUsed: number(u.budgetUsed) },
    heroes: array(r.heroes).map((value) => {
      const h = record(value),
        ammo = record(h.ammunition);
      return {
        ...readCocDraft(value),
        seat: text(h.seat),
        hp: number(h.hp),
        maxHp: number(h.maxHp),
        mp: number(h.mp),
        maxMp: number(h.maxMp),
        san: number(h.san),
        condition: text(h.condition),
        skills: numbers(h.skills),
        knowsChant: h.knowsChant === true,
        phobias: strings(h.phobias),
        ammunition: { loaded: number(ammo.loaded), reserve: number(ammo.reserve) },
        blazeUsed: h.blazeUsed === true,
        consciousLuckRounds: number(h.consciousLuckRounds),
        held: number(h.held),
      };
    }),
    clues: array(r.clues).map((v) => {
      const x = record(v);
      return { id: text(x.id), title: text(x.title), text: text(x.text) };
    }),
    journal: array(r.journal).map((v) => {
      const x = record(v);
      return { id: text(x.id), kind: text(x.kind), text: text(x.text), minutes: number(x.minutes) };
    }),
    pending: pending
      ? {
          id: text(pending.id),
          actor: text(pending.actor),
          stage: text(pending.stage),
          status: text(pending.status),
          error: text(pending.error),
        }
      : null,
    offer: offer
      ? {
          id: text(offer.id),
          actor: text(offer.actor),
          label: text(offer.label),
          risk: text(offer.risk),
          minutes: number(offer.minutes),
          party: offer.party === true,
          unanimous: offer.unanimous === true,
          electorate: strings(offer.electorate),
          votes: Object.fromEntries(
            Object.entries(record(offer.votes)).map(([id, v]) => [
              id,
              typeof v === 'boolean' ? v : null,
            ]),
          ),
        }
      : null,
    check: check
      ? {
          id: text(check.id),
          actor: text(check.actor),
          label: text(check.label),
          skill: text(check.skill),
          difficulty: text(check.difficulty),
          status: text(check.status),
          pushed: check.pushed === true,
          noPush: check.noPush === true,
          tiebreak: check.tiebreak === true,
          opposition: check.opposition
            ? {
                level: number(record(check.opposition).level),
                roll:
                  typeof record(check.opposition).roll === 'number'
                    ? number(record(check.opposition).roll)
                    : null,
              }
            : null,
          roll: readRoll(check.roll),
        }
      : null,
    combat: readBattle(r.combat),
    sanity: sanity
      ? {
          id: text(sanity.id),
          actor: text(sanity.actor),
          reason: text(sanity.reason),
          status: text(sanity.status),
          result: sr ? { loss: number(sr.loss), roll: readRoll(sr.roll) } : null,
        }
      : null,
    actions: array(r.actions).map((v) => {
      const x = record(v);
      return {
        id: text(x.id),
        label: text(x.label),
        minutes: number(x.minutes),
        confirm: x.confirm === true,
        risk: text(x.risk),
      };
    }),
    destinations: array(r.destinations).map((v) => {
      const x = record(v);
      return { id: text(x.id), name: text(x.name), minutes: number(x.minutes) };
    }),
    pauseReason: text(r.pauseReason),
    result: r.result ? record(r.result) : null,
  };
}
function readBattle(value: unknown): CocBattle | null {
  if (!value) return null;
  const b = record(value),
    w = b.waiting ? record(b.waiting) : null,
    i = b.injury ? record(b.injury) : null,
    r = b.resolution ? record(b.resolution) : null;
  return {
    id: text(b.id),
    kind: text(b.kind),
    round: number(b.round),
    turn: text(b.turn),
    foundDuncan: b.foundDuncan === true,
    dig: number(b.dig),
    escaped: strings(b.escaped),
    prepared: Object.fromEntries(
      Object.entries(record(b.prepared)).map(([id, v]) => {
        const p = record(v);
        return [id, { weapon: text(p.weapon), readied: p.readied === true }];
      }),
    ),
    waiting: w ? { kind: text(w.kind), actor: text(w.actor), monster: text(w.monster) } : null,
    injury: i
      ? {
          id: text(i.id),
          actor: text(i.actor),
          reason: text(i.reason),
          condition: text(i.condition),
        }
      : null,
    resolution: r
      ? {
          id: text(r.id),
          kind: text(r.kind),
          actor: text(r.actor),
          target: text(r.target),
          roll: readRoll(r.roll),
          rolls: array(r.rolls)
            .map(readRoll)
            .filter((r): r is CocRoll => r !== null),
          attack: readRoll(r.attack),
          defense: readRoll(r.defense),
          poison: readRoll(r.poison),
        }
      : null,
    monsters: array(b.monsters).map((v) => {
      const m = record(v);
      return {
        id: text(m.id),
        kind: text(m.kind),
        name: text(m.name),
        hp: m.hp === null ? null : number(m.hp),
        maxHp: number(m.maxHp),
        limbs: array(m.limbs).map((v) => number(v)),
        corporeal: m.corporeal === true,
      };
    }),
  };
}
