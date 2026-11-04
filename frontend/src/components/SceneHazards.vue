<script setup lang="ts">
import { useId } from 'vue';
import type { ArenaHazard } from '../contracts/lobby-arena';
defineProps<{ zones: ArenaHazard[] }>();
const prefix = useId().replace(/[^a-z0-9]/gi, '');
</script>
<template>
  <div class="scene-hazards" aria-label="場景陷阱"
    ><svg
      v-for="zone in zones"
      :key="zone.id"
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      class="scene-hazard"
      :data-kind="zone.kind"
      :style="{
        left: zone.x + '%',
        top: zone.y + '%',
        width: zone.width + '%',
        height: zone.height + '%',
      }"
      role="img"
      :aria-label="zone.kind === 'mud' ? '泥沼：移速減半' : '餘燼：每秒灼傷最大血量百分之五'"
    >
      <defs>
        <linearGradient :id="prefix + zone.id" x2="0.3" y2="1">
          <stop class="ground-light" />
          <stop offset="1" class="ground-dark" />
        </linearGradient>
      </defs>
      <rect class="shadow" x="2" y="3" width="98" height="57" rx="8" />
      <rect x="1" y="1" width="97" height="55" rx="8" :fill="'url(#' + prefix + zone.id + ')'" />
      <g v-if="zone.kind === 'mud'">
        <ellipse class="puddle" cx="24" cy="32" rx="21" ry="10" />
        <ellipse class="puddle" cx="69" cy="26" rx="24" ry="11" />
        <ellipse class="puddle" cx="52" cy="44" rx="23" ry="9" />
        <path class="shine" d="M9 29Q23 20 37 28M52 22Q69 15 85 23M39 42Q49 36 64 41" />
        <path class="boot" d="M45 13H56L55 30L68 34V40H42V32Z" />
        <ellipse class="puddle" cx="53" cy="40" rx="20" ry="4" />
      </g>
      <g v-else>
        <path
          class="cracks"
          d="M13 11L23 22L19 36L29 48M42 9L50 23L44 41L55 52M73 8L82 21L77 35L88 50"
        />
        <path
          class="ember"
          d="M28 23Q42 45 29 47Q17 48 22 37L24 31Z M52 10Q74 40 55 46Q32 50 43 31L46 25L48 33Q56 24 52 10Z M77 25Q92 47 78 48Q66 48 72 36Z"
        />
        <path class="flame-core" d="M52 29Q63 45 53 45Q45 44 52 29Z M28 37Q35 46 28 45Z" />
      </g></svg
  ></div>
</template>
<style scoped>
.scene-hazards {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.scene-hazard {
  position: absolute;
  overflow: visible;
}
.shadow {
  fill: var(--stitch-frame);
  opacity: 0.2;
}
.ground-light {
  stop-color: var(--stitch-artwork-swatch-b79862);
}
.ground-dark {
  stop-color: var(--stitch-artwork-swatch-796443);
}
[data-kind='embers'] .ground-dark {
  stop-color: var(--stitch-scene-light-ink);
}
.puddle {
  fill: var(--stitch-artwork-swatch-796443);
  stroke: var(--stitch-artwork-swatch-cdb176);
  stroke-width: 0.5;
}
.shine {
  fill: none;
  stroke: var(--stitch-artwork-swatch-cdb176);
  stroke-width: 1;
  opacity: 0.7;
}
.boot {
  fill: var(--stitch-artwork-swatch-cdb176);
  stroke: var(--stitch-artwork-swatch-796443);
  stroke-width: 1;
}
.cracks {
  fill: none;
  stroke: var(--stitch-artwork-swatch-b45309);
  stroke-width: 2;
}
.ember {
  fill: var(--stitch-artwork-swatch-fbbf24);
  stroke: var(--stitch-artwork-swatch-b45309);
  stroke-width: 1;
}
.flame-core {
  fill: var(--stitch-artwork-swatch-fde68a);
}
</style>
