<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GachaItem } from '../contracts/gacha';
import MotionPolicy from '../engines/motion-policy.js';
import { isEntranceEffect } from '../services/entrance-effects';
import { motionAllowed } from '../services/motion-lifetime.js';
import AttackArtwork from './AttackArtwork.vue';
import EntrancePreview from './EntrancePreview.vue';
import FramePreview from './FramePreview.vue';
import GachaRewardThumbnail from './GachaRewardThumbnail.vue';
import LobbyBackgroundArt from './LobbyBackgroundArt.vue';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import UiHeading from './UiHeading.vue';

const props = defineProps<{
  pool: string;
  items: readonly GachaItem[];
  blocked: boolean;
  name: string;
  image?: string;
}>();
const emit = defineEmits<{ playVoice: [GachaItem] }>();
const kinds = {
  attacks: '攻擊招式',
  entrances: '進場特效',
  backgrounds: '大廳背景',
  frames: '彈幕框',
  media: '播放器風格',
  sounds: '標記語音',
};
const tones = { legendary: 'primary', epic: 'epic', rare: 'info', common: 'neutral' } as const;
const stage = ref<HTMLElement | null>(null);
const index = ref(0),
  replay = ref(0);
const visible = ref(false),
  motion = ref(false);
const item = computed(() => props.items[index.value]);
const entrance = computed(() => {
  const id = item.value?.kind === 'entrances' ? item.value.id : '';
  return isEntranceEffect(id) ? id : undefined;
});
const playable = computed(() => visible.value && motion.value && !props.blocked);
const rotating = computed(() => playable.value && props.items.length > 1);
let observer: IntersectionObserver | undefined;
let unsubscribe: (() => void) | undefined;

function step(delta: number) {
  const count = props.items.length;
  if (count) index.value = (index.value + delta + count) % count;
}
function stopMotion() {
  motion.value = false;
}
function syncMotion() {
  motion.value = motionAllowed();
}
watch(
  () => props.pool,
  () => {
    index.value = 0;
  },
);
watch(
  () => props.items.length,
  (count) => {
    if (index.value >= count) index.value = 0;
  },
);
watch(
  stage,
  (element) => {
    observer?.disconnect();
    if (element) observer?.observe(element);
  },
  { flush: 'post' },
);
watch([rotating, () => props.pool, index, replay], ([enabled], _, onCleanup) => {
  if (!enabled) return;
  const timer = setTimeout(() => step(1), 5500);
  onCleanup(() => clearTimeout(timer));
});
onMounted(() => {
  syncMotion();
  unsubscribe = MotionPolicy?.subscribe(syncMotion);
  window.addEventListener('pagehide', stopMotion);
  window.addEventListener('pageshow', syncMotion);
  if (typeof IntersectionObserver !== 'function') {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      visible.value = (entry?.intersectionRatio ?? 0) >= 0.2;
    },
    { threshold: 0.2 },
  );
  if (stage.value) observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  unsubscribe?.();
  window.removeEventListener('pagehide', stopMotion);
  window.removeEventListener('pageshow', syncMotion);
});
</script>

<template>
  <div v-if="item" class="gacha-feature" role="group" aria-label="卡池特效展示">
    <div class="gacha-feature-copy">
      <div class="gacha-feature-controls">
        <UiBadge :tone="tones[item.rarity]">{{ item.rarityLabel }}・{{ kinds[item.kind] }}</UiBadge>
        <UiBadge v-if="item.owned" tone="success">已擁有</UiBadge>
      </div>
      <UiHeading :level="2">{{ item.label }}</UiHeading>
      <div class="gacha-feature-controls" v-if="items.length > 1">
        <UiButton label="上一個展示" icon="previous" icon-only @click="step(-1)" />
        <span>{{ index + 1 }} / {{ items.length }}</span>
        <UiButton label="下一個展示" icon="next" icon-only @click="step(1)" />
      </div>
      <UiButton
        v-if="item.kind === 'attacks' || entrance"
        label="重播特效"
        icon="replay"
        :disabled="!motion"
        @click="replay++"
      />
      <UiButton
        v-else-if="item.kind === 'sounds' && item.owned"
        label="播放語音"
        icon="sound"
        @click="emit('playVoice', item)"
      />
    </div>
    <div ref="stage" class="gacha-feature-art" :aria-label="item.label + '展示'">
      <FramePreview
        v-if="item.kind === 'frames' || item.kind === 'media'"
        :frame="item.id"
        :kind="item.kind === 'media' ? 'media' : 'barrage'"
      />
      <EntrancePreview
        v-else-if="playable && entrance && image"
        :key="item.key + ':' + replay"
        :effect="entrance"
        frameless
        :image="image"
        :name="name"
        :size="128"
      />
      <AttackArtwork
        v-else-if="playable && item.kind === 'attacks'"
        :key="item.key"
        :effect="item.id"
        :play-key="replay"
      />
      <LobbyBackgroundArt v-else-if="playable && item.kind === 'backgrounds'" :id="item.id" />
      <UiHeading v-else-if="item.kind === 'sounds'" :level="3" kind="card" card-size="page">
        {{ item.label }}
      </UiHeading>
      <GachaRewardThumbnail v-else :kind="item.kind" :effect="item.id" />
    </div>
  </div>
</template>

<style scoped>
.gacha-feature {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(0, 1.5fr);
  align-items: center;
  gap: var(--stitch-gap-panel);
}
.gacha-feature-copy {
  display: grid;
  grid-template-rows: auto minmax(3em, auto);
  justify-items: start;
  align-items: center;
  gap: var(--stitch-gap-controls);
  min-inline-size: 0;
}
.gacha-feature-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--stitch-space-8);
  font-variant-numeric: tabular-nums;
}
.gacha-feature-art {
  position: relative;
  display: grid;
  place-items: center;
  block-size: 22rem;
  min-inline-size: 0;
  overflow: hidden;
}
@media (max-width: 800px) {
  .gacha-feature {
    grid-template-columns: minmax(0, 1fr);
  }
  .gacha-feature-art {
    block-size: 16rem;
  }
}
</style>
