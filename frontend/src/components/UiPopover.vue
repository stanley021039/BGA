<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import UiButton from './UiButton.vue';

defineProps<{ id: string; title: string }>();
const emit = defineEmits<{ closed: [] }>();
const panel = ref<HTMLElement | null>(null), visible = ref(false);
let trigger: HTMLElement | null = null, observer: ResizeObserver | null = null;
let generation = 0, disposed = false;

function position() {
  const element = panel.value;
  if (!visible.value || !element || !trigger?.isConnected) { close(false); return; }
  const anchor = trigger.getBoundingClientRect(), gap = 8;
  if (!trigger.getClientRects().length) { close(false); return; }
  const below = window.innerHeight - anchor.bottom - gap * 2, above = anchor.top - gap * 2;
  element.style.maxBlockSize = Math.max(0, Math.min(window.innerHeight - gap * 2, Math.max(below, above))) + 'px';
  const bounds = element.getBoundingClientRect();
  const left = Math.max(gap, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - gap));
  const preferredTop = below >= bounds.height || below >= above ? anchor.bottom + gap : anchor.top - bounds.height - gap;
  element.style.left = left + 'px';
  element.style.top = Math.max(gap, Math.min(preferredTop, window.innerHeight - bounds.height - gap)) + 'px';
}
function scroll(event: Event) { if (!(event.target instanceof Node) || !panel.value?.contains(event.target)) position(); }
function visibility() { if (document.hidden) close(false); }
function detach() {
  observer?.disconnect(); observer = null;
  window.removeEventListener('resize', position); window.removeEventListener('scroll', scroll, true);
  document.removeEventListener('visibilitychange', visibility);
}
function finish(restore: boolean) {
  if (!visible.value) return;
  generation++; visible.value = false; detach();
  if (restore && trigger?.isConnected && !document.hidden) trigger.focus({ preventScroll: true });
  if (!disposed) emit('closed');
}
async function open(source?: HTMLElement) {
  if (visible.value || disposed) return;
  trigger = source || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  if (!trigger?.isConnected || document.hidden) return;
  const epoch = ++generation;
  visible.value = true;
  await nextTick();
  if (disposed || epoch !== generation || !visible.value || !trigger.isConnected) return;
  panel.value?.showPopover(); position();
  if (!visible.value) return;
  observer = new ResizeObserver(position); observer.observe(trigger);
  window.addEventListener('resize', position); window.addEventListener('scroll', scroll, true);
  document.addEventListener('visibilitychange', visibility);
  panel.value?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"], button:not(:disabled)')?.focus({ preventScroll: true });
}
function close(restore = true) {
  if (!visible.value) return;
  panel.value?.hidePopover(); finish(restore);
}
function toggled() {
  if (!panel.value?.matches(':popover-open') && visible.value) {
    const active = document.activeElement;
    finish(active === document.body || !!(active && panel.value?.contains(active)));
  }
}
onBeforeUnmount(() => { disposed = true; close(false); detach(); });
defineExpose({ open, close, visible });
</script>

<template>
  <Teleport to="body">
    <div :id="id" ref="panel" popover="auto" role="dialog" :aria-label="title" class="vue-social-popover" @toggle="toggled" @keydown.esc.stop.prevent="close()">
      <template v-if="visible">
        <header class="vue-social-popover-header"><slot name="header"><h2>{{ title }}</h2></slot><UiButton stitch variant="ghost" icon="close" icon-only :label="'關閉' + title" @click="close()" /></header>
        <div class="vue-social-popover-body"><slot /></div>
      </template>
    </div>
  </Teleport>
</template>
