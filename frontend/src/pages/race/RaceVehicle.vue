<script setup lang="ts">
import { computed } from 'vue';
const props = withDefaults(defineProps<{ size: number; color: string; disabled?: boolean }>(), {
  disabled: false,
});
const width = computed(() => [30, 36, 42][props.size] || 30),
  height = computed(() => [16, 20, 25][props.size] || 16);
</script>
<template>
  <g :transform="disabled ? 'rotate(180)' : undefined">
    <rect :x="-width / 2 + 2" :y="-height / 2 - 4" width="9" height="6" rx="2" fill="#111711" />
    <rect :x="width / 2 - 11" :y="-height / 2 - 4" width="9" height="6" rx="2" fill="#111711" />
    <rect :x="-width / 2 + 2" :y="height / 2 - 2" width="9" height="6" rx="2" fill="#111711" />
    <rect :x="width / 2 - 11" :y="height / 2 - 2" width="9" height="6" rx="2" fill="#111711" />
    <path
      :d="`M${-width / 2},${-height / 2 + 3} L${width / 2 - 5},${-height / 2} L${width / 2},${-height / 2 + 5} V${height / 2 - 5} L${width / 2 - 5},${height / 2} L${-width / 2},${height / 2 - 3}Z`"
      :fill="color"
      stroke="#eff2d880"
      stroke-width="1"
    />
    <rect x="-4" :y="-height / 2 + 3" width="9" :height="height - 6" rx="2" fill="#17251f" />
    <path :d="`M9,-2H${width / 2 + 4}M9,2H${width / 2 + 4}`" stroke="#262d24" stroke-width="2" />
    <path :d="`M${-width / 2 + 3},0H-7`" stroke="#f9eac6" stroke-width="2" />
  </g>
</template>
