<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import { readMajoritySnapshot } from '../../contracts/majority';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import MajorityScene from './MajorityScene.vue';
import TournamentScene from './TournamentScene.vue';
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
  if (!player.online) return '暫時離線';
  if (player.waitingForNextRound)
    return state.cruel || state.phase === 'finished' ? '下一局參與' : '下一題參與';
  if (state.phase === 'waiting') return '等待開桌';
  if (state.phase === 'answering')
    return state.answeredIds.includes(player.id) ? '已交卷 ✓' : '思考中';
  return {
    choosing: player.id === state.presenterId ? '挑題中' : '等待出題',
    review: '分組確認',
    reveal: '本題揭曉',
    finished: '本局結束',
  }[state.phase];
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
    :actor-id="s?.cruel || s?.tournament ? '' : s?.presenterId"
    :setup="game.setup"
    :setup-target="s?.phase === 'finished' ? '#majority-replay-slot' : undefined"
    :can-start="game.canStart && !game.settingsPending && !game.settingsError && !game.uncertain"
    :start-label="s?.phase === 'finished' ? '再玩一局' : undefined"
    @start="game.start()"
    ><TournamentScene
      v-if="s?.tournament && s.phase !== 'waiting'"
      :key="room.scope"
    /><MajorityScene v-else-if="s" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取同頻房間…</h1></section
    >
    <template #settings
      ><Teleport
        :disabled="s?.phase !== 'finished'"
        :to="s?.phase === 'finished' ? '#majority-next-settings' : 'body'"
        defer
        ><details v-if="s?.phase === 'finished'" open class="vue-majority-settings"
          ><summary
            >{{
              s?.phase === 'finished'
                ? '下一局設定'
                : s?.cruel
                  ? '殘酷2選1 · ' +
                    (s.cruel.rules === 'teams'
                      ? '雙人組隊'
                      : s.cruel.scoring === 'minority'
                        ? '個人少數得分'
                        : '個人多數得分')
                  : s?.tournament?.mode === 'music'
                    ? '猜歌2選1'
                    : s?.tournament
                      ? '情境2選1'
                      : '一般同頻'
            }}
            · {{ s?.roundLimit || 10 }} 題</summary
          ><fieldset :disabled="!game.editable || room.busy || game.uncertain"
            ><legend>開局前設定</legend
            ><label
              >這局玩法<select v-model="game.settings.mode" @change="game.queue()"
                ><option value="majority">一般同頻</option
                ><option value="music">猜歌2選1</option
                ><option value="scenario">情境2選1</option
                ><option value="cruel">殘酷2選1・圖片題</option></select
              ></label
            ><template v-if="['music', 'scenario'].includes(game.settings.mode)"
              ><label
                >主題<select v-model="game.settings.theme" @change="game.queue()"
                  ><option
                    v-for="theme in s?.tournament?.themes || []"
                    :key="theme.id"
                    :value="theme.id"
                    >{{ theme.label }} · {{ theme.count }}項</option
                  ></select
                ></label
              ><label
                >隨機抽幾項比較？<select
                  v-model.number="game.settings.bracketSize"
                  @change="game.queue()"
                  ><option
                    v-for="n in [8, 16, 32, 64, 128, 256]"
                    :key="n"
                    :value="n"
                    :disabled="
                      n >
                      (s?.tournament?.themes.find((t) => t.id === game.settings.theme)?.count || 0)
                    "
                    >{{ n }}強（{{ n - 1 }}場）</option
                  ></select
                ></label
              ><p
                >每場秘密投票，選到多數 +1分；只有 1 人選另一邊時該人
                -1分；平票抽籤晉級不加分，最後選出冠軍。</p
              ></template
            ><template v-else-if="game.settings.mode === 'cruel'"
              ><label
                >計分玩法<select v-model="game.settings.cruelRules" @change="game.queue()"
                  ><option value="teams">雙人組隊（4／6／8 人）</option
                  ><option value="individual">個人玩法（1–12 人）</option></select
                ></label
              ><label v-if="game.settings.cruelRules === 'individual'"
                >多人時得分方式<select v-model="game.settings.cruelScoring" @change="game.queue()"
                  ><option value="majority">多數得分</option
                  ><option value="minority">少數得分</option></select
                ></label
              ><p>固定十題；真正單人只記錄選擇。</p></template
            ><template v-else
              ><label
                >這局玩幾題？<input
                  v-model.number="game.settings.rounds"
                  type="number"
                  min="3"
                  max="30"
                  @change="game.queue()" /></label
              ><label
                >玩家投稿候選題比例<select
                  v-model="game.settings.customPercent"
                  @change="game.queue()"
                  ><option :value="null">依題庫比例</option
                  ><option v-for="value in [0, 25, 50, 75, 100]" :key="value" :value="value"
                    >{{ value }}%</option
                  ></select
                ></label
              ><p>投稿不足時以內建題補足；0% 只抽內建。手動與預備題不受比例限制。</p></template
            ></fieldset
          ><StatusSlot
            :message="
              game.settingsPending
                ? '正在儲存設定…'
                : game.settingsError || (game.settingsSaved ? '' : '修改後自動儲存。')
            "
            :error="!!game.settingsError" /><UiButton
            stitch
            v-if="game.settingsError && game.editable"
            icon="refresh"
            label="重試儲存設定"
            :disabled="room.busy"
            @click="game.queue()" /></details></Teleport
    ></template>
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
