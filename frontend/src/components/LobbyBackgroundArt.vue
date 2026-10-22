<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue';
import scenes from '../../../public/shared/lobby-background-live.json';
import { usePreferencesStore } from '../stores/preferences';
import '../assets/lobby-background-live.css';
const props = defineProps<{ id: string }>(),
  prefs = usePreferencesStore(),
  hidden = ref(document.hidden),
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
  () => hidden.value || prefs.motion?.enabled === false || prefs.motion?.reduced === true,
);
const visibility = () => {
  hidden.value = document.hidden;
};
onMounted(() => document.addEventListener('visibilitychange', visibility));
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility));
</script>
<template>
  <div
    v-if="svg"
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
