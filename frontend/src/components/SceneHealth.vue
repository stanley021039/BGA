<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import tombstone from '../assets/scene-tombstone.svg?no-inline';
import type { LobbyVisitor } from '../contracts/lobby';
const props = defineProps<{ visitor: LobbyVisitor }>();
const seconds = ref(3);
let timer: ReturnType<typeof setInterval> | undefined;
watch(
  () => props.visitor.respawnAt,
  () => {
    clearInterval(timer);
    const remaining = props.visitor.respawnRemainingMs ?? 3000;
    const deadline = performance.now() + remaining;
    seconds.value = Math.ceil(remaining / 1000);
    if (props.visitor.health === 0)
      timer = setInterval(() => {
        seconds.value = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        if (!seconds.value) clearInterval(timer);
      }, 250);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(timer));
</script>
<template>
  <div v-if="visitor.health === 0" class="scene-tombstone" role="status">
    <img :src="tombstone" width="80" height="90" alt="" /><span class="scene-respawn-seconds">{{
      seconds
    }}</span
    ><strong>{{ visitor.name }}</strong
    ><small>{{ seconds }} 秒後重生</small>
  </div>
</template>
<style scoped>
.scene-tombstone {
  position: relative;
  display: grid;
  justify-items: center;
  width: 80px;
  min-height: 90px;
}
.scene-tombstone > img {
  width: 80px;
  height: 90px;
}
.scene-tombstone .scene-respawn-seconds {
  position: absolute;
  top: 0;
  height: 20px;
  display: grid;
  place-items: center;
  color: var(--stitch-artwork-preview-ink);
  font-size: var(--stitch-text-label);
}
.scene-tombstone strong {
  position: absolute;
  top: 53px;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--stitch-artwork-preview-ink);
  font-size: var(--stitch-text-label);
}
.scene-tombstone small {
  color: var(--stitch-ink);
  background: var(--stitch-surface);
  font-size: var(--stitch-text-label);
}
</style>
