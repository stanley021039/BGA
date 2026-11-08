<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { useSessionStore } from '../stores/session';
import { motionAllowed, watchMotionCancellation } from '../services/motion-lifetime.js';
import UiBadge from './UiBadge.vue';

const prefs = usePreferencesStore();
const session = useSessionStore();
type Prize = { label: string; count: number };
type Announcement = { name: string; prizes: string };
const queue: Announcement[] = [];
const active = ref<Announcement | null>(null);
const sequence = ref(0);
const moving = ref(false);
let stream: EventSource | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopMotion: (() => void) | undefined;

function next() {
  stopMotion?.();
  stopMotion = undefined;
  active.value = queue.shift() || null;
  if (!active.value) return;
  moving.value = motionAllowed();
  if (moving.value) stopMotion = watchMotionCancellation(() => (moving.value = false));
  sequence.value++;
  timer = setTimeout(next, 5500);
}
function receive(event: MessageEvent<string>) {
  try {
    const message = JSON.parse(event.data);
    if (
      typeof message?.name !== 'string' ||
      message.name.length > 64 ||
      !Array.isArray(message.prizes) ||
      !message.prizes.length ||
      message.prizes.length > 10 ||
      queue.length >= 12
    )
      return;
    const prizes: Prize[] = message.prizes;
    if (
      prizes.some(
        (prize) =>
          typeof prize?.label !== 'string' ||
          !prize.label ||
          prize.label.length > 120 ||
          !Number.isInteger(prize.count) ||
          prize.count < 1 ||
          prize.count > 10,
      ) ||
      prizes.reduce((total, prize) => total + prize.count, 0) > 10
    )
      return;
    queue.push({
      name: message.name,
      prizes: prizes
        .map(({ label, count }) => (count === 1 ? label : `${label} ×${count}`))
        .join('、'),
    });
    if (!active.value) next();
  } catch {
    // Ignore malformed events without interrupting future notices.
  }
}
function disconnect() {
  stream?.close();
  stream = null;
  clearTimeout(timer);
  stopMotion?.();
  stopMotion = undefined;
  queue.length = 0;
  active.value = null;
}
watch(
  [() => session.user?.id, () => prefs.motion?.barrages !== false],
  ([userId, enabled]) => {
    disconnect();
    if (!userId || !enabled || typeof EventSource !== 'function') return;
    stream = new EventSource('/api/gacha/events');
    stream.addEventListener('legendary', receive as EventListener);
  },
  { immediate: true },
);
onBeforeUnmount(disconnect);
</script>
<template>
  <Teleport to="body">
    <div class="gacha-site-barrage" role="status" aria-live="polite" aria-atomic="true">
      <div
        v-if="active"
        :key="sequence"
        class="gacha-site-barrage-message"
        :data-static="!moving || undefined"
      >
        <UiBadge tone="primary">傳說</UiBadge>
        <span>{{ active.name }} 抽中了 {{ active.prizes }}！</span>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.gacha-site-barrage {
  position: fixed;
  z-index: 800;
  inset-block-start: calc(var(--stitch-space-48) + var(--stitch-space-16));
  inset-inline: 0;
  display: grid;
  justify-items: center;
  overflow: hidden;
  pointer-events: none;
}
.gacha-site-barrage-message {
  display: flex;
  align-items: center;
  gap: var(--stitch-space-8);
  max-inline-size: calc(100% - var(--stitch-space-24));
  padding: var(--stitch-space-8) var(--stitch-space-16);
  border: 1px solid var(--stitch-primary);
  border-radius: var(--stitch-radius-panel);
  background: var(--stitch-artwork-preview-bg);
  color: var(--stitch-artwork-preview-ink);
  font-weight: 700;
  overflow-wrap: anywhere;
  animation: gacha-site-fly 5500ms ease-in-out both;
}
@keyframes gacha-site-fly {
  0% {
    opacity: 0;
    transform: translateX(70vw);
  }
  14%,
  83% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-70vw);
  }
}
.gacha-site-barrage-message[data-static] {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .gacha-site-barrage-message {
    animation: none;
  }
}
</style>
