import { attackEffects } from '../stores/attack-loadout';
import type { GachaItem } from '../contracts/gacha';
import { entranceEffects } from './entrance-effects';

export interface EffectVersion {
  id: string;
  label: string;
  variantOf?: string;
  styleLabel?: string;
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

const gachaEffectParents = new Map<string, string>();
for (const [kind, groups] of [
  ['attacks', attackEffectGroups],
  ['entrances', entranceEffectGroups],
] as const) {
  for (const { original, versions } of groups) {
    for (const version of versions) {
      gachaEffectParents.set(kind + ':' + version.id, kind + ':' + original.id);
    }
  }
}

export function groupGachaEffects(items: readonly GachaItem[]) {
  const groups = new Map<string, GachaItem[]>();
  for (const item of items) {
    const key = gachaEffectParents.get(item.key) ?? item.key;
    let versions = groups.get(key);
    if (!versions) {
      versions = [];
      groups.set(key, versions);
    }
    if (item.key === key) versions.unshift(item);
    else versions.push(item);
  }
  return [...groups].map(([key, versions]) => ({ key, versions }));
}
