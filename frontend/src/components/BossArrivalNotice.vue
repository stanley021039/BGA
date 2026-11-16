<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { createBossWarningSounds } from '../services/boss-warning-sounds.js';
import type { LobbySnapshot } from '../contracts/lobby';
import UiNotice from './UiNotice.vue';
import warning from '../assets/boss-warning.svg';
const props = defineProps<{
  arrivals: NonNullable<LobbySnapshot['bossArrivals']>;
  now: number;
  connected: boolean;
}>();
const pending = computed(() =>
  props.connected ? props.arrivals.filter((a) => props.now < a.spawnAt) : [],
);
let sounds: ReturnType<typeof createBossWarningSounds> | undefined;
onMounted(() => {
  sounds = createBossWarningSounds();
  watch(
    [() => props.arrivals, () => props.now, () => props.connected],
    () => sounds?.update(props.arrivals, props.now, props.connected),
    { immediate: true },
  );
});
onUnmounted(() => sounds?.destroy());
</script>
<template>
  <Teleport to="body">
    <div v-if="pending.length" class="boss-arrival-warning" role="alert">
      <img :src="warning" alt="WARNING" width="600" height="130" />
      <UiNotice
        v-for="a in pending"
        :key="a.id"
        tone="danger"
        persistent
        :message="
          a.name + ' 即將降臨 · ' + Math.max(1, Math.ceil((a.spawnAt - now) / 1000)) + ' 秒'
        "
      />
    </div>
  </Teleport>
</template>
<style scoped>
.boss-arrival-warning {
  position: fixed;
  inset: 20% auto auto 50%;
  transform: translateX(-50%);
  width: min(480px, 90vw);
  z-index: 80;
  pointer-events: none;
  display: grid;
  gap: var(--stitch-space-8);
}
.boss-arrival-warning img {
  width: 100%;
  height: auto;
}
</style>
