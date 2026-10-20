<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DrawingTool, Point } from '../contracts/drawing';
import type { TelephoneStroke } from '../contracts/telephone';
const props = withDefaults(
  defineProps<{
    strokes: TelephoneStroke[];
    epoch: string;
    label: string;
    editable?: boolean;
    tool?: DrawingTool;
    color?: string;
    size?: number;
    filled?: boolean;
  }>(),
  { editable: false, tool: 'brush', color: '#273942', size: 6, filled: false },
);
const emit = defineEmits<{
    change: [strokes: TelephoneStroke[]];
    active: [value: boolean];
    notice: [text: string];
  }>(),
  canvas = ref<HTMLCanvasElement | null>(null),
  ready = ref(false),
  cursor = ref<Point>([256, 128]),
  keyboardAnchor = ref<Point | null>(null);
const points = computed(() => props.strokes.reduce((sum, s) => sum + s.points.length, 0));
let renderer: ReturnType<NonNullable<Window['StrokeCanvas']>['createRenderer']> | null = null,
  frame: number | null = null,
  pointer: number | null = null,
  active: TelephoneStroke | null = null,
  base: TelephoneStroke[] = [],
  disposed = false;
function paint() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if (!disposed) renderer?.render(props.strokes);
  });
}
function finish() {
  const old = pointer;
  pointer = null;
  active = null;
  base = [];
  keyboardAnchor.value = null;
  if (old !== null && canvas.value?.hasPointerCapture(old)) canvas.value.releasePointerCapture(old);
  emit('active', false);
  paint();
}
function allowed() {
  return props.editable && !document.hidden && !disposed && !!renderer;
}
function point(event: PointerEvent): Point {
  return window.StrokeCanvas!.pointFrom(event, canvas.value!, 512, 256);
}
function publish() {
  if (active)
    emit('change', [...base, { ...active, points: active.points.map((p) => [...p] as Point) }]);
  paint();
}
function begin(event: PointerEvent) {
  if (!allowed() || pointer !== null || event.button !== 0) return;
  if (props.strokes.length >= 100 || points.value >= 3000) {
    emit('notice', '畫作已達 100 筆或 3,000 點上限，請復原或送出。');
    return;
  }
  event.preventDefault();
  keyboardAnchor.value = null;
  const p = point(event);
  cursor.value = p;
  base = props.strokes.slice();
  active = {
    tool: props.tool,
    color: props.color,
    size: props.size,
    filled: props.filled,
    points: [p],
  };
  pointer = event.pointerId;
  emit('active', true);
  canvas.value?.setPointerCapture(pointer);
  publish();
  if (props.tool === 'fill') finish();
}
function move(event: PointerEvent) {
  if (!active || event.pointerId !== pointer) return;
  if (!allowed()) {
    finish();
    return;
  }
  event.preventDefault();
  const p = point(event),
    last = active.points.at(-1)!;
  if (last[0] === p[0] && last[1] === p[1]) return;
  const total = base.reduce((sum, s) => sum + s.points.length, 0);
  if (active.tool === 'brush' || active.tool === 'erase') {
    if (active.points.length >= 256 || total + active.points.length >= 3000) {
      finish();
      emit('notice', '這筆已達點數上限，可放開後繼續下一筆。');
      return;
    }
    active.points.push(p);
  } else {
    if (active.points.length === 1 && total + 1 >= 3000) {
      finish();
      return;
    }
    active.points = [active.points[0]!, p];
  }
  cursor.value = p;
  publish();
}
function end(event: PointerEvent) {
  if (event.pointerId === pointer) finish();
}
function key(event: KeyboardEvent) {
  if (!allowed()) return;
  if (pointer !== null) {
    if ([' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
      event.preventDefault();
    if (event.key === 'Escape') finish();
    return;
  }
  const moves: Record<string, Point> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const delta = moves[event.key];
  if (delta) {
    event.preventDefault();
    cursor.value = [
      Math.max(0, Math.min(511, cursor.value[0] + delta[0])),
      Math.max(0, Math.min(255, cursor.value[1] + delta[1])),
    ];
    emit('notice', `畫布位置 ${cursor.value[0] + 1}，${cursor.value[1] + 1}；按空白鍵落筆。`);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    finish();
    return;
  }
  if (event.key !== ' ' || event.repeat) return;
  event.preventDefault();
  if (props.strokes.length >= 100 || points.value >= 3000) return;
  const shaped = ['line', 'rect', 'ellipse'].includes(props.tool);
  if (shaped && !keyboardAnchor.value) {
    keyboardAnchor.value = [...cursor.value];
    emit('active', true);
    emit('notice', '已設定起點，方向鍵移動後再按空白鍵完成；Esc 取消。');
    return;
  }
  const locations: Point[] = shaped
    ? [[...keyboardAnchor.value!], [...cursor.value]]
    : [[...cursor.value]];
  if (points.value + locations.length > 3000) {
    finish();
    return;
  }
  emit('change', [
    ...props.strokes,
    {
      tool: props.tool,
      color: props.color,
      size: props.size,
      filled: props.filled,
      points: locations,
    },
  ]);
  keyboardAnchor.value = null;
  emit('active', false);
  paint();
}
watch(() => props.strokes, paint);
watch(
  () => props.epoch,
  () => {
    finish();
    renderer?.reset();
    cursor.value = [256, 128];
    paint();
  },
);
watch(
  () => props.editable,
  (value) => {
    if (!value) finish();
  },
);
watch([() => props.tool, () => props.color, () => props.size, () => props.filled], finish);
function visibility() {
  if (document.hidden) finish();
}
onMounted(() => {
  if (canvas.value) {
    renderer =
      window.StrokeCanvas?.createRenderer(canvas.value, {
        atomicPresentation: true,
        maxPoints: 3000,
        maxStrokes: 100,
      }) || null;
    ready.value = !!renderer;
    if (!renderer) emit('notice', '畫布元件未載入，請更新頁面後重試。');
    paint();
  }
  document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
  disposed = true;
  finish();
  if (frame !== null) cancelAnimationFrame(frame);
  renderer?.reset();
  renderer = null;
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div class="vue-telephone-canvas" :class="{ 'is-editable': editable && ready }"
    ><canvas
      ref="canvas"
      width="512"
      height="256"
      :tabindex="editable && ready ? 0 : undefined"
      :aria-label="label"
      :aria-disabled="editable ? !ready : undefined"
      @pointerdown="begin"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @lostpointercapture="end"
      @keydown="key"
  /></div>
</template>
