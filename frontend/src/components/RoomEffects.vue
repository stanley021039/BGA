<script setup lang="ts">
import GameResultSounds from '../engines/game-result-sounds.js';
import ExpressionSounds from '../engines/expression-sounds.js';
import MotionPolicy from '../engines/motion-policy.js';
import BarrageFrames from '../engines/barrage-frames.js';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import type { BarrageController, ExpressionPlayback } from '../contracts/social';
import { readBarrages, readExpressions } from '../contracts/social';
import '../styles/room-social.scss';
declare global {
  interface Window {
    GameResultSounds?: { create(): { update(snapshot: unknown): void; dispose(): void } };
  }
}
let results: ReturnType<NonNullable<Window['GameResultSounds']>['create']> | undefined;
const props = withDefaults(defineProps<{ connected?: boolean }>(), { connected: true });
const room = useRoomStore(),
  layer = ref<HTMLElement | null>(null),
  band = ref({ top: 0, height: 0 });
const viewport = window.visualViewport;
let headerObserver: ResizeObserver | null = null;
function positionBand() {
  const offset = viewport?.offsetTop || 0,
    height = viewport?.height || window.innerHeight;
  const headerBottom =
    document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom || 0;
  const top = Math.max(offset + height * 0.25, headerBottom + 16);
  const available = Math.max(0, offset + height * 0.75 - top);
  if (band.value.top !== top || band.value.height !== available)
    band.value = { top, height: available };
}
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
    results?.dispose();
    results = undefined;
    return;
  }
  results ??= GameResultSounds?.create();
  results?.update(state);
  barrages?.update({ ...state, barrages: readBarrages(state.barrages) });
  sounds?.update({
    contextId: context.value,
    serverNow: state.serverNow,
    events: [...readExpressions(state.expressions), ...readExpressions(state.social)],
  });
}
function stop() {
  results?.dispose();
  results = undefined;
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
    MotionPolicy?.createBarrageController((item, lane, { moving, finish }) => {
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
      } else if (BarrageFrames) {
        bubble.classList.add('game-barrage-framed');
        BarrageFrames.decorate(bubble, item.frame, item.name, item.message);
      } else {
        const name = document.createElement('strong');
        name.textContent = item.name + '：';
        bubble.append(name, document.createTextNode(item.message));
      }
      if (!moving) bubble.classList.add('game-barrage-static', 'vue-room-barrage-static');
      if (BarrageFrames) {
        if (!BarrageFrames.place(host, bubble)) return false;
      } else {
        host.append(bubble);
        const top = 12 + lane * (bubble.offsetHeight + 8);
        if (top + bubble.offsetHeight + 12 > host.clientHeight) {
          bubble.remove();
          return false;
        }
        bubble.style.top = top + 'px';
      }
      if (moving)
        bubble.style.setProperty(
          '--barrage-travel',
          `-${host.clientWidth + bubble.offsetWidth + 24}px`,
        );
      bubble.addEventListener('animationend', finish, { once: true });
      return () => bubble.remove();
    }) || null;
  sounds = ExpressionSounds?.create() || null;
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
onMounted(async () => {
  mounted = true;
  positionBand();
  headerObserver = new ResizeObserver(positionBand);
  const header = document.querySelector('[data-site-header]');
  if (header) headerObserver.observe(header);
  window.addEventListener('resize', positionBand);
  window.addEventListener('scroll', positionBand, { passive: true });
  viewport?.addEventListener('resize', positionBand);
  viewport?.addEventListener('scroll', positionBand);
  await nextTick();
  if (mounted) start();
});
onBeforeUnmount(() => {
  mounted = false;
  headerObserver?.disconnect();
  window.removeEventListener('resize', positionBand);
  window.removeEventListener('scroll', positionBand);
  viewport?.removeEventListener('resize', positionBand);
  viewport?.removeEventListener('scroll', positionBand);
  stop();
});
</script>
<template>
  <div
    class="vue-room-barrage-layer"
    :style="{ top: band.top + 'px', height: band.height + 'px' }"
    aria-hidden="true"
  >
    <div ref="layer" class="vue-room-barrage-stage" />
  </div>
</template>
<style scoped>
.vue-room-barrage-layer {
  position: fixed;
  bottom: auto;
}
.vue-room-barrage-stage {
  position: absolute;
  inset: 32px 0;
}
</style>
