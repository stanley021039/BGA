<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import type { GachaResult } from '../contracts/gacha';
import BarrageFrames from '../engines/barrage-frames.js';
import AudioSettings from '../engines/audio-settings.js';
import MotionPolicy from '../engines/motion-policy.js';
import { watchMotionCancellation } from '../services/motion-lifetime.js';
import FramePreview from './FramePreview.vue';
import GachaRewardThumbnail from './GachaRewardThumbnail.vue';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import UiChoiceCard from './UiChoiceCard.vue';
import UiHeading from './UiHeading.vue';
import UiIcon from './UiIcon.vue';
import UiPanel from './UiPanel.vue';

const props = defineProps<{
  item?: GachaResult;
  rarityHint?: 'epic' | 'legendary';
  prominent?: boolean;
  number: number;
  compact?: boolean;
  active?: boolean;
  motionEnabled?: boolean;
  spectator?: boolean;
}>();
const emit = defineEmits<{ playVoice: [item: GachaResult]; reveal: [] }>();
const glint = ref<HTMLElement | null>(null);
let pulse: Animation | null = null;
let glintTimer: ReturnType<typeof setTimeout> | undefined;
let glintSound: HTMLAudioElement | undefined;
let releaseMotion: (() => void) | undefined;
let hovering = false;
const pulseMs = 980;
function stopGlint() {
  clearTimeout(glintTimer);
  releaseMotion?.();
  releaseMotion = undefined;
  AudioSettings?.stopEffect(glintSound);
  glintSound = undefined;
  pulse?.cancel();
  pulse = null;
}
function scheduleGlintSound(animation: Animation, peak: number) {
  const elapsed = Number(animation.currentTime) || 0;
  glintTimer = setTimeout(
    () => {
      if (pulse !== animation) return;
      glintSound = AudioSettings?.playEffect?.('gacha-glint');
      if (hovering) {
        const elapsed = Number(animation.currentTime) || peak;
        const nextPeak = peak + pulseMs * Math.max(1, Math.floor((elapsed - peak) / pulseMs) + 1);
        scheduleGlintSound(animation, nextPeak);
      }
    },
    Math.max(0, peak - elapsed),
  );
}
function playGlint(event: PointerEvent | FocusEvent) {
  if (!props.rarityHint || !props.motionEnabled || props.item) return;
  if (event.type === 'pointerenter') {
    if ((event as PointerEvent).pointerType === 'touch') return;
    hovering = true;
  } else if (
    hovering ||
    !(event.target instanceof Element && event.target.matches(':focus-visible'))
  )
    return;
  stopGlint();
  pulse =
    MotionPolicy?.animate(
      glint.value,
      [{ opacity: 0.16 }, { opacity: 1, offset: 0.5 }, { opacity: 0.16 }],
      { duration: pulseMs, easing: 'ease-in-out', iterations: hovering ? Infinity : 1 },
    ) ?? null;
  const animation = pulse;
  if (animation) {
    releaseMotion = watchMotionCancellation(stopGlint);
    void animation.ready
      .then(() => {
        if (pulse === animation) scheduleGlintSound(animation, pulseMs / 2);
      })
      .catch(() => {});
  }
}
function leaveGlint(event: PointerEvent | FocusEvent) {
  if (event.type === 'pointerleave') hovering = false;
  if (!hovering) stopGlint();
}
function flip() {
  hovering = false;
  stopGlint();
  emit('reveal');
}
onBeforeUnmount(stopGlint);
const previewFrames = new Set(BarrageFrames.options.map(({ id }: { id: string }) => id));
const kinds = {
  attacks: '攻擊招式',
  entrances: '進場特效',
  backgrounds: '大廳背景',
  frames: '彈幕框',
  media: '播放器風格',
  sounds: '標記語音',
};
const rarityTone = { legendary: 'primary', epic: 'epic', rare: 'info', common: 'neutral' } as const;
</script>

