import { attackEffects } from '../stores/attack-loadout';
import type { LobbyAttackHit } from '../contracts/lobby';

export type AttackPoint = { x: number; y: number };
export type AttackPlacement = {
  effect: string;
  ageMs?: number;
  preview?: boolean;
  damage?: number;
  critical?: boolean;
  hits?: LobbyAttackHit[];
  rays?: AttackPoint[];
  aspectRatio?: number;
  from: AttackPoint;
  to: AttackPoint;
};

export const attackColor = (effect: string) =>
  attackEffects.find((e) => e.id === effect)?.color || attackEffects[0].color;

// Scene positions are percentages of the stage; an avatar's anchor sits 42px
// above the point the attack aims at. `currentHits` lets a live attack read
// hits the server settles after it started.
export function attackOptions(
  attack: AttackPlacement,
  width: number,
  height: number,
  currentHits: () => LobbyAttackHit[] | undefined = () => attack.hits,
) {
  const point = (x: number, y: number) => ({ x: (x * width) / 100, y: (y * height) / 100 - 42 });
  const fitPreview =
    attack.preview && !!attackEffects.find((effect) => effect.id === attack.effect)?.area;
  const unit = Math.min(width / 115, height / 100);
  const from = fitPreview
    ? { x: width * 0.22, y: height * 0.65 }
    : point(attack.from.x, attack.from.y);
  const to = fitPreview ? { x: from.x + unit * 35, y: from.y } : point(attack.to.x, attack.to.y);
  return {
    ageMs: attack.ageMs,
    readHits: attack.hits?.some((hit) => hit.phase)
      ? () =>
          (currentHits() || []).map((hit) => ({
            ...hit,
            ...point(hit.toX, hit.toY),
            pathX: hit.aimX !== undefined ? (hit.aimX * width) / 100 : undefined,
            pathY: hit.aimY !== undefined ? (hit.aimY * height) / 100 - 42 : undefined,
          }))
      : undefined,
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
    from,
    to,
  };
}
