<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import type { BarrageController, ExpressionPlayback } from '../contracts/social';
import { readBarrages, readExpressions } from '../contracts/social';
import '../styles/room-social.scss';
const props = withDefaults(defineProps<{ connected?: boolean }>(), { connected: true });
const room = useRoomStore(),
  layer = ref<HTMLElement | null>(null);
let barrages: BarrageController | null = null,
  sounds: ExpressionPlayback | null = null,
  resize: ResizeObserver | null = null,
  mounted = false;
const context = computed(() =>
  room.seat && room.snapshot && !room.terminal
    ? `${room.scope}:${room.code}:${room.snapshot.me}`
    : '',
);
function update() {
  const state = room.snapshot;
  if (!state || !context.value) return;
  if (!props.connected || room.disconnected) {
    barrages?.disconnect();
    sounds?.reset();
    return;
  }
  barrages?.update({ ...state, barrages: readBarrages(state.barrages) });
  sounds?.update({
    contextId: context.value,
    serverNow: state.serverNow,
    events: [...readExpressions(state.expressions), ...readExpressions(state.social)],
  });
}
function stop() {
  resize?.disconnect();
  resize = null;
  barrages?.dispose();
  sounds?.destroy();
  barrages = null;
  sounds = null;
}
function start() {
  stop();
  if (!mounted || !layer.value || !context.value) return;
  const host = layer.value;
  barrages =
    window.MotionPolicy?.createBarrageController((item, lane, { moving, finish }) => {
      const bubble = document.createElement('div');
      bubble.className = 'game-barrage vue-room-barrage';
      if (item.kind === 'emoji') {
        bubble.classList.add('game-emoji-barrage');
        const name = document.createElement('strong'),
          emoji = document.createElement('span');
        name.textContent = item.name + '：';
        emoji.className = 'vue-room-emoji-glyph';
        emoji.textContent = item.emoji;
        bubble.append(name, emoji);
      } else if (window.BarrageFrames) {
        bubble.classList.add('game-barrage-framed');
        window.BarrageFrames.decorate(bubble, item.frame, item.name, item.message);
      } else {
        const name = document.createElement('strong');
        name.textContent = item.name + '：';
        bubble.append(name, document.createTextNode(item.message));
      }
      if (!moving) bubble.classList.add('game-barrage-static', 'vue-room-barrage-static');
      if (window.BarrageFrames) {
        if (!window.BarrageFrames.place(host, bubble)) return false;
      } else {
        bubble.style.top = `${12 + lane * 18}%`;
        host.append(bubble);
      }
      if (moving)
        bubble.style.setProperty(
          '--barrage-travel',
          `-${host.clientWidth + bubble.offsetWidth + 24}px`,
        );
      bubble.addEventListener('animationend', finish, { once: true });
      return () => bubble.remove();
    }) || null;
  sounds = window.ExpressionSounds?.create() || null;
  if (typeof ResizeObserver === 'function') {
    let size: string | null = null;
    resize = new ResizeObserver(() => {
      const next = host.clientWidth + ':' + host.clientHeight;
      if (size !== null && size !== next) barrages?.clear();
      size = next;
    });
    resize.observe(host);
  }
  update();
}
watch(context, start, { flush: 'post' });
watch(() => room.snapshot, update, { flush: 'post' });
watch(() => [props.connected, room.disconnected], update, { flush: 'post' });
onMounted(() => {
  mounted = true;
  start();
});
onBeforeUnmount(() => {
  mounted = false;
  stop();
});
</script>
<template><div ref="layer" class="vue-room-barrage-layer" aria-hidden="true" /></template>
