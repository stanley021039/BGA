<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useDecryptoStore } from '../../stores/decrypto';
import { readDecryptoSnapshot } from '../../contracts/decrypto';
import GameRoomPage from '../../components/GameRoomPage.vue';
import DecryptoScene from './DecryptoScene.vue';
import DecryptoRules from './DecryptoRules.vue';
import { useDecryptoSounds } from './decrypto-sounds';
import type { RoomPlayer } from '../../contracts/room';
const room = useRoomStore(),
  game = useDecryptoStore(),
  s = computed(() => game.state);
useDecryptoSounds(room, s);
const phase = computed(() =>
  s.value?.interrupted
    ? '本場中止'
    : {
        waiting: '等待分隊',
        clues: '準備三條線索',
        guessing: '雙方猜碼',
        reveal: '通訊揭曉',
        tiebreak: '猜關鍵詞決勝',
        finished: '本場結束',
      }[s.value?.phase || 'waiting'] || '正在讀取',
);
function status(p: RoomPlayer) {
  const v = s.value;
  if (!v) return '正在讀取';
  const t = v.teams.findIndex((t) => t.members.includes(p.id));
  return (
    (v.teams[t]?.name || '等待分隊') +
    (v.encryptors[t] === p.id ? ' · 出題者' : v.decoders[t] === p.id ? ' · 猜碼代表' : '')
  );
}
const canStart = computed(
  () =>
    !!s.value &&
    s.value.teams.every(
      (t) => t.members.filter((id) => s.value?.players.some((p) => p.id === id)).length >= 2,
    ),
);
</script>
<template>
  <GameRoomPage
    type="decrypto"
    title="截碼戰"
    description="4–8 人 · 兩隊秘密通訊 · 生活與懷舊詞庫"
    :reader="readDecryptoSnapshot"
    :phase="phase"
    :round="s?.round ? `第 ${s.round}／8 輪` : ''"
    :max-players="8"
    :status="status"
    :setup="!s || ['waiting', 'finished'].includes(s.phase)"
    :can-start="canStart"
    :show-metrics="false"
    @start="room.command('start', {})"
  >
    <DecryptoScene v-if="s" :key="room.scope" /><p v-else>正在讀取截碼戰房間…</p>
    <template #help><DecryptoRules /></template>
  </GameRoomPage>
</template>
