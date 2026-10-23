<script setup lang="ts">
import UiIcon from './UiIcon.vue';
// A link drawn as a Stitch button (same variants as UiButton).
withDefaults(
  defineProps<{
    href: string;
    label: string;
    icon?: string;
    iconOnly?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'contrast';
  }>(),
  { variant: 'secondary' },
);
</script>
<template>
  <a
    :href="href"
    class="ui-button vue-button ui-stitch-button"
    :data-stitch-variant="variant"
    :class="{ 'ui-icon-button': iconOnly }"
    :aria-label="label"
    :title="iconOnly ? label : undefined"
    ><UiIcon v-if="icon" :name="icon" class="ui-button-icon" /><span
      class="vue-button-caption"
      :class="{ 'ui-sr-only': iconOnly }"
      >{{ label }}</span
    ></a
  >
</template>
