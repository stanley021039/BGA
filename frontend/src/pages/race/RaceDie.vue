<script setup lang="ts">
defineProps<{ value: number }>();
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
    <rect x="1" y="1" width="22" height="22" rx="4" fill="currentColor" />
    <circle
      v-for="(dot, i) in dots[value] || []"
      :key="i"
      :cx="dot[0]"
      :cy="dot[1]"
      r="1.8"
      fill="var(--race-die-ink,#263d30)"
    />
  </svg>
</template>
