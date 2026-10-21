<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { usePreferencesStore } from '../../stores/preferences';
import { useMutation } from '../../composables/mutation';
import type { BarrageController, BarrageEvent } from '../../contracts/social';
import UiDialog from '../../components/UiDialog.vue';
import UiButton from '../../components/UiButton.vue';
import FramePicker from '../../components/FramePicker.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const lobby = useLobbyStore(),
  prefs = usePreferencesStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  picker = ref<InstanceType<typeof FramePicker> | null>(null),
  layer = ref<HTMLElement | null>(null),
  draft = ref(''),
  mutation = useMutation();
let controller: BarrageController | null = null,
  pending: { message: string; builtinFrameId: string; requestId: string } | null = null;
watch(
  () => lobby.snapshot,
  (value) => {
    if (!value || !layer.value) return;
    controller ??=
      window.MotionPolicy?.createBarrageController(
        (item: BarrageEvent, _lane, { moving, finish }) => {
          const node = document.createElement('div');
          node.className = 'game-barrage game-barrage-framed vue-lobby-barrage';
          node.classList.toggle('is-moving', moving);
          window.BarrageFrames?.decorate(node, item.frame, item.name, item.message);
          if (!window.BarrageFrames?.place(layer.value!, node)) return false;
          node.addEventListener('animationend', finish, { once: true });
          return () => node.remove();
        },
      ) || null;
    if (!lobby.connected) {
      controller?.disconnect();
      return;
    }
    controller?.update({
      ...value,
      code: 'lobby',
      type: 'majority',
      me: value.selfId,
      phase: 'lobby',
      host: false,
      players: [],
    } as never);
  },
  { flush: 'post' },
);
async function send() {
  const message = [...draft.value.trim()].slice(0, 160).join(''),
    builtinFrameId = prefs.barrage?.selected || 'default';
  if (!message || !lobby.connected) return;
  if (!pending || pending.message !== message || pending.builtinFrameId !== builtinFrameId)
    pending = { message, builtinFrameId, requestId: crypto.randomUUID() };
  const payload = { ...pending };
  if (
    await mutation.run(async (request) => {
      await request('/api/lobby/barrage', payload);
    }, '彈幕已發送')
  ) {
    draft.value = '';
    pending = null;
    dialog.value?.close();
    void lobby.sync();
  }
}
onBeforeUnmount(() => controller?.dispose());
</script>
<template>
  <UiButton
    icon="chat"
    icon-only
    label="發送大廳彈幕"
    :disabled="!lobby.connected"
    @click="dialog?.open()"
  /><UiDialog ref="dialog" title="發送大廳彈幕"
    ><form class="vue-lobby-barrage-form" @submit.prevent="send"
      ><label
        >彈幕內容<input
          v-model="draft"
          maxlength="160"
          required
          :disabled="mutation.pending.value" /></label
      ><div class="vue-lobby-barrage-actions"
        ><UiButton label="選擇彈幕框" @click="picker?.open()" /><UiButton
          icon="send"
          type="submit"
          label="送出彈幕"
          :disabled="mutation.pending.value || !lobby.connected" /></div
      ><StatusSlot
        :message="mutation.message.value"
        :error="mutation.failed.value" /></form></UiDialog
  ><FramePicker ref="picker" kind="barrage" /><Teleport to="body"
    ><div ref="layer" class="vue-lobby-barrages" aria-hidden="true"
  /></Teleport>
</template>
<style>
.vue-lobby-barrage-form {
  display: grid;
  gap: 12px;
}
.vue-lobby-barrage-form > label {
  display: grid;
  gap: 4px;
}
.vue-lobby-barrage-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.vue-lobby-barrage-actions > .ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
}

.vue-lobby-barrages {
  position: fixed;
  inset: 80px 0 0;
  pointer-events: none;
  z-index: 180;
  overflow: hidden;
}
.vue-lobby-barrages > .game-barrage {
  position: absolute;
  left: 12px;
  width: max-content;
  max-width: min(420px, 85vw);
  pointer-events: none;
}
.vue-lobby-barrages > .is-moving {
  left: 100%;
  animation: vue-lobby-barrage-travel 8s linear forwards;
}
@keyframes vue-lobby-barrage-travel {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100vw - 100%));
  }
}
</style>
