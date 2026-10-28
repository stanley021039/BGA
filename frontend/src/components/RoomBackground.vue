<script setup lang="ts">
import SceneFragments from './SceneFragments.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import LobbyAttackLayer from '../pages/lobby/LobbyAttackLayer.vue';
import { entranceEffect } from '../services/entrance-effects';
import ReactionPicker from './ReactionPicker.vue';
import UiMoveMarker from './UiMoveMarker.vue';
import { useRoomStore } from '../stores/room';
import { record } from '../services/validation';
import { readLobbySnapshot } from '../contracts/lobby';
import LobbyVisitor from '../pages/lobby/LobbyVisitor.vue';
import StatusSlot from './StatusSlot.vue';
import MobileSceneControls from './MobileSceneControls.vue';
import { sceneDirections, useSceneControls } from '../services/scene-controls';
import { type Passage } from '../engines/scene-path.js';
const props = defineProps<{ connected: boolean; focused: boolean; inert?: boolean }>();
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
// Measure at the moment of each command, so resizing, scrolling and game
// phases cannot leave a stale invisible portal in the middle of the floor.
function passage(): Passage | null {
  if (
    props.focused ||
    !room.snapshot ||
    ['waiting', 'finished', 'showdown'].includes(room.snapshot.phase)
  )
    return null;
  const floor = stage.value?.getBoundingClientRect();
  const main = stage.value?.parentElement?.querySelector<HTMLElement>(':scope > .vue-game-main');
  if (!floor?.width || !floor.height || !main) return null;
  // Drawing uses display:contents for its main; measure its painted children.
  const rects = [...(getComputedStyle(main).display === 'contents' ? main.children : [main])]
    .map((node) => node.getBoundingClientRect())
    .filter((r) => r.width && r.height);
  if (!rects.length) return null;
  const avatar = stage.value?.querySelector<HTMLElement>('.lobby-avatar.is-self');
  const halfWidth = (avatar?.offsetWidth || 100) / 2 + 8;
  const avatarHeight = avatar?.offsetHeight || 110;
  const clamp = (n: number) => Math.max(2, Math.min(98, n));
  const box = {
    left: clamp(
      ((Math.min(...rects.map((r) => r.left)) - floor.left - halfWidth) / floor.width) * 100,
    ),
    right: clamp(
      ((Math.max(...rects.map((r) => r.right)) - floor.left + halfWidth) / floor.width) * 100,
    ),
    top: clamp(
      ((Math.min(...rects.map((r) => r.top)) - floor.top - avatarHeight * 0.22 - 8) /
        floor.height) *
        100,
    ),
    bottom: clamp(
      ((Math.max(...rects.map((r) => r.bottom)) - floor.top + avatarHeight * 0.78 + 8) /
        floor.height) *
        100,
    ),
  };
  return box.left < box.right && box.top < box.bottom ? box : null;
}
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
        attacks: record(room.snapshot.roomSpace).attacks || [],
      }),
      error: '',
    };
  } catch {
    return { snapshot: null, error: '角色資料暫時無法讀取，等待重新連線。' };
  }
});
const snapshot = computed(() => projection.value.snapshot);
const controls = useSceneControls({
  context: () => room.code + ':' + room.scope,
  enabled: () => props.connected && !props.focused && !props.inert && !!snapshot.value,
  snapshot: () => snapshot.value,
  send: async (action) => {
    const rect = stage.value?.getBoundingClientRect();
    if (action in sceneDirections) {
      const [dx, dy] = sceneDirections[action as keyof typeof sceneDirections];
      return sceneAction({ action: 'step', dx, dy });
    }
    return sceneAction(
      action === 'r'
        ? { action: 'teleport' }
        : {
            action: 'attack',
            slot: action,
            requestId: crypto.randomUUID(),
            aspectRatio: Math.max(0.2, Math.min(5, (rect?.width || 1) / (rect?.height || 1))),
          },
    );
  },
});
let lastSent = 0;
let lastStep = -Infinity;
let disposed = false,
  posting = false,
  queued: { x: number; y: number } | null = null;
let controller: AbortController | null = null,
  keyboardTarget: { x: number; y: number } | null = null;
const actionControllers = new Set<AbortController>();
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
          await room.request(
            'room-space',
            { ...next, passage: passage() },
            {
              signal: controller.signal,
              affectsConnection: false,
            },
          ),
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
  if (
    event.defaultPrevented ||
    !props.connected ||
    props.focused ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    document.hidden ||
    (event.target instanceof Element &&
      event.target.closest('[inert], canvas, [data-drawing-surface]')) ||
    document.querySelector('dialog[open]') ||
    (event.target instanceof Element &&
      event.target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      ))
  )
    return;
  const action = event.key.toLowerCase();
  if (['q', 'e', 'r'].includes(action)) {
    if (event.repeat) return;
    event.preventDefault();
    void controls.run(action as 'q' | 'e' | 'r');
    return;
  }
  if (![stage.value, document.body].includes(event.target as HTMLElement)) return;
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
  if (performance.now() - lastStep < 200) {
    event.preventDefault();
    return;
  }
  lastStep = performance.now();
  event.preventDefault();
  const base = keyboardTarget || own;
  keyboardTarget = {
    x: (((base.x + delta[0]) % 100) + 100) % 100,
    y: (((base.y + delta[1]) % 100) + 100) % 100,
  };
  void sceneAction({ action: 'step', dx: delta[0] / 5, dy: delta[1] / 5 });
}
async function sceneAction(input: Record<string, unknown>): Promise<boolean> {
  if (disposed || !props.connected || props.focused || !snapshot.value) return false;
  const scope = room.scope,
    code = room.code,
    actionController = new AbortController();
  actionControllers.add(actionController);
  const timeout = setTimeout(() => actionController.abort(), 10000);
  try {
    const result = await room.request(
      'room-space',
      {
        ...input,
        entrance: entranceEffect.value,
        ...(input.action === 'step' ? { passage: passage() } : {}),
      },
      { affectsConnection: false, signal: actionController.signal },
    );
    if (!disposed && scope === room.scope && code === room.code) {
      room.accept(result);
      error.value = '';
      return true;
    }
  } catch (cause) {
    if (!disposed && scope === room.scope)
      error.value = actionController.signal.aborted
        ? '操作結果尚未確認，請查看目前狀態後重試。'
        : cause instanceof Error
          ? cause.message
          : '操作失敗';
  } finally {
    clearTimeout(timeout);
    actionControllers.delete(actionController);
  }
  return false;
}
onMounted(() => document.addEventListener('keydown', key));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', key);
  sizeObserver?.disconnect();
  clearTimeout(markerTimer);
  disposed = true;
  queued = null;
  controller?.abort();
  for (const actionController of actionControllers) actionController.abort();
  actionControllers.clear();
});
</script>
<template>
  <MobileSceneControls
    :controls="controls"
    :enabled="connected && !focused && !inert && !!snapshot"
    :message="error"
  />
  <div
    v-show="!focused"
    ref="stage"
    :inert="inert"
    class="vue-room-background lobby-backdrop"
    :style="{ '--room-viewport-width': viewportWidth + 'px' }"
    tabindex="0"
    role="region"
    aria-label="房間角色活動背景，點擊目的地或聚焦後用方向鍵移動"
    :aria-busy="!connected"
    @click="click"
  >
    <LobbyAttackLayer :snapshot="snapshot" :connected="connected" />
    <UiMoveMarker v-if="destination" :key="markerKey" :point="destination" />
    <div class="lobby-visitors">
      <SceneFragments :visitors="snapshot?.visitors || []" />
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
