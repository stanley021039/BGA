import { ref } from 'vue';
import stitchEffects from '../../../public/shared/entrance-requirements.json';

import palettes from '../../../public/shared/entrance-palette.json';

export const entranceEffects = [...palettes.starters, ...stitchEffects, ...palettes.variants];
const starterIds = new Set(palettes.starters.map((effect) => effect.id));
const variants = new Map(palettes.variants.map((effect) => [effect.id, effect]));
export const isFreeEntrance = (id: string) => starterIds.has(id);
export const entranceVariant = (id: string) => variants.get(id);
export type EntranceEffectId = string;

const KEY = 'bga-entrance-effect';
export const isEntranceEffect = (value: unknown): value is EntranceEffectId =>
  entranceEffects.some((effect) => effect.id === value);

function read(): EntranceEffectId {
  try {
    const value = localStorage.getItem(KEY);
    return isEntranceEffect(value) ? value : 'classic';
  } catch {
    return 'classic';
  }
}
/** This browser's choice, sent with lobby presence so everyone sees it. */
export const entranceEffect = ref<EntranceEffectId>(read());
export function setEntranceEffect(id: EntranceEffectId) {
  entranceEffect.value = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Storage may be unavailable; the choice still applies for this page.
  }
}
// Guarded so contract/store code can load outside a browser (frontend tests).
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) entranceEffect.value = read();
  });
