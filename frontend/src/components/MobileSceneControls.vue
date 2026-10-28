<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import UiButton from './UiButton.vue';
import UiPanel from './UiPanel.vue';
import StatusSlot from './StatusSlot.vue';
import { attackEffects, useAttackLoadoutStore } from '../stores/attack-loadout';
import {
  sceneInputBlocked,
  type SceneAction,
  type useSceneControls,
} from '../services/scene-controls';
import '../styles/mobile-scene-controls.scss';

const props = defineProps<{
  controls: ReturnType<typeof useSceneControls>;
  enabled: boolean;
  message?: string;
}>();
const loadout = useAttackLoadoutStore();
const expanded = ref(false),
  blocked = ref(true),
  touch = ref(false);
const trigger = ref<InstanceType<typeof UiButton> | null>(null);
const panelId = useId();
const media = window.matchMedia('(max-width: 1180px), (any-pointer: coarse)');
const visible = computed(() => touch.value && props.enabled && !blocked.value);
const directions = [
  { action: 'up', label: '向上移動', caption: '上' },
  { action: 'left', label: '向左移動', caption: '左' },
  { action: 'down', label: '向下移動', caption: '下' },
  { action: 'right', label: '向右移動', caption: '右' },
] as const;
function effect(slot: 'q' | 'e') {
  return attackEffects.find((effect) => effect.id === loadout.loadout[slot])?.label || '載入配裝中';
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
    <div
      v-if="visible"
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
            v-for="slot in ['q', 'e'] as const"
            :key="slot"
            :label="`攻擊${slot === 'q' ? '一' : '二'}：${effect(slot)}`"
            :caption="slot === 'q' ? '攻擊一' : '攻擊二'"
            :disabled="!loadout.ready || controls.disabled(slot)"
            :pending="controls.pending[slot]"
            @click="controls.run(slot)"
          />
          <UiButton
            label="瞬移：隨機換位並播放進場特效"
            caption="瞬移"
            icon="refresh"
            :disabled="controls.disabled('r')"
            :pending="controls.pending.r"
            @click="controls.run('r')"
          />
          <span
            v-for="action in ['q', 'e', 'r'] as const"
            :key="action"
            class="mobile-scene-cooldown"
          >
            {{ controls.pending[action] ? '送出中' : cooldown(action) }}
          </span>
        </div>
        <p class="mobile-scene-loadout">一：{{ effect('q') }}<br />二：{{ effect('e') }}</p>
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
