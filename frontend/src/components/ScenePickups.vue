<script setup lang="ts">
import { pickupIcons, pickupLabels, type LobbyPickup } from '../contracts/lobby-pickups';
defineProps<{ items: LobbyPickup[] }>();
</script>
<template>
  <div class="scene-pickups" aria-label="走近自動拾取的場景道具"
    ><img
      v-for="item in items"
      :key="item.id"
      class="scene-pickup"
      :data-kind="item.kind"
      :src="pickupIcons[item.kind]"
      :alt="pickupLabels[item.kind] + '：走近自動拾取'"
      :style="{ left: item.x + '%', top: item.y + '%' }"
  /></div>
</template>
<style scoped>
.scene-pickups {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.scene-pickup {
  position: absolute;
  width: 42px;
  height: 42px;
  filter: drop-shadow(0 0 4px var(--stitch-scene-dark-ink));
  transform: translate(-50%, -50%);
}
@media (max-width: 500px) {
  .scene-pickup {
    width: 32px;
    height: 32px;
  }
}
</style>
