<script setup lang="ts">
import { computed } from 'vue';
import sceneRules from '../../../public/shared/scene-rules.json';
import type { LobbyVisitor } from '../contracts/lobby';
const props = defineProps<{
  visitor?: LobbyVisitor;
  connected: boolean;
  size?: 'avatar' | 'panel';
}>();
const maximum = computed(() => props.visitor?.energyMaximum ?? sceneRules.energy.maximum);
</script>
<template>
  <div
    class="scene-energy"
    :class="{ 'is-panel': size === 'panel' }"
    role="progressbar"
    aria-label="大招能量"
    aria-valuemin="0"
    :aria-valuemax="maximum"
    :aria-valuenow="visitor?.energy || 0"
    :aria-busy="!connected"
  >
    <div :style="{ width: ((visitor?.energy || 0) / maximum) * 100 + '%' }" />
  </div>
</template>
<style scoped>
.scene-energy {
  flex: none;
  inline-size: 42px;
  block-size: 2px;
  margin-block: 2px;
  overflow: hidden;
  background: var(--stitch-line);
  border-radius: var(--stitch-radius-pill);
}
.scene-energy > div {
  block-size: 100%;
  background: var(--stitch-info-ink);
}
.scene-energy.is-panel {
  inline-size: 100%;
  block-size: var(--stitch-space-8);
  margin-block: 0;
}
</style>
