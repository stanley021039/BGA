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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
}
.vue-lobby-chat-input input {
  grid-area: 1 / 1 / 2 / -1;
  align-self: stretch;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding-right: calc(max(44px, 2.75rem) + 12px);
}
.vue-lobby-chat-input .vue-lobby-inline-send {
  // Keep the action in the input row even when shared button states change.
  grid-area: 1 / 2;
  position: relative;
  inset: auto;
  transform: none;
  width: max(44px, 2.75rem);
  min-width: max(44px, 2.75rem);
  height: max(44px, 2.75rem);
  min-height: max(44px, 2.75rem);
  margin: 0 3px;
}
.vue-lobby-barrage-form .vue-lobby-chat-input :is(input, .vue-lobby-inline-send):focus-visible {
  // Beat the shared theme's outward focus ring inside the dialog scroll area.
  outline-offset: -3px;
}
</style>
