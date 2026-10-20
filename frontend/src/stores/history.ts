import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { useResource } from '../composables/resource';
import { useRequests } from '../composables/requests';
import { requestJson } from '../services/http';
import { readMatches, readReplay } from '../contracts/history';
import type { HistoryMatch, HistoryReplay } from '../contracts/history';

export const useHistoryStore = defineStore('history', () => {
  const catalog = useResource(async (request) => readMatches(await request('/api/history'))),
    requests = useRequests();
  const filter = ref(''),
    selected = shallowRef<HistoryMatch | null>(null),
    replay = shallowRef<HistoryReplay | null>(null);
  const opening = ref(false),
    error = ref(''),
    step = ref(0);
  let generation = 0,
    selectionRead: AbortController | undefined;
  const filtered = computed(() =>
    (catalog.data.value || []).filter((match) => !filter.value || match.type === filter.value),
  );
  const frame = computed(() => replay.value?.frames[step.value]);
  async function open(match: HistoryMatch) {
    if (match.status === 'playing') return;
    const epoch = ++generation;
    selectionRead?.abort();
    const controller = new AbortController();
    selectionRead = controller;
    opening.value = true;
    error.value = '';
    try {
      const value = await requests.run(async (signal) => {
        const cancel = () => controller.abort();
        signal.addEventListener('abort', cancel, { once: true });
        try {
          signal.throwIfAborted();
          return await requestJson('/api/history/' + encodeURIComponent(match.id), {
            signal: controller.signal,
          });
        } finally {
          signal.removeEventListener('abort', cancel);
        }
      });
      if (epoch !== generation) return;
      const loaded = readReplay(value, match.type);
      selected.value = match;
      replay.value = loaded;
      step.value = 0;
    } catch (cause) {
      if (epoch === generation && !controller.signal.aborted)
        error.value = cause instanceof Error ? cause.message : '無法讀取對局，請重試';
    } finally {
      if (epoch === generation) {
        opening.value = false;
        selectionRead = undefined;
      }
    }
  }
  function move(value: number) {
    step.value = Math.max(
      0,
      Math.min((replay.value?.frames.length || 1) - 1, Math.floor(value) || 0),
    );
  }
  onScopeDispose(() => {
    generation++;
    selectionRead?.abort();
  });
  return {
    loading: catalog.loading,
    listError: catalog.error,
    load: catalog.load,
    filter,
    filtered,
    selected,
    replay,
    frame,
    step,
    opening,
    error,
    open,
    move,
  };
});
