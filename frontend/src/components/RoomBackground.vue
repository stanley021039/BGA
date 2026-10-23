<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ReactionPicker from './ReactionPicker.vue';
import UiMoveMarker from './UiMoveMarker.vue';
import { useRoomStore } from '../stores/room';
import { record } from '../services/validation';
import { readLobbySnapshot } from '../contracts/lobby';
import LobbyVisitor from '../pages/lobby/LobbyVisitor.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ connected: boolean; focused: boolean }>();
const room = useRoomStore(),
  stage = ref<HTMLElement | null>(null),
  error = ref(''),
  picker = ref<InstanceType<typeof ReactionPicker> | null>(null),
  destination = ref<{ x: number; y: number } | null>(null),
  markerKey = ref(0);
const viewportWidth = ref(document.documentElement.clientWidth);
let sizeObserver: ResizeObserver | null = null;
onMounted(() => {
  sizeObserver = new ResizeObserver(() => {
    viewportWidth.value = document.documentElement.clientWidth;
  });
  sizeObserver.observe(document.documentElement);
});
let markerTimer: ReturnType<typeof setTimeout> | undefined;
function openCharacter(trigger: HTMLElement) {
  if (props.connected && !props.focused) picker.value?.open(trigger);
}
watch(
  () => [props.focused, props.connected, room.scope],
  () => {
    picker.value?.close();
    destination.value = null;
    clearTimeout(markerTimer);
  },
);
const projection = computed(() => {
  if (!room.snapshot?.roomSpace) return { snapshot: null, error: '' };
  try {
    return {
      snapshot: readLobbySnapshot({
        ...record(room.snapshot.roomSpace),
        barrages: [],
        attacks: [],
      }),
      error: '',
    };
  } catch {
    return { snapshot: null, error: '角色資料暫時無法讀取，等待重新連線。' };
  }
});
const snapshot = computed(() => projection.value.snapshot);
let lastSent = 0;
let disposed = false,
  posting = false,
  queued: { x: number; y: number } | null = null;
let controller: AbortController | null = null,
  keyboardTarget: { x: number; y: number } | null = null;
async function move(target: { x: number; y: number }) {
  if (!props.connected || props.focused || !snapshot.value || disposed) return;
  queued = target;
  if (posting) return;
  posting = true;
  const scope = room.scope,
    code = room.code;
  try {
    while (queued && !disposed && props.connected && scope === room.scope && code === room.code) {
      const delay = Math.max(0, 200 - (performance.now() - lastSent));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (disposed || !props.connected || scope !== room.scope || code !== room.code) break;
      const next = queued;
      queued = null;
      controller = new AbortController();
      lastSent = performance.now();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        room.accept(
          await room.request('room-space', next, {
            signal: controller.signal,
            affectsConnection: false,
          }),
        );
        error.value = '';
      } finally {
        clearTimeout(timeout);
        controller = null;
      }
    }
  } catch (cause) {
    queued = null;
    if (!disposed && scope === room.scope && code === room.code)
      error.value = cause instanceof Error ? cause.message : '角色移動暫時失敗，請重試。';
  } finally {
    posting = false;
  }
}
function click(event: MouseEvent) {
  if (!stage.value || !props.connected || event.button !== 0 || event.defaultPrevented) return;
  const rect = stage.value.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  keyboardTarget = null;
  const target = {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
  };
  destination.value = target;
  markerKey.value++;
  clearTimeout(markerTimer);
  markerTimer = setTimeout(() => {
    destination.value = null;
  }, 1100);
  void move(target);
  void nextTick(() => stage.value?.focus({ preventScroll: true }));
}
function key(event: KeyboardEvent) {
  if (event.target !== stage.value || event.ctrlKey || event.metaKey || event.altKey) return;
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-5, 0],
    ArrowRight: [5, 0],
    ArrowUp: [0, -5],
    ArrowDown: [0, 5],
    a: [-5, 0],
    d: [5, 0],
    w: [0, -5],
    s: [0, 5],
  };
  const delta = directions[event.key],
    own = snapshot.value?.visitors.find((v) => v.id === snapshot.value?.selfId);
  if (!delta || !own) return;
  event.preventDefault();
  const base = keyboardTarget || own;
  keyboardTarget = {
    x: Math.max(0, Math.min(100, base.x + delta[0])),
    y: Math.max(0, Math.min(100, base.y + delta[1])),
  };
  void move(keyboardTarget);
}
onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  clearTimeout(markerTimer);
  disposed = true;
  queued = null;
  controller?.abort();
});
</script>
<template>
  <div
    v-show="!focused"
    ref="stage"
    class="vue-room-background lobby-backdrop"
    :style="{ '--room-viewport-width': viewportWidth + 'px' }"
    tabindex="0"
    role="region"
    aria-label="房間角色活動背景，點擊目的地或聚焦後用方向鍵移動"
    :aria-busy="!connected"
    @click="click"
    @keydown="key"
  >
    <UiMoveMarker v-if="destination" :key="markerKey" :point="destination" />
    <div class="lobby-visitors">
      <LobbyVisitor
        v-for="visitor in snapshot?.visitors || []"
        :key="visitor.id"
        :visitor="visitor"
        :self="visitor.id === snapshot?.selfId"
        :reset="room.scope"
        :open="!!picker?.visible"
        :connected="connected"
        :role="visitor.id === snapshot?.selfId ? undefined : 'img'"
        @select="openCharacter"
        :class="{ 'is-self': visitor.id === snapshot?.selfId }"
        :aria-label="visitor.name + (visitor.id === snapshot?.selfId ? '（你），點一下發表情' : '')"
      />
    </div>
    <ReactionPicker
      ref="picker"
      mode="character"
      external-trigger
      :disabled="!connected || focused"
    />
    <StatusSlot
      v-if="error || projection.error"
      :message="error || projection.error"
      error
      class="vue-room-movement-error"
    />
  </div>
</template>
