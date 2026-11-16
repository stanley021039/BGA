<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ index: number; lastDrain: number }>();
const tile = computed(() =>
  props.index === 2 ? null : props.index < 2 ? props.index : props.index - 1,
);
</script>
<template>
  <div
    class="scene-bear-companion"
    :aria-label="'彩虹熊附身，每秒扣能' + (lastDrain ? '，剛扣除' + lastDrain + '能量' : '')"
  >
    <div
      class="scene-bear-companion-crop"
      :style="{
        backgroundImage:
          'url(' +
          (tile === null
            ? '/assets/attacks/rainbow-bear-96.webp'
            : '/assets/attacks/rainbow-bear-squad-96.webp') +
          ')',
        backgroundSize: tile === null ? '48px 48px' : '96px 96px',
        backgroundPosition:
          tile === null ? '0 0' : -(tile % 2) * 48 + 'px ' + -Math.floor(tile / 2) * 48 + 'px',
      }"
    />
    <div aria-hidden="true">💋</div>
  </div>
</template>
<style scoped>
.scene-bear-companion {
  position: absolute;
  inset-inline-start: 100%;
  inset-block-start: 0;
  pointer-events: none;
  display: grid;
  justify-items: center;
  font-size: var(--stitch-text-label);
}
.scene-bear-companion-crop {
  display: block;
  width: 48px;
  height: 48px;
  overflow: hidden;
}
</style>
