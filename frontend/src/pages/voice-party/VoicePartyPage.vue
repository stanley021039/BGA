<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { readRoomSnapshot } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import DrawingModePicker from '../../components/DrawingModePicker.vue';
import UiField from '../../components/UiField.vue';
import UiPanel from '../../components/UiPanel.vue';
import '../../styles/party-338.scss';

import VoicePartyScene from './VoicePartyScene.vue';
const type = location.pathname.startsWith('/brainwave') ? 'brainwave' : 'drama-bar';
const drawing = type === 'brainwave';
const title = drawing ? '電波畫家' : '戲精酒吧';
const description = drawing
  ? '聽領圖者的口令、各自跟畫，搶答找出正確選項。'
  : '只用聲音演出一句台詞，猜猜是哪個情境。';
const room = useRoomStore();
const state = computed(() => room.snapshot);
const phaseLabels: Record<string, string> = {
  waiting: '等待玩家',
  prepare: '領圖者選題',
  drawing: '領圖與搶答',
  performing: '聲音表演',
  guessing: '猜情境',
  reveal: '本輪揭曉',
  finished: '本局結束',
};
const phase = computed(() => phaseLabels[state.value?.phase || 'waiting']);
function status(player: { id: string }) {
  if (!state.value || state.value.phase === 'waiting') return '已入座';
  if (['reveal', 'finished'].includes(state.value.phase)) return '本輪已揭曉';
  return player.id === state.value.actorId
    ? drawing
      ? '領圖者'
      : '表演者'
    : drawing
      ? '收訊者'
      : '猜題者';
}
</script>

<template>
  <GameRoomPage
    :type="type"
    :title="title"
    :description="'3–8 人 · ' + description"
    :reader="readRoomSnapshot"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 回合` : ''"
    :actor-id="typeof state?.actorId === 'string' ? state.actorId : null"
    :status="status"
    :max-players="8"
    :score-label="drawing ? '顆水晶' : '杯'"
    :setup="!!state && ['waiting', 'finished'].includes(state.phase)"
    :can-start="(state?.players.length || 0) >= 3"
    :watchable="false"
    :poll-ms="850"
    @start="room.command('start', {})"
  >
    <template #settings>
      <p v-if="state?.phase === 'waiting'"
        >請先確認大家能透過同桌或外部語音互相聽見。測試 AI 僅用於操作驗證。</p
      >
      <UiField
        v-if="!drawing && state?.phase === 'waiting'"
        control="select"
        label="每人演出次數"
        :model-value="String((state.options as { cycles?: number })?.cycles ?? 1)"
        :options="
          [1, 2, 3].map((count) => ({ value: String(count), label: String(count) + ' 次' }))
        "
        :disabled="!room.settingsManager || room.busy"
        @update:model-value="room.command('settings', { cycles: Number($event) })"
      />
    </template>
    <template #help>
      <ol v-if="drawing">
        <li>領圖者有一次換題機會。確認後，正解只有領圖者可見。</li>
        <li>60 秒內只能說形狀、大小、方向、位置與數量。每個人只看得到自己的畫板。</li>
        <li>收訊者可提交 1–3 個不同選項。正確的先後順序決定水晶獎勵，錯牌與未出牌可能扣分。</li>
        <li>若無人答對，擲訊號不良骰結算。每人輪流領圖，水晶最多者獲勝。</li>
      </ol>
      <ol v-else>
        <li>題卡公開一句台詞及六個情境。抽到的情境只有表演者可見。</li>
        <li>用聲音與語氣說出台詞，其他玩家各自猜一個情境。</li>
        <li>有人答對時，答錯的人各記一杯。全部猜錯時，只有表演者記一杯。</li>
        <li>每人輪流表演。全部演完後，虛擬杯數最少者獲勝。</li>
      </ol>
    </template>
    <RoomWaitingTemplate
      v-if="drawing && state?.phase === 'waiting'"
      type="brainwave"
      :title="title"
      :description="description"
      art="/assets/playful/game-draw.svg"
      :facts="[
        { label: '玩家人數', value: '3–8 人' },
        { label: '每輪時間', value: '60 秒' },
        { label: '語音', value: '同桌或外部語音' },
      ]"
      ><template #mode-picker><DrawingModePicker /></template
    ></RoomWaitingTemplate>
    <UiPanel
      v-else-if="!state || state.phase === 'waiting'"
      :title="title"
      :description="description"
    >
      <p>{{ drawing ? '輪到你時，用一句句口令傳出你的圖。' : '先聽台詞，再選出最像的情境。' }}</p>
    </UiPanel>
    <VoicePartyScene v-else :type="type" />
  </GameRoomPage>
</template>
