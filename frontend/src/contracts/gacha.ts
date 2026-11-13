import { record, array, text } from '../services/validation';
import poolGroups from '../../../public/shared/gacha-pools.json';
export const gachaKinds = [
  'attacks',
  'entrances',
  'backgrounds',
  'frames',
  'media',
  'sounds',
] as const;
export type GachaKind = (typeof gachaKinds)[number];
export const gachaRarities = ['common', 'rare', 'epic', 'legendary'] as const;
export const gachaPoolIds = ['all', ...Object.keys(poolGroups)];
export function gachaPoolKinds(pool: string): readonly GachaKind[] {
  if (pool === 'all') return gachaKinds;
  if (Object.hasOwn(poolGroups, pool))
    return poolGroups[pool as keyof typeof poolGroups].kinds as GachaKind[];
  return gachaKinds.filter((kind) => kind === pool);
}
export interface GachaItem {
  key: string;
  kind: GachaKind;
  id: string;
  label: string;
  rarity: (typeof gachaRarities)[number];
  rarityLabel: string;
  weight: number;
  duplicateFragments: number;
  exchangeCost: number;
  owned: boolean;
}
export function gachaShowcaseItems(items: readonly GachaItem[]): GachaItem[] {
  const ordered = [...gachaRarities].reverse().map((rarity) => {
    const groups = gachaKinds.map((kind) =>
      items.filter((item) => item.rarity === rarity && item.kind === kind),
    );
    const count = Math.max(...groups.map((group) => group.length));
    return Array.from({ length: count }, (_, index) =>
      groups.flatMap((group) => (group[index] ? [group[index]] : [])),
    ).flat();
  });
  const featured = ordered.slice(0, 2).flat();
  return featured.length ? featured : (ordered.find((group) => group.length) ?? []);
}
export interface GachaWallet {
  coins: number;
  fragments: number;
}
const checkinMilestoneStatuses = ['locked', 'claimable', 'available', 'used'] as const;
export interface GachaCheckin {
  day: string;
  visits: number;
  cycle: number[];
  step: number;
  claimed: boolean;
  epicTen?: { days: number; status: (typeof checkinMilestoneStatuses)[number] };
  milestone: { days: number; status: (typeof checkinMilestoneStatuses)[number] };
  wallet?: GachaWallet;
}
export interface GachaState {
  rewardTickets?: number;
  wallet: GachaWallet;
  voucherAvailable: boolean;
  epicTenAvailable: boolean;
  pools: {
    id: string;
    label: string;
    count: number;
    totalWeight: number;
    drawCount: number;
    bonusWeights?: GachaOdds['weights'];
  }[];
  items: GachaItem[];
  odds: GachaOdds;
  characterImage?: string;
}
export interface GachaOdds {
  weights: Record<GachaItem['rarity'], number>;
  revision: string;
}
export function readGachaOdds(value: unknown): GachaOdds {
  const r = record(value),
    w = record(r.weights);
  if (typeof r.revision !== 'string' || !/^[a-f0-9]{64}$/.test(r.revision))
    throw Error('抽卡機率版本格式不正確');
  const weights = {
    common: Number(w.common),
    rare: Number(w.rare),
    epic: Number(w.epic),
    legendary: Number(w.legendary),
  };
  for (const key of gachaRarities)
    if (
      typeof w[key] !== 'number' ||
      !Number.isSafeInteger(weights[key]) ||
      weights[key] < 1 ||
      weights[key] > 1000000
    )
      throw Error('抽卡權重格式不正確');
  return { weights, revision: r.revision };
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
      drawCount?: number;
      voucher?: true;
      thirdLogin?: true;
      useTickets?: true;
      ticketCost?: number;
      rewardTickets?: number;
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
export function readGachaCheckin(value: unknown): GachaCheckin {
  const r = record(value);
  const day = required(r.day);
  const cycle = array(r.cycle).map(integer);
  const step = integer(r.step);
  const visits = integer(r.visits);
  const milestone = record(r.milestone);
  const days = integer(milestone.days);
  const status = checkinMilestoneStatuses.find((value) => value === milestone.status);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    cycle.length !== 5 ||
    cycle.some((amount) => amount === 0) ||
    step >= cycle.length ||
    typeof r.claimed !== 'boolean' ||
    days === 0 ||
    !status ||
    (status === 'locked') !== visits < days
  )
    throw Error('登入獎勵格式不正確');
  const epicTen = r.epicTen === undefined ? undefined : record(r.epicTen);
  if (
    epicTen &&
    (epicTen.days !== 3 ||
      !['locked', 'claimable', 'available', 'used'].includes(String(epicTen.status)) ||
      (epicTen.status === 'locked') !== visits < 3)
  )
    throw Error('登入十連狀態不正確');
  return {
    day,
    cycle,
    step,
    visits,
    claimed: r.claimed,
    milestone: { days, status },
    ...(r.epicTen
      ? {
          epicTen: {
            days: integer(record(r.epicTen).days),
            status: required(record(r.epicTen).status) as GachaCheckin['milestone']['status'],
          },
        }
      : {}),
    ...(r.wallet === undefined ? {} : { wallet: readWallet(r.wallet) }),
  };
}
export function readGachaItem(value: unknown): GachaItem {
  const r = record(value),
    kind = required(r.kind) as GachaKind,
    rarity = required(r.rarity) as GachaItem['rarity'],
    id = required(r.id);
  if (!gachaKinds.includes(kind) || !gachaRarities.includes(rarity) || r.key !== kind + ':' + id)
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
      const bonus = p.bonusWeights === undefined ? undefined : record(p.bonusWeights);
      return {
        id: required(p.id),
        label: required(p.label),
        count: integer(p.count),
        totalWeight: integer(p.totalWeight),
        drawCount: integer(p.drawCount ?? 0),
        ...(bonus && {
          bonusWeights: {
            common: integer(bonus.common ?? 0),
            rare: integer(bonus.rare ?? 0),
            epic: integer(bonus.epic ?? 0),
            legendary: integer(bonus.legendary ?? 0),
          },
        }),
      };
    });
  if (
    items.length === 0 ||
    pools.length !== gachaPoolIds.length ||
    new Set(items.map((i) => i.key)).size !== items.length ||
    new Set(pools.map((p) => p.id)).size !== gachaPoolIds.length ||
    pools.some((p) => !gachaPoolIds.includes(p.id))
  )
    throw Error('抽卡獎池格式不正確');
  const characterImage = text(r.characterImage);
  return {
    wallet: readWallet(r.wallet),
    voucherAvailable: r.voucherAvailable === true,
    epicTenAvailable: r.epicTenAvailable === true,
    rewardTickets: integer(r.rewardTickets ?? 0),
    items,
    pools,
    odds: readGachaOdds(r.odds),
    ...(/^\/characters\/[a-f0-9-]{36}\?(?:v=[a-z0-9_-]{16}&)?size=256$/i.test(characterImage)
      ? { characterImage }
      : {}),
  };
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
  const voucher = r.voucher === true;
  const thirdLogin = r.thirdLogin === true;
  const useTickets = r.useTickets === true;
  if (
    (r.voucher !== undefined && !voucher) ||
    (r.thirdLogin !== undefined && !thirdLogin) ||
    (voucher && thirdLogin) ||
    (r.useTickets !== undefined && !useTickets) ||
    (!useTickets && (r.ticketCost !== undefined || r.rewardTickets !== undefined)) ||
    (useTickets && (voucher || thirdLogin || r.ticketCost !== results.length)) ||
    (thirdLogin && (results.length !== 10 || results[9]?.rarity !== 'epic' || r.pool !== 'all')) ||
    ![1, 10].includes(results.length) ||
    common.cost !== (voucher || thirdLogin || useTickets ? 0 : results.length * 100) ||
    (voucher && (results.length !== 1 || results[0].rarity !== 'legendary'))
  )
    throw Error('抽卡結果數量不正確');
  const fragmentsGained = integer(r.fragmentsGained);
  const pool = required(r.pool);
  const kinds = gachaPoolKinds(pool);
  if (results.some((item) => !kinds.includes(item.kind))) throw Error('抽卡卡池明細不一致');
  if (
    results.some((i) => i.fragments !== (i.duplicate ? i.duplicateFragments : 0)) ||
    results.reduce((n, i) => n + i.fragments, 0) !== fragmentsGained
  )
    throw Error('抽卡碎片明細不一致');
  return {
    operation,
    ...common,
    pool,
    results,
    fragmentsGained,
    ...(voucher ? { voucher: true } : {}),
    ...(thirdLogin ? { thirdLogin: true } : {}),
    ...(useTickets
      ? {
          useTickets: true,
          ticketCost: integer(r.ticketCost),
          rewardTickets: integer(r.rewardTickets),
        }
      : {}),
    ...(r.drawCount === undefined ? {} : { drawCount: integer(r.drawCount) }),
  };
}
