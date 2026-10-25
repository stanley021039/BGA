<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import RoomInvite from './RoomInvite.vue';
import UiButton from './UiButton.vue';
import UiPopover from './UiPopover.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/room-header.scss';
const props = defineProps<{ title: string; focused: boolean }>();
const emit = defineEmits<{ integrated: [value: boolean] }>();
const room = useRoomStore(),
  ready = ref(false),
  navigation = ref<InstanceType<typeof UiPopover> | null>(null),
  notice = ref('');
const integrated = computed(() => ready.value && !props.focused);
let timer: ReturnType<typeof setTimeout> | null = null,
  disposed = false;
watch(integrated, (value) => emit('integrated', value), { immediate: true });
watch(
  () => room.scope,
  () => {
    notice.value = '';
    navigation.value?.close(false);
  },
);
onMounted(async () => {
  await nextTick();
  if (!disposed) ready.value = !!document.getElementById('vue-room-header-portal');
});
onBeforeUnmount(() => {
  disposed = true;
  if (timer) clearTimeout(timer);
  emit('integrated', false);
});
async function copyCode() {
  const scope = room.scope,
    code = room.code;
  try {
    if (!navigator.clipboard) throw Error();
    await navigator.clipboard.writeText(code);
    if (!disposed && scope === room.scope) notice.value = '房間代碼已複製。';
  } catch {
    if (!disposed && scope === room.scope)
      notice.value = '無法自動複製，請選取房間代碼 ' + code + '。';
  }
  if (disposed || scope !== room.scope) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    notice.value = '';
  }, 5000);
}
</script>
<template>
  <Teleport to="#vue-room-header-portal" :disabled="!integrated">
    <nav
      class="vue-room-topbar"
      :class="{ 'is-local': !integrated }"
      :aria-label="title + '房間操作'"
    >
      <div class="vue-room-topbar-context"
        ><UiButton
          class="vue-room-code-button"
          :label="'複製房間代碼 ' + room.code"
          :caption="'房間 ' + room.code"
          @click="copyCode" /><RoomInvite
      /></div>
      <div class="vue-room-topbar-navigation"
        ><a class="vue-room-nav-home" href="/">遊戲大廳</a
        ><UiButton
          variant="ghost"
          icon="book"
          caption="共編題庫"
          label="共編題庫與更多導覽"
          class="vue-room-nav-more"
          aria-haspopup="dialog"
          :aria-expanded="!!navigation?.visible"
          aria-controls="vue-room-navigation"
          @click="navigation?.open($event.currentTarget as HTMLElement)" /><slot name="navigation"
      /></div>
      <div class="vue-room-topbar-actions"
        ><div v-if="$slots['game-actions']" class="vue-room-game-actions"
          ><slot name="game-actions" /></div
        ><slot
      /></div>
      <div class="vue-room-code-feedback"><StatusSlot :message="notice" /></div>
    </nav>
  </Teleport>
  <UiPopover id="vue-room-navigation" ref="navigation" title="共編題庫與更多導覽"
    ><nav class="vue-room-navigation-menu" aria-label="房間導覽"
      ><a href="/">遊戲大廳</a><a href="/draw-words">你畫我猜題庫</a
      ><a href="/community?tab=questions">同頻俱樂部題庫</a><a href="/gifts">送禮達人題庫</a
      ><a href="/community?tab=issues">留言板</a></nav
    ></UiPopover
  >
</template>
