import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import type { DecryptoSnapshot } from '../contracts/decrypto';
export const useDecryptoStore = defineStore('decrypto', () => {
  const room = useRoomStore(),
    state = computed(() => room.snapshot as DecryptoSnapshot | null);
  async function act(action: string, data: Record<string, unknown> = {}) {
    const s = state.value;
    if (!s || !room.connected || room.busy) return false;
    return room.command('action', {
      action,
      roundId: s.roundId,
      turn: s.turn,
      requestId: crypto.randomUUID(),
      ...data,
    });
  }
  return { state, act };
});
