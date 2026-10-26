<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import StrokeCanvas from '../engines/stroke-canvas.js';
import DrawPlayback from '../engines/draw-playback.js';
import type { SpectatorStroke } from '../contracts/spectator';
const props = defineProps<{
  epoch: string;
  strokes: SpectatorStroke[];
  label: string;
  live?: boolean;
}>();
const canvas = ref<HTMLCanvasElement | null>(null);
let renderer: ReturnType<typeof StrokeCanvas.createDrawingRenderer> | null = null;
let frame: number | null = null,
  epoch = '',
  known = new Set<number>(),
  disposed = false,
  visible = false,
  initialized = false;
let observer: IntersectionObserver | null = null;
const playback = DrawPlayback.create({ onFrame: paint });
function paint() {
  if (frame !== null || disposed || document.hidden || !visible || !renderer) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if (!disposed) renderer?.render(props.strokes.map((s) => playback.view(s)).filter(Boolean));
  });
}
function update() {
  const changed = epoch !== props.epoch;
  if (changed) {
    playback.reset();
    known.clear();
    epoch = props.epoch;
  }
  const existing = initialized;
  for (const stroke of props.strokes)
    if (stroke.version !== undefined && !known.has(stroke.version)) {
      if (existing && !changed && props.live && !document.hidden && visible && renderer)
        playback.add(stroke);
      known.add(stroke.version);
    }
  // Undo/reset removes accepted batches; never replay deleted or previous-epoch ink.
  if (known.size > props.strokes.length || !props.live) {
    playback.finish({ notify: false });
    known = new Set(
      props.strokes.map((s) => s.version).filter((v): v is number => v !== undefined),
    );
  }
  initialized = true;
  paint();
}
function visibility() {
  playback.finish({ notify: false });
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  if (document.hidden || !visible) {
    renderer?.reset();
    renderer = null;
    if (canvas.value) canvas.value.width = canvas.value.height = 0;
  } else if (!disposed && canvas.value) {
    renderer ||= StrokeCanvas.createDrawingRenderer(canvas.value, {
      separateMutable: true,
      atomicPresentation: true,
      maxCheckpoints: 1,
    });
    paint();
  }
}
watch(() => [props.epoch, props.strokes, props.live], update);
onMounted(() => {
  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        visible = entries.some((entry) => entry.isIntersecting);
        visibility();
      },
      { rootMargin: '200px' },
    );
    observer.observe(canvas.value!);
  } else {
    visible = true;
    visibility();
  }
  update();
  document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  playback.reset();
  if (frame !== null) cancelAnimationFrame(frame);
  renderer?.reset();
  renderer = null;
  if (canvas.value) canvas.value.width = canvas.value.height = 0;
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <canvas ref="canvas" class="vue-spectator-canvas" role="img" :aria-label="label" />
</template>
