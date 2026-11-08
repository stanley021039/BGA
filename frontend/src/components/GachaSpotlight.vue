<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { GachaItem } from '../contracts/gacha';
import { entranceVariant, isEntranceEffect } from '../services/entrance-effects';
import { motionAllowed, watchMotionCancellation } from '../services/motion-lifetime.js';
import AudioSettings from '../engines/audio-settings.js';
import AttackArtwork from './AttackArtwork.vue';
import EntrancePreview from './EntrancePreview.vue';
import FramePreview from './FramePreview.vue';
import GachaRewardThumbnail from './GachaRewardThumbnail.vue';
import LobbyBackgroundArt from './LobbyBackgroundArt.vue';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import UiHeading from './UiHeading.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{
  item: GachaItem;
  name: string;
  image: string;
  area: boolean;
  attackId?: string;
  preview?: boolean;
  spectator?: boolean;
  elapsedMs?: number;
}>();
const emit = defineEmits<{ close: []; voice: [item: GachaItem]; silence: [] }>();
const moving = ref(false),
  showing = ref(false),
  replay = ref(0),
  stage = ref<HTMLElement | null>(null),
  back = ref<InstanceType<typeof UiButton> | null>(null);
const tones = { legendary: 'primary', epic: 'epic', rare: 'info', common: 'neutral' } as const;
const entrance = computed(() =>
  props.item.kind === 'entrances' && isEntranceEffect(props.item.id) ? props.item.id : undefined,
);
const attackChants: Partial<Record<string, readonly [string, string]>> = {
  explosion: ['將火光壓進最後一點。', '讓一瞬的焰，撼動整片大地。'],
  guanyin_barrage: ['一念定心，百掌隨形。', '此間萬物，臣服於我掌下。'],
  solar_phoenix: ['灰燼尚暖，火翼未熄。', '越過長夜，把天穹點燃。'],
  dimension_cleave: ['循著鱗紋，找出空間的縫隙。', '兩道流光交錯，連天幕也一同裂開。'],
  bijuu_beam: ['讓狂湧的力量聚成一點。', '三道洪流，從此處貫穿戰場。'],
  giga_drill: ['螺旋加速，凝成鑽鋒。', '向著無垠盡頭，貫穿天際吧。'],
  gate_of_babylon: ['金門列陣，諸兵聽令。', '以天地為鞘，喚醒最初之劍。'],
  excalibur: ['風幕退去，露出劍鋒。', '聚萬千星光，為信念開路。'],
  giant_orange_cat: ['地上的影子，怎麼愈來愈大？', '讓一雙肉墊，撼動整片戰場。'],
  shaohua_devour: ['聞到獵物的氣息了。', '有什麼巨獸，正從暗處靠近'],
  reaper_seal: ['以絲絲的黑線，換那道門開啟。', '伸出手來，把未竟之事一併封存。'],
  gate_of_heroes: ['以萬丈光芒，點亮此座標。', '跨過門扉，讓落地的震聲響徹戰場。'],
};
const rewardChants: Partial<Record<string, readonly [string, string]>> = {
  'frames:mask': ['藏起真容，讓下一副面孔登場。', '字句掠過，滿座都是戲。'],
  'frames:dragon': ['舊金在餘燼裡閃動。', '讓每一行字，拖著一尾火光飛過。'],
  'frames:royal': ['帷幕拉開，讓燈光追上來。', '今晚的台詞，由你寫在半空。'],
  'media:triform': ['第一筆畫出軌跡，第二筆喚醒星光。', '第三筆落下，整座宇宙隨節拍轉動。'],
  'media:dragon': ['深處傳來低鳴，火心隨拍跳動。', '讓鼓聲掀開石門，照亮沉睡的金庫。'],
  'media:royal': ['席間燈火漸暗，樂池亮起。', '聽，那是整座劇院為你奏響的序曲。'],
  'sounds:ping-voice-amazing': ['滿場屏息，只等這一刻。', '把忍不住的情緒，爆出來吧！'],
  'sounds:ping-voice-gay-club': ['門後的節拍，已經響了三次。', '這是屬於甲方復權的時刻。'],
  'sounds:ping-voice-butt-party': ['把燈調暗一點', '後門一關，美味蜜汁即將上桌。'],
  'sounds:ping-voice-card-check': ['這不可能啊。', '這一手到底藏了什麼？翻開！'],
  'sounds:ping-voice-senior': ['走廊盡頭，傳來熟悉的紅茶。', '別回頭，前輩已經到了。'],
  'entrances:stitch-senbonzakura': ['刀鋒隨風散落。', '千瓣櫻花，為我開路。'],
  'entrances:stitch-black-coffin': ['隱隱透出渾濁的紋章，爬行的鐵之公主。', '知曉自身的無力吧！'],
  'entrances:stitch-stand-time': ['連一粒塵埃也停在半空。', '在時間追上來以前，我已到了。'],
  'entrances:stitch-chibaku-tensei': ['碎石浮起，地平線開始彎折。', '萬物歸向一點，天星自此成形。'],
  'backgrounds:aurora': ['風雪停歇，群峰沒入深夜。', '天邊升起流光，整片雪地跟著亮了。'],
};
const shaohua = computed(() => props.attackId === 'shaohua_devour');
const chant = computed(() => {
  if (props.attackId && attackChants[props.attackId]) return attackChants[props.attackId];
  const variant = entrance.value && entranceVariant(entrance.value);
  return rewardChants[variant ? 'entrances:' + variant.variantOf : props.item.key];
});
const chantMs = 6800;
const showcaseMs = 4880;
const chantCues = [
  'gacha-chant-you-say-run',
  'gacha-chant-il-vento-doro',
  'gacha-chant-attack-on-titan',
  'gacha-chant-swordland',
  'gacha-chant-unicorn',
] as const;
let transition: ReturnType<typeof setTimeout> | undefined;
let end: ReturnType<typeof setTimeout> | undefined;
let release: (() => void) | undefined;
let chantMusic: HTMLAudioElement | undefined;

