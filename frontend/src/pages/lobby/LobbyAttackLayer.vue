<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LobbyAttack, LobbySnapshot } from '../../contracts/lobby';
import { usePreferencesStore } from '../../stores/preferences';
import { createAttackStage } from '../../services/attack-artwork';
import { attackColor, attackOptions } from '../../services/attack-placement';
const props = defineProps<{ snapshot: LobbySnapshot | null; connected: boolean }>();
// Every live attack draws on this one canvas (#322); up to three play at once.
const layer = ref<HTMLElement | null>(null),
  surface = ref<HTMLCanvasElement | null>(null),
  active = ref<LobbyAttack[]>([]);
const prefs = usePreferencesStore(),
  still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const seen = new Set<string>(),
  timers = new Set<ReturnType<typeof setTimeout>>();
let identity = '',
  initialized = false,
  stage: ReturnType<typeof createAttackStage> | null = null;
function clear() {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  active.value = [];
  stage?.clear();
}
function play(event: LobbyAttack) {
  if (still.value || document.hidden || !layer.value || !surface.value) return;
  const { width, height } = layer.value.getBoundingClientRect();
  if (!width || !height) return;
  stage ||= createAttackStage(surface.value);
  const placement = {
    ...event,
    from: { x: event.fromX, y: event.fromY },
    to: { x: event.toX, y: event.toY },
  };
  stage.add(
    event.id,
    attackOptions(
      placement,
      width,
      height,
      () => active.value.find((item) => item.id === event.id)?.hits,
    ),
  );
}
function visibility() {
  if (document.hidden) {
    clear();
    initialized = false;
  }
}
watch(
  [() => props.snapshot, () => props.connected],
  ([snapshot, connected]) => {
    if (!snapshot || !connected || document.hidden) {
      clear();
      initialized = false;
      return;
    }
    if (identity !== snapshot.selfId) {
      identity = snapshot.selfId;
      initialized = false;
      seen.clear();
      clear();
    }
    const baseline = !initialized;
    initialized = true;
    for (const event of snapshot.attacks) {
      if (seen.has(event.id)) {
        active.value = active.value.map((item) =>
          item.id === event.id ? { ...event, ageMs: item.ageMs } : item,
        );
        continue;
      }
      seen.add(event.id);
      if (baseline || snapshot.serverNow - event.at > 1200 || event.at > snapshot.serverNow + 1000)
        continue;
      const next = { ...event, ageMs: Math.max(0, snapshot.serverNow - event.at) };
      for (const dropped of active.value.slice(0, -2)) stage?.remove(dropped.id);
      active.value = [...active.value.slice(-2), next];
      play(next);
      const timer = setTimeout(() => {
        active.value = active.value.filter((item) => item.id !== event.id);
        stage?.remove(event.id);
        timers.delete(timer);
      }, 4300);
      timers.add(timer);
    }
    if (seen.size > 256) {
      const last = [...seen].slice(-128);
      seen.clear();
      last.forEach((id) => seen.add(id));
    }
  },
  { immediate: true, flush: 'post' },
);
watch(still, (value) => {
  if (value) stage?.clear();
});
onMounted(() => document.addEventListener('visibilitychange', visibility));
onBeforeUnmount(() => {
  clear();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div ref="layer" class="lobby-attack-layer" aria-hidden="true">
    <canvas ref="surface"></canvas>
    <template v-if="still">
      <span
        v-for="event in active"
        :key="event.id"
        class="attack-static-hit"
        :style="{
          left: (['shield', 'sphere'].includes(event.effect) ? event.fromX : event.toX) + '%',
          top:
            'calc(' +
            (['shield', 'sphere'].includes(event.effect) ? event.fromY : event.toY) +
            '% - 42px)',
          borderColor: attackColor(event.effect),
        }"
      ></span>
    </template>
  </div>
</template>
<style scoped>
.lobby-attack-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 5;
}
.lobby-attack-layer canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.attack-static-hit {
  position: absolute;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border: 3px solid;
  border-radius: 50%;
}
</style>
