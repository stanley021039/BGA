<script setup lang="ts">
import { sizedImage } from '../services/image-size';
import type { Artwork } from '../contracts/libraries';
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
    <button
      style="--ui-button-radius: var(--stitch-control-radius, 8px); --ui-button-border-width: 1px"
      v-for="artwork in items"
      :key="artwork.id"
      type="button"
      :class="variant === 'profile' ? 'artwork-choice' : 'gift-artwork-choice'"
      :disabled="disabled"
      :aria-pressed="modelValue === artwork.id"
      :aria-label="(variant === 'profile' ? '使用圖庫作品 ' : '選擇圖庫圖片 ') + artwork.name"
      @click="$emit('update:modelValue', modelValue === artwork.id ? null : artwork.id)"
      ><img :src="sizedImage(artwork.url, 256)" alt="" loading="lazy" /><span>{{
        artwork.name
      }}</span></button
    >
  </div>
</template>
