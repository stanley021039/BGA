import { array, record, text } from '../services/validation';
export type PickupKind = 'health' | 'speed' | 'shield' | 'sword';
export interface LobbyPickup {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  at: number;
  until: number;
}
export interface PickupEffects {
  speedUntil: number;
  shieldUntil: number;
  attackUntil?: number;
  last: { id: string; kind: PickupKind; at: number; until: number } | null;
}
export const pickupLabels: Record<PickupKind, string> = {
  health: '補血包',
  speed: '加速鞋',
  shield: '護盾球',
  sword: '攻擊之劍',
};
const kind = (v: unknown): PickupKind => {
  if (!['health', 'speed', 'shield', 'sword'].includes(text(v))) throw Error('道具類型不正確。');
  return v as PickupKind;
};
const num = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw Error('道具數值不正確。');
  return v;
};
export function readPickups(value: unknown): LobbyPickup[] {
  if (value === undefined) return [];
  const rows = array(value);
  if (rows.length > 3) throw Error('場上道具過多。');
  const result = rows.map((v) => {
    const r = record(v);
    const x = num(r.x),
      y = num(r.y),
      at = num(r.at),
      until = num(r.until);
    if (!text(r.id) || x > 100 || y > 100 || until <= at) throw Error('道具位置或時間不正確。');
    return { id: text(r.id), kind: kind(r.kind), x, y, at, until };
  });
  if (new Set(result.map((p) => p.id)).size !== result.length) throw Error('道具重複。');
  return result;
}
export function readPickupEffects(value: unknown): PickupEffects | undefined {
  if (value === undefined) return undefined;
  const r = record(value);
  let last: PickupEffects['last'] = null;
  if (r.last) {
    const p = record(r.last);
    const at = num(p.at),
      until = num(p.until);
    if (!text(p.id) || until <= at) throw Error('拾取事件不正確。');
    last = { id: text(p.id), kind: kind(p.kind), at, until };
  }
  return {
    speedUntil: num(r.speedUntil),
    shieldUntil: num(r.shieldUntil),
    ...(r.attackUntil !== undefined ? { attackUntil: num(r.attackUntil) } : {}),
    last,
  };
}
