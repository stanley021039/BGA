<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue';
import scenes from '../../../public/shared/lobby-background-live.json';
import { useSteppedAnimations } from '../composables/stepped-animations';
import { usePreferencesStore } from '../stores/preferences';
import '../assets/lobby-background-live.css';
const props = defineProps<{ id: string }>(),
  prefs = usePreferencesStore(),
  root = ref<HTMLElement | null>(null),
  hidden = ref(document.hidden),
  idle = ref(false),
  suffix = '-bg-' + useId().replace(/[^a-z0-9-]/gi, '');
const svg = computed(() => {
  let html = scenes.find((scene) => scene.id === props.id)?.svg || '';
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids)
    html = html
      .split('id="' + id + '"')
      .join('id="' + id + suffix + '"')
      .split('url(#' + id + ')')
      .join('url(#' + id + suffix + ')');
  return html;
});
const paused = computed(
  () =>
    hidden.value || idle.value || prefs.motion?.enabled === false || prefs.motion?.reduced === true,
);
const playing = computed(() => !paused.value),
  stepped = useSteppedAnimations(root, playing);
// Nobody watches a lobby they have left alone, so the art stops after a minute.
const IDLE_MS = 60_000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
function active() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => (idle.value = true), IDLE_MS);
  idle.value = false;
}
const visibility = () => {
  hidden.value = document.hidden;
};
const inputs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
watch(svg, () => nextTick(stepped.refresh));
onMounted(() => {
  document.addEventListener('visibilitychange', visibility);
  for (const type of inputs) window.addEventListener(type, active, { passive: true });
  active();
  stepped.refresh();
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', visibility);
  for (const type of inputs) window.removeEventListener(type, active);
  if (idleTimer) clearTimeout(idleTimer);
});
</script>
<template>
  <div
    v-if="svg"
    ref="root"
    class="lobby-live-art"
    :class="{ 'is-paused': paused }"
    :data-scene="id"
    aria-hidden="true"
    v-html="svg"
  />
</template>
<style lang="scss">
.lobby-live-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.lobby-live-art svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.lobby-live-art * {
  pointer-events: none;
}
.lobby-live-art.is-paused * {
  animation-play-state: paused !important;
}
@media (prefers-reduced-motion: reduce) {
  .lobby-live-art * {
    animation-play-state: paused !important;
  }
}
</style>
