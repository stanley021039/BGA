<script lang="ts">
type Point = [number, number];
export type Trace = { index: number; from: number; to: number };
export interface TraceBoard {
  side: number;
  rotation: number;
  submitted: boolean;
  paths: [Point, Point][];
  marks: Trace[][];
}
export interface PartyShape {
  kind: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export const shapeOptions = [
  ['circle', '圓形'],
  ['ellipse', '橢圓'],
  ['semicircle', '半圓'],
  ['arc', '弧線'],
  ['square', '正方形'],
  ['rectangle', '長方形'],
  ['diamond', '菱形'],
  ['triangle', '三角形'],
  ['line', '直線'],
  ['arrow', '箭頭'],
  ['cross', '十字'],
  ['zigzag', '折線'],
].map(([value, label]) => ({ value, label }));
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{
  label: string;
  board?: TraceBoard | null;
  shapes?: PartyShape[];
  kind?: string;
  editable?: boolean;
  saving?: boolean;
}>();
const emit = defineEmits<{ trace: [Trace[]]; shape: [PartyShape] }>();
const group = ref<SVGGElement | null>(null);
const preview = ref<Trace[]>([]);
const shape = ref<PartyShape | null>(null);
let pointerId: number | null = null;
let previous: Point | null = null;
let marks = new Map<number, { from: number; to: number }>();
watch(
  () => props.saving,
  (saving) => {
    if (!saving && pointerId === null) {
      preview.value = [];
      shape.value = null;
    }
  },
);

function cursor(event: PointerEvent): Point | null {
  const matrix = group.value?.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [Math.min(1000, Math.max(0, point.x)), Math.min(1000, Math.max(0, point.y))];
}
function sample([x, y]: Point) {
  const paths = props.board?.paths || [];
  let best = { index: -1, position: 0, distance: 32 ** 2 };
  for (let index = 0; index < paths.length; index++) {
    const [[a, b], [c, d]] = paths[index];
    const dx = c - a,
      dy = d - b;
    const t = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / (dx ** 2 + dy ** 2)));
    const distance = (x - a - dx * t) ** 2 + (y - b - dy * t) ** 2;
    if (distance < best.distance) best = { index, position: Math.round(t * 100), distance };
  }
  if (best.index < 0 || (marks.size >= 48 && !marks.has(best.index))) return;
  const mark = marks.get(best.index) || { from: best.position, to: best.position };
  marks.set(best.index, {
    from: Math.min(mark.from, best.position),
    to: Math.max(mark.to, best.position),
  });
}
function down(event: PointerEvent) {
  if (!props.editable || props.saving || pointerId !== null || event.button !== 0) return;
  const point = cursor(event);
  if (!point) return;
  const [x, y] = point;
  pointerId = event.pointerId;
  (event.currentTarget as SVGElement).setPointerCapture(pointerId);
  previous = point;
  marks = new Map();
  preview.value = [];
  if (props.board) sample(point);
  else if (props.kind)
    shape.value = {
      kind: props.kind,
      x1: x / 1000,
      y1: y / 1000,
      x2: x / 1000,
      y2: y / 1000,
    };
}
function move(event: PointerEvent) {
  if (event.pointerId !== pointerId || !props.editable) return;
  const point = cursor(event);
  if (!point) return;
  const [x, y] = point;
  if (props.board && previous) {
    const [a, b] = previous;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - a, y - b) / 10));
    for (let i = 1; i <= steps; i++) sample([a + ((x - a) * i) / steps, b + ((y - b) * i) / steps]);
    preview.value = Array.from(marks, ([index, bounds]) => ({ index, ...bounds })).filter(
      ({ from, to }) => from < to,
    );
  } else if (shape.value) {
    shape.value = { ...shape.value, x2: x / 1000, y2: y / 1000 };
  }
  previous = point;
}
function end(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  let sent = false;
  if (event.type === 'pointerup' && props.editable && !props.saving) {
    move(event);
    if (preview.value.length) {
      emit('trace', preview.value);
      sent = true;
    }
    const value = shape.value;
    if (value && Math.hypot(value.x2 - value.x1, value.y2 - value.y1) >= 0.01) {
      emit('shape', value);
      sent = true;
    }
  }
  pointerId = null;
  previous = null;
  if (!sent) {
    preview.value = [];
    shape.value = null;
  }
}
function traceLine({ index, from, to }: Trace) {
  const [[a, b], [c, d]] = props.board!.paths[index];
  const at = (percent: number) =>
    [a + ((c - a) * percent) / 100, b + ((d - b) * percent) / 100].join(' ');
  return 'M ' + at(from) + ' L ' + at(to);
}
function shapeLine({ kind, x1, y1, x2, y2 }: PartyShape) {
  const a = x1 * 1000,
    b = y1 * 1000,
    c = x2 * 1000,
    d = y2 * 1000;
  const left = Math.min(a, c),
    right = Math.max(a, c),
    top = Math.min(b, d),
    bottom = Math.max(b, d);
  const width = right - left,
    height = bottom - top,
    x = left + width / 2,
    y = top + height / 2;
  const radius = Math.min(width, height) / 2;
  switch (kind) {
    case 'circle':
    case 'ellipse': {
      const rx = kind === 'circle' ? radius : width / 2;
      const ry = kind === 'circle' ? radius : height / 2;
      return `M ${x - rx} ${y} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
    }
    case 'semicircle':
    case 'arc':
      return `M ${left} ${bottom} Q ${x} ${top - height} ${right} ${bottom}${kind === 'semicircle' ? ' Z' : ''}`;
    case 'square':
    case 'rectangle': {
      const w = kind === 'square' ? 2 * radius : width;
      const h = kind === 'square' ? 2 * radius : height;
      return `M ${x - w / 2} ${y - h / 2} h ${w} v ${h} h ${-w} Z`;
    }
    case 'diamond':
      return `M ${x} ${top} L ${right} ${y} ${x} ${bottom} ${left} ${y} Z`;
    case 'triangle':
      return `M ${x} ${top} L ${right} ${bottom} ${left} ${bottom} Z`;
    case 'cross':
      return `M ${left} ${y} H ${right} M ${x} ${top} V ${bottom}`;
    case 'zigzag':
      return `M ${left} ${bottom} L ${left + width / 4} ${top} ${x} ${bottom} ${right - width / 4} ${top} ${right} ${bottom}`;
    case 'arrow': {
      const angle = Math.atan2(d - b, c - a),
        size = Math.min(60, Math.hypot(c - a, d - b) / 3);
      const wing = (direction: number) =>
        `${c - size * Math.cos(angle + direction)} ${d - size * Math.sin(angle + direction)}`;
      return `M ${a} ${b} L ${c} ${d} M ${wing(-0.6)} L ${c} ${d} ${wing(0.6)}`;
    }
    default:
      return `M ${a} ${b} L ${c} ${d}`;
  }
}
const committed = computed(
  () => props.board?.marks.flat().map(traceLine) || props.shapes?.map(shapeLine) || [],
);
const current = computed(() =>
  props.board ? preview.value.map(traceLine) : shape.value ? [shapeLine(shape.value)] : [],
);
</script>

<template>
  <svg
    class="party-artwork"
    :class="{ 'party-artwork-editable': editable }"
    :aria-label="label"
    :data-drawing-surface="editable ? '' : undefined"
    role="img"
    viewBox="0 0 1000 1000"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @lostpointercapture="end"
  >
    <rect v-if="editable" width="1000" height="1000" fill="transparent" />
    <g
      ref="group"
      :transform="board ? `rotate(${board.rotation * 90},500,500)` : undefined"
      fill="none"
    >
      <g
        v-if="board && editable"
        stroke="currentColor"
        opacity="0.4"
        stroke-width="4"
        stroke-dasharray="9 9"
      >
        <line
          v-for="([[x1, y1], [x2, y2]], index) in board.paths"
          :key="index"
          :x1="x1"
          :y1="y1"
          :x2="x2"
          :y2="y2"
        />
      </g>
      <g stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path v-for="(line, index) in committed" :key="'ink' + index" :d="line" />
        <path v-for="(line, index) in current" :key="'draft' + index" :d="line" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.party-artwork {
  display: block;
  inline-size: 100%;
  max-block-size: min(55vh, 32rem);
  margin-inline: auto;
  background: var(--stitch-surface);
}
.party-artwork-editable {
  touch-action: none;
  cursor: crosshair;
}
</style>
