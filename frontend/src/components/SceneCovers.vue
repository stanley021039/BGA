<script setup lang="ts">
import type { ArenaCover } from '../contracts/lobby-arena';
defineProps<{ covers: ArenaCover[] }>();
</script>
<template>
  <div class="scene-covers" aria-label="阻擋行走與直線攻擊的石牆"
    ><svg
      v-for="cover in covers"
      :key="cover.id"
      class="scene-cover"
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      :style="{
        left: cover.x + '%',
        top: cover.y + '%',
        width: cover.width + '%',
        height: cover.height + '%',
      }"
      role="img"
      aria-label="石牆掩體"
    >
      <rect class="shadow" x="3" y="5" width="97" height="55" rx="3" />
      <rect class="stone" x="1" y="1" width="96" height="53" rx="3" />
      <path class="top" d="M3 2H95V14H3Z" />
      <path class="edge" d="M50 15V53M3 14H95" /></svg
  ></div>
</template>
<style scoped>
.scene-covers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.scene-cover {
  position: absolute;
  overflow: visible;
}
.stone {
  fill: var(--stitch-artwork-swatch-b79862);
  stroke: var(--stitch-scene-light-ink);
  stroke-width: 1.5;
}
.top {
  fill: var(--stitch-artwork-swatch-cdb176);
}
.shadow {
  fill: var(--stitch-frame);
  opacity: 0.2;
}
.edge {
  stroke: var(--stitch-artwork-swatch-796443);
  stroke-width: 1;
  fill: none;
}
</style>
