<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { attackEffects } from '../stores/attack-loadout';
import { playAttackArtwork } from '../services/attack-artwork';
const props = defineProps<{
  effect: string;
  playKey: string | number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}>();
const prefs = usePreferencesStore(),
  surface = ref<HTMLCanvasElement | null>(null),
  stage = ref<HTMLElement | null>(null);
const still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const color = computed(() => attackEffects.find((e) => e.id === props.effect)?.color || '#00f0ff');
let cleanup: (() => void) | null = null,
  revision = 0,
  mounted = false;
async function play() {
  cleanup?.();
  cleanup = null;
  const epoch = ++revision;
  await nextTick();
  if (
    !mounted ||
    epoch !== revision ||
    still.value ||
    document.hidden ||
    !surface.value ||
    !stage.value
  )
    return;
  const { width, height } = stage.value.getBoundingClientRect();
  if (!width || !height) return;
  cleanup = playAttackArtwork(surface.value, {
    effect: props.effect,
    color: color.value,
    width,
    height,
    from: { x: (props.from.x * width) / 100, y: (props.from.y * height) / 100 - 42 },
    to: { x: (props.to.x * width) / 100, y: (props.to.y * height) / 100 - 42 },
  });
}
onMounted(() => {
  mounted = true;
  void play();
});
watch([() => props.effect, () => props.playKey], play);
watch(still, (value) => {
  if (value) {
    revision++;
    cleanup?.();
    cleanup = null;
  }
});
onBeforeUnmount(() => {
  mounted = false;
  revision++;
  cleanup?.();
});
</script>
<template>
  <div
    ref="stage"
    class="attack-artwork"
    :class="{ 'is-still': still }"
    :data-effect="effect"
    aria-hidden="true"
    ><canvas ref="surface"></canvas
    ><span
      v-if="still"
      class="attack-static-hit"
      :style="{ left: to.x + '%', top: 'calc(' + to.y + '% - 42px)', borderColor: color }"
    ></span
  ></div>
</template>
<style scoped>
.attack-artwork {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.attack-artwork canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.attack-artwork.is-still canvas {
  display: none;
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
