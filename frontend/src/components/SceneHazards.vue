<script setup lang="ts">
import { useId } from 'vue';
import { arenaZonePoints, type ArenaHazard } from '../contracts/lobby-arena';
const outline = (zone: ArenaHazard) =>
  arenaZonePoints(zone.shape, zone.kind)
    .map(([x, y]) => x + ',' + y * 0.6)
    .join(' ');
const clip = (zone: ArenaHazard) =>
  'polygon(' +
  arenaZonePoints(zone.shape, zone.kind)
    .map(([x, y]) => x + '% ' + y + '%')
    .join(',') +
  ')';
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
        clipPath: clip(zone),
      }"
      role="img"
      :aria-label="zone.kind === 'mud' ? '泥沼：移速減半' : '餘燼：每半秒灼傷，離開後仍持續兩秒'"
    >
      <defs>
        <linearGradient :id="prefix + zone.id" x2="0.3" y2="1">
          <stop class="ground-light" />
          <stop offset="1" class="ground-dark" />
        </linearGradient>
      </defs>
      <ellipse class="shadow" cx="50" cy="42" rx="49" ry="18" />
      <polygon :points="outline(zone)" :fill="'url(#' + prefix + zone.id + ')'" />
      <g v-if="zone.kind === 'mud'">
        <ellipse class="puddle" cx="24" cy="32" rx="21" ry="10" />
        <ellipse class="puddle" cx="69" cy="26" rx="24" ry="11" />
        <ellipse class="puddle" cx="52" cy="44" rx="23" ry="9" />
        <path class="shine" d="M9 29Q23 20 37 28M52 22Q69 15 85 23M39 42Q49 36 64 41" />
        <path class="mud-rim" d="M9 37L18 43L32 43M54 17Q69 12 85 20M66 49L82 43L91 34" />
        <ellipse class="puddle" cx="53" cy="40" rx="20" ry="4" />
      </g>
      <g v-else>
        <path
          class="cracks"
          d="M13 11L23 22L19 36L29 48M42 9L50 23L44 41L55 52M73 8L82 21L77 35L88 50"
        />
        <g v-for="spark in 13" :key="spark">
          <circle
            class="ember"
            :cx="10 + ((spark * 17) % 80)"
            :cy="12 + ((spark * 11) % 36)"
            :r="1 + (spark % 3)"
          />
          <circle
            class="flame-core"
            :cx="10 + ((spark * 17) % 80)"
            :cy="12 + ((spark * 11) % 36)"
            r="0.8"
          />
        </g>
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
.mud-rim {
  fill: none;
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
