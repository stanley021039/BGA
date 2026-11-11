<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { sizedImage } from '../services/image-size';
const props = defineProps<{ name: string; avatar?: string | null; bot?: boolean }>();
const failed = ref(false),
  // Avatars render at 68 CSS px or less, so the smallest thumbnail suffices.
  source = computed(() =>
    sizedImage(
      props.avatar ||
        (props.bot
          ? '/assets/characters/sunny-neutral.png'
          : '/assets/characters/traveler-neutral.png'),
      128,
    ),
  );
watch(source, () => {
  failed.value = false;
});
</script>
<style lang="scss">
.vue-player-avatar {
  position: relative;
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  flex: none;
  overflow: hidden;
  border-radius: 0.5rem;
  background: var(--play-surface, #fffdf8);
}
.vue-player-avatar > img {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
</style>
<template>
  <span class="vue-player-avatar" aria-hidden="true"
    ><span>{{ [...name][0] || '？' }}</span
    ><img v-if="!failed" :src="source" alt="" @error="failed = true"
  /></span>
</template>
