import { ref } from 'vue';
import { defineStore } from 'pinia';
import { requestJson } from '../services/http';
import { readLobbySnapshot } from '../contracts/lobby';

import backgrounds from '../../../public/shared/lobby-backgrounds.json';
export const lobbyBackgrounds = backgrounds;

export const useLobbyBackgroundStore = defineStore('lobby-background', () => {
  const selected = ref('default'),
    pending = ref(false),
    message = ref(''),
    nextChangeAt = ref(0);
  let observedAt = 0;
  function receive(value: { id: string; changedAt: number; nextChangeAt: number }) {
    if (value.changedAt < observedAt) return;
    observedAt = value.changedAt;
    selected.value = value.id;
    nextChangeAt.value = value.nextChangeAt;
  }
  async function refresh() {
    try {
      receive(readLobbySnapshot(await requestJson('/api/lobby')).background);
    } catch (error) {
      message.value = error instanceof Error ? error.message : '無法載入大廳背景';
    }
  }
  async function select(id: string) {
    if (pending.value || !lobbyBackgrounds.some((item) => item.id === id)) return;
    pending.value = true;
    message.value = '';
    try {
      receive(
        readLobbySnapshot(
          await requestJson('/api/lobby/background', { method: 'POST', body: { id } }),
        ).background,
      );
      message.value = '已替所有大廳玩家更換背景；30 秒後可再次更換。';
    } catch (error) {
      message.value = error instanceof Error ? error.message : '更換失敗';
    } finally {
      pending.value = false;
    }
  }
  return { selected, pending, message, nextChangeAt, receive, refresh, select };
});
