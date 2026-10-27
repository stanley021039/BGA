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
    <div class="scene-tombstone-caption">
      <strong :title="visitor.name">{{ visitor.name }}</strong>
      <small>{{ seconds }} 秒後重生</small>
    </div>
    <img :src="tombstone" width="80" height="90" alt="" />
  </div>
  <div
    v-else-if="visitor.maxHealth && visitor.health !== undefined"
    class="scene-health-bar"
    role="progressbar"
    :aria-label="visitor.name + '的HP'"
    :aria-valuenow="visitor.health"
    :aria-valuemax="visitor.maxHealth"
    aria-valuemin="0"
  >
    <div
      :style="{
        width: Math.max(0, Math.min(100, (visitor.health / visitor.maxHealth) * 100)) + '%',
      }"
    />
  </div>
</template>
<style scoped>
.scene-health-bar {
  flex: none;
  width: 42px;
  height: 2px;
  margin-block: 2px;
  overflow: hidden;
  background: var(--stitch-line);
  border-radius: var(--stitch-radius-pill);
}
.scene-health-bar > div {
  height: 100%;
  background: var(--stitch-primary);
}
.scene-tombstone {
  position: relative;
  display: grid;
  justify-items: center;
  width: 80px;
  height: 90px;
}
.scene-tombstone > img {
  width: 80px;
  height: 90px;
}
.scene-tombstone-caption {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  width: max-content;
  max-width: 160px;
  padding: var(--stitch-space-4) var(--stitch-space-8);
  color: var(--stitch-ink);
  background: var(--stitch-surface);
  border-radius: var(--stitch-radius-control);
  text-align: center;
  font-size: var(--stitch-text-label);
}
.scene-tombstone strong {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
  font-size: var(--stitch-text-label);
}
.scene-tombstone small {
  color: inherit;
  font-size: var(--stitch-text-label);
}
</style>
