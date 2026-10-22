import { ref } from 'vue';
import stitchEffects from '../../../public/shared/entrance-requirements.json';

// Lobby entrance effects. Ids must match ENTRANCE_EFFECTS in src/rooms/lobby.js.
export const entranceEffects = [
  { id: 'classic', label: '經典現影', description: '煙霧漩渦收束後爆出一圈光環。' },
  { id: 'smoke', label: '黑煙漩渦', description: '紫黑色漩渦捲緊、啪一聲現身。' },
  { id: 'sparks', label: '金色魔杖火花', description: '金色火花聚成光球，從光裡浮現。' },
  { id: 'ink', label: '墨水潑濺', description: '墨水潑地長成剪影，再染回原色。' },
  { id: 'runes', label: '地面魔法陣', description: '符文陣畫出光柱，角色在光中成形。' },
  { id: 'rift', label: '時空裂縫', description: '空中撕開發光裂縫，角色走出來。' },
  { id: 'particles', label: '粒子組合', description: '粒子飛來由腳到頭拼出角色。' },
  ...stitchEffects,
] as const;
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
