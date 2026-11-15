<script setup lang="ts">
import { computed } from 'vue';
import abilities from '../../../public/shared/boss-abilities.json';
import { bossZones } from '../engines/boss-geometry.js';
import type { LobbyAttack } from '../contracts/lobby';
const props = defineProps<{ events: LobbyAttack[]; now: number }>();
const warnings = computed(() =>
  props.events
    .flatMap((event) => {
      const spec = abilities.find((s) => s.id === event.effect);
      const rate = event.bossAttackRate || 1;
      if (!spec || event.cancelled || props.now > event.at + (spec.windup + spec.duration) / rate)
        return [];
      return [
        {
          id: event.id,
          name: spec.name,
          color: spec.color,
          charged: props.now < event.at + spec.windup / rate,
          zones: bossZones(
            spec,
            { x: event.fromX, y: event.fromY },
            { x: event.toX, y: event.toY },
            event.aspectRatio || 1.6,
          ),
        },
      ];
    })
    .slice(-2),
);
function ring(z: { x: number; y: number; r: number; inner?: number }) {
  const r = z.r,
    i = z.inner || 0;
  return `M${z.x + r},${z.y}a${r},${r} 0 1 0 ${-r * 2},0a${r},${r} 0 1 0 ${r * 2},0 M${z.x + i},${z.y}a${i},${i} 0 1 1 ${-i * 2},0a${i},${i} 0 1 1 ${i * 2},0`;
}
</script>
<template>
  <svg
    class="boss-telegraphs"
    viewBox="0 0 100 62.5"
    preserveAspectRatio="none"
    role="img"
    aria-label="Boss招式預警區域"
  >
    <g
      v-for="warning in warnings"
      :key="warning.id"
      :style="{ color: warning.color }"
      :opacity="warning.charged ? 0.35 : 0.6"
    >
      <title>{{ warning.name }}</title>
      <template v-for="(zone, i) in warning.zones" :key="i">
        <line
          v-if="zone.shape === 'line'"
          :x1="zone.x"
          :y1="zone.y"
          :x2="zone.x2"
          :y2="zone.y2"
          :stroke-width="zone.w"
          stroke="currentColor"
          stroke-linecap="round"
          opacity=".45"
        />
        <path
          v-else-if="zone.shape === 'ring'"
          :d="ring(zone)"
          fill="currentColor"
          fill-rule="evenodd"
          stroke="currentColor"
          stroke-width=".35"
          fill-opacity=".25"
        />
        <circle
          v-else
          :cx="zone.x"
          :cy="zone.y"
          :r="zone.r"
          fill="currentColor"
          fill-opacity=".2"
          stroke="currentColor"
          stroke-width=".35"
        />
      </template>
    </g>
  </svg>
</template>
<style scoped>
.boss-telegraphs {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
