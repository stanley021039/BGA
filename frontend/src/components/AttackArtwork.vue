<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { attackEffects } from '../stores/attack-loadout';
import { playAttackArtwork } from '../services/attack-artwork';
import type { LobbyAttackHit } from '../contracts/lobby';
const props = defineProps<{
  effect: string;
  ageMs?: number;
  preview?: boolean;
  damage?: number;
  critical?: boolean;
  hits?: LobbyAttackHit[];
  rays?: { x: number; y: number }[];
  aspectRatio?: number;
  playKey: string | number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}>();
const prefs = usePreferencesStore(),
  surface = ref<HTMLCanvasElement | null>(null),
  stage = ref<HTMLElement | null>(null);
const still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const color = computed(
  () => attackEffects.find((e) => e.id === props.effect)?.color || attackEffects[0].color,
);
const target = computed(() =>
  ['shield', 'sphere'].includes(props.effect) ? props.from : props.to,
);
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
  const fitPreview =
    props.preview && !!attackEffects.find((effect) => effect.id === props.effect)?.area;
  const unit = Math.min(width / 115, height / 100);
  const from = fitPreview
    ? { x: width * 0.22, y: height * 0.65 }
    : { x: (props.from.x * width) / 100, y: (props.from.y * height) / 100 - 42 };
  const to = fitPreview
    ? { x: from.x + unit * 35, y: from.y }
    : { x: (props.to.x * width) / 100, y: (props.to.y * height) / 100 - 42 };
  cleanup = playAttackArtwork(surface.value, {
    ageMs: props.ageMs,
    readHits: props.hits?.some((hit) => hit.phase)
      ? () =>
          (props.hits || []).map((hit) => ({
            ...hit,
            x: (hit.toX * width) / 100,
            y: (hit.toY * height) / 100 - 42,
            pathX: hit.aimX !== undefined ? (hit.aimX * width) / 100 : undefined,
            pathY: hit.aimY !== undefined ? (hit.aimY * height) / 100 - 42 : undefined,
          }))
      : undefined,
    preview: props.preview === true,
    rays: props.rays?.map((ray) => ({ x: (ray.x * width) / 100, y: (ray.y * height) / 100 - 42 })),
    effect: props.effect,
    damage: props.damage,
    critical: props.critical,
    aspectRatio: props.aspectRatio,
    hits: props.hits?.map((hit) => ({
      x: (hit.toX * width) / 100,
      y: (hit.toY * height) / 100 - 42,
      damage: hit.damage,
      critical: hit.critical,
    })),
    color: color.value,
    width,
    height,
    from,
    to,
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
      :style="{ left: target.x + '%', top: 'calc(' + target.y + '% - 42px)', borderColor: color }"
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
