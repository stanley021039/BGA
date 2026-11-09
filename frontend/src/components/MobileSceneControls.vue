<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import UiButton from './UiButton.vue';
import UiPanel from './UiPanel.vue';
import StatusSlot from './StatusSlot.vue';
import { attackEffects, useAttackLoadoutStore } from '../stores/attack-loadout';
import {
  sceneInputBlocked,
  type SceneAction,
  type SceneDirection,
  type useSceneControls,
} from '../services/scene-controls';
import '../styles/mobile-scene-controls.scss';

const props = defineProps<{
  controls: ReturnType<typeof useSceneControls>;
  enabled: boolean;
  message?: string;
  battle?: boolean;
  disableTeleport?: boolean;
  lockedLoadout?: { q: string; e: string; r?: string } | null;
}>();
const loadout = useAttackLoadoutStore();
const expanded = ref(false),
  blocked = ref(true),
  touch = ref(false);
const trigger = ref<InstanceType<typeof UiButton> | null>(null);
const panelId = useId();
const media = window.matchMedia('(max-width: 1180px), (any-pointer: coarse)');
const coarse = window.matchMedia('(any-pointer: coarse)');
const portrait = window.matchMedia('(orientation: portrait)');
const visible = computed(() => touch.value && props.enabled && !blocked.value);
const battleHud = computed(() => props.battle && visible.value);
const rotateHint = ref(false);
const thumb = ref<SceneDirection>([0, 0]);
let pointer: number | undefined;
let movement: ReturnType<typeof setInterval> | undefined;
let ownFullscreen = false;
let landscapeRequested = false;
const orientation = screen.orientation as
  | (ScreenOrientation & {
      lock?: (value: 'landscape') => Promise<void>;
      unlock?: () => void;
    })
  | undefined;
