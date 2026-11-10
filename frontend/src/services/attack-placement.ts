import { attackEffects, fitsAttackSlot } from '../stores/attack-loadout';
import type { LobbyAttackHit, AttackHead, LobbyAttack, LobbySnapshot } from '../contracts/lobby';

export function visibleSummons(snapshot: LobbySnapshot | null) {
  const actors = snapshot?.visitors.filter((actor) => actor.summon) ?? [];
  actors.sort((a, b) => Number(b.id === snapshot?.selfId) - Number(a.id === snapshot?.selfId));
  return new Set(actors.slice(0, 3).map((actor) => actor.id));
}

export type AttackPoint = { x: number; y: number };
export type AttackPlacement = {
  effect: string;
  ageMs?: number;
  preview?: boolean;
  damage?: number;
  critical?: boolean;
  hits?: LobbyAttackHit[];
  head?: AttackHead;
  cancelled?: boolean;
  casterImage?: string;
  rays?: AttackPoint[];
  aspectRatio?: number;
  from: AttackPoint;
  to: AttackPoint;
};

export const attackColor = (effect: string) =>
  attackEffects.find((e) => e.id === effect)?.color || attackEffects[0].color;

const targetCentered = new Set([
  'beam',
  'chains',
  'orbital',
  'singularity',
  'chain_lightning',
  'frost_spikes',
  'arrow_volley',
  'flame_vortex',
  'explosion',
  'giant_orange_cat',
]);

export function previewAttackOptions(effect: string, stageWidth: number, stageHeight: number) {
  const ultimate = fitsAttackSlot('r', effect);
  const renderScale = Math.min(ultimate ? 1.65 : 1.45, stageWidth / 260, stageHeight / 180);
  const width = stageWidth / renderScale;
  const height = stageHeight / renderScale;
  const definition = attackEffects.find((entry) => entry.id === effect);
  const original = definition?.variantOf || effect;
  const closeArea = original === 'guanyin_barrage' || original === 'dimension_cleave';
  const unit = closeArea ? Math.min(width / 92, height / 57) : Math.min(width / 110, height / 62);
  const mid = width / 2;
  const y = height / 2 + (original === 'guanyin_barrage' ? unit * 8 : 0);
  const area = definition?.area;
  const distance = area ? 34 * unit : Math.min(width * 0.38, height * 0.82);
  const from = { x: mid - distance / 2, y };
  const to = { x: mid + distance / 2, y };
  if (original === 'black_coffin') {
    to.x = mid;
  } else if (['world_stasis', 'human_malice', 'susanoo'].includes(original)) {
    from.x = mid;
    to.x = mid + unit * 9;
  } else if (original === 'gate_of_heroes') {
    from.y = to.y = height * 0.68;
  } else if (original === 'starburst_stream') {
    to.x = mid;
  } else if (original === 'rainbow_bear' || original === 'zero_equation') {
    from.x = mid - distance * 0.08;
    to.x = mid + distance * 0.42;
  } else if (targetCentered.has(original)) {
    to.x = mid;
    from.x = mid - distance * 0.6;
  } else if (original === 'shield' || original === 'sphere' || original === 'funnel') {
    from.x = to.x = mid;
  } else if (original === 'guanyin_barrage') {
    from.x = mid - 7 * unit;
    to.x = from.x + 30 * unit;
  } else if (original === 'dimension_cleave') {
    from.x = mid - distance * 0.75;
    to.x = from.x + distance;
  } else if (original === 'gate_of_babylon') {
    from.x = mid;
    to.x = mid + distance * 0.78;
  } else if (original === 'shaohua_devour') {
    to.x = width * 0.58;
    from.x = width * 0.36;
  }
  return {
    effect,
    width,
    height,
    from,
    to,
    renderScale,
    previewUnit: unit,
    preview: true,
    color: attackColor(effect),
  };
}

// Scene positions are percentages of the stage; an avatar's anchor sits 42px
// above the point the attack aims at. `currentHits` lets a live attack read
// hits the server settles after it started.
export function attackOptions(
  attack: AttackPlacement,
  width: number,
  height: number,
  currentHits: () => LobbyAttackHit[] | undefined = () => attack.hits,
  currentAttack: () => Partial<LobbyAttack> = () => attack,
  currentCaster?: () => AttackPoint | undefined,
  currentTarget?: () => AttackPoint | undefined,
) {
  const point = (x: number, y: number) => ({ x: (x * width) / 100, y: (y * height) / 100 - 42 });
  return {
    ageMs: attack.ageMs,
    readTarget:
      currentTarget &&
      (() => {
        const target = currentTarget();
        return target ? point(target.x, target.y) : undefined;
      }),
    readCaster: currentCaster
      ? () => {
          const caster = currentCaster();
          return caster ? point(caster.x, caster.y) : undefined;
        }
      : undefined,
    readHits: Array.isArray(attack.hits)
      ? () =>
          (currentHits() || []).map((hit) => ({
            ...hit,
            ...point(hit.toX, hit.toY),
            pathX: hit.aimX !== undefined ? (hit.aimX * width) / 100 : undefined,
            pathY: hit.aimY !== undefined ? (hit.aimY * height) / 100 - 42 : undefined,
          }))
      : undefined,
    readHead: attack.head
      ? () => {
          const head = currentAttack().head;
          return head
            ? {
                ...head,
                ...point(head.x, head.y),
                targetX: point(head.targetX, head.targetY).x,
                targetY: point(head.targetX, head.targetY).y,
              }
            : null;
        }
      : undefined,
    cancelled: () => currentAttack().cancelled === true,
    casterImage: attack.casterImage,
    preview: attack.preview === true,
    rays: attack.rays?.map((ray) => point(ray.x, ray.y)),
    effect: attack.effect,
    damage: attack.damage,
    critical: attack.critical,
    aspectRatio: attack.aspectRatio,
    hits: attack.hits?.map((hit) => ({
      ...point(hit.toX, hit.toY),
      damage: hit.damage,
      critical: hit.critical,
    })),
    color: attackColor(attack.effect),
    width,
    height,
    from: point(attack.from.x, attack.from.y),
    to: point(attack.to.x, attack.to.y),
  };
}
