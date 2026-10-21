<script setup lang="ts">
import { ref } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { usePreferencesStore } from '../../stores/preferences';
import { useMutation } from '../../composables/mutation';
import UiButton from '../../components/UiButton.vue';
import FramePicker from '../../components/FramePicker.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const lobby = useLobbyStore(),
  prefs = usePreferencesStore(),
  picker = ref<InstanceType<typeof FramePicker> | null>(null),
  draft = ref(''),
  mutation = useMutation();
const emit = defineEmits<{ sent: [] }>();
let pending: { message: string; builtinFrameId: string; requestId: string } | null = null;
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
    }, '訊息已送出')
  ) {
    draft.value = '';
    pending = null;
    emit('sent');
    void lobby.sync();
  }
}
</script>
<template>
  <form class="vue-lobby-barrage-form" @submit.prevent="send"
    ><label
      >訊息內容<input
        v-model="draft"
        maxlength="160"
        required
        :disabled="mutation.pending.value" /></label
    ><div class="vue-lobby-barrage-actions"
      ><UiButton label="選擇對話框" @click="picker?.open()" /><UiButton
        icon="send"
        type="submit"
        label="送出訊息"
        :disabled="mutation.pending.value || !lobby.connected" /></div
    ><StatusSlot :message="mutation.message.value" :error="mutation.failed.value" /></form
  ><FramePicker ref="picker" kind="barrage" />
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
</style>
