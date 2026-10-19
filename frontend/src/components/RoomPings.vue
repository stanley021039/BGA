<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { usePingsStore } from '../stores/pings';
import { usePreferencesStore } from '../stores/preferences';
import { pingTypes } from '../contracts/pings';
import type { PingTarget, PingType } from '../contracts/pings';
import { capturePing, pingAnchors, resolvePing } from '../services/ping-target';
import PingSymbol from './PingSymbol.vue';
import UiButton from './UiButton.vue';
import '../../../public/shared/room-pings.css';
import '../styles/room-pings.scss';
const pings = usePingsStore(), prefs = usePreferencesStore();
const layer = ref<HTMLElement | null>(null), wheel = ref<HTMLElement | null>(null), targetHost = shallowRef<HTMLElement | null>(null), wheelOpen = ref(false), selected = ref<PingType>('ping'), wheelPoint = ref({ x: 0, y: 0 });
const still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
type Position = { x: number; y: number; label: string; shift: number };
const positions = shallowRef<Record<string, Position>>({});
let held = false, used = false, armed: PingType | null = null, suppressUntil = 0, mounted = false, disposed = false, frame = 0, observer: MutationObserver | null = null, previous: HTMLElement | null = null;
let gesture: { id: number; x: number; y: number; target: PingTarget; type: PingType; moved: boolean; identity: string; scene: string } | null = null;
const pointers = new Set<number>();
function editing(node: EventTarget | null) { return node instanceof Element && !!node.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],iframe'); }
function syncHost() { if (!mounted) return; const host = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) || document.body; if (targetHost.value !== host) targetHost.value = host; }
async function open(x: number, y: number, focus = false) {
  syncHost(); if (!wheelOpen.value) previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wheelPoint.value = { x, y }; wheelOpen.value = true; selected.value = 'ping'; await nextTick();
  if (!wheelOpen.value || !wheel.value) return;
  const rect = wheel.value.getBoundingClientRect(); wheelPoint.value = { x: Math.max(rect.width / 2 + 8, Math.min(innerWidth - rect.width / 2 - 8, x)), y: Math.max(rect.height / 2 + 8, Math.min(innerHeight - rect.height / 2 - 8, y)) };
  if (focus) wheel.value.querySelector<HTMLButtonElement>('[data-ping-type="ping"]')?.focus();
}
function cancel() {
  const returnFocus = document.activeElement instanceof Node && wheel.value?.contains(document.activeElement);
  held = false; gesture = null; armed = null; wheelOpen.value = false;
  if (returnFocus && previous?.isConnected) previous.focus({ preventScroll: true });
}
function arm(type: PingType) { cancel(); armed = type; pings.feedback('點選要標記的位置；Esc 取消'); }
function downKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && (gesture || armed || wheelOpen.value)) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); pings.feedback(''); return; }
  if (wheelOpen.value && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) {
    event.preventDefault(); if (event.key === 'Enter') arm(selected.value); else selected.value = ({ ArrowUp: 'attention', ArrowLeft: 'question', ArrowDown: 'help', ArrowRight: 'look' } as Record<string, PingType>)[event.key]; return;
  }
  if (event.code === 'KeyP' && !event.repeat && !event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey && !pointers.size && !gesture && !editing(event.target) && pings.identity && !document.hidden) { held = true; used = false; event.preventDefault(); }
}
function upKey(event: KeyboardEvent) { if (event.code !== 'KeyP') return; if (held && !used && pings.identity) void open(innerWidth / 2, innerHeight / 2, true); held = false; }
function pointerDown(event: PointerEvent) {
  if (event.button === 2 && (gesture || armed || wheelOpen.value)) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); suppressUntil = Date.now() + 400; return; }
  if (!pings.context || !pings.surface || !pings.identity || event.button !== 0 || event.isPrimary === false || pointers.size || gesture || editing(event.target) || event.target instanceof Node && wheel.value?.contains(event.target)) { pointers.add(event.pointerId); return; }
  if (!held && !armed) { if (wheelOpen.value) cancel(); pointers.add(event.pointerId); return; }
  if (!(event.target instanceof Element)) return;
  used = true; const target = capturePing(pings.model, pings.surface, pings.context, event.target, event.clientX, event.clientY); event.preventDefault(); event.stopImmediatePropagation();
  if (armed) { const type = armed; cancel(); void pings.send(type, target); suppressUntil = Date.now() + 400; return; }
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, target, type: 'ping', moved: false, identity: pings.identity, scene: pings.context.scene };
}
function pointerMove(event: PointerEvent) {
  const active = gesture; if (!active || event.pointerId !== active.id) return; event.preventDefault(); event.stopImmediatePropagation();
  active.type = pings.model.pick(event.clientX - active.x, event.clientY - active.y);
  if (active.type !== 'ping') { active.moved = true; if (!wheelOpen.value) void open(active.x, active.y); } selected.value = active.type;
}
function pointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId); const active = gesture; if (!active || event.pointerId !== active.id) return;
  event.preventDefault(); event.stopImmediatePropagation(); suppressUntil = Date.now() + 400; cancel();
  if (active.identity === pings.identity && active.scene === pings.context?.scene && (active.type !== 'ping' || !active.moved)) void pings.send(active.type, active.target);
}
function click(event: MouseEvent) { if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }
function contextMenu(event: MouseEvent) { if (gesture || armed || wheelOpen.value || Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); } }
function lost() { pointers.clear(); cancel(); }
function visibility() { if (document.hidden) lost(); }
function paint() {
  frame = 0; if (!mounted || !pings.surface || !pings.context) return;
  const next: Record<string, Position> = {}, anchors = pingAnchors(pings.surface);
  for (const event of pings.marks) {
    const point = resolvePing(pings.model, pings.surface, pings.context, event, anchors), direction = Math.abs(point.dx) > Math.abs(point.dy) ? point.dx > 0 ? '→' : '←' : point.dy > 0 ? '↓' : '↑';
    const label = event.name + '：' + pings.types[event.type].label + (point.edge ? ' · ' + direction + ' ' + point.label : ['畫面已更新', '目標目前不可見'].includes(point.label) ? ' · ' + point.label : '');
    const caption = [...(layer.value?.querySelectorAll<HTMLElement>('[data-ping-caption]') || [])].find(node => node.dataset.pingCaption === event.id), half = (caption?.getBoundingClientRect().width || 0) / 2;
    next[event.id] = { x: point.x, y: point.y, label, shift: Math.max(half + 8, Math.min(innerWidth - half - 8, point.x)) - point.x };
  }
  if (JSON.stringify(next) !== JSON.stringify(positions.value)) positions.value = next;
  if (pings.marks.length) frame = requestAnimationFrame(paint);
}
watch(() => pings.marks, () => { if (mounted && !frame) frame = requestAnimationFrame(paint); });
watch(() => [pings.identity, pings.context?.scene], () => { lost(); syncHost(); });
watch(() => pings.connected, connected => { if (!connected) lost(); });
const listeners: [string, EventListener][] = [['keydown', downKey as EventListener], ['keyup', upKey as EventListener], ['pointerdown', pointerDown as EventListener], ['pointermove', pointerMove as EventListener], ['pointerup', pointerUp as EventListener], ['pointercancel', lost], ['click', click as EventListener], ['contextmenu', contextMenu as EventListener], ['blur', lost]];
onMounted(() => {
  mounted = true; syncHost(); for (const [type, callback] of listeners) window.addEventListener(type, callback, true); document.addEventListener('visibilitychange', visibility);
  observer = new MutationObserver(entries => { if (entries.some(entry => entry.target instanceof HTMLDialogElement)) { syncHost(); if (gesture || armed || wheelOpen.value) cancel(); } }); observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
});
onBeforeUnmount(() => { disposed = true; mounted = false; lost(); observer?.disconnect(); if (frame) cancelAnimationFrame(frame); for (const [type, callback] of listeners) window.removeEventListener(type, callback, true); document.removeEventListener('visibilitychange', visibility); });
</script>
<template><Teleport v-if="targetHost && !disposed" :to="targetHost"><div ref="layer" class="room-ping-layer vue-room-pings vue-page" :class="{ 'room-ping-still': still }" data-ui-owner="vue" data-game-focus-overlay>
  <div v-if="pings.notice" class="room-ping-status" role="status" aria-live="polite">{{ pings.notice }}</div>
  <div v-show="wheelOpen" ref="wheel" class="room-ping-wheel" role="group" aria-label="快速標記：方向鍵選擇，Enter 確認，Esc 取消" :style="{ left: wheelPoint.x + 'px', top: wheelPoint.y + 'px' }"><button v-for="type in pingTypes" :key="type" type="button" :data-ping-type="type" :class="{ 'is-selected': selected === type }" :aria-label="pings.types[type].label" :aria-pressed="selected === type" @click="arm(type)"><span class="ui-button-icon"><PingSymbol :icon="pings.types[type].icon" :image="pings.preferences[type].imageUrl" /></span><small>{{ pings.types[type].label }}</small></button><div class="room-ping-settings"><UiButton :icon="pings.enabled ? 'check' : 'close'" :label="'接收標記：' + (pings.enabled ? '開啟' : '關閉')" :aria-pressed="pings.enabled" @click="pings.enabled = !pings.enabled" /></div></div>
  <div v-for="mark in pings.marks" :key="mark.id" class="room-ping-mark" :data-type="mark.type" :style="{ left: (positions[mark.id]?.x || 0) + 'px', top: (positions[mark.id]?.y || 0) + 'px', visibility: positions[mark.id] ? 'visible' : 'hidden' }"><strong><PingSymbol :icon="pings.types[mark.type].icon" :image="pings.preferences[mark.type].imageUrl" /></strong><span :data-ping-caption="mark.id" :style="{ transform: `translateX(${positions[mark.id]?.shift || 0}px)` }">{{ positions[mark.id]?.label }}</span></div>
</div></Teleport></template>
