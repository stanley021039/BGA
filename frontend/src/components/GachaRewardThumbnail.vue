<script setup lang="ts">
import { computed } from 'vue';
import type { GachaKind } from '../contracts/gacha';
import effects from '../../../public/shared/attack-effects.json';
import { entranceEffects } from '../services/entrance-effects';
import LobbyBackgroundArt from './LobbyBackgroundArt.vue';
import UiHeading from './UiHeading.vue';
import UiIcon from './UiIcon.vue';
const props = defineProps<{ kind: GachaKind; effect: string; compact?: boolean }>();
const label = computed(
  () =>
    (props.kind === 'attacks' ? effects : entranceEffects).find((item) => item.id === props.effect)
      ?.label || props.effect,
);
const fallback = {
  attacks: 'attack-up',
  entrances: 'emoji',
  backgrounds: 'landscape',
  frames: 'frame',
  media: 'video',
  sounds: 'sound',
};
</script>
<template>
  <div
    class="gacha-reward-thumbnail"
    :data-kind="kind"
    :class="{ 'is-compact': compact }"
    aria-hidden="true"
  >
    <LobbyBackgroundArt v-if="kind === 'backgrounds'" :id="effect" fit="contain" />
    <template v-else-if="kind === 'attacks' || kind === 'entrances'">
      <UiIcon :name="fallback[kind]" />
      <UiHeading :level="3" kind="card" :tone="kind === 'attacks' ? 'artwork' : 'default'">{{
        label
      }}</UiHeading>
    </template>
    <UiIcon v-else :name="fallback[kind]" />
  </div>
</template>
<style scoped>
.gacha-reward-thumbnail {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--stitch-space-8);
  inline-size: min(100%, 192px);
  aspect-ratio: 16 / 9;
  border-radius: var(--stitch-radius-panel);
  overflow: hidden;
  background: var(--stitch-artwork-preview-bg);
}
.gacha-reward-thumbnail[data-kind='entrances'] {
  border-radius: 0;
  background: transparent;
}
.gacha-reward-thumbnail[data-kind='attacks'] {
  color: var(--stitch-artwork-preview-ink);
}
.gacha-reward-thumbnail.is-compact {
  inline-size: min(100%, 160px);
}
.gacha-reward-thumbnail :deep(.ui-heading) {
  margin: 0;
}
</style>
