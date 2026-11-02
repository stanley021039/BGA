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
  <svg class="ui-die" viewBox="0 0 24 24" role="img" :aria-label="value + ' 點'">
    <rect x="1" y="1" width="22" height="22" rx="4" />
    <circle
      v-for="(point, i) in dots[value] || []"
      :key="i"
      :cx="point[0]"
      :cy="point[1]"
      r="1.8"
    />
  </svg>
</template>
<style scoped>
.ui-die {
  inline-size: var(--stitch-space-32);
  block-size: var(--stitch-space-32);
  flex: none;
}
.ui-die rect {
  fill: var(--stitch-primary);
  stroke: var(--stitch-frame);
  stroke-width: 2;
}
.ui-die circle {
  fill: var(--stitch-on-primary);
}
</style>
