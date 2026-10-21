<script setup lang="ts">
import { computed, useId } from 'vue';
const props = withDefaults(defineProps<{ value: number; color?: string; variant?: number }>(), {
  color: '#e6c878',
  variant: 0,
});
const gradient = useId();
const ink = computed(() => {
  const hex = props.color.replace('#', '');
  if (!/^[a-f0-9]{6}$/i.test(hex)) return '#17241e';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r! * 0.299 + g! * 0.587 + b! * 0.114 < 145 ? '#fff9e8' : '#17241e';
});
const dots: Record<number, number[][]> = {
  1: [[12, 12]],
  2: [
    [6, 6],
    [18, 18],
  ],
  3: [
    [6, 6],
    [12, 12],
    [18, 18],
  ],
  4: [
    [6, 6],
    [18, 6],
    [6, 18],
    [18, 18],
  ],
  5: [
    [6, 6],
    [18, 6],
    [12, 12],
    [6, 18],
    [18, 18],
  ],
  6: [
    [6, 5],
    [18, 5],
    [6, 12],
    [18, 12],
    [6, 19],
    [18, 19],
  ],
};
</script>
<template>
  <svg class="vue-race-die" viewBox="0 0 24 24" role="img" :aria-label="value + ' 點'">
    <defs>
      <linearGradient :id="gradient" x1="0" y1="0" x2="1" y2="1">
        <stop :stop-color="color" />
        <stop offset="1" :stop-color="color" stop-opacity=".68" />
      </linearGradient>
    </defs>
    <rect x="1" y="1.8" width="22" height="21" rx="5" fill="#101915" />
    <rect
      x="1"
      y=".6"
      width="22"
      height="21"
      rx="5"
      :fill="'url(#' + gradient + ')'"
      :stroke="color"
      stroke-width=".8"
    />
    <rect
      x="2.5"
      y="2"
      width="19"
      height="18"
      rx="3.5"
      fill="none"
      stroke="#fff"
      stroke-opacity=".3"
      stroke-width=".6"
    />
    <path
      :d="variant % 2 ? 'M3 18L18 3M7 21L21 7' : 'M3 5L19 21M5 3L21 19'"
      fill="none"
      stroke="#fff"
      stroke-opacity=".09"
      stroke-width="2"
    />
    <circle
      v-for="(dot, i) in dots[value] || []"
      :key="i"
      :cx="dot[0]"
      :cy="dot[1]"
      r="1.8"
      :fill="ink"
    />
  </svg>
</template>
