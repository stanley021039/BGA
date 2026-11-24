<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { isEntranceEffect } from '../services/entrance-effects';
import { motionAllowed, watchMotionCancellation } from '../services/motion-lifetime.js';
import AttackArtwork from './AttackArtwork.vue';
import EntrancePreview from './EntrancePreview.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{
  kind: 'attacks' | 'entrances';
  effect: string;
  active: boolean;
  playKey: string | number;
  image?: string;
  name?: string;
}>();
const prefs = usePreferencesStore();
const disabledMotion = computed(
  () => prefs.motion?.enabled === false || prefs.motion?.reduced === true,
);
const playing = ref(false);
const entrance = computed(() => props.kind === 'entrances' && isEntranceEffect(props.effect));
let release: (() => void) | undefined;
function stop() {
  playing.value = false;
  release?.();
  release = undefined;
}
function play() {
  stop();
  if (
    !props.active ||
    prefs.motion?.enabled === false ||
    prefs.motion?.reduced === true ||
    !motionAllowed()
  )
    return;
  playing.value = true;
  release = watchMotionCancellation(stop);
}
onMounted(play);
watch([() => props.active, () => props.effect, () => props.playKey], play);
watch(
  () => [prefs.motion?.enabled, prefs.motion?.reduced],
  () => {
    if (prefs.motion?.enabled === false || prefs.motion?.reduced === true) stop();
  },
);
onBeforeUnmount(stop);
</script>

<template>
  <div
    class="gacha-live-effect"
    :data-effect="effect"
    :data-playing="playing || undefined"
    @click.stop
  >
    <AttackArtwork
      v-if="playing && kind === 'attacks'"
      :effect="effect"
      :play-key="playKey"
      @complete="stop"
    />
    <EntrancePreview
      v-else-if="playing && entrance"
      :key="playKey"
      :effect="effect"
      :image="image || '/assets/characters/community-asian-neutral.webp'"
      :name="name || '玩家'"
      :size="128"
      frameless
    />
    <template v-else>
      <UiIcon :name="kind === 'attacks' ? 'attack-up' : 'emoji'" />
      <span class="gacha-live-caption">{{
        disabledMotion ? '動畫已關閉' : active ? '可重播特效' : '選取後播放特效'
      }}</span>
    </template>
  </div>
</template>

<style scoped>
.gacha-live-effect {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--stitch-space-8);
  inline-size: 100%;
  block-size: 100%;
  min-inline-size: 0;
  min-block-size: 0;
  overflow: hidden;
}
.gacha-live-caption {
  font-size: var(--stitch-text-hint);
}
.gacha-live-effect :deep(.entrance-preview) {
  position: absolute;
  inset: 0;
  block-size: 100%;
  grid-template-rows: minmax(0, 1fr) auto;
  min-block-size: 0;
}
.gacha-live-effect :deep(.entrance-stage) {
  block-size: 100%;
  min-block-size: 0;
}
</style>
