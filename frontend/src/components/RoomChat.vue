<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useChatStore } from '../stores/chat';
import { useReactionsStore } from '../stores/reactions';
import { useRoomStore } from '../stores/room';
import ReactionPicker from './ReactionPicker.vue';
import UiButton from './UiButton.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/room-social.scss';
const props = withDefaults(
  defineProps<{ inline?: boolean; notice?: string; quickReplies?: string[] }>(),
  { inline: true, notice: '' },
);
const chat = useChatStore(),
  reactions = useReactionsStore(),
  room = useRoomStore(),
  prefix = useId();
const list = ref<HTMLOListElement | null>(null),
  input = ref<HTMLInputElement | null>(null),
  composing = ref(false);
let disposed = false;
const clock = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | undefined;
const quick = computed(
  () =>
    props.quickReplies ||
    (room.type === 'draw'
      ? room.snapshot?.phase === 'finished'
        ? ['GG! 🔥', '再來一局! 🔄', '笑死 🤣']
        : ['👏', '🤣', '🔥']
      : []),
);
const notice = computed(
  () =>
    props.notice ||
    (room.type === 'draw'
      ? room.snapshot?.phase === 'finished'
        ? '本局已結束，聊聊剛才的精彩畫作。'
        : '閒聊與答案分流；猜題請使用作答區。'
      : ''),
);
const blocked = computed(
  () => !chat.enabled || !chat.viewerId || chat.pending || reactions.pending,
);
const feedback = computed(() =>
  chat.pending || reactions.pending
    ? '傳送中…'
    : chat.status || reactions.message || (chat.loading ? '正在載入聊天訊息…' : ''),
);
function time(value: number) {
  const seconds = Math.max(0, Math.floor((clock.value - room.clockOffset - value) / 1000));
  if (seconds < 5) return '剛剛';
  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分鐘前`;
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function focusInput() {
  if (!disposed && !document.hidden && input.value?.isConnected && !input.value.disabled)
    input.value.focus();
}
function compose(value: string) {
  if (chat.compose(value)) void nextTick(focusInput);
}
function limitInput() {
  if (!composing.value) chat.draft = [...chat.draft].slice(0, 160).join('');
}
function compositionEnd() {
  composing.value = false;
  if (input.value) chat.draft = [...input.value.value].slice(0, 160).join('');
}
async function submit() {
  if (composing.value || blocked.value) return;
  const scope = room.scope,
    trigger = document.activeElement;
  await chat.send();
  if (
    scope === room.scope &&
    !document.querySelector('dialog[open], [popover]:popover-open') &&
    (document.activeElement === trigger || document.activeElement === document.body)
  )
    focusInput();
}
async function toggle() {
  chat.show(!chat.visible);
  if (chat.visible) {
    await nextTick();
    if (list.value) list.value.scrollTop = list.value.scrollHeight;
    focusInput();
  }
}
watch(
  () => props.inline,
  (value) => {
    chat.show(value);
  },
  { immediate: true },
);
watch(
  () => chat.messages.map((message) => message.id).join('|'),
  async () => {
    const element = list.value,
      bottom = !element || element.scrollHeight - element.scrollTop - element.clientHeight < 40;
    await nextTick();
    if (!disposed && bottom && list.value) list.value.scrollTop = list.value.scrollHeight;
  },
);
onMounted(() => {
  clockTimer = setInterval(() => {
    if (!document.hidden) clock.value = Date.now();
  }, 5000);
});
onBeforeUnmount(() => {
  disposed = true;
  clearInterval(clockTimer);
});
defineExpose({ compose, focus: focusInput });
</script>

<template>
  <section
    class="vue-room-chat vue-chat-c01"
    data-ping-anchor="chat"
    aria-label="房間彈幕與閒聊"
    :class="{ 'vue-chat-collapsed': !chat.visible }"
  >
    <header class="vue-chat-header" :class="{ 'vue-chat-toggle-header': !inline }">
      <div class="vue-chat-heading"
        ><h2 v-if="inline">房間彈幕與閒聊</h2
        ><UiButton
          v-else
          variant="ghost"
          icon="chat"
          :label="chat.visible ? '收合房間彈幕與閒聊' : '展開房間彈幕與閒聊'"
          caption="房間彈幕與閒聊"
          :aria-expanded="chat.visible"
          :aria-controls="prefix + '-content'"
          @click="toggle"
        /><span
          class="vue-chat-connection"
          role="img"
          :data-connected="chat.enabled && room.connected && !chat.status"
          :aria-label="
            chat.enabled && room.connected && !chat.status
              ? '聊天室已連線'
              : '聊天室連線中斷或載入中'
          "
        ></span
        ><span class="vue-chat-unread" role="status">{{
          chat.unread ? '未讀 ' + chat.unread : ''
        }}</span></div
      >
    </header>
    <div
      v-show="chat.visible"
      :id="prefix + '-content'"
      class="vue-room-chat-content vue-chat-c01-content"
    >
      <p v-if="notice" class="vue-chat-notice">{{ notice }}</p>
      <ol
        ref="list"
        class="vue-chat-messages"
        aria-label="聊天訊息"
        tabindex="0"
        :aria-busy="chat.loading"
        ><li v-if="!chat.messages.length && (chat.loading || chat.status)" class="vue-chat-empty">{{
          chat.loading ? '正在載入…' : '聊天訊息暫時無法更新。'
        }}</li
        ><li v-for="message in chat.messages" :key="message.id" class="vue-chat-message"
          ><div class="vue-chat-message-copy"
            ><div class="vue-chat-message-meta"
              ><strong>{{ message.name }}</strong
              ><span aria-hidden="true">•</span
              ><time
                :datetime="new Date(message.at).toISOString()"
                :title="new Date(message.at).toLocaleString()"
                >{{ time(message.at) }}</time
              ></div
            ><p>{{ message.message }}</p></div
          ></li
        ></ol
      >
      <div :id="prefix + '-status'" class="vue-chat-feedback"
        ><StatusSlot v-if="feedback" :message="feedback" :error="!!chat.status || reactions.failed"
      /></div>
      <form autocomplete="off" :aria-busy="chat.pending" @submit.prevent="submit">
        <div class="vue-chat-tools" aria-label="房間社交工具"
          ><slot name="tools" /><ReactionPicker
            :disabled="blocked"
            :quick-replies="quick"
            compose-emoji
            @compose="compose" /><UiButton
            v-if="chat.status && chat.enabled"
            variant="secondary"
            class="vue-chat-retry"
            icon="refresh"
            icon-only
            label="重新載入聊天室"
            :disabled="chat.pending || chat.loading"
            @click="chat.poll()"
        /></div>
        <label :for="prefix + '-input'" class="ui-sr-only">房間彈幕</label
        ><div class="vue-chat-compose"
          ><input
            :id="prefix + '-input'"
            ref="input"
            v-model="chat.draft"
            maxlength="320"
            required
            autocomplete="off"
            placeholder="輸入彈幕或閒聊…"
            :aria-describedby="prefix + '-status'"
            :disabled="blocked"
            @input="limitInput"
            @compositionstart="composing = true"
            @compositionend="compositionEnd"
            @keydown.enter="
              ($event.isComposing || composing) && $event.preventDefault()
            " /><UiButton
            variant="contrast"
            type="submit"
            class="vue-chat-send"
            icon="send"
            icon-only
            label="發送房間彈幕"
            :pending="chat.pending"
            :disabled="blocked" /></div
      ></form>
    </div>
  </section>
</template>
