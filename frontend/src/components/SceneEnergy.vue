<script setup lang="ts">
import type { LobbyVisitor } from '../contracts/lobby';
defineProps<{ visitor?: LobbyVisitor; connected: boolean }>();
</script>
<template>
  <div
    class="scene-energy"
    role="progressbar"
    aria-label="多人招式能量"
    aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="visitor?.energy || 0"
    :aria-busy="!connected"
  >
    <div :style="{ width: (visitor?.energy || 0) + '%' }" />
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
</style>
