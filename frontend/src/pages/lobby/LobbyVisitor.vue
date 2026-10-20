<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { LobbyVisitor } from '../../contracts/lobby';
import { usePreferencesStore } from '../../stores/preferences';
const props = defineProps<{
    visitor: LobbyVisitor;
    self: boolean;
    reset: number;
    open: boolean;
    connected: boolean;
  }>(),
  emit = defineEmits<{ select: [element: HTMLElement] }>();
const node = ref<HTMLElement | null>(null),
  speech = ref<HTMLElement | null>(null),
  left = ref(props.visitor.x),
  top = ref(props.visitor.y),
  duration = ref(0),
  placing = ref(true),
  bubbleLeft = ref('50%');
const prefs = usePreferencesStore(),
  still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
let disposed = false,
  revision = 0,
  frame = 0,
  observer: ResizeObserver | null = null;
function positionBubble() {
  if (!node.value || !speech.value) return;
  const stage = node.value.closest('.lobby-stage')?.getBoundingClientRect(),
    box = node.value.getBoundingClientRect(),
    half = speech.value.offsetWidth / 2;
  if (!stage) return;
  const center = box.left + box.width / 2,
    safe = Math.max(stage.left + half + 8, Math.min(stage.right - half - 8, center));
  bubbleLeft.value = `calc(50% + ${safe - center}px)`;
}
watch(
  [() => props.visitor.moveId, () => props.reset],
  async (_, previous) => {
    const epoch = ++revision,
      initial = !previous || previous[1] !== props.reset;
    if (initial) {
      placing.value = true;
      duration.value = 0;
      left.value = props.visitor.x;
      top.value = props.visitor.y;
      await nextTick();
      if (disposed || epoch !== revision) return;
      node.value?.getBoundingClientRect();
    }
    duration.value =
      props.visitor.moveId === 0 || still.value ? 0 : Math.max(350, props.visitor.remainingMs);
    placing.value = false;
    left.value = props.visitor.moving ? props.visitor.targetX : props.visitor.x;
    top.value = props.visitor.moving ? props.visitor.targetY : props.visitor.y;
  },
  { immediate: true },
);
watch(
  [() => props.visitor.x, () => props.visitor.y, () => props.visitor.emote?.id],
  async () => {
    await nextTick();
    if (!disposed) {
      positionBubble();
      if (!observer && node.value) {
        observer = new ResizeObserver(positionBubble);
        const stage = node.value.closest('.lobby-stage');
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
    if (
      disposed ||
      document.hidden ||
      !props.connected ||
      epoch !== revision ||
      !props.visitor.emote
    )
      return;
    positionBubble();
    frame = requestAnimationFrame(tick);
  };
  if (props.visitor.emote && props.connected && !document.hidden)
    frame = requestAnimationFrame(tick);
}
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  observer?.disconnect();
  if (frame) cancelAnimationFrame(frame);
});
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
      zIndex: Math.round(visitor.y),
      '--lobby-move-duration': duration + 'ms',
    }"
    :data-ping-player="visitor.id"
    :aria-label="self ? visitor.name + '（你），選擇表情' : undefined"
    :aria-haspopup="self ? 'dialog' : undefined"
    :aria-expanded="self ? open : undefined"
    :disabled="self && !connected ? true : undefined"
    @click.stop="self && node && emit('select', node)"
    @transitionrun="transition"
  >
    <div
      v-if="visitor.emote"
      :key="visitor.emote.id"
      ref="speech"
      class="lobby-speech"
      :style="{ left: bubbleLeft, transform: 'translateX(-50%)' }"
      >{{ visitor.emote.label }}</div
    ><img :src="visitor.emote?.image || visitor.image" alt="" draggable="false" /><span
      >{{ visitor.name }}{{ self ? '（你）' : '' }}</span
    >
  </component>
</template>
