<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useBluffStore } from '../../stores/bluff';
import { readBluffSnapshot } from '../../contracts/bluff';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import BluffScene from './BluffScene.vue';
import BluffRules from './BluffRules.vue';
const room = useRoomStore(),
  bluff = useBluffStore(),
  state = computed(() => bluff.state);
const phase = computed(() =>
  state.value?.interrupted
    ? '有人離席，本場中止'
    : {
        waiting: '等待開始',
        selecting: '想想三選一抽題',
        preparing: '查看秘密角色',
        discussion: '輪流解釋與質問',
        reveal: '本輪揭曉',
        finished: '本場結束',
      }[state.value?.phase || 'waiting'],
);
function status(player: RoomPlayer) {
  const s = state.value;
  if (!s) return '正在讀取';
  if (room.disconnected) return '重新連接中';
  if (s.phase === 'waiting') return '等待開桌';
  if (s.phase === 'finished') return '本場結束';
  return (
    (player.id === s.thinkerId ? '想想 · ' : '') +
    (s.challenges.includes(player.id)
      ? '被質疑：公三小'
      : s.spokenIds.includes(player.id)
        ? '說明完畢'
        : s.readyIds.includes(player.id)
          ? '已準備'
          : s.phase === 'preparing'
            ? '看角色'
            : s.phase === 'selecting'
              ? '選題中'
              : '討論中')
  );
}
</script>
<template>
  <GameRoomPage
    type="bluff"
    title="瞎掰王"
    description="3–9 人 · 外部語音或面對面口說 · 每人輪流當一次想想"
    :reader="readBluffSnapshot"
    :poll-ms="1500"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 輪` : ''"
    :max-players="9"
    :status="status"
    :setup="bluff.setup"
    :setup-target="bluff.setup ? '#bluff-start-slot' : undefined"
    :can-start="(state?.players.length || 0) >= 3 && !bluff.settingsPending && !bluff.settingsError"
    :start-label="state?.phase === 'finished' ? '再玩一局' : undefined"
    @start="bluff.start()"
  >
    <BluffScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取瞎掰王房間…</h1></section
    >
    <template #help><BluffRules /></template>
  </GameRoomPage>
</template>
