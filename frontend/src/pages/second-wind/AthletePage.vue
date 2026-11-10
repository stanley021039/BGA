<script setup lang="ts">
import { computed } from 'vue';
import { useAthleteStore } from '../../stores/second-wind';
import { readAthleteSnapshot } from '../../contracts/second-wind';
import GameRoomPage from '../../components/GameRoomPage.vue';
import AthleteWaiting from './AthleteWaiting.vue';
import AthleteScene from './AthleteScene.vue';
import UiPanel from '../../components/UiPanel.vue';

import AthleteSettings from './AthleteSettings.vue';
const athlete = useAthleteStore();
const roster = computed(
  () =>
    ({ base: '36 名初代角色', mixed: '72 名混合角色', 'second-wind': '36 名 Second Wind 角色' })[
      athlete.state?.options?.racerSet || 'second-wind'
    ],
);
const labels: Record<string, string> = {
  'draft-rolloff': '選秀先手擲骰',
  drafting: '蛇形選秀',
  'race-rolloff': '首場先手擲骰',
  choosing: '秘密選角',
  racing: '能力競速',
  'race-result': '本場結算',
  finished: '總結算',
};
const phase = computed(() =>
  athlete.state?.interrupted ? '本局已中止' : labels[athlete.game?.phase || ''] || '等待開桌',
);
</script>
<template>
  <GameRoomPage
    type="second-wind"
    title="運動員 Second Wind"
    :description="`3–6 人 · ${roster} · 四場能力競速`"
    :reader="readAthleteSnapshot"
    :phase="phase"
    :round="athlete.game?.race ? `第 ${athlete.game.race}／4 場` : ''"
    :max-players="6"
    :actor-id="athlete.game?.pending?.playerId || athlete.game?.turnId"
    :setup="athlete.setup"
    :status="
      (p) =>
        athlete.game?.pending?.playerId === p.id
          ? '能力選擇中'
          : athlete.game?.turnId === p.id
            ? '正在行動'
            : p.online
              ? '在線'
              : '暫時離線'
    "
    :can-start="(athlete.state?.players.length || 0) >= 3"
    start-label="開始選秀"
    setup-target="#athlete-restart-settings"
    @start="athlete.start()"
  >
    <AthleteWaiting v-if="athlete.state?.phase === 'waiting'" :roster="roster" />
    <AthleteScene v-else-if="athlete.game" />
    <UiPanel
      v-else-if="athlete.state"
      :title="athlete.state.interrupted ? '本局已中止' : '等待下一局'"
    >
      <p>{{
        athlete.state.interrupted
          ? '有人離席，本局已中止；房主可重新開局。'
          : '你未參與目前對局；等待房主開始下一局。'
      }}</p
      ><div id="athlete-restart-settings"></div>
    </UiPanel>
    <template #settings
      ><AthleteSettings /><p
        >3–6 人，13 張 Twist。四場測試獎分：3／1、4／2、5／3、7／4。</p
      ></template
    >
    <template #help
      ><ol>
        <li
          >先擲骰決定選秀先手，進行兩輪蛇形選秀，每人四名角色。各場同時秘密鎖角，每名角色只出賽一次。</li
        >
        <li
          >輪到你時擲骰做主移動；可選能力會停下等待指定玩家作決定，強制能力自動結算。絆倒會略過下次主移動。</li
        >
        <li>曲折賽道第一位通過 14 格觸發 Twist；漩渦賽道停在漩渦格會傳送到另一端。</li>
        <li
          >兩名選手完賽即結束該場。下一場由最先淘汰或最落後角色的玩家先行。只剩一人在場時直接取得剩餘名次。</li
        >
        <li
          >角色、Twist、分數與事件紀錄都可查看；四場總分最高者獲勝，同分共同獲勝。Re-Runner
          等效果會增加在場角色。</li
        >
        <li>本機試玩版；伺服器重啟不續局，有人離席則中止，暫時斷線可重連。</li>
      </ol></template
    >
  </GameRoomPage>
</template>
