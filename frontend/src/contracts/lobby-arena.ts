import { readPickups, type LobbyPickup } from './lobby-pickups';
import zoneShapes from '../../../public/shared/arena-zone-shapes.json';
import { array, record, text } from '../services/validation';
export type ArenaArchetype = 'attack' | 'speed' | 'defense' | 'health' | 'energy';
export const archetypeOptions = [
  { value: 'attack', label: '攻擊型 · 傷害 +15%' },
  { value: 'speed', label: '速度型 · 移速 +30%' },
  { value: 'defense', label: '防禦型 · 承傷 −25%' },
  { value: 'health', label: '生命型 · 生命 +35%' },
  { value: 'energy', label: '能量型 · 回能 +20%' },
] as const;
export const archetypeNames: Record<ArenaArchetype, string> = {
  attack: '攻擊型',
  speed: '速度型',
  defense: '防禦型',
  health: '生命型',
  energy: '能量型',
};
export function readArchetype(value: unknown): ArenaArchetype | null {
  if (value === null || value === undefined) return null;
  if (!Object.hasOwn(archetypeNames, String(value))) throw Error('角色類型不正確。');
  return value as ArenaArchetype;
}
export const arenaPortalLabels: Record<string, string> = {
  north: '北',
  south: '南',
  west: '西',
  east: '東',
  northwest: '左上',
  southeast: '右下',
};
export type ArenaZoneShape = keyof typeof zoneShapes;
export function arenaZonePoints(shape: ArenaZoneShape | undefined, fallback: ArenaZoneShape) {
  return zoneShapes[shape || fallback];
}
function readZoneShape(value: unknown): ArenaZoneShape | undefined {
  return typeof value === 'string' && Object.hasOwn(zoneShapes, value)
    ? (value as ArenaZoneShape)
    : undefined;
}
export interface ArenaHazard {
  shape?: ArenaZoneShape;
  id: string;
  kind: 'mud' | 'embers';
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ArenaTeam = 'red' | 'blue';
export interface ArenaCover {
  shape?: ArenaZoneShape;
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
  loadout?: { q: string; e: string; r?: string } | null;
}
export interface ArenaMapPreview {
  walls: ArenaCover[];
  bushes: ArenaCover[];
  hazards: ArenaHazard[];
  portals: { x: number; y: number }[];
}
export interface LobbyArena {
  layoutId?: number;
  hazards?: ArenaHazard[];
  expanded?: boolean;
  maps?: { id: number; name?: string; wide: boolean; preview?: ArenaMapPreview }[];
  portals?: { id: string; pair: string; x: number; y: number; exitCount?: number }[];
  portalRadius?: number;
  bushes?: ArenaCover[];
  pickups?: LobbyPickup[];
  nextPickupAt?: number;
  covers: ArenaCover[];
  coveredEffects: string[];
  ownArchetype?: ArenaArchetype | null;
  teams: { id: string; team: ArenaTeam; ready?: boolean; archetype?: ArenaArchetype | null }[];
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
  const readZones = (value: unknown) =>
    array(value).map((v) => {
      const r = record(v),
        x = num(r.x),
        y = num(r.y),
        width = num(r.width),
        height = num(r.height);
      if (!width || !height || x + width > 100 || y + height > 100) throw Error('掩體位置不正確。');
      const shape = readZoneShape(r.shape);
      return { id: text(r.id), x, y, width, height, ...(shape ? { shape } : {}) };
    });
  const covers = readZones(row.covers);
  const bushes = readZones(row.bushes);
  if (bushes.length > (row.expanded === true ? 10 : 5)) throw Error('草叢過多。');
  const teams = array(row.teams)
    .slice(0, 80)
    .map((v) => {
      const r = record(v);
      return {
        id: text(r.id),
        team: team(r.team),
        ready: r.ready === true,
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
                    ? {
                        q: text(record(p.loadout).q),
                        e: text(record(p.loadout).e),
                        r: text(record(p.loadout).r),
                      }
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
          const shape = readZoneShape(h.shape);
          return {
            id: text(h.id),
            kind: h.kind as 'mud' | 'embers',
            x,
            y,
            width,
            height,
            ...(shape ? { shape } : {}),
          };
        });
  if (hazards && hazards.length > (row.expanded === true ? 10 : 5)) throw Error('陷阱過多。');
  return {
    ...(row.layoutId !== undefined ? { layoutId: num(row.layoutId), hazards: hazards || [] } : {}),
    ...(row.pickups !== undefined
      ? { pickups: readPickups(row.pickups), nextPickupAt: num(row.nextPickupAt) }
      : {}),
    covers,
    ...(row.maps !== undefined
      ? {
          maps: array(row.maps)
            .slice(0, 5)
            .map((value) => {
              const map = record(value);
              const preview = map.preview ? record(map.preview) : null;
              return {
                id: num(map.id),
                name: text(map.name),
                wide: map.wide === true,
                ...(preview
                  ? {
                      preview: {
                        walls: readZones(array(preview.walls).slice(0, 64)),
                        bushes: readZones(array(preview.bushes).slice(0, 10)),
                        hazards: array(preview.hazards)
                          .slice(0, 10)
                          .map((item): ArenaHazard => {
                            const hazard = record(item);
                            if (hazard.kind !== 'mud' && hazard.kind !== 'embers')
                              throw Error('陷阱種類不正確。');
                            return { ...readZones([item])[0], kind: hazard.kind };
                          }),
                        portals: array(preview.portals)
                          .slice(0, 4)
                          .map((item) => {
                            const portal = record(item);
                            const x = num(portal.x),
                              y = num(portal.y);
                            if (x > 100 || y > 100) throw Error('蟲洞位置不正確。');
                            return { x, y };
                          }),
                      },
                    }
                  : {}),
              };
            }),
        }
      : {}),
    ...(row.expanded === true ? { expanded: true } : {}),
    ...(row.portals !== undefined
      ? {
          portals: array(row.portals)
            .slice(0, 4)
            .map((value) => {
              const p = record(value);
              return {
                id: text(p.id),
                pair: text(p.pair),
                x: Number(p.x),
                y: Number(p.y),
                exitCount: Number(p.exitCount) || 1,
              };
            }),
          portalRadius: Number(row.portalRadius) || 2,
        }
      : {}),
    ...(row.bushes !== undefined && { bushes }),
    coveredEffects: array(row.coveredEffects).map((v) => text(v)),
    ...(row.ownArchetype !== undefined ? { ownArchetype: readArchetype(row.ownArchetype) } : {}),
    teams,
    match,
  };
}

export function readArenaRooms(value: unknown) {
  const row = record(value);
  return {
    currentId: row.currentId ? text(row.currentId) : null,
    rooms: array(row.rooms)
      .slice(0, 50)
      .map((value) => {
        const room = record(value);
        return { id: text(room.id), name: text(room.name), count: Number(room.count) || 0 };
      }),
  };
}
