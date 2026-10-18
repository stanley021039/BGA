<script setup lang="ts">
import type { Artwork } from '../contracts/libraries';
defineProps<{ items: Artwork[]; modelValue: string | null; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [value: string | null] }>();
</script>
<template>
  <div class="gift-artwork-list resource-artwork-list">
    <p v-if="!items.length">圖庫還沒有圖片。</p>
    <button v-for="artwork in items" :key="artwork.id" type="button" class="gift-artwork-choice" :disabled="disabled" :aria-pressed="modelValue===artwork.id" :aria-label="'選擇圖庫圖片 '+artwork.name" @click="$emit('update:modelValue',modelValue===artwork.id?null:artwork.id)"><img :src="artwork.url" alt="" loading="lazy"><span>{{ artwork.name }}</span></button>
  </div>
</template>
