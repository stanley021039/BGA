<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { leaveEffect } from '../contracts/room';
import { ApiError } from '../services/http';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/room.scss';
const room = useRoomStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  pending = ref(false),
  message = ref(''),
  effect = ref('');
let controller: AbortController | null = null,
  openedScope = -1;
function open(event: MouseEvent) {
  if (!room.snapshot || pending.value || room.busy) return;
  openedScope = room.scope;
  effect.value = leaveEffect(room.snapshot);
  message.value = '';
  void dialog.value?.open(event.currentTarget as HTMLElement);
}
function finish(game: string, scope: number) {
  if (scope !== room.scope) return;
  room.forget();
  room.dispose();
  location.replace('/?game=' + encodeURIComponent(game));
}
async function leave() {
  if (pending.value || openedScope !== room.scope) return;
  const scope = room.scope,
    game = room.type;
  if (room.terminal) {
    finish(game, scope);
    return;
  }
  pending.value = true;
  message.value = '';
  const operation = new AbortController();
  controller = operation;
  const timer = setTimeout(
    () => operation.abort(new DOMException('離房結果尚未確認，請重試。', 'TimeoutError')),
    10000,
  );
  try {
    await room.request('leave', {}, { signal: operation.signal });
    finish(game, scope);
  } catch (cause) {
    if (scope !== room.scope) return;
    if (
      cause instanceof ApiError &&
      ['ROOM_NOT_FOUND', 'NOT_SEATED', 'KICKED'].includes(cause.code || '')
    )
      finish(game, scope);
    else
      message.value =
        cause instanceof Error
          ? cause.name === 'AbortError'
            ? '離房結果尚未確認，請重試。'
            : cause.message
          : '無法離開房間，請重試。';
  } finally {
    clearTimeout(timer);
    if (controller === operation) {
      controller = null;
      pending.value = false;
    }
  }
}
watch(
  () => room.scope,
  () => {
    controller?.abort();
    controller = null;
    pending.value = false;
    dialog.value?.close();
  },
);
onBeforeUnmount(() => controller?.abort());
</script>
<template>
  <UiButton
    variant="danger"
    class="vue-room-leave-trigger"
    icon="leave"
    caption="離開"
    label="離開房間"
    :disabled="!room.seat || room.busy || pending"
    @click="open"
  /><UiDialog
    ref="dialog"
    title="確定離開這個房間？"
    compact
    :dismissible="!pending"
    ><img
      class="vue-room-leave-image"
      src="/assets/room-leave-thumbnail.jpg"
      width="640"
      height="361"
      alt="離別場景，字幕：多麼虎頭蛇尾的結局" /><p>{{ effect }}</p
    ><StatusSlot :message="pending ? '正在離開房間…' : message" :error="!!message" /><div
      class="vue-confirm-actions"
      ><UiButton icon="leave" label="確認離開" :pending="pending" @click="leave" /><UiButton
        icon="close"
        label="留在房間"
        :disabled="pending"
        @click="dialog?.close()" /></div
  ></UiDialog>
</template>