<template>
  <UiPanel
    tone="raised"
    density="compact"
    class="gacha-reward-card"
    :class="{
      'is-compact': compact,
      'is-prominent': prominent,
      'is-active': active,
      'is-face-down': !item,
      'has-motion': motionEnabled,
    }"
    :data-rarity="item?.rarity"
    :data-rarity-hint="item ? undefined : rarityHint"
    @pointerenter="playGlint"
    @pointerleave="leaveGlint"
  >
    <div v-if="item" class="gacha-card-content">
      <span class="gacha-card-number">第 {{ number }} 張</span>
      <div
        class="gacha-reward-art"
        :data-kind="item.kind"
        :aria-hidden="item.kind === 'sounds' ? undefined : true"
      >
        <UiHeading
          v-if="item.kind === 'sounds'"
          class="gacha-card-voice-name"
          :level="3"
          kind="card"
          :card-size="prominent ? 'page' : 'section'"
        >
          {{ item.label }}
        </UiHeading>
        <FramePreview
          v-else-if="
            (item.kind === 'frames' || item.kind === 'media') && previewFrames.has(item.id)
          "
          class="game-barrage-static"
          :frame="item.id"
          :kind="item.kind === 'media' ? 'media' : 'barrage'"
          :lines="[item.label]"
        />
        <GachaRewardThumbnail v-else :kind="item.kind" :effect="item.id" :compact="compact" />
      </div>
      <UiHeading
        v-if="item.kind !== 'sounds'"
        :level="3"
        kind="card"
        :card-size="compact ? undefined : 'section'"
      >
        {{ item.label }}
      </UiHeading>
      <div class="gacha-card-badges">
        <UiBadge :tone="rarityTone[item.rarity]">{{ item.rarityLabel }}</UiBadge>
        <UiBadge :tone="item.duplicate ? 'neutral' : 'success'">
          {{ item.duplicate ? '重複 +' + item.fragments + ' 片' : '新獲得' }}
        </UiBadge>
      </div>
      <span v-if="item.kind !== 'sounds'" class="gacha-card-kind">{{ kinds[item.kind] }}</span>
      <UiButton
        v-else-if="!spectator"
        icon="sound"
        :label="'播放語音 ' + item.label"
        caption="播放語音"
        @click="emit('playVoice', item)"
      />
    </div>
    <div v-else class="gacha-card-trigger">
      <UiChoiceCard
        class="gacha-card-hit-area"
        :label="'翻開第 ' + number + ' 張'"
        action
        image-only
        @focus="playGlint"
        @blur="leaveGlint"
        @click="flip"
      >
        <span class="gacha-card-back" aria-hidden="true">
          <svg
            class="gacha-card-engraving"
            viewBox="0 0 240 280"
            preserveAspectRatio="none"
            focusable="false"
          >
            <path
              d="M120 14 224 70V210L120 266 16 210V70Z M120 35 204 81V199L120 245 36 199V81Z M120 55 186 91V189L120 225 54 189V91Z M120 75 167 103V177L120 205 73 177V103Z"
            />
            <path
              d="M24 42V24H51 M189 24H216V42 M24 238V256H51 M189 256H216V238 M24 57 56 39 M216 57 184 39 M24 223 56 241 M216 223 184 241 M36 140H82 M158 140H204 M120 35V80 M120 200V245"
            />
            <path
              class="gacha-card-filigree"
              d="M120 42 130 54 120 66 110 54Z M120 214 130 226 120 238 110 226Z M44 140 54 128 64 140 54 152Z M176 140 186 128 196 140 186 152Z"
            />
          </svg>
          <span class="gacha-card-number">第 {{ number }} 張</span>
          <span class="gacha-card-seal"><UiIcon name="cards" /></span>
        </span>
      </UiChoiceCard>
      <span ref="glint" class="gacha-card-glint" aria-hidden="true" />
    </div>
  </UiPanel>
</template>