function stopChantMusic() {
  AudioSettings?.stopEffect(chantMusic);
  chantMusic = undefined;
}

function showReward() {
  showing.value = true;
  void nextTick(() => {
    if (document.activeElement === stage.value) back.value?.$el.focus({ preventScroll: true });
  });
}
function playVoice() {
  stopChantMusic();
  emit('voice', props.item);
}

function stopMotion() {
  clearTimeout(transition);
  clearTimeout(end);
  stopChantMusic();
  moving.value = false;
  showReward();
  emit('silence');
}

onMounted(() => {
  if (!props.spectator) stage.value?.focus({ preventScroll: true });
  if (!motionAllowed()) {
    showReward();
    return;
  }
  moving.value = true;
  if (props.preview) {
    showReward();
    release = watchMotionCancellation(stopMotion);
    return;
  }
  if (chant.value) {
    const elapsed = props.elapsedMs ?? 0;
    if (elapsed >= chantMs) showReward();
    else {
      if (elapsed < 600) {
        const cue = chantCues[Math.floor(Math.random() * chantCues.length)];
        if (cue) chantMusic = AudioSettings?.playEffect?.(cue);
      }
      transition = setTimeout(showReward, chantMs - elapsed);
    }
  } else {
    showReward();
  }
  if (!props.spectator)
    end = setTimeout(() => emit('close'), showcaseMs + (chant.value ? chantMs : 0));
  release = watchMotionCancellation(stopMotion);
});
onBeforeUnmount(() => {
  clearTimeout(transition);
  clearTimeout(end);
  stopChantMusic();
  release?.();
});
</script>

