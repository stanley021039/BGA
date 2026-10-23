<script setup lang="ts">
import { sizedImage } from '../services/image-size';
import UiChoiceCard from './UiChoiceCard.vue';
import '../styles/image-choice-grid.scss';
withDefaults(
  defineProps<{
    items: { id: string; label: string; url: string; caption?: string; ariaLabel?: string }[];
    modelValue: string;
    variant?: 'character' | 'expression';
    disabled?: boolean;
  }>(),
  { variant: 'character' },
);
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>
<template>
  <div
    class="vue-image-choice-grid"
    :class="variant === 'character' ? 'preset-gallery' : 'expression-gallery'"
    ><UiChoiceCard
      v-for="item in items"
      :key="item.id"
      :class="[
        'vue-image-choice',
        variant === 'character' ? 'preset-card' : 'expression-card',
        { active: modelValue === item.id },
      ]"
      :label="item.label"
      :disabled="disabled"
      :selected="modelValue === item.id"
      :aria-label="item.ariaLabel || item.label"
      @click="$emit('update:modelValue', item.id)"
      ><img :src="sizedImage(item.url, 256)" alt="" loading="lazy" /><small v-if="item.caption">{{
        item.caption
      }}</small></UiChoiceCard
    ><slot name="append"
  /></div>
</template>
