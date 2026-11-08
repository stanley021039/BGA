<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { playAttackArtwork } from '../services/attack-artwork';
import { warmNewSkillAssets } from '../services/game-assets';
import { attackColor, previewAttackOptions } from '../services/attack-placement';
const props = defineProps<{
  effect: string;
  playKey: string | number;
}>();
const prefs = usePreferencesStore(),
  surface = ref<HTMLCanvasElement | null>(null),
  stage = ref<HTMLElement | null>(null);
const still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const color = computed(() => attackColor(props.effect));
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
  const options = previewAttackOptions(props.effect, width, height);
  warmNewSkillAssets(props.effect, options.width, options.height);
  cleanup = playAttackArtwork(surface.value, options);
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
    ><span v-if="still" class="attack-static-hit" :style="{ borderColor: color }"></span
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
  inset: 50% auto auto 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border: 3px solid;
  border-radius: 50%;
}
</style>
