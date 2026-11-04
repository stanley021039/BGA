<script setup lang="ts">
import { pickupLabels, type LobbyPickup } from '../contracts/lobby-pickups';
defineProps<{ items: LobbyPickup[] }>();
const images = {
  health: '/assets/arena/pickup-health.svg',
  speed: '/assets/arena/pickup-speed.svg',
  shield: '/assets/arena/pickup-shield.svg',
  sword: '/assets/arena/pickup-sword.svg',
};
</script>
<template>
  <div class="scene-pickups" aria-label="走近自動拾取的場景道具"
    ><img
      v-for="item in items"
      :key="item.id"
      class="scene-pickup"
      :data-kind="item.kind"
      :src="images[item.kind]"
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
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
}
@media (max-width: 500px) {
  .scene-pickup {
    width: 25px;
    height: 25px;
  }
}
</style>
