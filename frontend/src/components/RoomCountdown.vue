<script setup lang="ts">
import CountdownBar from '../engines/countdown-bar.js';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import '../styles/room-countdown.scss';
const props = withDefaults(
  defineProps<{
    deadline: number | null;
    duration: number;
    offset: number;
    epoch: string;
    caption: string;
    urgent?: boolean;
    now: number;
    emptyValue?: string;
  }>(),
  { emptyValue: '—' },
);
const prefs = usePreferencesStore(),
  fill = ref<HTMLElement | null>(null),
  seconds = computed(() =>
    Math.ceil(Math.max(0, (props.deadline || 0) - props.now + props.offset) / 1000),
  );
const fraction = computed(() =>
  Math.min(1, Math.max(0, ((props.deadline || 0) - props.now + props.offset) / props.duration)),
);
declare global {
  interface Window {
    CountdownBar?: {
      create(
        node: HTMLElement,
        options: { reducedMotion: () => boolean },
      ): {
        sync(value: {
          key: string;
          deadline: number;
          duration: number;
          offset: number;
          visible: boolean;
        }): void;
        reset(): void;
      };
    };
  }
}
let bar: ReturnType<NonNullable<Window['CountdownBar']>['create']> | null = null;
function sync() {
  if (!props.deadline) {
    bar?.reset();
    if (fill.value) fill.value.style.transform = 'scaleX(0)';
    return;
  }
  bar?.sync({
    key: props.epoch,
    deadline: props.deadline,
    duration: props.duration,
    offset: props.offset,
    visible: !document.hidden,
  });
}
watch(
  () => [props.deadline, props.duration, props.offset, props.epoch, props.now, prefs.motion],
  sync,
);
onMounted(() => {
  if (fill.value)
    bar =
      CountdownBar?.create(fill.value, {
        reducedMotion: () =>
          prefs.motion?.enabled === false ||
          prefs.motion?.reduced === true ||
          matchMedia('(prefers-reduced-motion: reduce)').matches,
      }) || null;
  document.addEventListener('visibilitychange', sync);
  sync();
});
onBeforeUnmount(() => {
  bar?.reset();
  document.removeEventListener('visibilitychange', sync);
});
</script>
<template>
  <div class="vue-room-countdown" :class="{ 'is-urgent': urgent && seconds <= 10 }"
    ><span>{{ caption }}</span
    ><strong role="timer">{{ deadline ? seconds + ' 秒' : emptyValue }}</strong
    ><div class="vue-room-timebar"
      ><progress
        class="ui-sr-only"
        max="1"
        :value="fraction"
        :aria-label="caption"
        :aria-valuetext="'剩餘 ' + seconds + ' 秒'" /><span ref="fill" /></div
  ></div>
</template>
