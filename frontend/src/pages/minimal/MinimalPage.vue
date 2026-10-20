<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { readMinimalSnapshot, type MinimalSnapshot } from '../../contracts/minimal';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import MinimalScene from './MinimalScene.vue';
import MinimalRules from './MinimalRules.vue';
const room = useRoomStore(),
  state = computed(() => room.snapshot as MinimalSnapshot | null),
  setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase));
const phase = computed(() =>
  state.value?.interrupted
    ? '本場中止，保留已完成回合'
    : {
        waiting: '等待開始',
        drawing: '畫家私人作畫',
        guessing: '由少到多猜圖',
        reveal: '本輪揭曉',
        finished: '本場結束',
      }[state.value?.phase || 'waiting'],
);
function status(player: RoomPlayer) {
  const value = state.value;
  return !value
    ? '正在讀取'
    : room.disconnected
      ? '重新連接中'
      : value.phase === 'waiting'
        ? '等待開桌'
        : value.phase === 'finished'
          ? '本場結束'
          : player.id === value.guesserId
            ? '本輪猜題者'
            : value.readyIds.includes(player.id)
              ? '已完成作畫'
              : '本輪畫家';
}
</script>
<template>
  <GameRoomPage
    type="minimal"
    title="極簡畫家"
    description="3–6 人 · 只用直線與封閉圓 · 由少筆畫開始猜"
    :reader="readMinimalSnapshot"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 輪` : ''"
    :max-players="6"
    :status="status"
    :setup="setup"
    :setup-target="setup ? '#minimal-setup-slot' : undefined"
    :can-start="(state?.players.length || 0) >= 3"
    :start-label="state?.phase === 'finished' ? '再玩一局' : undefined"
    @start="room.command('start', {})"
    ><MinimalScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取極簡畫家房間…</h1></section
    ><template #settings
      ><p>四人以下每人當兩次猜題者，五至六人各一次。每張最多 40 個直線或封閉圓。</p></template
    ><template #help
      ><MinimalRules /><p
        >草稿僅保存在本分頁，伺服器重啟不續局。腳本夥伴不理解圖片或題目。</p
      ></template
    >
  </GameRoomPage>
</template>
