<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useGameFocus } from '../composables/game-focus';
import { useRoomStore } from '../stores/room';
import SceneViewToggle from './SceneViewToggle.vue';
import UiButton from './UiButton.vue';
import '../styles/room-fullscreen.scss';
const props = withDefaults(defineProps<{ focusClass?: string }>(), {
  focusClass: 'vue-game-focus',
});
const emit = defineEmits<{ 'update:focused': [value: boolean] }>();
const { focused, toggle, exit } = useGameFocus(props.focusClass);
const restore = ref<HTMLElement | null>(null),
  room = useRoomStore();
watch(focused, async (value) => {
  emit('update:focused', value);
  await nextTick();
  if (value)
    restore.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
});
</script>
<template>
  <UiButton
    variant="ghost"
    icon="expand"
    icon-only
    label="全螢幕：只顯示遊戲區"
    :aria-pressed="focused"
    @click="toggle"
  />
  <!-- Background view sits beside fullscreen; the bordered look tells the two apart. -->
  <SceneViewToggle v-if="room.snapshot?.roomSpace" />
  <Teleport to="body">
    <div v-if="focused" ref="restore" class="vue-room-fullscreen-restore" data-game-focus-overlay>
      <UiButton icon="contract" label="退出全螢幕（Esc）" @click="exit" />
    </div>
  </Teleport>
</template>
