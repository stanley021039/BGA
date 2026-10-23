<script setup lang="ts">
import { sizedImage } from '../services/image-size';
import type { Artwork } from '../contracts/libraries';
import UiChoiceCard from './UiChoiceCard.vue';
defineProps<{
  items: Artwork[];
  modelValue: string | null;
  disabled?: boolean;
  variant?: 'profile' | 'gift';
}>();
defineEmits<{ 'update:modelValue': [value: string | null] }>();
</script>
<template>
  <div class="gift-artwork-list resource-artwork-list">
    <p v-if="!items.length">圖庫還沒有圖片。</p>
    <UiChoiceCard
      v-for="artwork in items"
      :key="artwork.id"
      :class="variant === 'profile' ? 'artwork-choice' : 'gift-artwork-choice'"
      :disabled="disabled"
      :selected="modelValue === artwork.id"
      :label="artwork.name"
      :aria-label="(variant === 'profile' ? '使用圖庫作品 ' : '選擇圖庫圖片 ') + artwork.name"
      @click="$emit('update:modelValue', modelValue === artwork.id ? null : artwork.id)"
      ><img :src="sizedImage(artwork.url, 256)" alt="" loading="lazy"
    /></UiChoiceCard>
  </div>
</template>
