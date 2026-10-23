<script setup lang="ts">
import { computed } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
defineProps<{ point: { x: number; y: number } }>();
const preferences = usePreferencesStore();
const still = computed(
  () => preferences.motion?.enabled === false || preferences.motion?.reduced === true,
);
</script>
<template>
  <span
    class="ui-move-marker"
    :data-still="still"
    :style="{ left: point.x + '%', top: point.y + '%' }"
    aria-hidden="true"
  />
</template>
<style scoped>
.ui-move-marker {
  position: absolute;
  z-index: 1;
  width: 25px;
  height: 13px;
  border: var(--stitch-border-width-strong, 2px) solid currentColor;
  border-radius: 50%;
  color: var(--stitch-primary);
  background: color-mix(in srgb, currentColor 25%, transparent);
  box-shadow: 0 0 16px currentColor;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.ui-move-marker::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid currentColor;
  border-radius: inherit;
  animation: move-point-pulse 1.1s ease-out both;
}
.ui-move-marker[data-still='true']::after {
  animation: none;
}
@keyframes move-point-pulse {
  from {
    opacity: 1;
    transform: scale(0.7);
  }
  to {
    opacity: 0;
    transform: scale(2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-move-marker::after {
    animation: none;
  }
}
</style>
