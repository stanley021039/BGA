<script setup lang="ts">
import UiIcon from './UiIcon.vue';
withDefaults(defineProps<{ label: string; caption?: string; icon?: string; iconOnly?: boolean; pending?: boolean; disabled?: boolean; type?: 'button' | 'submit' | 'reset' }>(), {
  type: 'button', iconOnly: false, pending: false, disabled: false,
});
</script>
<template>
  <button :type="type" class="ui-button vue-button" :class="{ 'ui-icon-button': iconOnly, 'is-pending': pending }" :aria-label="label" :title="iconOnly ? label : undefined" :disabled="disabled || pending" :aria-busy="pending">
    <UiIcon v-if="icon" :name="icon" class="ui-button-icon" />
    <span class="vue-button-caption" :class="{ 'ui-sr-only': iconOnly }">{{ caption || label }}</span>
  </button>
</template>