function updateRotation() {
  rotateHint.value = coarse.matches && portrait.matches;
}
async function enterLandscape() {
  landscapeRequested = true;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      if (!landscapeRequested) {
        await document.exitFullscreen();
        return;
      }
      ownFullscreen = true;
    }
    await orientation?.lock?.('landscape');
    if (!landscapeRequested) orientation?.unlock?.();
  } catch {
    // Rotation locks are optional. The controls also work in portrait.
  }
}
function stopMovement() {
  pointer = undefined;
  clearInterval(movement);
  movement = undefined;
  thumb.value = [0, 0];
}
function moveThumb(event: PointerEvent) {
  if (event.pointerId !== pointer) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const dx = event.clientX - rect.left - rect.width / 2;
  const dy = event.clientY - rect.top - rect.height / 2;
  const distance = Math.hypot(dx, dy);
  const scale = Math.max(distance, rect.width / 2);
  thumb.value = distance < rect.width / 9 ? [0, 0] : [dx / scale, dy / scale];
}
function sendMovement() {
  const [dx, dy] = thumb.value;
  const length = Math.hypot(dx, dy);
  if (length) void props.controls.run('up', [dx / length, dy / length]);
}
function startMovement(event: PointerEvent) {
  if (pointer !== undefined || event.button !== 0) return;
  event.preventDefault();
  pointer = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture(pointer);
  moveThumb(event);
  sendMovement();
  movement = setInterval(sendMovement, 220);
}
function endMovement(event: PointerEvent) {
  if (event.pointerId === pointer) stopMovement();
}
watch(
  battleHud,
  (active) => {
    if (!active) stopMovement();
  },
  { flush: 'sync' },
);
const directions = [
  { action: 'up', label: '向上移動', caption: '上' },
  { action: 'left', label: '向左移動', caption: '左' },
  { action: 'down', label: '向下移動', caption: '下' },
  { action: 'right', label: '向右移動', caption: '右' },
] as const;
const activeLoadout = computed(() => props.lockedLoadout || loadout.loadout);
const loadoutReady = computed(() => !!props.lockedLoadout || loadout.ready);
function effect(slot: 'q' | 'e' | 'r') {
  return (
    attackEffects.find((effect) => effect.id === activeLoadout.value[slot])?.label ||
    (loadoutReady.value ? '尚未配裝' : '載入配裝中')
  );
}
function cooldown(action: SceneAction) {
  const seconds = props.controls.seconds(action);
  return seconds ? `冷卻 ${seconds}秒` : '可使用';
}
function update() {
  touch.value = media.matches;
  blocked.value = sceneInputBlocked();
}
function focusChanged() {
  void nextTick(update);
}
function close() {
  expanded.value = false;
  void nextTick(() => (trigger.value?.$el as HTMLElement | undefined)?.focus());
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape' && expanded.value && visible.value) {
    event.preventDefault();
    close();
  }
}
let observer: MutationObserver | undefined;
onMounted(() => {
  update();
  void loadout.load();
  media.addEventListener('change', update);
  coarse.addEventListener('change', updateRotation);
  portrait.addEventListener('change', updateRotation);
  updateRotation();
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', focusChanged);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('toggle', update, true);
  document.addEventListener('keydown', key);
  observer = new MutationObserver(update);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open', 'inert'],
  });
});
watch(
  () => props.enabled,
  (value) => {
    if (!value) expanded.value = false;
  },
);
onBeforeUnmount(() => {
  stopMovement();
  if (landscapeRequested) orientation?.unlock?.();
  landscapeRequested = false;
  if (ownFullscreen && document.fullscreenElement === document.documentElement)
    void document.exitFullscreen().catch(() => {});
  coarse.removeEventListener('change', updateRotation);
  portrait.removeEventListener('change', updateRotation);
  observer?.disconnect();
  media.removeEventListener('change', update);
  document.removeEventListener('focusin', update);
  document.removeEventListener('focusout', focusChanged);
  document.removeEventListener('visibilitychange', update);
  document.removeEventListener('toggle', update, true);
  document.removeEventListener('keydown', key);
});
</script>
<template>
  <Teleport to="body">
    <template v-if="battleHud">
      <div
        class="arena-touch-stick"
        role="group"
        aria-label="拖曳搖桿移動角色"
        @pointerdown.stop="startMovement"
        @pointermove.stop="moveThumb"
        @pointerup.stop="endMovement"
        @pointercancel.stop="endMovement"
        @lostpointercapture="endMovement"
        @click.stop
      >
        <span :style="{ translate: `${thumb[0] * 65}% ${thumb[1] * 65}%` }" aria-hidden="true" />
      </div>
      <div
        class="arena-touch-skills"
        role="group"
        aria-label="競技場招式"
        @pointerdown.stop
        @click.stop
      >
        <UiButton
          v-for="slot in ['c', 'q', 'e', 'r'] as const"
          :key="slot"
          :label="slot === 'c' ? 'C 瞬移' : slot.toUpperCase() + ' ' + effect(slot)"
          :caption="slot.toUpperCase()"
          :variant="slot === 'r' ? 'primary' : 'secondary'"
          :disabled="
            controls.disabled(slot) || (slot !== 'c' && (!loadoutReady || !activeLoadout[slot]))
          "
          :pending="controls.pending[slot]"
          @click="controls.run(slot)"
        />
      </div>
      <UiButton
        v-if="rotateHint"
        class="arena-touch-rotate"
        label="橫向全螢幕"
        variant="ghost"
        @pointerdown.stop
        @click.stop="enterLandscape"
      />
    </template>
    <div
      v-else-if="visible"
      class="mobile-scene-controls"
      @click.stop
      @pointerdown.stop
      @keydown.stop="key"
    >
      <UiPanel v-if="expanded" :id="panelId" title="角色操作" density="compact" tone="raised">
        <template #actions
          ><UiButton icon="close" icon-only label="收合角色操作" @click="close"
        /></template>
        <div class="mobile-scene-actions">
          <UiButton
            v-for="slot in ['q', 'e', 'r'] as const"
            :key="slot"
            :label="`${slot === 'r' ? '大招 R' : '普通攻擊 ' + slot.toUpperCase()}：${effect(slot)}`"
            :caption="slot === 'r' ? '大招 R' : '普通 ' + slot.toUpperCase()"
            :disabled="!loadoutReady || !activeLoadout[slot] || controls.disabled(slot)"
            :pending="controls.pending[slot]"
            @click="controls.run(slot)"
          />
          <UiButton
            v-if="!disableTeleport"
            label="瞬移：隨機換位並播放進場特效"
            caption="瞬移 C"
            icon="refresh"
            :disabled="controls.disabled('c')"
            :pending="controls.pending.c"
            @click="controls.run('c')"
          />
          <span
            v-for="action in disableTeleport
              ? (['q', 'e', 'r'] as const)
              : (['q', 'e', 'r', 'c'] as const)"
            :key="action"
            class="mobile-scene-cooldown"
          >
            {{ action.toUpperCase() }}：{{
              controls.pending[action]
                ? '送出中'
                : action === 'r' && controls.energy.value < controls.energyMaximum.value
                  ? `能量 ${controls.energy.value}／${controls.energyMaximum.value}`
                  : cooldown(action)
            }}
          </span>
        </div>
        <p class="mobile-scene-loadout"
          >Q：{{ effect('q') }}<br />E：{{ effect('e') }}<br />R：{{ effect('r') }}</p
        >
        <div class="mobile-scene-directions" role="group" aria-label="角色移動">
          <UiButton
            v-for="direction in directions"
            :key="direction.action"
            :label="direction.label"
            :caption="direction.caption"
            :disabled="controls.disabled(direction.action)"
            @click="controls.run(direction.action)"
          />
        </div>
        <p class="mobile-scene-hint">點空白處也能移動，點自己的角色發表情。</p>
        <StatusSlot
          :message="controls.knockedOut.value ? '角色倒地，等待重生。' : message || loadout.message"
          error
        />
        <UiButton
          v-if="!loadout.ready && loadout.message"
          label="重試載入配裝"
          @click="loadout.load()"
        />
      </UiPanel>
      <UiButton
        v-else
        ref="trigger"
        label="角色操作"
        icon="users"
        :aria-controls="panelId"
        :aria-expanded="expanded"
        @click="expanded = true"
      />
    </div>
  </Teleport>
</template>
