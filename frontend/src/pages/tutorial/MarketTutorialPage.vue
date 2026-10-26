<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { createMarketPractice, tutorialForecastTick } from './market-practice';
import UiPanel from '../../components/UiPanel.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiField from '../../components/UiField.vue';
import UiHeading from '../../components/UiHeading.vue';
import UiNotice from '../../components/UiNotice.vue';
import '../../styles/tutorial.scss';
let model = createMarketPractice(),
  timer: ReturnType<typeof setTimeout> | undefined;
const state = ref(model.snapshot()),
  mode = ref<'manual' | 'auto' | null>(null),
  paused = ref(false),
  forecast = ref<string | number>(0.5),
  error = ref('');
const titles = ['選擇預測', '截止並凍結', '教學收盤揭曉', '查看積分'],
  copy = [
    '先預測下一交易日的漲跌幅，可選 -10% 至 +10%，每格 0.1%。這裡使用示範快照與假設行情。',
    '正式投票在目標交易日台北 00:00 截止；截止後不能修改。此處按下一步演示時間經過。',
    '假設這次教學的收盤漲跌幅為 +0.8%。正式行情須以官方同日收盤證據為準。',
    '積分已用正式計分公式計算；預測與實際越接近，結果通常越好，但正負分依凍結快照而定。教學不計入帳號。',
  ];
const valid = computed(() => {
  try {
    tutorialForecastTick(forecast.value);
    return true;
  } catch {
    return false;
  }
});
function schedule() {
  clearTimeout(timer);
  if (mode.value === 'auto' && !paused.value && !state.value.done && !document.hidden)
    timer = setTimeout(next, 1800);
}
function next() {
  error.value = '';
  try {
    if (state.value.phase === 0) {
      if (!valid.value) throw Error('請輸入 -10% 至 +10%，每格 0.1%');
      model.forecast(tutorialForecastTick(forecast.value));
    }
    model.next();
    state.value = model.snapshot();
    schedule();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '請重試';
    paused.value = true;
  }
}
function start(value: 'manual' | 'auto') {
  clearTimeout(timer);
  mode.value = value;
  paused.value = false;
  model = createMarketPractice();
  state.value = model.snapshot();
  forecast.value = 0.5;
  error.value = '';
  schedule();
}
function pause() {
  paused.value = !paused.value;
  schedule();
}
function visibility() {
  if (document.hidden) {
    paused.value = true;
    clearTimeout(timer);
  }
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <main class="vue-tutorial" data-tutorial-game="market" :data-tutorial-mode="mode || 'choose'"
    ><header class="vue-tutorial-header"
      ><UiHeading :level="1" kind="page">股市冥燈 · 試玩教學</UiHeading
      ><UiLink href="/" label="離開教學"
    /></header>
    <UiPanel title="每日預測練習" description="示範資料與假設行情 · 不連線投票、不寫正式積分">
      <div class="vue-tutorial-modes"
        ><UiButton label="自己手動操作" @click="start('manual')" /><UiButton
          label="全自動演示"
          @click="start('auto')"
      /></div>
    </UiPanel>
    <UiPanel v-if="mode" :title="titles[state.phase]" :description="copy[state.phase]">
      <UiField
        v-model="forecast"
        label="預測漲跌幅（%）"
        type="number"
        min="-10"
        max="10"
        step="0.1"
        :disabled="state.phase !== 0 || mode === 'auto'"
      />
      <p v-if="state.phase >= 1">已凍結預測：{{ state.forecast }}%</p
      ><p v-if="state.actual !== null">教學假設收盤：+{{ state.actual }}%</p
      ><p v-if="state.points !== null" role="status">示範積分：{{ state.points.toFixed(6) }}</p>
      <UiNotice v-if="error" :message="error" error persistent />
      <div class="vue-tutorial-controls"
        ><UiButton
          v-if="mode === 'manual' && !state.done"
          :label="
            state.phase === 0 ? '送出示範預測' : state.phase === 1 ? '查看教學收盤' : '計算示範積分'
          "
          :disabled="state.phase === 0 && !valid"
          @click="next" /><UiButton
          v-if="mode === 'auto' && !state.done"
          :label="paused ? '繼續演示' : '暫停演示'"
          @click="pause" /><UiButton label="重新練習" @click="start(mode)" /><UiButton
          :label="mode === 'manual' ? '切換自動演示' : '切換手動練習'"
          @click="start(mode === 'manual' ? 'auto' : 'manual')"
      /></div>
    </UiPanel>
  </main>
</template>
