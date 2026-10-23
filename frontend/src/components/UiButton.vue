<script setup lang="ts">
import UiIcon from './UiIcon.vue';
// Stitch is the only look for new code. `legacy` keeps an unconverted page's old
// controls and ignores `variant`; see docs/UI-COMPONENTS.md.
withDefaults(
  defineProps<{
    label: string;
    caption?: string;
    icon?: string;
    iconOnly?: boolean;
    pending?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    legacy?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'contrast';
  }>(),
  {
    type: 'button',
    iconOnly: false,
    pending: false,
    disabled: false,
    legacy: false,
    variant: 'secondary',
  },
);
</script>
<template>
  <button
    :type="type"
    class="ui-button vue-button"
    :class="{
      'ui-icon-button': iconOnly,
      'has-mobile-caption': iconOnly && !!caption,
      'is-pending': pending,
      'ui-stitch-button': !legacy,
    }"
    :data-stitch-variant="legacy ? undefined : variant"
    :aria-label="label"
    :title="iconOnly ? label : undefined"
    :disabled="disabled || pending"
    :aria-busy="pending"
  >
    <slot name="icon"><UiIcon v-if="icon" :name="icon" class="ui-button-icon" /></slot>
    <span class="vue-button-caption" :class="{ 'ui-sr-only': iconOnly }">{{
      caption || label
    }}</span>
  </button>
</template>
