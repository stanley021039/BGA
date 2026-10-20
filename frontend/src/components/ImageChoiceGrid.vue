<script setup lang="ts">
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
    ><button
      v-for="item in items"
      :key="item.id"
      type="button"
      :class="[
        'vue-image-choice',
        variant === 'character' ? 'preset-card' : 'expression-card',
        { active: modelValue === item.id },
      ]"
      :disabled="disabled"
      :aria-pressed="modelValue === item.id"
      :aria-label="item.ariaLabel || item.label"
      @click="$emit('update:modelValue', item.id)"
      ><img :src="item.url" alt="" loading="lazy" /><span>{{ item.label }}</span
      ><small v-if="item.caption">{{ item.caption }}</small></button
    ></div
  >
</template>
