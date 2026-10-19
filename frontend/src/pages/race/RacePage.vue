<script setup lang="ts">
import { computed } from 'vue';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import { useRaceStore } from '../../stores/race';
import { useRoomStore } from '../../stores/room';
import { readRaceSnapshot } from '../../contracts/race';
import type { RoomPlayer } from '../../contracts/room';
import RaceScene from './RaceScene.vue';
const race = useRaceStore(),
  room = useRoomStore(),
  s = computed(() => race.state);
const phases: Record<string, string> = {
  waiting: '等待開賽',
  assign: '分配',
  move: '移動',
  bonus: '加速',
  shoot: '射擊',
  airplace: '部署',
  airshoot: '空襲',
  effects: '事件處理',
  finished: '比賽結束',
};
function status(p: RoomPlayer) {
  const labels = [];
  if (p.id === s.value?.actor) labels.push('目前行動');
  if (p.out) labels.push('車隊出局');
  if (p.kicked) labels.push('電腦接手');
  else if (!p.online) labels.push('暫時離線');
  return labels.join(' · ') || '準備比賽';
}
const lessonHref = computed(
  () => `/race?learn=1&from=game${s.value ? '&room=' + encodeURIComponent(s.value.code) : ''}`,
);
</script>
<template>
  <GameRoomPage
    type="thunder"
    title="雷霆之路"
    description="2–4 支車隊 · 選骰競速與碰撞射擊"
    :reader="readRaceSnapshot"
    :poll-ms="700"
    :phase="phases[s?.phase || 'waiting']"
    :round="s?.round ? `第 ${s.round} 輪` : '準備開賽'"
    :max-players="4"
    :show-metrics="false"
    :status="status"
    :setup="race.setup"
    :can-start="
      (s?.players.filter((p) => !p.kicked).length || 0) >= 2 &&
      !race.settingsPending &&
      !race.settingsError
    "
    :start-label="s?.phase === 'finished' ? '再比一場' : undefined"
    @start="race.start()"
    ><RaceScene v-if="s && s.phase !== 'waiting'" :key="room.scope" :model="race" /><section
      v-else
      class="vue-game-panel vue-race-waiting"
      ><h1>準備踏上雷霆之路</h1
      ><p>每支車隊有輕、中、重型戰車；選擇骰子移動，用碰撞與射擊爭先抵達終點。</p
      ><a :href="lessonHref">進入獨立本機教學桌 →</a
      ><p>六種實作情境、17 個章節，可自由重試；教學不占線上房間座位。</p></section
    >
    <template #settings
      ><label class="vue-race-mode"
        >賽道模式<select
          v-model="race.devilsRun"
          :disabled="!race.settingsEditable || room.busy"
          @change="race.queue()"
          ><option :value="false">主遊戲 · 自製賽道</option
          ><option :value="true">惡魔賽道 · 地形／危險試玩</option></select
        ></label
      ><p>設定會自動儲存；至少兩支車隊開始，可加入電腦練習。</p
      ><p v-if="race.settingsError" role="alert">{{ race.settingsError }}</p
      ><p v-else role="status">{{
        race.settingsPending ? '正在儲存…' : race.settingsSaved ? '已儲存' : ''
      }}</p></template
    >
    <template #side-actions
      ><a class="vue-race-lesson-link" :href="lessonHref">獨立本機教學桌 →</a
      ><p v-if="s">{{
        s.options.devilsRun ? '惡魔賽道 · 地形／危險試玩' : '主遊戲 · 自製賽道'
      }}</p></template
    >
    <template #help
      ><ol
        ><li>每隊三輛不同車型，損傷滿兩格暫時失能，可用維修指令恢復；淘汰車不能修復。</li
        ><li
          >每輪四顆移動骰，每次出發消耗一顆；各車先行動一次後可滑行一格，每車最多兩次。每輪只可使用一次指令，消耗另一顆骰子。</li
        ><li
          >氮氣需要 1–3、甩尾需要 3–5、維修需要 6，直升機可用任意點數。指令與移動使用不同骰子。</li
        ><li
          >亮框可選多格目標並預覽路線；公開危險會影響規劃，未公開危險抵達後才揭示，遇到檢定或道路更新重新選路。</li
        ><li
          >射擊前方三格，骰面符合車型才命中。第一輪禁止射擊。碰撞後依較大車的車主決定保留或重擲一次。</li
        ><li
          >跨越前方道路會接新路並移除後段，落後車輛淘汰。車隊出局後會出現終點；兩隊賽到第五塊道路也會出現終點。</li
        ><li
          >每步 90
          秒；逾時依既有規則自動操作。離席車隊由電腦接手。先抵達終點或最後存活的車隊獲勝。</li
        ></ol
      ><a :href="lessonHref">用獨立教學桌練習完整操作 →</a></template
    >
  </GameRoomPage>
</template>
