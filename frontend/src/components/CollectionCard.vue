<script setup lang="ts">
import { sizedImage } from '../services/image-size';
import { centerChoiceImage } from '../services/image-framing';
defineProps<{
  title: string;
  image?: string;
  metadata: string;
  avatar?: boolean;
  selected?: boolean;
}>();
</script>
<template>
  <article class="collection-card ui-interactive-card" :data-selected="!!selected"
    ><span v-if="image" class="collection-image" :class="{ avatar }"
      ><img
        :src="sizedImage(image, 128)"
        :alt="title"
        loading="lazy"
        :class="{ 'is-character': image.startsWith('/assets/characters/') }"
        @load="centerChoiceImage($event.target as HTMLImageElement)" /></span
    ><slot name="preview" /><h3>{{ title }}</h3
    ><span v-if="image" class="collection-current">{{ selected ? '使用中' : '' }}</span
    ><p class="collection-meta">{{ metadata }}</p
    ><div class="collection-actions ui-button-group" role="group" :aria-label="title + '的操作'"
      ><slot /></div
  ></article>
</template>
