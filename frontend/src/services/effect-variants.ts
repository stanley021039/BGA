import { attackEffects } from '../stores/attack-loadout';
import { entranceEffects } from './entrance-effects';

export interface EffectVersion {
  id: string;
  label: string;
  variantOf?: string;
}

function groupEffectVariants<T extends EffectVersion>(
  effects: readonly T[],
  existingPairs: Readonly<Record<string, string>> = {},
) {
  const byId = new Map(effects.map((effect) => [effect.id, effect]));
  const groups = new Map<string, { original: T; versions: T[] }>();
  for (const effect of effects) {
    const parentId = effect.variantOf ?? existingPairs[effect.id];
    const original = (parentId && byId.get(parentId)) || effect;
    let group = groups.get(original.id);
    if (!group) {
      group = { original, versions: [original] };
      groups.set(original.id, group);
    }
    if (effect.id !== original.id) group.versions.push(effect);
  }
  return [...groups.values()];
}

export const attackEffectGroups = groupEffectVariants(attackEffects, {
  blade_aura_crimson: 'blade_aura',
});
export const entranceEffectGroups = groupEffectVariants(entranceEffects);
