<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { useChatStore } from '../stores/chat';
import RoomBackground from './RoomBackground.vue';
import RoomSidePanel from './RoomSidePanel.vue';
import '../styles/room-space.scss';

const props = withDefaults(
  defineProps<{
    connected: boolean;
    focused: boolean;
    rosterClass?: string;
    mainClass?: string;
    sideClass?: string;
    // Wide screens start with both panels open; drawers on narrow screens stay closed (#277).
    panelsOpen?: boolean;
  }>(),
  {
    panelsOpen: true,
    rosterClass: 'vue-game-roster-panel',
    mainClass: 'vue-game-main',
    sideClass: 'vue-game-side',
  },
);
const room = useRoomStore(),
  chat = useChatStore(),
  narrow = window.matchMedia('(max-width: 1180px)'),
  mobile = ref(narrow.matches),
  initiallyOpen = () => props.panelsOpen && !mobile.value,
  rosterOpen = ref(initiallyOpen()),
  chatOpen = ref(initiallyOpen()),
  drawerOpen = computed(
    () => mobile.value && !props.focused && (rosterOpen.value || chatOpen.value),
  );
let previousTrigger: HTMLElement | null = null;
function togglePanel(side: 'left' | 'right') {
  previousTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (side === 'left') {
    rosterOpen.value = !rosterOpen.value;
    if (mobile.value && rosterOpen.value) chatOpen.value = false;
  } else {
    chatOpen.value = !chatOpen.value;
    if (mobile.value && chatOpen.value) rosterOpen.value = false;
  }
}
async function closePanels() {
  rosterOpen.value = chatOpen.value = false;
  await nextTick();
  if (previousTrigger?.isConnected) previousTrigger.focus({ preventScroll: true });
}
function breakpoint() {
  mobile.value = narrow.matches;
  if (mobile.value && rosterOpen.value && chatOpen.value) rosterOpen.value = false;
}
narrow.addEventListener('change', breakpoint);
onBeforeUnmount(() => narrow.removeEventListener('change', breakpoint));
watch(
  () => room.scope + ':' + room.code,
  () => {
    rosterOpen.value = chatOpen.value = initiallyOpen();
  },
);
</script>
<template>
  <div class="vue-game-grid">
    <RoomBackground :connected="connected" :focused="focused" :inert="drawerOpen" />
    <Teleport to="body">
      <div
        v-if="drawerOpen"
        role="presentation"
        aria-hidden="true"
        class="vue-room-drawer-backdrop"
        tabindex="-1"
        @click.stop="closePanels"
      />
    </Teleport>
    <RoomSidePanel
      :class="rosterClass"
      enabled
      side="left"
      title="玩家列表"
      :open="rosterOpen"
      :mobile="mobile"
      :focused="focused"
      @toggle="togglePanel('left')"
      @close="closePanels"
    >
      <slot name="roster" />
    </RoomSidePanel>
    <main class="vue-game-main" :class="mainClass" :inert="drawerOpen"><slot /></main>
    <RoomSidePanel
      :class="sideClass"
      enabled
      side="right"
      title="聊天室"
      :open="chatOpen"
      :unread="chat.unread"
      :mobile="mobile"
      :focused="focused"
      @toggle="togglePanel('right')"
      @close="closePanels"
    >
      <slot name="side" :chat-visible="chatOpen && !focused" />
    </RoomSidePanel>
  </div>
</template>
