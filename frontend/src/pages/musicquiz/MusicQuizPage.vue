<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { readMusicQuizSnapshot, type MusicQuizSnapshot } from '../../contracts/musicquiz';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import MusicQuizScene from './MusicQuizScene.vue';
const room = useRoomStore(),
  state = computed(() => room.snapshot as MusicQuizSnapshot | null),
  setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase));
const phase = computed(() =>
  state.value?.interrupted
    ? '本場中止，保留已完成回合'
    : { waiting: '等待開始', answering: '聽開頭猜歌', reveal: '本輪揭曉', finished: '本場結束' }[
        state.value?.phase || 'waiting'
      ],
);
function playerStatus(player: RoomPlayer) {
  return !state.value
    ? '正在讀取'
    : room.disconnected
      ? '重新連接中'
      : state.value.phase === 'waiting'
        ? '等待開桌'
        : state.value.phase === 'finished'
          ? '本場結束'
          : state.value.readyIds.includes(player.id)
            ? '已完成作答'
            : '正在聽歌／作答';
}
</script>
<template>
  <GameRoomPage
    type="musicquiz"
    title="猜歌挑戰"
    description="1–8 人 · 六秒旋律開頭 · 每人一次作答"
    :reader="readMusicQuizSnapshot"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 題` : ''"
    :max-players="8"
    :status="playerStatus"
    :setup="setup"
    :can-start="!!state?.players.length"
    :start-label="state?.phase === 'finished' ? '再玩一局' : undefined"
    @start="room.command('start', {})"
    ><MusicQuizScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取猜歌房間…</h1></section
    ><template #settings
      ><p>固定三首傳統／古典旋律，自製六秒音訊。全員作答後由房主揭曉，猜中 +1 分。</p></template
    ><template #help
      ><ol
        ><li>1–8 人，三首熟悉的傳統／古典旋律，以本站自製合成音訊示範。</li
        ><li>手動播放六秒開頭，可以重聽；每人每題只能送出一次歌名或略過，不按速度計分。</li
        ><li>全員作答後由房主揭曉，猜中 +1；接受常見中文／英文歌名別名。</li
        ><li>三題後列出最高分及每題回顧，同分並列。</li
        ><li>離席會中止進行中的場次，保留已完成回合；斷線可恢復既有席位，伺服器重啟不續局。</li></ol
      ><p>腳本夥伴只測流程，不理解旋律。未接入上傳歌曲庫、YouTube 或 AI 音樂辨識。</p></template
    ></GameRoomPage
  >
</template>
