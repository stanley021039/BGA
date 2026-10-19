<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { DrawingController, DrawingRequest, DrawingSession, DrawingTool, DrawingView, DrawSnapshot } from '../contracts/drawing';
import type { RoomSeat } from '../contracts/room';
import { createDrawingInput } from '../services/drawing-input';
import DrawingToolButton from './DrawingToolButton.vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/drawing-surface.scss';

const props = defineProps<{ code: string; scope: number; seat: RoomSeat | null; snapshot: DrawSnapshot | null; busy: boolean; request: DrawingRequest }>();
const emit = defineEmits<{ snapshot: [value: unknown]; tick: []; disconnected: [cause: Error]; stream: [connected: boolean]; rendered: [] }>();
const canvas = ref<HTMLCanvasElement | null>(null), view = shallowRef<DrawingView | null>(null);
const notice = ref(''), noticeFailed = ref(false), network = ref(''), streamLost = ref(false), ready = ref(false);
const tool = ref<DrawingTool>('brush'), filled = ref(false), color = ref('#1b1c1c'), size = ref(6);
const palette = ref<InstanceType<typeof UiDialog> | null>(null), confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const colors = ['#1b1c1c','#ffffff','#6b7280','#ba1a1a','#f97316','#f8c838','#16a34a','#0284c7','#4338ca','#7e22ce','#735947','#fedbc4'];
const tools: { tool: DrawingTool; filled?: boolean; label: string }[] = [
  { tool: 'brush', label: '畫筆' }, { tool: 'erase', label: '橡皮擦' }, { tool: 'line', label: '直線' },
  { tool: 'rect', label: '空心矩形' }, { tool: 'ellipse', label: '空心橢圓' }, { tool: 'rect', filled: true, label: '實心矩形' },
  { tool: 'ellipse', filled: true, label: '實心橢圓' }, { tool: 'fill', label: '油漆桶' },
];
const artist = computed(() => props.snapshot?.phase === 'drawing' && props.snapshot.presenterId === props.snapshot.me);
const canDraw = computed(() => ready.value && artist.value && !view.value?.commandBusy && !view.value?.recovering && !view.value?.error);
let session: DrawingSession | null = null, controller: DrawingController | null = null, input: ReturnType<typeof createDrawingInput> | null = null, mounted = false;
function refresh() { view.value = session?.view() || null; }
function feedback(message: string, kind = 'info', options?: { onlyRecovering?: boolean }) {
  if (options?.onlyRecovering && notice.value !== '正在回復畫布，仍可猜題與查看玩家。') return;
  notice.value = message; noticeFailed.value = kind === 'error';
}
function stop() {
  ready.value = false; controller?.dispose(); input?.dispose(); session?.dispose();
  controller = null; input = null; session = null; view.value = null;
}
function start() {
  stop(); if (!mounted || !canvas.value || !props.seat) return;
  if (!window.DrawCanvasSession || !window.DrawController || !window.StrokeCanvas) { feedback('畫布工具無法載入，請重新整理。', 'error'); return; }
  const captured = props.scope;
  const current = () => mounted && captured === props.scope && !!props.seat;
  const request: DrawingRequest = (route, data, options) => props.request(route, data, options);
  session = window.DrawCanvasSession.create({
    canvas: canvas.value, request, syncCanvas: () => controller?.syncCanvas() || Promise.resolve(),
    cancelInput: failed => input?.cancel(failed), cancelNetwork: options => controller?.cancel(options), feedback,
    notify: message => feedback(message, 'error'), onBusy: refresh, onQuota: refresh,
    onRendered: () => { refresh(); emit('rendered'); },
  });
  const activeSession = session;
  input = createDrawingInput({ canvas: canvas.value, session, style: () => ({ tool: tool.value, filled: filled.value, color: color.value, size: size.value }),
    epoch: () => props.snapshot?.canvasEpoch, strokeId: () => window.StrokeCanvas!.strokeId(), feedback: message => feedback(message) });
  controller = window.DrawController.create({
    // The controller compares room identity; use the page scope as well as its code.
    // The stream URL below always uses the real six-character room code.
    context: () => ({ room: props.code + ':' + props.scope, session: props.seat, busy: props.busy, epoch: props.snapshot?.canvasEpoch, round: props.snapshot?.round, version: activeSession.view().version }),
    request, receive: value => { if (current()) emit('snapshot', value); },
    applySnapshot: (value, reset) => { if (current()) { const applied = activeSession.applySnapshot(value, reset); refresh(); return applied; } return false; },
    receiveStroke: value => { if (current()) { activeSession.receiveStroke(value); refresh(); } },
    tick: () => { if (current()) emit('tick'); },
    onSyncError: cause => { network.value = '畫布正在重新同步：' + cause.message; }, onSyncSuccess: () => { network.value = ''; },
    onPollError: cause => { if (current()) emit('disconnected', cause); },
    onStreamReady: () => { if (current()) { streamLost.value = false; emit('stream', true); } },
    onStreamError: () => { if (current()) { streamLost.value = true; emit('stream', false); } },
    cancelWork: () => { activeSession.suspend(); },
    createStream: () => new EventSource('/api/draw/events?code=' + encodeURIComponent(props.code)),
  });
  ready.value = true; notice.value = network.value = ''; noticeFailed.value = streamLost.value = false;
  controller.start();
  if (props.snapshot) activeSession.transition(props.snapshot);
  controller.connectEvents(); void controller.poll(); refresh();
}
watch(() => props.seat ? `${props.scope}:${props.code}` : '', start, { flush: 'post' });
watch(() => props.snapshot, (next, previous) => {
  if (!next || !session) return;
  if (next.canvasEpoch !== previous?.canvasEpoch) { notice.value = ''; noticeFailed.value = false; }
  session.transition(next); controller?.connectEvents(); refresh();
}, { flush: 'sync' });
function visibility() {
  if (document.hidden) { input?.finish(); session?.cancelPreview(); session?.finishPlayback(); }
  else emit('tick');
}
async function command(name: 'undo' | 'clear') {
  if (!canDraw.value || !session) return;
  const epoch = props.snapshot?.canvasEpoch, round = props.snapshot?.round, captured = props.scope, engine = session;
  if (name === 'clear' && !await confirmation.value?.ask('清空目前的筆跡，所有玩家會看到空白畫布。', '清空畫布')) return;
  if (captured !== props.scope || engine !== session || epoch !== props.snapshot?.canvasEpoch || round !== props.snapshot?.round || !canDraw.value) return;
  await engine.command(name); refresh();
}
function chooseColor(value: string) { color.value = value; palette.value?.close(); }
onMounted(() => { mounted = true; start(); document.addEventListener('visibilitychange', visibility); });
onBeforeUnmount(() => { mounted = false; document.removeEventListener('visibilitychange', visibility); stop(); });
defineExpose({ command, sync: () => controller?.syncCanvas(), whenIdle: () => session?.whenIdle(), view: () => session?.view() });
</script>
<template>
  <section class="vue-drawing-surface" :class="{ 'is-artist': artist }" aria-label="畫布與繪畫工具">
    <div class="vue-drawing-frame"><canvas ref="canvas" id="drawCanvas" v-show="snapshot?.phase === 'drawing'" width="512" height="256" :tabindex="artist ? 0 : -1" :aria-hidden="snapshot?.phase !== 'drawing'" :aria-busy="view?.commandBusy || view?.recovering" aria-label="你畫我猜畫布；畫者可用滑鼠、觸控或方向鍵移動與空白鍵落筆" @pointerdown="input?.down($event)" @pointermove="input?.move($event)" @pointerup="input?.finish($event)" @pointercancel="input?.finish($event)" @lostpointercapture="input?.finish($event)" @keydown="input?.key($event)" /><div v-if="snapshot?.phase !== 'drawing'" class="vue-drawing-scene"><slot /></div></div>
    <div v-show="artist" class="vue-drawing-tools"><div class="vue-drawing-tool-row" role="group" aria-label="繪畫工具"><DrawingToolButton v-for="choice in tools" :key="choice.tool + (choice.filled ? 'Filled' : '')" :tool="choice.tool + (choice.filled ? 'Filled' : '')" :label="choice.label" :selected="choice.tool === tool && !!choice.filled === filled" :disabled="!canDraw || choice.tool === 'fill' && (view?.quota.usedFills || 0) >= 48" @click="tool = choice.tool; filled = !!choice.filled" /><DrawingToolButton tool="undo" label="復原上一筆" :disabled="!canDraw" @click="command('undo')" /><DrawingToolButton tool="clear" label="清空畫布" :disabled="!canDraw" @click="command('clear')" /></div><div class="vue-drawing-color-row"><label>顏色<input id="color" v-model="color" type="color" :disabled="!canDraw"></label><UiButton label="調色盤" icon="edit" :disabled="!canDraw" @click="palette?.open()" /><label class="vue-drawing-size">筆刷<input id="size" v-model.number="size" type="range" min="1" max="40" :disabled="!canDraw"><output>{{ size }}</output></label></div></div>
    <StatusSlot :message="network || (streamLost ? '即時連線中斷，正在重試；房間狀態持續更新。' : notice)" :error="!!network || noticeFailed" />
  </section>
  <UiDialog ref="palette" title="調色盤" compact><div class="vue-drawing-swatches" role="group" aria-label="常用顏色"><button v-for="value in colors" :key="value" type="button" :style="{ background: value }" :aria-label="'選擇 ' + value" :aria-pressed="color === value" @click="chooseColor(value)"><span v-if="color === value" aria-hidden="true">✓</span></button></div></UiDialog>
  <ConfirmDialog ref="confirmation" />
</template>
