import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from './session';

export const lobbyBackgrounds = [
  { id: 'default', label: '原本' },
  { id: 'castle', label: '城堡' },
] as const;

export const useLobbyBackgroundStore = defineStore('lobby-background', () => {
  const session = useSessionStore(),
    selected = ref('default');
  const valid = (value: string | null): value is string =>
    lobbyBackgrounds.some((item) => item.id === value);
  watch(
    () => session.user?.id,
    (account) => {
      selected.value = 'default';
      try {
        const saved = account ? localStorage.getItem('lobby-background:' + account) : null;
        if (valid(saved)) selected.value = saved;
      } catch {
        /* Storage is optional. */
      }
    },
    { immediate: true },
  );
  function select(value: string) {
    if (!valid(value)) return;
    selected.value = value;
    try {
      if (session.user?.id) localStorage.setItem('lobby-background:' + session.user.id, value);
    } catch {
      /* Keep the selection for this page when storage is unavailable. */
    }
  }
  return { selected, select };
});
