<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ name: string; avatar?: string | null; bot?: boolean }>();
const failed = ref(false),
  source = computed(
    () =>
      props.avatar ||
      (props.bot
        ? '/assets/characters/sunny-neutral.png?size=256'
        : '/assets/characters/traveler-neutral.png?size=256'),
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
