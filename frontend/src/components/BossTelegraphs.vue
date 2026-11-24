<script setup lang="ts">
import { computed } from 'vue';
import abilities from '../../../public/shared/boss-abilities.json';
import { bossStageSpec, bossAttackPlan, bossZonePath } from '../engines/boss-geometry.js';
import type { LobbyAttack } from '../contracts/lobby';
import { bossWarningOpacity } from '../services/boss-warning-visibility.js';
const props = defineProps<{ events: LobbyAttack[]; now: number }>();
const warnings = computed(() =>
  props.events
    .flatMap((event) => {
      const spec = bossStageSpec(
        abilities.find((s) => s.id === event.effect),
        event.bossPhase || 1,
      );
      const rate = event.bossAttackRate || 1;
      if (!spec || event.cancelled || props.now > event.until) return [];
      const age = (props.now - event.at) * rate;
      return bossAttackPlan(
        spec,
        { x: event.fromX, y: event.fromY },
        { x: event.toX, y: event.toY },
        event.aspectRatio || 1.6,
      ).flatMap((strike) => {
        const opacity = bossWarningOpacity(spec.slot, spec.windup, strike.at, age, rate);
        if (!opacity) return [];
        return [
          {
            id: event.id + ':' + strike.index,
            name: spec.name,
            color: strike.spec.color,
            opacity,
            zones: strike.zones,
          },
        ];
      });
    })
    .slice(-30),
);
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
      :opacity="warning.opacity"
    >
      <title>{{ warning.name }}</title>
      <path
        v-for="(zone, i) in warning.zones"
        :key="i"
        :d="bossZonePath(zone)"
        :fill="zone.shape === 'line' ? 'none' : 'currentColor'"
        fill-rule="evenodd"
        stroke="currentColor"
        :stroke-width="zone.shape === 'line' ? zone.w : 0.35"
        stroke-linecap="round"
        fill-opacity=".25"
      />
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
