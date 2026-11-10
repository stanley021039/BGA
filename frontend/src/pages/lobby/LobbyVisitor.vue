<script setup lang="ts">
import MotionPolicy from '../../engines/motion-policy.js';
import BarrageFrames from '../../engines/barrage-frames.js';

import SceneHealth from '../../components/SceneHealth.vue';
import SummonArtwork from '../../components/SummonArtwork.vue';
import { sceneWalkWithSpeed } from '../../engines/scene-path.js';
import { interpolateSceneVisitor } from '../../services/scene-interpolation';
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
    team?: string;
    message?: BarrageEvent;
    self: boolean;
    reset: number;
    open: boolean;
    connected: boolean;
    arrive?: boolean;
    followCamera?: boolean;
    showSummon?: boolean;
  }>(),
  emit = defineEmits<{
    select: [element: HTMLElement];
    arrived: [];
    position: [x: number, y: number];
  }>();
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
watch(
  [left, top, () => props.followCamera],
  ([x, y, follow]) => {
    if (follow) emit('position', x, y);
  },
  { immediate: true, flush: 'post' },
);
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
const guard = ref<'full' | 'residual' | null>(null);
const guardSweep = ref<SVGGElement | null>(null);
let guardTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [() => props.visitor, () => props.connected],
  ([visitor, connected], _, onCleanup) => {
    const remaining = visitor.guardMs || 0;
    const full = Math.min(visitor.guardFullMs || 0, remaining);
    if (!connected || !visitor.health || remaining <= 0) {
      guard.value = null;
      return;
    }
    const started = performance.now();
    const refresh = () => {
      const elapsed = performance.now() - started;
      guard.value = elapsed < full ? 'full' : elapsed < remaining ? 'residual' : null;
      if (guard.value)
        guardTimer = setTimeout(
          refresh,
          Math.ceil((guard.value === 'full' ? full : remaining) - elapsed),
        );
    };
    onCleanup(() => clearTimeout(guardTimer));
    refresh();
  },
  { immediate: true },
);
watch(guardSweep, (sweep, _, onCleanup) => {
  if (!sweep || still.value) return;
  const animation = MotionPolicy?.animate(
    sweep,
    [
      { transform: 'rotate(0deg)', opacity: 0 },
      { opacity: 1, offset: 0.18 },
      { transform: 'rotate(145deg)', opacity: 0 },
    ],
    { duration: 620, easing: 'ease-out' },
  );
  if (animation) onCleanup(() => animation.cancel());
});
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
      const position =
        (visitor.archetype || visitor.pickupEffects?.speedUntil) && !visitor.passage
          ? interpolateSceneVisitor(visitor, time - started)
          : sceneWalkWithSpeed(
              visitor,
              { x: visitor.targetX, y: visitor.targetY },
              time - started,
              visitor.passage,
              visitor,
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
    :data-arena-team="team"
    :data-arena-concealed="visitor.concealed || undefined"
    :aria-label="self ? visitor.name + '（你），點一下發表情，C 鍵瞬移、R 鍵施放大招' : undefined"
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
      :class="{ 'is-weak': visitor.dotPulse.weakened }"
      class="scene-dot-number"
      aria-hidden="true"
      >{{
        visitor.dotPulse.damage.toLocaleString() + (visitor.dotPulse.weakened ? ' (WEAK)' : '')
      }}</div
    >
    <div v-show="visitor.health !== 0" class="scene-avatar-portrait">
      <SummonArtwork
        v-if="showSummon && connected && !still && visitor.summon"
        :key="visitor.summon.until"
        :effect="visitor.summon.effect"
        :remaining-ms="visitor.summon.remainingMs"
      />
      <img
        class="scene-avatar-image"
        :src="sizedImage(visitor.emote?.image || visitor.image, 256)"
        :style="{ clipPath: visitor.severed ? 'inset(0 0 50% 0)' : undefined }"
        alt=""
        draggable="false"
      />
      <svg
        v-if="connected && visitor.equationLocked"
        class="scene-equation-bind"
        viewBox="0 0 144 110"
        aria-hidden="true"
      >
        <ellipse cx="72" cy="54" rx="64" ry="24" transform="rotate(-25 72 54)" />
        <ellipse cx="72" cy="61" rx="62" ry="22" transform="rotate(24 72 61)" />
        <text x="18" y="27" transform="rotate(-12 18 27)">x² + y²</text>
        <text x="88" y="37" transform="rotate(15 88 37)">Σ n²</text>
        <text x="3" y="79" transform="rotate(-8 3 79)">∫ f(x) dx</text>
        <text x="82" y="94" transform="rotate(10 82 94)">√(a² + b²)</text>
      </svg>
      <svg
        v-if="connected && visitor.kissedUntil"
        class="scene-kiss-mark"
        viewBox="0 0 100 64"
        aria-hidden="true"
      >
        <path
          d="M3 31C18 26 28 7 38 9c6 0 9 5 13 9 4-4 8-9 14-9 11 1 20 15 32 22-11 14-24 25-46 25S16 46 3 31Zm16 1c10 7 22 10 32 10s21-3 32-10c-11-1-22-5-32-3-10-2-21 2-32 3Z"
          fill-rule="evenodd"
        />
      </svg>
      <svg
        v-if="guard"
        class="scene-avatar-guard"
        :data-guard-phase="guard"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <circle class="guard-rim" cx="50" cy="50" r="44" />
        <g v-if="guard === 'full'" fill="none">
          <path class="guard-trace" d="M17 40 L30 20 H70 L83 40 V60 L70 80 H30 L17 60 Z" />
          <path
            class="guard-arcs"
            d="M10 26 A47 47 0 0 1 41 4 M59 4 A47 47 0 0 1 90 26
               M90 74 A47 47 0 0 1 59 96 M41 96 A47 47 0 0 1 10 74"
          />
          <path class="guard-nodes" d="M4 45 L8 50 L4 55 L0 50 Z M96 45 L100 50 L96 55 L92 50 Z" />
          <g ref="guardSweep" class="guard-sweep">
            <path d="M50 6 A44 44 0 0 1 91 34" />
            <circle cx="91" cy="34" r="1.5" />
          </g>
        </g>
      </svg>
    </div>
    <SceneHealth
      v-if="visitor.maxHealth"
      :visitor="visitor"
      :self="self"
      :connected="connected"
    /><span v-if="visitor.health !== 0"
      >{{ team ? (team === 'red' ? '綠隊 · ' : '藍隊 · ') : '' }}{{ shortName
      }}{{ visitor.concealed ? ' · 隱身' : '' }}</span
    >
  </component>
</template>
<style scoped>
.scene-avatar-portrait {
  position: relative;
  line-height: 0;
}
.scene-avatar-image {
  position: relative;
}
.scene-equation-bind {
  position: absolute;
  inset: -10% auto auto 50%;
  width: 205%;
  height: 122%;
  transform: translateX(-50%);
  overflow: visible;
  pointer-events: none;
  color: var(--stitch-primary);
}
.scene-equation-bind ellipse {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-dasharray: 6 4;
}
.scene-equation-bind text {
  fill: currentColor;
  stroke: var(--stitch-artwork-preview-bg);
  stroke-width: 3;
  paint-order: stroke;
  font-size: var(--stitch-text-label);
  font-weight: 900;
}
.scene-avatar-guard {
  position: absolute;
  inset: -8% auto auto -14%;
  width: 128%;
  height: 116%;
  overflow: visible;
  pointer-events: none;
  color: var(--stitch-info-ink);
}
.guard-rim {
  fill: var(--stitch-info-bg);
  fill-opacity: 0.16;
  stroke: currentColor;
  stroke-width: 1.8;
}
.guard-trace {
  stroke: currentColor;
  stroke-width: 1;
  opacity: 0.5;
}
.guard-arcs,
.guard-nodes {
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  filter: drop-shadow(0 0 2px var(--stitch-info-line));
}
.guard-nodes {
  fill: var(--stitch-surface);
  stroke-width: 1.5;
}
.guard-sweep {
  opacity: 0;
  transform-origin: center;
}
.guard-sweep path {
  stroke: color-mix(in srgb, currentColor 45%, var(--stitch-surface));
  stroke-width: 3.5;
  stroke-linecap: round;
}
.guard-sweep circle {
  fill: var(--stitch-surface);
}
.scene-avatar-guard[data-guard-phase='residual'] .guard-rim {
  fill: none;
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.65;
}
.scene-kiss-mark {
  position: absolute;
  width: 82%;
  inset: 20% auto auto 9%;
  rotate: -13deg;
  fill: var(--stitch-artwork-swatch-f43f5e, var(--stitch-danger-ink));
  stroke: var(--stitch-surface);
  stroke-width: 1.5;
  pointer-events: none;
}
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
.is-weak {
  color: var(--stitch-artwork-swatch-8edcff, lightblue);
}
</style>