<template>
  <section class="gacha-spotlight" :class="{ 'is-moving': moving }" :data-rarity="item.rarity">
    <div class="gacha-spotlight-title" role="status">
      <template v-if="showing">
        <div class="gacha-spotlight-badges">
          <UiBadge :tone="tones[item.rarity]">{{ item.rarityLabel }}</UiBadge>
          <UiBadge v-if="area">多人招式</UiBadge>
        </div>
        <UiHeading :level="2" kind="card">{{ item.label }}</UiHeading>
      </template>
    </div>
    <div
      ref="stage"
      class="gacha-spotlight-stage"
      :aria-label="showing ? item.label + '效果演示' : '獎品演出'"
      role="group"
      tabindex="-1"
    >
      <span
        v-if="moving && !showing && chant"
        class="gacha-spotlight-ring"
        :style="{ animationDuration: `${chantMs}ms` }"
        aria-hidden="true"
      />
      <p
        v-if="moving && !showing && chant"
        class="gacha-spotlight-chant"
        :style="{ '--chant-offset': `-${elapsedMs ?? 0}ms` }"
      >
        <span>{{ chant[0] }}</span>
        <span>{{ chant[1] }}</span>
      </p>
      <div v-if="showing" :key="replay" class="gacha-spotlight-art">
        <span v-if="moving && shaohua" class="gacha-spotlight-target" aria-hidden="true"
          ><UiIcon name="users"
        /></span>
        <AttackArtwork
          v-if="moving && item.kind === 'attacks'"
          :effect="item.id"
          :play-key="item.key"
        />
        <EntrancePreview
          v-else-if="moving && entrance"
          :effect="entrance"
          :image="image || '/assets/characters/traveler-neutral.png'"
          :name="name"
          :size="128"
        />
        <LobbyBackgroundArt v-else-if="moving && item.kind === 'backgrounds'" :id="item.id" />
        <FramePreview
          v-else-if="item.kind === 'frames' || item.kind === 'media'"
          :class="{ 'game-barrage-static': !moving }"
          :frame="item.id"
          :kind="item.kind === 'media' ? 'media' : 'barrage'"
          :name="name"
          :message="item.label"
        />
        <UiIcon v-else-if="item.kind === 'sounds'" name="sound" class="gacha-spotlight-voice" />
        <GachaRewardThumbnail v-else :kind="item.kind" :effect="item.id" />
      </div>
    </div>
    <div class="gacha-spotlight-actions">
      <UiButton
        v-if="
          preview && moving && (item.kind === 'attacks' || entrance || item.kind === 'backgrounds')
        "
        label="重播特效"
        icon="replay"
        @click="replay++"
      />
      <UiButton
        v-if="item.kind === 'sounds' && showing && !spectator"
        label="播放語音"
        icon="sound"
        @click="playVoice"
      />
      <UiButton
        v-if="showing && !spectator"
        ref="back"
        :label="preview ? '關閉預覽' : '返回卡片'"
        variant="primary"
        @click="emit('close')"
      />
    </div>
  </section>
</template>

