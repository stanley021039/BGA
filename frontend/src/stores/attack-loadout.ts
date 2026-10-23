import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from './session';
import { requestJson } from '../services/http';
import effects from '../../../public/shared/attack-effects.json';
export type AttackSlot = 'q' | 'e';
export const attackEffects = effects;
export const useAttackLoadoutStore = defineStore('attack-loadout', () => {
  const session = useSessionStore(),
    identity = computed(() => session.user?.id || '');
  const loadout = ref({ q: 'barrage', e: 'beam' }),
    ready = ref(false),
    pending = ref(false),
    message = ref('');
  let generation = 0,
    job: Promise<void> | null = null,
    controller: AbortController | null = null;
  const valid = (v: unknown): v is { q: string; e: string } =>
    !!v &&
    typeof v === 'object' &&
    ['q', 'e'].every((k) => effects.some((e) => e.id === (v as Record<string, unknown>)[k]));
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
    if (!ready.value || pending.value || !effects.some((e) => e.id === effect)) return;
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
      loadout.value = { q: 'barrage', e: 'beam' };
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
