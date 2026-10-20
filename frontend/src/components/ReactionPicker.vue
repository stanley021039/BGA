<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { useReactionsStore } from '../stores/reactions';
import UiButton from './UiButton.vue';
import UiPopover from './UiPopover.vue';
import UiTabs from './UiTabs.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/room-social.scss';
const props = defineProps<{
    disabled?: boolean;
    composeEmoji?: boolean;
    quickReplies?: string[];
  }>(),
  emit = defineEmits<{ compose: [text: string] }>();
const room = useRoomStore(),
  reactions = useReactionsStore(),
  popover = ref<InstanceType<typeof UiPopover> | null>(null),
  tab = ref('character'),
  prefix = useId();
const featured = [
  ['😂', '笑死'],
  ['👏', '神作'],
  ['🔥', '熱血'],
  ['🤔', '思考'],
  ['😱', '崩潰'],
  ['👍', '厲害'],
  ['❤️', '喜歡'],
  ['🎉', '恭喜'],
  ['💩', '畫啥呢'],
  ['🤡', '小丑'],
  ['🚀', '起飛'],
  ['💡', '靈光'],
  ['🎨', '畫工'],
  ['💯', '滿分'],
  ['👻', '抓到了'],
  ['🕶️', '淡定'],
  ['👀', '圍觀'],
  ['🤯', '震驚'],
  ['🤝', '同意'],
  ['🎯', '命中'],
  ['⏳', '快點'],
  ['🤐', '保密'],
  ['🍿', '爆米花'],
  ['🏆', 'MVP'],
];
const names: Record<string, string> = {
  '😀': '開心',
  '🥰': '喜歡',
  '😎': '帥氣',
  '😮': '驚訝',
  '😭': '哭哭',
  '😡': '生氣',
  '👎': '不行',
  '🙌': '歡呼',
  '🙏': '拜託',
  '🥳': '慶祝',
  '😴': '想睡',
  '✨': '閃亮',
  '💪': '加油',
};
const enhanced = computed(() => room.type === 'draw' || room.type === 'quacks');
const emojiChoices = computed(() => {
  const preferred = enhanced.value
    ? featured.filter(([value]) => reactions.emojiChoices.includes(value!))
    : [];
  return [
    ...preferred,
    ...reactions.emojiChoices
      .filter((value) => !preferred.some(([glyph]) => glyph === value))
      .map((value) => [
        value,
        names[value] || featured.find(([glyph]) => glyph === value)?.[1] || '表情互動',
      ]),
  ];
});
const tabs = [
  { id: 'character', label: '角色動作' },
  { id: 'emoji', label: '表情' },
];
const phrases = computed(() => [
  ...new Set([
    ...(props.quickReplies || []),
    ...(enhanced.value
      ? room.type === 'quacks'
        ? ['💬 這鍋穩啦！', '💬 先停還是衝？', '💬 差一顆就爆了！']
        : ['💬 太抽象了！', '💬 肯定是那個吧？', '💬 加油快畫完！']
      : []),
  ]),
]);
const blocked = computed(() => !!props.disabled || reactions.pending || !reactions.enabled);
function open(event: MouseEvent) {
  if (blocked.value) return;
  if (popover.value?.visible) popover.value.close();
  else {
    void popover.value?.open(event.currentTarget as HTMLElement);
    void reactions.load();
  }
}
async function send(kind: 'emoji' | 'expression', value: string) {
  if (blocked.value) return;
  const scope = room.scope;
  if ((await reactions.send(kind, value)) && scope === room.scope) popover.value?.close();
}
let queuedCompose: { text: string; scope: number } | null = null;
function compose(value: string) {
  if (blocked.value) return;
  queuedCompose = { text: value, scope: room.scope };
  popover.value?.close();
}
function chooseEmoji(value: string) {
  if (props.composeEmoji) compose(value);
  else void send('emoji', value);
}
function closed() {
  const value = queuedCompose;
  queuedCompose = null;
  if (value && value.scope === room.scope && reactions.enabled) emit('compose', value.text);
}
watch(
  () => reactions.enabled,
  (enabled) => {
    if (!enabled) {
      queuedCompose = null;
      popover.value?.close(false);
    }
  },
);
watch(
  () => room.scope,
  () => {
    queuedCompose = null;
    popover.value?.close(false);
    tab.value = 'character';
  },
);
onBeforeUnmount(() => {
  queuedCompose = null;
});
defineExpose({ open });
</script>