<style scoped>
.gacha-spotlight {
  --gacha-spotlight-color: var(--stitch-artwork-swatch-60a5fa);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--stitch-space-16);
  inline-size: min(100%, 76rem);
  block-size: 100%;
  margin-inline: auto;
}
.gacha-spotlight[data-rarity='epic'] {
  --gacha-spotlight-color: var(--stitch-artwork-swatch-c084fc);
}
.gacha-spotlight[data-rarity='legendary'] {
  --gacha-spotlight-color: var(--stitch-primary);
}
.gacha-spotlight-title {
  display: grid;
  justify-items: center;
  gap: var(--stitch-space-8);
  text-align: center;
  overflow-wrap: anywhere;
  min-block-size: calc(var(--stitch-space-48) + var(--stitch-space-16));
}
.gacha-spotlight-title :deep(.ui-heading[data-kind='card']) {
  font-size: var(--stitch-text-page);
}
.gacha-spotlight-badges,
.gacha-spotlight-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--stitch-gap-controls);
}
.gacha-spotlight-actions {
  min-block-size: var(--stitch-control-height);
}
.gacha-spotlight-stage {
  position: relative;
  display: grid;
  place-items: center;
  isolation: isolate;
  overflow: hidden;
  border: var(--stitch-border);
  border-radius: var(--stitch-radius-panel);
  color: var(--stitch-artwork-preview-ink);
  background:
    radial-gradient(
      ellipse at center,
      color-mix(in srgb, var(--gacha-spotlight-color) 30%, transparent),
      transparent 65%
    ),
    var(--stitch-artwork-preview-bg);
}
.gacha-spotlight-ring {
  grid-area: 1 / 1;
  inline-size: min(70%, 23rem);
  aspect-ratio: 1;
  border: var(--stitch-border-strong);
  border-color: var(--gacha-spotlight-color);
  border-radius: var(--stitch-radius-pill);
  box-shadow:
    inset 0 0 var(--stitch-space-32) var(--gacha-spotlight-color),
    0 0 var(--stitch-space-48) var(--gacha-spotlight-color);
  animation: gacha-ring-open ease-out both;
}
.gacha-spotlight-chant {
  grid-area: 1 / 1;
  z-index: 1;
  display: grid;
  gap: var(--stitch-space-12);
  margin: var(--stitch-space-16);
  font-size: clamp(var(--stitch-text-body), 3vw, var(--stitch-text-page));
  font-weight: var(--stitch-weight-title);
  text-align: center;
}
.gacha-spotlight-chant span {
  animation: gacha-chant-appear 850ms ease-out both;
  animation-delay: var(--chant-offset, 0ms);
}
.gacha-spotlight-chant span + span {
  animation-delay: calc(3900ms + var(--chant-offset, 0ms));
}
.gacha-spotlight-art {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.is-moving .gacha-spotlight-art {
  animation: gacha-art-appear 400ms ease-out both;
}
.gacha-spotlight-art :deep(.vue-frame-preview-viewport) {
  inline-size: min(96%, 38rem);
  block-size: min(90%, 22rem);
}
.gacha-spotlight-art :deep(.entrance-preview) {
  inline-size: min(100%, 44rem);
}
.gacha-spotlight-art :deep(.entrance-stage) {
  block-size: clamp(9rem, 44dvh, 25rem);
}
.gacha-spotlight-voice {
  color: var(--gacha-spotlight-color);
}
.gacha-spotlight-voice :deep(svg) {
  inline-size: var(--stitch-space-48);
  block-size: var(--stitch-space-48);
}
.gacha-spotlight-target {
  position: absolute;
  inset: 50% auto auto 58%;
  display: grid;
  place-items: center;
  inline-size: var(--stitch-control-height);
  aspect-ratio: 1;
  color: var(--stitch-artwork-preview-ink);
  border: var(--stitch-border-strong);
  border-color: currentColor;
  border-radius: var(--stitch-radius-pill);
  transform: translate(-50%, -50%);
  opacity: 0.8;
  /* Match the tracking demo's contact and bite in createNewAttack. */
  animation: gacha-target-swallow 400ms ease-in 2200ms forwards;
}
@keyframes gacha-target-swallow {
  to {
    transform: translate(-80%, -10%) scale(0.08);
    opacity: 0;
  }
}
@keyframes gacha-ring-open {
  from {
    transform: scale(0.22);
    opacity: 0.25;
  }
  85% {
    transform: scale(0.65);
    opacity: 0.75;
  }
  93% {
    transform: scale(0.95);
    opacity: 1;
  }
  to {
    transform: scale(1.7);
    opacity: 0;
  }
}
@keyframes gacha-art-appear {
  from {
    opacity: 0.2;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes gacha-chant-appear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gacha-spotlight-ring,
  .gacha-spotlight-target,
  .gacha-spotlight-chant span,
  .is-moving .gacha-spotlight-art {
    animation: none;
  }
}
</style>
