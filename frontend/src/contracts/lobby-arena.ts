import { readPickups, type LobbyPickup } from './lobby-pickups';
import { array, record, text } from '../services/validation';
export type ArenaArchetype = 'attack' | 'speed' | 'defense' | 'health';
export const archetypeOptions = [
  { value: 'attack', label: '攻擊型 · 傷害 +20%' },
  { value: 'speed', label: '速度型 · 移速 +20%' },
  { value: 'defense', label: '防禦型 · 承傷 −20%' },
  { value: 'health', label: '生命型 · 生命 +30%' },
] as const;
export const archetypeNames: Record<ArenaArchetype, string> = {
  attack: '攻擊型',
  speed: '速度型',
  defense: '防禦型',
  health: '生命型',
};
export function readArchetype(value: unknown): ArenaArchetype | null {
  if (value === null || value === undefined) return null;
  if (!Object.hasOwn(archetypeNames, String(value))) throw Error('角色類型不正確。');
  return value as ArenaArchetype;
}
export interface ArenaHazard {
  id: string;
  kind: 'mud' | 'embers';
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ArenaTeam = 'red' | 'blue';
export interface ArenaCover {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ArenaPlayer {
  id: string;
  name: string;
  team: ArenaTeam;
  score: number;
  forfeited: boolean;
  archetype?: ArenaArchetype | null;
  damageDealt?: number;
  damageTaken?: number;
  trapDamageTaken?: number;
  loadout?: { q: string; e: string } | null;
}
export interface LobbyArena {
  layoutId?: number;
  hazards?: ArenaHazard[];
  pickups?: LobbyPickup[];
  nextPickupAt?: number;
  covers: ArenaCover[];
  coveredEffects: string[];
  teams: { id: string; team: ArenaTeam; archetype?: ArenaArchetype | null }[];
  match: {
    id: string;
    mode: 'pk' | 'team';
    phase: 'running' | 'finished';
    startedAt: number;
    endsAt: number;
    remainingMs: number;
    players: ArenaPlayer[];
    winners: string[];
  } | null;
}
export function readLobbyArena(value: unknown): LobbyArena | null {
  if (value === undefined || value === null) return null;
  const row = record(value);
  const team = (v: unknown): ArenaTeam => {
    if (v !== 'red' && v !== 'blue') throw Error('隊伍資料不正確。');
    return v;
  };
  const num = (v: unknown): number => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw Error('對戰數值不正確。');
    return v;
  };
  if (array(row.covers).length > 64) throw Error('場景牆段過多。');
  const covers = array(row.covers).map((v) => {
    const r = record(v),
      x = num(r.x),
      y = num(r.y),
      width = num(r.width),
      height = num(r.height);
    if (!width || !height || x + width > 100 || y + height > 100) throw Error('掩體位置不正確。');
    return { id: text(r.id), x, y, width, height };
  });
  const teams = array(row.teams)
    .slice(0, 80)
    .map((v) => {
      const r = record(v);
      return {
        id: text(r.id),
        team: team(r.team),
        ...(r.archetype !== undefined ? { archetype: readArchetype(r.archetype) } : {}),
      };
    });
  let match: LobbyArena['match'] = null;
  if (row.match) {
    const r = record(row.match);
    if (!['pk', 'team'].includes(text(r.mode)) || !['running', 'finished'].includes(text(r.phase)))
      throw Error('對戰狀態不正確。');
    match = {
      id: text(r.id),
      mode: r.mode as 'pk' | 'team',
      phase: r.phase as 'running' | 'finished',
      startedAt: num(r.startedAt),
      endsAt: num(r.endsAt),
      remainingMs: num(r.remainingMs),
      players: array(r.players)
        .slice(0, 16)
        .map((v) => {
          const p = record(v);
          const score = num(p.score);
          if (!Number.isSafeInteger(score) || typeof p.forfeited !== 'boolean')
            throw Error('對戰分數不正確。');
          return {
            id: text(p.id),
            name: text(p.name),
            team: team(p.team),
            score,
            forfeited: p.forfeited,
            ...(p.archetype !== undefined ? { archetype: readArchetype(p.archetype) } : {}),
            ...(p.damageDealt !== undefined
              ? {
                  damageDealt: num(p.damageDealt),
                  damageTaken: num(p.damageTaken),
                  trapDamageTaken: num(p.trapDamageTaken),
                }
              : {}),
            ...(p.loadout !== undefined
              ? {
                  loadout: p.loadout
                    ? { q: text(record(p.loadout).q), e: text(record(p.loadout).e) }
                    : null,
                }
              : {}),
          };
        }),
      winners: array(r.winners).map((v) => text(v)),
    };
  }
  const hazards =
    row.hazards === undefined
      ? undefined
      : array(row.hazards).map((v) => {
          const h = record(v);
          if (!['mud', 'embers'].includes(text(h.kind))) throw Error('陷阱種類不正確。');
          const x = num(h.x),
            y = num(h.y),
            width = num(h.width),
            height = num(h.height);
          if (!width || !height || x + width > 100 || y + height > 100)
            throw Error('陷阱位置不正確。');
          return { id: text(h.id), kind: h.kind as 'mud' | 'embers', x, y, width, height };
        });
  if (hazards && hazards.length > 3) throw Error('陷阱過多。');
  return {
    ...(row.layoutId !== undefined ? { layoutId: num(row.layoutId), hazards: hazards || [] } : {}),
    ...(row.pickups !== undefined
      ? { pickups: readPickups(row.pickups), nextPickupAt: num(row.nextPickupAt) }
      : {}),
    covers,
    coveredEffects: array(row.coveredEffects).map((v) => text(v)),
    teams,
    match,
  };
}
