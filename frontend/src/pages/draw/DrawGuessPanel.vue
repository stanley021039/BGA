<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import type { DrawSnapshot } from '../../contracts/drawing';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const props = defineProps<{ snapshot: DrawSnapshot }>(),
  room = useRoomStore();
const draft = ref(''),
  input = ref<HTMLInputElement | null>(null),
  feed = ref<HTMLElement | null>(null),
  notice = ref(''),
  failed = ref(false),
  composing = ref(false);
const eligible = computed(
  () =>
    props.snapshot.phase === 'drawing' &&
    props.snapshot.participantIds.includes(props.snapshot.me) &&
    !props.snapshot.guessedIds.includes(props.snapshot.me),
);
const hint = computed(() =>
  props.snapshot.presenterId === props.snapshot.me
    ? '你是本輪畫者，其他朋友來猜題。'
    : props.snapshot.guessedIds.includes(props.snapshot.me)
      ? '你已猜中，等待其他朋友。'
      : props.snapshot.phase !== 'drawing'
        ? '本輪已揭曉。'
        : !props.snapshot.participantIds.includes(props.snapshot.me)
          ? '你將從下一輪開始猜題。'
          : '輸入答案，按 Enter 送出。',
);
watch([() => props.snapshot.canvasEpoch, () => room.scope], () => {
  draft.value = notice.value = '';
  failed.value = false;
});
watch(
  () => props.snapshot.guesses,
  async () => {
    const host = feed.value,
      follow = !host || host.scrollHeight - host.scrollTop - host.clientHeight < 40;
    await nextTick();
    if (follow && feed.value) feed.value.scrollTop = feed.value.scrollHeight;
  },
);
async function submit() {
  if (composing.value || !eligible.value || room.busy) return;
  const answer = draft.value.trim(),
    epoch = props.snapshot.canvasEpoch,
    scope = room.scope;
  if (!answer) return;
  notice.value = '正在送出猜測…';
  failed.value = false;
  const result = await room.command('action', { action: 'guess', answer });
  if (scope !== room.scope || epoch !== props.snapshot.canvasEpoch) return;
  if (result) {
    if (draft.value.trim() === answer) draft.value = '';
    notice.value = '';
  } else {
    notice.value = room.message;
    failed.value = true;
  }
  await nextTick();
  if (eligible.value) input.value?.focus();
}
</script>
<template>
  <section class="vue-draw-guess-panel vue-draw-approved-guesses" aria-label="猜題聊天室"
    ><h2>這輪的猜測</h2
    ><div
      ref="feed"
      class="vue-draw-guess-feed"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      tabindex="0"
      ><p v-if="!snapshot.guesses.length">還沒有猜測。第一個想法也可以送出！</p
      ><p
        v-for="guess in snapshot.guesses"
        :key="`${snapshot.canvasEpoch}:${guess.at}:${guess.id}:${guess.correct}:${guess.answer}`"
        :class="{ 'is-correct': guess.correct }"
        >{{
          guess.correct
            ? `${guess.name}：猜對了答案！ +${guess.points} 分`
            : `${guess.name}：${guess.answer}`
        }}</p
      ></div
    ><p class="vue-draw-guess-hint">{{ hint }}</p
    ><form @submit.prevent="submit"
      ><label for="vue-draw-guess">你猜這是什麼？</label
      ><div
        ><input
          id="vue-draw-guess"
          ref="input"
          v-model="draft"
          maxlength="40"
          autocomplete="off"
          placeholder="輸入答案"
          :disabled="!eligible"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @keydown.enter="($event.isComposing || composing) && $event.preventDefault()" /><UiButton
          stitch
          variant="primary"
          type="submit"
          icon="send"
          caption="送出"
          label="送出猜測"
          :pending="room.busy"
          :disabled="!eligible || !draft.trim() || composing" /></div></form
    ><StatusSlot :message="notice" :error="failed"
  /></section>
</template>
