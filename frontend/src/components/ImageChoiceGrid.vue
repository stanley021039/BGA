<script setup lang="ts">
import { sizedImage } from '../services/image-size';
import UiChoiceCard from './UiChoiceCard.vue';
import '../styles/image-choice-grid.scss';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { centerChoiceImage } from '../services/image-framing';
const grid = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return;
  observer = new ResizeObserver(() =>
    grid.value?.querySelectorAll('img').forEach(centerChoiceImage),
  );
  if (grid.value) observer.observe(grid.value);
});
onBeforeUnmount(() => observer?.disconnect());
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
    ref="grid"
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
      content-align="center"
      :disabled="disabled"
      :selected="modelValue === item.id"
      :aria-label="item.ariaLabel || item.label"
      @click="$emit('update:modelValue', item.id)"
      ><img
        :src="sizedImage(item.url, 128)"
        alt=""
        loading="lazy"
        @load="centerChoiceImage($event.target as HTMLImageElement)"
      /><small v-if="item.caption">{{ item.caption }}</small></UiChoiceCard
    ><slot name="append"
  /></div>
</template>
