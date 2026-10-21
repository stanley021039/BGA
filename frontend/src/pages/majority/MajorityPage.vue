<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import { readMajoritySnapshot } from '../../contracts/majority';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import MajorityScene from './MajorityScene.vue';
import TournamentScene from './TournamentScene.vue';
import MajoritySetup from './MajoritySetup.vue';
const room = useRoomStore(),
  game = useMajorityStore(),
  s = computed(() => game.state);
const phase = computed(
  () =>
    ({
      waiting: '等待開桌',
      choosing: '出題人挑題',
      answering: '各自秘密作答',
      review: '確認答案分組',
      reveal: '本題揭曉',
      finished: '本局結束',
    })[s.value?.phase || 'waiting'],
);
function status(player: RoomPlayer) {
  const state = s.value;
  if (!state) return '讀取中';
  return (
    (player.id === state.presenterId ? (state.cruel ? '輪值玩家 · ' : '出題人 · ') : '') +
    (player.waitingForNextRound
      ? state.cruel || state.phase === 'finished'
        ? '下一局參與'
        : '下一題參與'
      : state.phase === 'answering'
        ? state.answeredIds.includes(player.id)
          ? '已交卷 ✓'
          : '思考中'
        : state.phase === 'finished'
          ? '本局結束'
          : player.online
            ? '在線'
            : '暫時離線')
  );
}
</script>
<template>
  <GameRoomPage
    type="majority"
    :title="s?.cruel ? '殘酷2選1' : '同頻俱樂部'"
    description="一般 3–12 人 · 輪流選題並秘密作答；殘酷2選1 支援組隊、個人及單人偏好回顧"
    :reader="readMajoritySnapshot"
    :poll-ms="900"
    :phase="phase"
    :round="s?.round ? `第 ${s.round}／${s.roundLimit} 題` : ''"
    :max-players="12"
    :show-metrics="
      !(s?.cruel?.solo || (s?.cruel?.rules === 'individual' && s?.players.length === 1))
    "
    :status="status"
    :setup="game.setup"
    :can-start="game.canStart && !game.settingsPending && !game.settingsError && !game.uncertain"
    :start-label="s?.phase === 'finished' ? '再玩一局' : undefined"
    @start="game.start()"
    ><MajoritySetup v-if="s?.phase === 'waiting'" :key="room.scope" /><TournamentScene
      v-else-if="s?.tournament"
      :key="room.scope"
    /><MajorityScene v-else-if="s" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取同頻房間…</h1></section
    >
    <template #help
      ><ol
        ><li
          >一般同頻 3–12 人，輪流從分類抽三張候選題、挑共用題庫或自己出題；出題人也會一起回答。</li
        ><li
          >答案交卷前只有本人看得到。每題最多等候 120
          秒；全員交卷後立即揭曉。未交卷不計分，揭曉前可以收回答案。</li
        ><li>唯一最大答案組且至少兩人一致：選擇題每人 +1，填空題每人 +2；最高票平手不加分。</li
        ><li
          >填空先公開分組，由房主合併同義詞後確認計分。系統只自動統一
          NFKC、英文大小寫與空白。最大組未超過全體玩家三分之一時，出題人 -1。</li
        ><li>每人最多預備五題，依提交順序自動出題。晚入座者從下一題參與。</li
        ><li
          >殘酷2選1 使用擴充的原創雙圖題，固定十題。雙人組隊限 4／6／8
          人，兩位隊員都交卷且答案相同，隊伍 +1；座位分數顯示隊伍總分。</li
        ><li
          >殘酷個人玩法 1–12
          人，可選唯一多數／唯一非空少數得分；平票不加分，所有人同邊時沒有少數。真正單人只記錄偏好，沒有假對手、分數或勝者。</li
        ><li
          >每人整局可換題一次，限尚未有人交卷且未逾時。殘酷晚入座者下一局參與；本局參與者離席會中止本局。</li
        ><li
          >最高分可共同勝出。可使用共用聊天、表情、媒體與專注全螢幕。網路結果不明時先更新狀態，系統不會自動重送操作。</li
        ></ol
      ></template
    >
  </GameRoomPage>
</template>
