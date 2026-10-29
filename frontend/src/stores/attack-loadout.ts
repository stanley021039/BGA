import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from './session';
import { requestJson } from '../services/http';
import effects from '../../../public/shared/attack-effects.json';
export type AttackSlot = 'q' | 'e' | 'r';
export const attackEffects = effects;
export const fitsAttackSlot = (slot: AttackSlot, id: string) => {
  const effect = effects.find((item) => item.id === id);
  return !!effect && (slot === 'r') === ('area' in effect && !!effect.area);
};
export const useAttackLoadoutStore = defineStore('attack-loadout', () => {
  const session = useSessionStore(),
    identity = computed(() => session.user?.id || '');
  const loadout = ref({ q: 'barrage', e: 'beam', r: '' }),
    ready = ref(false),
    pending = ref(false),
    message = ref('');
  let generation = 0,
    job: Promise<void> | null = null,
    controller: AbortController | null = null;
  const valid = (v: unknown): v is { q: string; e: string; r: string } =>
    !!v &&
    typeof v === 'object' &&
    (['q', 'e', 'r'] as const).every((slot) => {
      const id = (v as Record<string, unknown>)[slot];
      return (slot === 'r' && id === '') || (typeof id === 'string' && fitsAttackSlot(slot, id));
    });
  async function load() {
    if (ready.value || !identity.value) return;
    if (job) return job;
    const epoch = generation;
    controller = new AbortController();
    const signal = controller.signal;
    job = (async () => {
      try {
        const result = await requestJson('/api/profile/attacks', { signal });
        if (epoch !== generation) return;
        if (!valid(result)) throw Error('攻擊設定格式不正確');
        loadout.value = result;
        ready.value = true;
        message.value = '';
      } catch (e) {
        if (epoch === generation)
          message.value = e instanceof Error ? e.message : '無法載入攻擊設定';
      } finally {
        if (epoch === generation) job = null;
      }
    })();
    return job;
  }
  async function choose(slot: AttackSlot, effect: string) {
    if (
      !ready.value ||
      pending.value ||
      !((slot === 'r' && effect === '') || fitsAttackSlot(slot, effect))
    )
      return;
    pending.value = true;
    message.value = '';
    const epoch = generation;
    controller = new AbortController();
    try {
      const result = await requestJson('/api/profile/attacks', {
        method: 'POST',
        body: { ...loadout.value, [slot]: effect },
        signal: controller.signal,
      });
      if (epoch !== generation) return;
      if (!valid(result)) throw Error('攻擊設定格式不正確');
      loadout.value = result;
    } catch (e) {
      if (epoch === generation) message.value = e instanceof Error ? e.message : '儲存失敗';
    } finally {
      if (epoch === generation) pending.value = false;
    }
  }
  watch(
    identity,
    () => {
      generation++;
      controller?.abort();
      job = null;
      ready.value = false;
      pending.value = false;
      loadout.value = { q: 'barrage', e: 'beam', r: '' };
      message.value = '';
      if (identity.value) void load();
    },
    { flush: 'sync' },
  );
  onScopeDispose(() => {
    generation++;
    controller?.abort();
  });
  return { loadout, ready, pending, message, load, choose };
});
