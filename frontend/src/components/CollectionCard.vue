<script setup lang="ts">
import { sizedImage } from '../services/image-size';
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
    ><img
      v-if="image"
      :src="sizedImage(image, 256)"
      :alt="title"
      loading="lazy"
      class="collection-image"
      :class="{ avatar }" /><slot name="preview" /><h3>{{ title }}</h3
    ><span v-if="image" class="collection-current">{{ selected ? '使用中' : '' }}</span
    ><p class="collection-meta">{{ metadata }}</p
    ><div class="collection-actions ui-button-group" role="group" :aria-label="title + '的操作'"
      ><slot /></div
  ></article>
</template>