<template>
  <UiButton
    stitch
    variant="ghost"
    icon="emoji"
    icon-only
    label="表情與角色動作"
    :aria-expanded="!!popover?.visible"
    :aria-controls="prefix + '-popover'"
    aria-haspopup="dialog"
    :disabled="blocked"
    @click="open"
  />
  <UiPopover :id="prefix + '-popover'" ref="popover" title="表情與角色動作" @closed="closed">
    <template #header
      ><UiTabs
        v-model="tab"
        :items="tabs"
        label="表情分類"
        :id-prefix="prefix + '-tab'"
        :panel-prefix="prefix + '-panel'"
        :disabled="reactions.pending"
    /></template>
    <div class="vue-reaction-content">
      <section
        v-show="tab === 'emoji'"
        :id="prefix + '-panel-emoji'"
        role="tabpanel"
        :aria-labelledby="prefix + '-tab-emoji'"
        :aria-busy="reactions.emojiLoading"
      >
        <p class="vue-reaction-hint">{{
          composeEmoji ? '點選表情填入輸入框，再按發送。' : '點選表情，傳送房間互動。'
        }}</p>
        <p v-if="reactions.emojiLoading && !reactions.emojiChoices.length">正在載入表情…</p>
        <div v-if="reactions.emojiError" class="vue-social-load-error"
          ><p>{{ reactions.emojiError }}</p
          ><UiButton
            stitch
            variant="secondary"
            icon="refresh"
            label="重新載入表情"
            :pending="reactions.emojiLoading"
            @click="reactions.loadEmojis()"
        /></div>
        <div class="vue-emoji-grid"
          ><button
            v-for="[value, label] in emojiChoices"
            :key="value"
            type="button"
            :title="label"
            :aria-label="(composeEmoji ? '填入' : '送出') + label + '表情（' + value + '）'"
            :disabled="blocked"
            @click="chooseEmoji(value!)"
            ><span class="vue-emoji-glyph" aria-hidden="true">{{ value }}</span></button
          ></div
        >
      </section>
      <section
        v-show="tab === 'character'"
        :id="prefix + '-panel-character'"
        role="tabpanel"
        :aria-labelledby="prefix + '-tab-character'"
        :aria-busy="reactions.characterLoading"
      >
        <p
          v-if="reactions.characterLoading && !reactions.expressions.length"
          class="vue-reaction-hint"
          >正在載入角色動作…</p
        ><p v-else class="vue-reaction-hint">{{
          reactions.characterName
            ? '使用「' + reactions.characterName + '」的角色動作。'
            : '選擇角色動作，和房間裡的朋友互動。'
        }}</p>
        <div v-if="reactions.characterError" class="vue-social-load-error"
          ><p>{{ reactions.characterError }}</p
          ><UiButton
            stitch
            variant="secondary"
            icon="refresh"
            label="重新載入角色動作"
            :pending="reactions.characterLoading"
            @click="reactions.loadCharacter()"
        /></div>
        <div class="vue-expression-grid"
          ><button
            v-for="choice in reactions.expressions"
            :key="choice.id"
            type="button"
            :aria-label="'送出「' + choice.label + '」角色動作'"
            :disabled="blocked"
            @click="send('expression', choice.id)"
            ><img :src="choice.url" alt="" loading="lazy" /><span>{{ choice.label }}</span></button
          ></div
        >
        <details v-if="phrases.length" class="vue-reaction-phrases"
          ><summary>常用語・填入輸入框</summary
          ><div
            ><UiButton
              v-for="phrase in phrases"
              :key="phrase"
              stitch
              variant="secondary"
              :label="phrase"
              :disabled="blocked"
              @click="compose(phrase)" /></div
        ></details>
      </section>
    </div>
    <StatusSlot
      :message="reactions.pending ? '傳送中…' : reactions.message"
      :error="reactions.failed"
    />
  </UiPopover>
</template>
