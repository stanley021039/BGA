<script setup lang="ts">
import MotionPolicy from '../../engines/motion-policy.js';
import BarrageFrames from '../../engines/barrage-frames.js';

import SceneHealth from '../../components/SceneHealth.vue';
import { sceneWalk } from '../../engines/scene-path.js';
import { sizedImage } from '../../services/image-size';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { LobbyVisitor } from '../../contracts/lobby';
import { playKnockback } from '../../services/scene-knockback';
import type { BarrageEvent } from '../../contracts/social';
import { usePreferencesStore } from '../../stores/preferences';
import { apparate, entranceDuration } from './apparition';
const NAME_LIMIT = 10;
const props = defineProps<{
    visitor: LobbyVisitor;
    message?: BarrageEvent;
    self: boolean;
    reset: number;
    open: boolean;
    connected: boolean;
    arrive?: boolean;
  }>(),
  emit = defineEmits<{ select: [element: HTMLElement]; arrived: [] }>();
const node = ref<HTMLElement | null>(null),
  speech = ref<HTMLElement | null>(null),
  left = ref(props.visitor.x),
  top = ref(props.visitor.y),
  duration = ref(0),
  placing = ref(true),
  bubbleLeft = ref('50%'),
  messageLeft = ref('0px'),
  messageTop = ref('0px'),
  messageOnscreen = ref(true),
  tailShift = ref('0px'),
  bubbleBelow = ref(false),
  bubbleHeight = ref('180px'),
  ornate = ref(false);
const shortName = computed(() => {
  const chars = [...props.visitor.name];
  return chars.length > NAME_LIMIT ? chars.slice(0, NAME_LIMIT).join('') + '…' : props.visitor.name;
});
const prefs = usePreferencesStore(),
  hasSpeech = computed(() => !!props.message || !!props.visitor.emote),
  still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
let disposed = false,
  revision = 0,
  frame = 0,
  observer: ResizeObserver | null = null,
  stopArrival: (() => void) | null = null;
