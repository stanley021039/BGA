<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type {} from '../contracts/drawing';
import { readMinimalShapes, type MinimalShape } from '../contracts/minimal';
import StatusSlot from './StatusSlot.vue';
import '../styles/geometry-canvas.scss';
const props = withDefaults(
  defineProps<{
    shapes: MinimalShape[];
    label: string;
    editable?: boolean;
    tool?: 'line' | 'circle';
    epoch: string;
  }>(),
  { editable: false, tool: 'line' },
);
const emit = defineEmits<{ commit: [shape: MinimalShape]; active: [value: boolean] }>(),
  canvas = ref<HTMLCanvasElement | null>(null),
  error = ref(''),
  cursor = ref({ x: 256, y: 128 });
let renderer: ReturnType<NonNullable<Window['StrokeCanvas']>['createRenderer']> | null = null,
  active: { x: number; y: number; tool: 'line' | 'circle'; pointer: number | null } | null = null,
  mounted = false;
const keyboardHelp = computed(() =>
  props.editable
    ? '方向鍵移動游標，Shift 加速；Enter 設定起點，再移動並按 Enter 完成；Esc 取消。'
    : '',
);
function paint(extra?: MinimalShape) {
  if (!mounted || !canvas.value) return;
  try {
    if (!window.StrokeCanvas || !window.PartyShapes) throw Error('幾何畫布工具無法載入。');
    renderer ||= window.StrokeCanvas.createRenderer(canvas.value, {
      atomicPresentation: true,
      maxStrokes: 40,
      maxPoints: 80,
      maxCheckpoints: 2,
    });
    renderer.render(
      window.PartyShapes.toStrokes(
        extra && props.shapes.length < 40 ? [...props.shapes, extra] : props.shapes,
      ),
    );
    error.value = '';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '無法顯示幾何畫作。';
  }
}
function point(event: PointerEvent) {
  const [x, y] = window.StrokeCanvas!.pointFrom(event, canvas.value!, 512, 256);
  return { x, y };
}
function shape(point: { x: number; y: number }): MinimalShape | null {
  if (!active) return null;
  const value: MinimalShape =
    active.tool === 'line'
      ? { kind: 'line', x1: active.x, y1: active.y, x2: point.x, y2: point.y }
      : {
          kind: 'circle',
          cx: active.x,
          cy: active.y,
          r: Math.min(
            128,
            Math.floor(Math.hypot(point.x - active.x, point.y - active.y)),
            active.x - 2,
            509 - active.x,
            active.y - 2,
            253 - active.y,
          ),
        };
  try {
    return readMinimalShapes([value])[0];
  } catch {
    return null;
  }
}
function cancel() {
  const pointer = active?.pointer;
  active = null;
  emit('active', false);
  if (pointer !== null && pointer !== undefined && canvas.value?.hasPointerCapture(pointer))
    canvas.value.releasePointerCapture(pointer);
  paint();
}
function begin(point: { x: number; y: number }, pointer: number | null) {
  if (!props.editable || active || props.shapes.length >= 40 || !renderer) return;
  active = { ...point, pointer, tool: props.tool };
  cursor.value = point;
  emit('active', true);
}
function down(event: PointerEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.isPrimary === false ||
    !props.editable ||
    active ||
    !renderer ||
    !window.StrokeCanvas
  )
    return;
  event.preventDefault();
  begin(point(event), event.pointerId);
  if (active) canvas.value?.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (!active || active.pointer !== event.pointerId) return;
  event.preventDefault();
  cursor.value = point(event);
  paint(shape(cursor.value) || undefined);
}
function finish(point: { x: number; y: number }) {
  if (!active) return;
  const value = shape(point);
  cancel();
  if (value && props.editable) emit('commit', value);
  else if (!value) error.value = '直線需有長度；圓心與完整外框需位於畫布內。';
}
function up(event: PointerEvent) {
  if (!active || active.pointer !== event.pointerId) return;
  event.preventDefault();
  finish(point(event));
}
function key(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    !props.editable ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (event.key === 'Escape' && active) {
    event.preventDefault();
    event.stopPropagation();
    cancel();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (active?.pointer !== null && active) return;
    if (active) finish(cursor.value);
    else begin(cursor.value, null);
    return;
  }
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (!directions[event.key]) return;
  event.preventDefault();
  const [x, y] = directions[event.key],
    step = event.shiftKey ? 10 : 1;
  cursor.value = {
    x: Math.max(0, Math.min(511, cursor.value.x + x * step)),
    y: Math.max(0, Math.min(255, cursor.value.y + y * step)),
  };
  if (active?.pointer === null) paint(shape(cursor.value) || undefined);
}
function visibility() {
  if (document.hidden) cancel();
}
watch(
  () => props.shapes,
  () => paint(),
);
watch(() => [props.epoch, props.editable, props.tool], cancel);
onMounted(() => {
  mounted = true;
  paint();
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', cancel);
});
onBeforeUnmount(() => {
  mounted = false;
  cancel();
  renderer?.reset();
  renderer = null;
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('blur', cancel);
});
defineExpose({ cancel });
</script>
<template>
  <figure class="vue-geometry-canvas" :data-private="editable ? '' : undefined"
    ><div class="vue-geometry-surface"
      ><canvas
        ref="canvas"
        width="512"
        height="256"
        :tabindex="editable ? 0 : undefined"
        :role="editable ? 'group' : 'img'"
        :aria-label="label"
        :aria-description="keyboardHelp || undefined"
        :style="{ touchAction: editable ? 'none' : 'auto' }"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="cancel"
        @lostpointercapture="cancel"
        @keydown="key"
      ></canvas
      ><span
        v-if="editable"
        class="vue-geometry-cursor"
        aria-hidden="true"
        :style="{ left: (cursor.x / 512) * 100 + '%', top: (cursor.y / 256) * 100 + '%' }"
      ></span></div
    ><StatusSlot :message="error" :error="!!error"
  /></figure>
</template>
