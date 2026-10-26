<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import { useRoomStore } from '../../stores/room';
import { record } from '../../services/validation';
import { drawingColors } from '../../services/drawing-palette';
import UiChoiceCard from '../../components/UiChoiceCard.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiButton from '../../components/UiButton.vue';
import UiNotice from '../../components/UiNotice.vue';
import DrawGuessPanel from '../draw/DrawGuessPanel.vue';
const props = defineProps<{ snapshot: DrawSnapshot; canvas?: unknown }>(),
  room = useRoomStore();
const svg = ref<SVGSVGElement | null>(null),
  points = ref<number[][]>([]),
  pointer = ref<number | null>(null),
  keyboard = ref(false),
  cursor = ref([256, 128]),
  saving = ref(false),
  error = ref('');
const attempt = shallowRef<Record<string, unknown> | null>(null);
let epoch = 0;
const editable = computed(
  () =>
    props.snapshot.presenterId === props.snapshot.me &&
    props.snapshot.phase === 'drawing' &&
    !saving.value &&
    !attempt.value,
);
const strokes = computed(() => {
  const c = record(props.canvas || {});
  return (Array.isArray(c.strokes) ? c.strokes : []) as { points: number[][]; size: number }[];
});
const path = (values: number[][]) => values.map((p) => p.join(',')).join(' ');
function point(e: PointerEvent) {
  const r = svg.value!.getBoundingClientRect();
  return [
    Math.round(Math.max(0, Math.min(511, ((e.clientX - r.x) * 512) / r.width))),
    Math.round(Math.max(0, Math.min(255, ((e.clientY - r.y) * 256) / r.height))),
  ];
}
function cancel() {
  if (saving.value) return;
  pointer.value = null;
  keyboard.value = false;
  points.value = [];
  attempt.value = null;
  error.value = '';
}
function down(e: PointerEvent) {
  if (!editable.value || pointer.value !== null || keyboard.value) return;
  pointer.value = e.pointerId;
  svg.value?.setPointerCapture(e.pointerId);
  points.value = [point(e)];
}
function move(e: PointerEvent) {
  if (editable.value || pointer.value === e.pointerId) cursor.value = point(e);
  if (pointer.value === e.pointerId && points.value.length < 240)
    points.value.push([...cursor.value]);
}
async function save() {
  if (!attempt.value || saving.value) return;
  const token = epoch,
    restoreFocus = document.activeElement === svg.value;
  saving.value = true;
  error.value = '';
  try {
    const value = await room.request('draw/stroke', attempt.value);
    if (token !== epoch) return;
    room.accept(value);
    if (token === epoch) {
      points.value = [];
      attempt.value = null;
    }
  } catch (e) {
    if (token === epoch)
      error.value = e instanceof Error ? e.message : '同步失敗，筆跡已保留，請重試';
  } finally {
    if (token === epoch) {
      saving.value = false;
      if (restoreFocus && document.activeElement === document.body)
        svg.value?.focus?.({ preventScroll: true });
    }
  }
}
function commit() {
  if (!points.value.length || saving.value) return;
  pointer.value = null;
  keyboard.value = false;
  attempt.value = {
    tool: 'brush',
    color: drawingColors[0][0],
    size: 4,
    points: points.value.map((p) => [...p]),
    round: props.snapshot.round,
    canvasEpoch: props.snapshot.canvasEpoch,
    batchId: crypto.randomUUID(),
    strokeId: crypto.randomUUID(),
  };
  void save();
}
function up(e: PointerEvent) {
  if (pointer.value === e.pointerId) commit();
}
function key(e: KeyboardEvent) {
  if (!editable.value) return;
  const deltas: Record<string, number[]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (deltas[e.key]) {
    e.preventDefault();
    const d = deltas[e.key],
      step = e.shiftKey ? 16 : 4;
    cursor.value = [
      Math.max(0, Math.min(511, cursor.value[0] + d[0] * step)),
      Math.max(0, Math.min(255, cursor.value[1] + d[1] * step)),
    ];
    if (keyboard.value && points.value.length < 240) points.value.push([...cursor.value]);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (keyboard.value) commit();
    else {
      keyboard.value = true;
      points.value = [[...cursor.value]];
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
  }
}
onBeforeUnmount(() => {
  epoch++;
});
watch([() => props.snapshot.canvasEpoch, () => room.scope], () => {
  epoch++;
  pointer.value = null;
  keyboard.value = false;
  points.value = [];
  attempt.value = null;
  saving.value = false;
  error.value = '';
});
</script>
<template>
  <UiPanel title="你畫我猜練習畫布">
    <template v-if="snapshot.phase === 'choosing'"
      ><p>從候選詞選出這次要畫的主題。</p
      ><UiChoiceCard
        v-for="word in snapshot.candidates"
        :key="word.id"
        :label="word.title"
        action
        @click="room.command('action', { action: 'choose', questionId: word.id })"
        >{{ word.title }}</UiChoiceCard
      ></template
    >
    <p v-if="snapshot.question">秘密題目：{{ snapshot.question.title }}</p>
    <p v-if="snapshot.presenterId === snapshot.me && snapshot.phase === 'drawing'"
      >拖曳畫一筆；鍵盤可用方向鍵移動游標、空白鍵開始或完成筆畫。</p
    >
    <svg
      ref="svg"
      viewBox="0 0 512 256"
      class="vue-tutorial-canvas"
      data-tutorial-drawing
      tabindex="0"
      role="img"
      aria-label="教學畫布，可用滑鼠、觸控或方向鍵與空白鍵作畫"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
      @keydown="key"
    >
      <template v-for="(stroke, index) in strokes" :key="index">
        <polyline
          :points="path(stroke.points)"
          fill="none"
          stroke="var(--stitch-ink)"
          :stroke-width="stroke.size"
          stroke-linecap="round"
        />
        <circle
          v-if="stroke.points.length === 1"
          :cx="stroke.points[0][0]"
          :cy="stroke.points[0][1]"
          :r="stroke.size / 2"
          fill="var(--stitch-ink)"
        />
      </template>
      <circle
        v-if="editable && !points.length"
        :cx="cursor[0]"
        :cy="cursor[1]"
        r="3"
        fill="none"
        stroke="var(--stitch-ink)"
        stroke-dasharray="2 2"
        aria-hidden="true"
      />
      <polyline
        :points="path(points)"
        fill="none"
        stroke="var(--stitch-ink)"
        stroke-width="4"
        stroke-linecap="round"
      />
      <circle
        v-if="points.length === 1"
        :cx="points[0][0]"
        :cy="points[0][1]"
        r="2"
        fill="var(--stitch-ink)"
      />
    </svg>
    <p v-if="saving" role="status">正在同步這一筆，畫面會保留你的筆跡。</p
    ><UiNotice v-if="error" :message="error" error persistent /><UiButton
      v-if="error && attempt"
      label="重試這一筆"
      :pending="saving"
      @click="save"
    /><UiButton v-if="keyboard" label="完成這筆" @click="commit" /><UiButton
      v-if="keyboard"
      label="取消本地筆畫"
      @click="cancel"
    />
    <DrawGuessPanel
      v-if="snapshot.phase === 'drawing' && snapshot.presenterId !== snapshot.me"
      :snapshot="snapshot"
    />
    <p v-if="snapshot.result">答案：{{ snapshot.result.answer }}。本輪已揭曉，查看玩家得分。</p>
  </UiPanel>
</template>