let stopKnockback: (() => void) | null = null;
watch(
  () => props.visitor.knockback?.id,
  async (id) => {
    if (!id) return;
    stopKnockback?.();
    stopKnockback = null;
    if (still.value || !props.connected) return;
    await nextTick();
    if (
      !disposed &&
      node.value &&
      props.visitor.knockback?.id === id &&
      !still.value &&
      props.connected
    )
      stopKnockback = playKnockback(node.value, props.visitor);
  },
);
watch(
  [
    still,
    () => props.connected,
    () => props.visitor.moveId,
    () => props.visitor.teleportId,
    () => props.visitor.health === 0,
  ],
  () => {
    stopKnockback?.();
    stopKnockback = null;
  },
);
watch(
  [() => props.arrive, () => props.visitor.teleportId],
  async ([value, id], previous) => {
    if (!value && !(previous && id > 0 && id !== previous[1])) return;
    await nextTick();
    const layer = node.value?.closest<HTMLElement>('.lobby-backdrop');
    if (
      disposed ||
      !node.value ||
      !layer ||
      still.value ||
      document.hidden ||
      !MotionPolicy?.allowsMotion()
    ) {
      emit('arrived');
      return;
    }
    stopArrival?.();
    stopArrival = apparate(node.value, layer, props.visitor.entrance);
    setTimeout(() => !disposed && emit('arrived'), entranceDuration(props.visitor.entrance) + 50);
  },
  { immediate: true },
);
function positionBubble() {
  if (!node.value || !speech.value) return;
  const stage = node.value.closest('.lobby-backdrop')?.getBoundingClientRect(),
    box = node.value.getBoundingClientRect(),
    half = speech.value.offsetWidth / 2;
  if (!stage) return;
  if (props.message) {
    const width = stage.width;
    const center = box.left + box.width / 2;
    const safe = Math.max(half + 16, Math.min(width - half - 16, center - stage.left));
    const above = box.top - stage.top - 24,
      below = stage.bottom - box.bottom - 24;
    bubbleBelow.value = speech.value.scrollHeight > above && below > above;
    bubbleHeight.value = Math.max(60, bubbleBelow.value ? below : above) + 'px';
    messageLeft.value = safe + 'px';
    messageTop.value =
      (bubbleBelow.value ? box.bottom - stage.top + 18 : box.top - stage.top - 18) + 'px';
    messageOnscreen.value = box.bottom > stage.top && box.top < stage.bottom;
    tailShift.value = center - stage.left - safe + 'px';
    return;
  }
  const center = box.left + box.width / 2,
    safe = Math.max(stage.left + half + 8, Math.min(stage.right - half - 8, center));
  bubbleLeft.value = `calc(50% + ${safe - center}px)`;
  tailShift.value = center - safe + 'px';
  const above = box.top - stage.top - 12,
    below = stage.bottom - box.bottom - 12;
  bubbleBelow.value = speech.value.scrollHeight > above && below > above;
  bubbleHeight.value = Math.max(60, bubbleBelow.value ? below : above) + 'px';
}
watch(
  () => props.message?.id,
  async () => {
    await nextTick();
    if (disposed || !props.message || !speech.value) return;
    speech.value.replaceChildren();
    if (BarrageFrames)
      BarrageFrames.decorate(
        speech.value,
        props.message.frame,
        props.message.name,
        props.message.message,
      );
    else speech.value.textContent = props.message.message;
    const pointer = document.createElement('span');
    pointer.className = 'lobby-chat-pointer';
    pointer.setAttribute('aria-hidden', 'true');
    speech.value.append(pointer);
    ornate.value = speech.value.classList.contains('barrage-frame-ornate');
    await nextTick();
    positionBubble();
    transition();
  },
  { immediate: true, flush: 'post' },
);
let moveFrame = 0;
const wrap = (value: number) => ((value % 100) + 100) % 100;
watch(
  [() => props.visitor, () => props.reset, () => props.connected, still],
  async () => {
    if (moveFrame) cancelAnimationFrame(moveFrame);
    const epoch = ++revision,
      visitor = props.visitor;
    placing.value = true;
    duration.value = 0;
    left.value = visitor.x;
    top.value = visitor.y;
    await nextTick();
    if (disposed || epoch !== revision) return;
    placing.value = false;
    if (!props.connected || document.hidden) return;
    if (still.value || !visitor.moving || !visitor.remainingMs) {
      left.value = wrap(visitor.targetX);
      top.value = wrap(visitor.targetY);
      return;
    }
    const started = performance.now();
    const tick = (time: number) => {
      moveFrame = 0;
      if (disposed || epoch !== revision || document.hidden || !props.connected) return;
      const position = sceneWalk(
        visitor,
        { x: visitor.targetX, y: visitor.targetY },
        time - started,
        visitor.passage,
      );
      left.value = wrap(position.x);
      top.value = wrap(position.y);
      if (hasSpeech.value) positionBubble();
      if (position.remainingMs > 0) moveFrame = requestAnimationFrame(tick);
    };
    moveFrame = requestAnimationFrame(tick);
  },
  { immediate: true },
);
watch(
  [
    () => props.visitor.x,
    () => props.visitor.y,
    () => props.visitor.emote?.id,
    () => props.message?.id,
  ],
  async () => {
    await nextTick();
    if (!disposed) {
      positionBubble();
      if (!observer && node.value) {
        observer = new ResizeObserver(positionBubble);
        const stage = node.value.closest('.lobby-backdrop');
        if (stage) observer.observe(stage);
      }
    }
  },
  { immediate: true },
);
function transition() {
  if (frame) cancelAnimationFrame(frame);
  const epoch = revision;
  const tick = () => {
    frame = 0;
    if (disposed || document.hidden || !props.connected || epoch !== revision || !hasSpeech.value)
      return;
    positionBubble();
    frame = requestAnimationFrame(tick);
  };
  if (hasSpeech.value && props.connected && !document.hidden) frame = requestAnimationFrame(tick);
}
onBeforeUnmount(() => {
  disposed = true;
  stopKnockback?.();
  revision++;
  if (moveFrame) cancelAnimationFrame(moveFrame);
  observer?.disconnect();
  stopArrival?.();
  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener('scroll', positionBubble, true);
  window.removeEventListener('resize', positionBubble);
});
window.addEventListener('scroll', positionBubble, true);
window.addEventListener('resize', positionBubble);
</script>
<template>
  <component
    :is="self ? 'button' : 'div'"
    ref="node"
    :type="self ? 'button' : undefined"
    class="lobby-avatar"
    :class="{
      'is-self': self,
      'is-placing': placing || still || !connected,
      'is-moving': visitor.moving && connected && !still,
      'facing-left': visitor.facing === 'left',
      'is-emoting': visitor.emote && !still,
    }"
    :style="{
      left: left + '%',
      top: top + '%',
      zIndex: (hasSpeech ? 200 : 0) + Math.round(visitor.y),
      '--lobby-move-duration': duration + 'ms',
    }"
    :data-ping-player="visitor.id"
    :aria-label="self ? visitor.name + '（你），點一下發表情，R 鍵隨機換位' : undefined"
    :aria-haspopup="self ? 'dialog' : undefined"
    :aria-expanded="self ? open : undefined"
    :disabled="self && !connected ? true : undefined"
    @click.stop="self && node && emit('select', node)"
    @transitionrun="transition"
  >
    <Teleport to=".lobby-backdrop"
      ><div
        v-if="message"
        :key="message.id"
        ref="speech"
        class="lobby-chat-bubble game-barrage game-barrage-framed"
        :data-speaker-id="visitor.id"
        role="status"
        :class="{ 'is-below': bubbleBelow, 'barrage-frame-ornate': ornate }"
        :style="{
          left: messageLeft,
          top: messageTop,
          visibility: messageOnscreen ? undefined : 'hidden',
          '--speech-height': bubbleHeight,
          '--tail-shift': tailShift,
          transform: bubbleBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        }"
        @click.stop
    /></Teleport>
    <div
      v-if="!message && visitor.emote"
      :key="visitor.emote.id"
      ref="speech"
      class="lobby-speech"
      :style="{ left: bubbleLeft, transform: 'translateX(-50%)' }"
      >{{ visitor.emote.label }}</div
    >
    <div
      v-if="visitor.dotPulse"
      :key="visitor.dotPulse.id"
      class="scene-dot-number"
      aria-hidden="true"
      >{{ visitor.dotPulse.damage.toLocaleString() }}</div
    >
    <img
      v-show="visitor.health !== 0"
      :src="sizedImage(visitor.emote?.image || visitor.image, 256)"
      :style="{ clipPath: visitor.severed ? 'inset(0 0 50% 0)' : undefined }"
      alt=""
      draggable="false"
    /><SceneHealth v-if="visitor.maxHealth" :visitor="visitor" /><span
      v-if="visitor.health !== 0"
      >{{ shortName }}</span
    >
  </component>
</template>
<style scoped>
.scene-dot-number {
  position: absolute;
  bottom: 100%;
  left: 50%;
  color: var(--stitch-danger-ink);
  font-size: var(--stitch-text-section);
  font-weight: 700;
  pointer-events: none;
  translate: -50% -12px;
}
</style>
