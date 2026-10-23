<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import type { QuacksSnapshot } from '../../contracts/quacks';
const props = defineProps<{ state: QuacksSnapshot }>();
const list = ref<HTMLOListElement | null>(null);
const steps = computed(() => [
  ...((props.state.round === 1 || props.state.phase === 'patients') &&
  props.state.options.alchemists
    ? [{ id: 'patients', label: '病患' }]
    : []),
  { id: 'fortune', label: '占卜' },
  { id: 'drawing', label: '抽藥' },
  { id: 'reserves', label: '暫存' },
  {
    id: 'witches',
    label: props.state.options.witches || props.state.visitingWitch ? '女巫' : '結算準備',
  },
  ...(props.state.options.alchemists ? [{ id: 'essence', label: '特效藥' }] : []),
  { id: 'bonus', label: '獎勵骰' },
  { id: 'effects', label: '藥材效果' },
  { id: 'rewards', label: '格位獎勵' },
  { id: 'shopping', label: props.state.round === 9 ? '最終換分' : '購物' },
  { id: 'complete', label: '完成' },
]);
const active = computed(() => {
  const s = props.state;
  if (s.phase === 'patients' || s.phase === 'fortune') return s.phase;
  if (s.phase === 'between' || s.phase === 'round-intro' || s.phase === 'finished')
    return 'complete';
  if (s.phase === 'brewing') return s.stage === 'reserves' ? 'reserves' : 'drawing';
  return s.stage === 'effects-confirm' ? 'effects' : s.stage;
});
function alignCurrent() {
  const current = list.value?.querySelector<HTMLElement>('[aria-current="step"]');
  if (list.value && current)
    list.value.scrollLeft = Math.max(
      0,
      current.offsetLeft - list.value.clientWidth / 2 + current.offsetWidth / 2,
    );
}
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (list.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(alignCurrent);
    observer.observe(list.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
watch(
  () => JSON.stringify([props.state.code, props.state.roundId, active.value, steps.value]),
  async () => {
    await nextTick();
    alignCurrent();
  },
  { immediate: true, flush: 'post' },
);
</script>
<template>
  <ol ref="list" class="vue-quacks-round-progress" aria-label="當回合進度" tabindex="0">
    <li
      v-for="(step, index) in steps"
      :key="step.id"
      :aria-current="step.id === active ? 'step' : undefined"
    >
      <span v-if="index" class="vue-quacks-progress-arrow" aria-hidden="true">→</span>
      <span>{{ step.label }}</span>
    </li>
  </ol>
</template>
