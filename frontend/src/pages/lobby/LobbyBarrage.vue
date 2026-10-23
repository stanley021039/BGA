<script setup lang="ts">
import { ref } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { usePreferencesStore } from '../../stores/preferences';
import { useMutation } from '../../composables/mutation';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const lobby = useLobbyStore(),
  prefs = usePreferencesStore(),
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
  <form class="vue-lobby-barrage-form" @submit.prevent="send">
    <label for="lobby-chat-message">訊息內容</label>
    <div class="vue-lobby-chat-input">
      <input
        id="lobby-chat-message"
        v-model="draft"
        maxlength="160"
        required
        :disabled="mutation.pending.value"
      />
      <UiButton
        class="vue-lobby-inline-send"
        icon="send"
        icon-only
        type="submit"
        label="送出訊息"
        :pending="mutation.pending.value"
        :disabled="!lobby.connected || !draft.trim()"
      />
    </div>
    <StatusSlot :message="mutation.message.value" :error="mutation.failed.value" />
  </form>
</template>
<style lang="scss">
.vue-lobby-barrage-form {
  display: grid;
  gap: 12px;
}
.vue-lobby-chat-input {
  position: relative;
  min-width: 0;
}
.vue-lobby-chat-input input {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding-right: 56px;
}
.vue-lobby-chat-input .vue-lobby-inline-send {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  min-width: 42px;
  height: 42px;
  min-height: 42px;
  margin: 0;
}
</style>
