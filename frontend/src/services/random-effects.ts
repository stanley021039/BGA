import { attackEffects, fitsAttackSlot } from '../stores/attack-loadout';
import { entranceEffects } from './entrance-effects';

export function randomEffect(ids: string[], current = '', random = Math.random): string {
  const unique = [...new Set(ids)];
  const choices = unique.length > 1 ? unique.filter((id) => id !== current) : unique;
  return choices[Math.floor(random() * choices.length)] || '';
}

export function randomAttacks(
  current: { q: string; e: string; r: string },
  allowed: (id: string) => boolean = () => true,
) {
  const ordinary = attackEffects
    .filter((e) => fitsAttackSlot('q', e.id) && allowed(e.id))
    .map((e) => e.id);
  const ultimate = attackEffects
    .filter((e) => fitsAttackSlot('r', e.id) && allowed(e.id))
    .map((e) => e.id);
  const q = randomEffect(ordinary, current.q);
  return {
    q,
    e: randomEffect(ordinary.length > 1 ? ordinary.filter((id) => id !== q) : ordinary, current.e),
    r: randomEffect(ultimate, current.r),
  };
}

export function randomEntrance(current: string, allowed: (id: string) => boolean = () => true) {
  return randomEffect(
    entranceEffects.filter((e) => allowed(e.id)).map((e) => e.id),
    current,
  );
}