<style scoped>
.gacha-reward-card {
  --gacha-card-glow: var(--stitch-artwork-preview-ink);
  --gacha-card-glow-size: var(--stitch-space-16);
  --gacha-card-back-glow: var(--stitch-artwork-swatch-60a5fa);
  min-inline-size: 0;
  min-block-size: 19rem;
  text-align: center;
  overflow-wrap: anywhere;
  position: relative;
  isolation: isolate;
  -webkit-user-select: none;
  user-select: none;
}
.gacha-reward-card[data-rarity-hint] {
  --gacha-card-back-glow: var(--stitch-artwork-swatch-c084fc);
}
.gacha-card-trigger {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.gacha-card-hit-area {
  inline-size: 100%;
  block-size: 100%;
  cursor: pointer;
}
.gacha-card-glint {
  position: absolute;
  z-index: 1;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 var(--stitch-space-2) var(--gacha-card-back-glow),
    inset 0 0 var(--stitch-space-16) var(--gacha-card-back-glow),
    0 0 var(--stitch-space-12) var(--gacha-card-back-glow);
  opacity: 0.4;
  pointer-events: none;
}
.gacha-reward-card[data-rarity-hint] .gacha-card-glint {
  opacity: 0.16;
  box-shadow:
    inset 0 0 0 var(--stitch-space-2) var(--gacha-card-back-glow),
    inset 0 0 var(--stitch-space-32) var(--gacha-card-back-glow),
    0 0 var(--stitch-space-32) var(--gacha-card-back-glow);
}
.gacha-reward-card.is-prominent[data-rarity-hint] .gacha-card-glint::before,
.gacha-reward-card.is-prominent[data-rarity-hint] .gacha-card-glint::after {
  content: '';
  position: absolute;
  inset-block: 4%;
  inline-size: min(27vw, 25rem);
  pointer-events: none;
  color: var(--gacha-card-back-glow);
  background:
    radial-gradient(circle at 46% 28%, var(--stitch-artwork-preview-ink) 0 1px, transparent 5px),
    radial-gradient(circle at 23% 51%, currentColor 0 2px, transparent 6px),
    radial-gradient(circle at 64% 68%, var(--stitch-artwork-preview-ink) 0 1px, transparent 5px),
    radial-gradient(circle at 50% 79%, currentColor 0 1px, transparent 5px),
    conic-gradient(
      from 251deg at right center,
      transparent 0deg 4deg,
      currentColor 5deg,
      transparent 6deg 12deg,
      currentColor 14deg,
      transparent 16deg 26deg,
      currentColor 27deg,
      transparent 28deg 37deg,
      currentColor 38deg,
      transparent 40deg
    ),
    radial-gradient(ellipse at right center, currentColor, transparent 70%);
  mask-image: radial-gradient(
    ellipse 100% 58% at right center,
    var(--stitch-artwork-preview-ink),
    transparent
  );
}
.gacha-reward-card.is-prominent[data-rarity-hint] .gacha-card-glint::before {
  inset-inline-end: 100%;
}
.gacha-reward-card.is-prominent[data-rarity-hint] .gacha-card-glint::after {
  inset-inline-start: 100%;
  transform: scaleX(-1);
}
@media (max-width: 820px) {
  .gacha-reward-card.is-prominent[data-rarity-hint] .gacha-card-glint::before,
  .gacha-reward-card.is-prominent[data-rarity-hint] .gacha-card-glint::after {
    inline-size: min(5vw, var(--stitch-space-16));
  }
}
.gacha-reward-card:has(:focus-visible) .gacha-card-glint,
.gacha-reward-card:active .gacha-card-glint {
  opacity: 1;
}
@media (hover: hover) {
  .gacha-reward-card:hover .gacha-card-glint {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .gacha-reward-card.is-face-down.has-motion {
    transition: transform var(--stitch-transition);
  }
  .gacha-reward-card.has-motion:not([data-rarity-hint]) .gacha-card-glint {
    transition: opacity var(--stitch-transition);
  }
  .gacha-reward-card.is-face-down.has-motion:has(:focus-visible) {
    z-index: 1;
    transform: scale(1.08);
  }
}
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .gacha-reward-card.is-face-down.has-motion:hover {
    z-index: 1;
    transform: scale(1.08);
  }
}
.gacha-card-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  align-items: center;
  gap: var(--stitch-space-12);
  min-inline-size: 0;
}
.gacha-reward-card.is-compact {
  min-block-size: clamp(15rem, 30dvh, 19rem);
}
.gacha-reward-card.is-prominent {
  min-block-size: clamp(17rem, 58dvh, 35rem);
  display: grid;
  align-items: center;
}
.is-prominent .gacha-reward-art {
  inline-size: min(100%, 24rem);
}
.is-prominent .gacha-card-content {
  gap: var(--stitch-gap-controls);
}
.is-prominent .gacha-reward-art :deep(.gacha-reward-thumbnail) {
  inline-size: 100%;
}
.is-compact .gacha-card-content {
  gap: var(--stitch-space-8);
}
.gacha-reward-card[data-rarity='rare'] {
  --gacha-card-glow: var(--stitch-artwork-swatch-60a5fa);
  --gacha-card-glow-size: var(--stitch-space-24);
}
.gacha-reward-card[data-rarity='epic'] {
  --gacha-card-glow: var(--stitch-artwork-swatch-c084fc);
  --gacha-card-glow-size: var(--stitch-space-24);
}
.gacha-reward-card[data-rarity='legendary'] {
  --gacha-card-glow: var(--stitch-primary);
  --gacha-card-glow-size: var(--stitch-space-32);
}
.gacha-reward-card[data-rarity]::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: var(--stitch-space-4);
  border: var(--stitch-border);
  border-color: color-mix(in srgb, var(--gacha-card-glow) 30%, transparent);
  border-radius: var(--stitch-radius-panel);
  background: linear-gradient(
    color-mix(in srgb, var(--gacha-card-glow) 12%, transparent),
    transparent 60%
  );
  pointer-events: none;
}
.gacha-reward-card.is-active.has-motion {
  animation: gacha-card-arrive 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.gacha-card-number,
.gacha-card-kind {
  color: var(--stitch-muted);
  font-size: var(--stitch-text-hint);
}
.gacha-reward-card:not(.is-compact) .gacha-card-kind {
  font-size: var(--stitch-text-body);
}
.gacha-reward-art {
  display: grid;
  place-items: center;
  inline-size: min(100%, 192px);
  aspect-ratio: 16 / 9;
  border-radius: var(--stitch-radius-panel);
  background: var(--stitch-artwork-preview-bg);
  color: var(--gacha-card-glow);
  box-shadow: 0 0 var(--gacha-card-glow-size) color-mix(in srgb, currentColor 38%, transparent);
}
.gacha-reward-art[data-kind='entrances'] {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.is-compact .gacha-reward-art {
  inline-size: min(100%, 160px);
}
.gacha-reward-art .gacha-card-voice-name {
  margin-inline: var(--stitch-space-8);
  color: var(--stitch-artwork-preview-ink);
}
.gacha-reward-art :deep(.vue-frame-preview-viewport) {
  block-size: 100%;
}
.gacha-card-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--stitch-space-8);
}
.gacha-card-back {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: center;
  padding: var(--stitch-space-12);
  flex: 1;
  border-radius: inherit;
  background:
    radial-gradient(ellipse at 50% 45%, var(--stitch-link) -90%, transparent 64%),
    repeating-linear-gradient(
      125deg,
      color-mix(in srgb, var(--stitch-primary) 10%, transparent) 0 var(--stitch-space-2),
      transparent var(--stitch-space-2) var(--stitch-space-8)
    ),
    var(--stitch-artwork-preview-bg);
}
.gacha-card-back::before {
  content: '';
  position: absolute;
  inset: var(--stitch-space-8);
  border: var(--stitch-border);
  border-color: color-mix(in srgb, var(--stitch-primary) 66%, transparent);
  border-radius: var(--stitch-radius-control);
  pointer-events: none;
}
.gacha-card-back .gacha-card-number {
  z-index: 1;
  color: var(--stitch-artwork-preview-ink);
  text-align: center;
}
.gacha-card-engraving {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  color: color-mix(in srgb, var(--stitch-primary) 50%, transparent);
  fill: none;
  stroke: currentColor;
  stroke-width: 0.9;
  pointer-events: none;
}
.gacha-card-filigree {
  fill: currentColor;
}
.gacha-card-seal {
  z-index: 1;
  place-self: center;
  display: grid;
  place-items: center;
  inline-size: min(80%, 5rem);
  aspect-ratio: 1;
  border: var(--stitch-border-strong);
  border-color: var(--stitch-primary);
  border-radius: var(--stitch-radius-pill);
  color: var(--stitch-primary);
  background: var(--stitch-artwork-preview-bg);
  box-shadow:
    0 0 0 var(--stitch-space-4) color-mix(in srgb, currentColor 26%, transparent),
    inset 0 0 var(--stitch-space-8) color-mix(in srgb, currentColor 42%, transparent),
    0 0 var(--stitch-space-16) color-mix(in srgb, currentColor 35%, transparent);
}
.gacha-card-seal :deep(svg) {
  inline-size: clamp(var(--stitch-icon-size), 3.5vw, var(--stitch-space-40));
  block-size: auto;
  aspect-ratio: 1;
}
@media (max-width: 640px) {
  .gacha-reward-card.is-compact {
    min-block-size: 13rem;
  }
}
@keyframes gacha-card-arrive {
  from {
    opacity: 0;
    transform: translateY(0.65rem) scale(0.96);
  }
  60% {
    box-shadow: 0 0 var(--gacha-card-glow-size) var(--gacha-card-glow);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gacha-reward-card.is-active.has-motion {
    animation: none;
  }
}
</style>
