<script setup lang="ts">
import { computed } from 'vue';
import { useAthleteStore } from '../../stores/second-wind';
import { readAthleteSnapshot } from '../../contracts/second-wind';
import GameRoomPage from '../../components/GameRoomPage.vue';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import AthleteScene from './AthleteScene.vue';
const athlete = useAthleteStore();
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
    description="3–6 人 · 36 名原版角色 · 四場能力競速"
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
    <RoomWaitingTemplate
      v-if="athlete.state?.phase === 'waiting'"
      flow
      type="second-wind"
      title="運動員 Second Wind"
      description="招募四名選手，秘密安排出賽順序，利用能力搶下四場比賽的積分。"
      :facts="[
        { label: '人數', value: '3–6 人' },
        { label: '角色', value: '36 名原版角色' },
        { label: '賽程', value: 'Twisty／Whirly 各兩場' },
        { label: '獎分', value: '3／1、4／2、5／3、7／4' },
      ]"
      notice="名次獎分為使用者核准的測試值，後三場仍待原版數值核對。可加入測試 AI。"
      ><template #art><strong>SECOND WIND</strong></template></RoomWaitingTemplate
    >
    <AthleteScene v-else-if="athlete.game" />
    <p v-else-if="athlete.state?.interrupted">有人離席，本局已中止；房主可重新開局。</p>
    <template #settings
      ><p>3–6 人，原版 36 名角色與 13 張 Twist。四場測試獎分：3／1、4／2、5／3、7／4。</p></template
    >
    <template #help
      ><ol>
        <li
          >先擲骰決定選秀先手，進行兩輪蛇形選秀，每人四名角色。各場同時秘密鎖角，每名角色只出賽一次。</li
        >
        <li
          >輪到你時擲骰做主移動；可選能力會停下等待指定玩家作決定，強制能力自動結算。絆倒會略過下次主移動。</li
        >
        <li
          >Twisty 第一位通過 14 格觸發 Twist；Whirly 停在漩渦格會傳送到另一端。14
          格界線為目前圖像轉錄，待核對。</li
        >
        <li
          >兩名選手完賽即結束該場。下一場由最先淘汰或最落後角色的玩家先行。只剩一人在場時直接取得剩餘名次。</li
        >
        <li
          >角色、Twist、分數與事件紀錄都可查看；四場總分最高者獲勝，同分共同獲勝。Re-Runner
          等效果會增加在場角色。</li
        >
        <li
          >本機試玩版；伺服器重啟不續局，有人離席則中止，暫時斷線可重連。獎分後三場與 Twist
          界線尚待原版核對。</li
        >
      </ol></template
    >
  </GameRoomPage>
</template>
