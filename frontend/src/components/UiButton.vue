<script setup lang="ts">
import UiIcon from './UiIcon.vue';
// The only button look (Figma 03 C05/C07). Pick a role with `variant`.
withDefaults(
  defineProps<{
    label: string;
    caption?: string;
    icon?: string;
    iconOnly?: boolean;
    pending?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'contrast';
  }>(),
  {
    type: 'button',
    iconOnly: false,
    pending: false,
    disabled: false,
    variant: 'secondary',
  },
);
</script>
<template>
  <button
    :type="type"
    class="ui-button vue-button ui-stitch-button"
    :class="{
      'ui-icon-button': iconOnly,
      'has-mobile-caption': iconOnly && !!caption,
      'is-stitch-pending': pending,
    }"
    :data-stitch-variant="variant"
    :aria-label="label"
    :title="iconOnly ? label : undefined"
    :disabled="disabled || pending"
    :aria-busy="pending"
  >
    <span
      v-if="icon || $slots.icon"
      class="ui-button-icon-slot"
      :data-pending="pending || undefined"
    >
      <slot name="icon"><UiIcon v-if="icon" :name="icon" class="ui-button-icon" /></slot>
      <span v-if="pending" class="ui-button-spinner" aria-hidden="true" />
    </span>
    <span v-else-if="pending" class="ui-button-spinner ui-button-edge-spinner" aria-hidden="true" />
    <span class="vue-button-caption" :class="{ 'ui-sr-only': iconOnly }">{{
      caption || label
    }}</span>
  </button>
</template>
<style scoped>
.ui-sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>
