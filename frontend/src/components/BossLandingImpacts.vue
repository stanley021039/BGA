<script setup lang="ts">
import { computed } from 'vue';
import type { LobbySnapshot } from '../contracts/lobby';
const props = defineProps<{
  arrivals: NonNullable<LobbySnapshot['bossArrivals']>;
  now: number;
  still: boolean;
}>();
const impacts = computed(() =>
  props.arrivals.filter((a) => props.now >= a.spawnAt + 700 && props.now < a.spawnAt + 1500),
);
</script>
<template>
  <svg
    v-for="a in impacts"
    :key="a.id"
    class="boss-landing-impact"
    :class="{ 'is-still': still }"
    :style="{ left: a.x + '%', top: a.y + '%', '--impact-age': -(now - a.spawnAt - 700) + 'ms' }"
    viewBox="0 0 180 100"
    aria-hidden="true"
  >
    <ellipse cx="90" cy="60" rx="80" ry="24" />
    <ellipse cx="90" cy="60" rx="56" ry="15" />
    <path d="m10 63 31-7-12-12m43 31 10-16-7-21m60 24-25-8 9-21m-61 3-10-18m71 44 39-18" />
    <path d="m38 38-8-8 7-9 9 7Zm86-14 9-8 9 10-10 9ZM82 9l9-5 6 10-10 4Z" />
  </svg>
</template>
<style scoped>
.boss-landing-impact {
  position: absolute;
  width: 220px;
  height: 125px;
  transform: translate(-50%, -70%);
  pointer-events: none;
  color: var(--stitch-primary);
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  animation: boss-ground-impact 800ms ease-out both;
  animation-delay: var(--impact-age);
}
.boss-landing-impact.is-still {
  animation: none;
  opacity: 0.65;
}
@keyframes boss-ground-impact {
  from {
    opacity: 1;
    transform: translate(-50%, -70%) scale(0.3);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -70%) scale(1.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  .boss-landing-impact {
    animation: none;
    opacity: 0.65;
  }
}
</style>
