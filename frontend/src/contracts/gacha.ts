import { record, array, text } from '../services/validation';
export const gachaKinds = [
  'attacks',
  'entrances',
  'backgrounds',
  'frames',
  'media',
  'sounds',
] as const;
export type GachaKind = (typeof gachaKinds)[number];
export interface GachaItem {
  key: string;
  kind: GachaKind;
  id: string;
  label: string;
  rarity: 'common' | 'rare' | 'legendary';
  rarityLabel: string;
  weight: number;
  duplicateFragments: number;
  exchangeCost: number;
  owned: boolean;
}
export interface GachaWallet {
  coins: number;
  fragments: number;
}
export interface GachaState {
  wallet: GachaWallet;
  pools: { id: string; label: string; count: number; totalWeight: number }[];
  items: GachaItem[];
}
export interface GachaResult extends GachaItem {
  duplicate: boolean;
  fragments: number;
}
export type GachaReceipt =
  | {
      operation: 'draw';
      requestId: string;
      pool: string;
      cost: number;
      results: GachaResult[];
      fragmentsGained: number;
      wallet: GachaWallet;
      at: string;
    }
  | {
      operation: 'exchange';
      requestId: string;
      cost: number;
      item: GachaItem;
      wallet: GachaWallet;
      at: string;
    };
const integer = (v: unknown) => {
  if (!Number.isSafeInteger(v) || Number(v) < 0) throw Error('抽卡數值格式不正確');
  return Number(v);
};
const required = (v: unknown) => {
  const s = text(v);
  if (!s) throw Error('抽卡名稱格式不正確');
  return s;
};
export function readWallet(value: unknown): GachaWallet {
  const r = record(value);
  return { coins: integer(r.coins), fragments: integer(r.fragments) };
}
export function readGachaItem(value: unknown): GachaItem {
  const r = record(value),
    kind = required(r.kind) as GachaKind,
    rarity = required(r.rarity) as GachaItem['rarity'],
    id = required(r.id);
  if (
    !gachaKinds.includes(kind) ||
    !['common', 'rare', 'legendary'].includes(rarity) ||
    r.key !== kind + ':' + id
  )
    throw Error('抽卡獎項格式不正確');
  return {
    key: String(r.key),
    kind,
    id,
    label: required(r.label),
    rarity,
    rarityLabel: required(r.rarityLabel),
    weight: integer(r.weight),
    duplicateFragments: integer(r.duplicateFragments),
    exchangeCost: integer(r.exchangeCost),
    owned: r.owned === true,
  };
}
export function readGachaState(value: unknown): GachaState {
  const r = record(value),
    items = array(r.items).map(readGachaItem),
    pools = array(r.pools).map((v) => {
      const p = record(v);
      return {
        id: required(p.id),
        label: required(p.label),
        count: integer(p.count),
        totalWeight: integer(p.totalWeight),
      };
    });
  if (
    items.length === 0 ||
    pools.length !== 7 ||
    new Set(items.map((i) => i.key)).size !== items.length ||
    new Set(pools.map((p) => p.id)).size !== 7 ||
    pools.some((p) => p.id !== 'all' && !gachaKinds.includes(p.id as GachaKind))
  )
    throw Error('抽卡獎池格式不正確');
  return { wallet: readWallet(r.wallet), items, pools };
}
export function readGachaReceipt(value: unknown, operation: 'draw' | 'exchange'): GachaReceipt {
  const r = record(value),
    common = {
      requestId: required(r.requestId),
      cost: integer(r.cost),
      wallet: readWallet(r.wallet),
      at: required(r.at),
    };
  if (
    !['draw', 'exchange'].includes(operation) ||
    (r.operation !== undefined && r.operation !== operation) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(common.requestId) ||
    !Number.isFinite(Date.parse(common.at))
  )
    throw Error('抽卡收據格式不正確');
  if (operation === 'exchange') {
    const item = readGachaItem(r.item);
    if (common.cost !== item.exchangeCost) throw Error('兌換碎片明細不一致');
    return { operation, ...common, item };
  }
  const results = array(r.results).map((v) => {
    const p = record(v);
    if (typeof p.duplicate !== 'boolean') throw Error('抽卡重複狀態格式不正確');
    return { ...readGachaItem(p), duplicate: p.duplicate, fragments: integer(p.fragments) };
  });
  if (![1, 10].includes(results.length) || common.cost !== results.length * 100)
    throw Error('抽卡結果數量不正確');
  const fragmentsGained = integer(r.fragmentsGained);
  const pool = required(r.pool);
  if (
    !['all', ...gachaKinds].includes(pool) ||
    results.some((i) => pool !== 'all' && i.kind !== pool)
  )
    throw Error('抽卡卡池明細不一致');
  if (
    results.some((i) => i.fragments !== (i.duplicate ? i.duplicateFragments : 0)) ||
    results.reduce((n, i) => n + i.fragments, 0) !== fragmentsGained
  )
    throw Error('抽卡碎片明細不一致');
  return { operation, ...common, pool, results, fragmentsGained };
}
