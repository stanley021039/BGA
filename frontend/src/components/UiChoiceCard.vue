<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(
  defineProps<{
    label: string;
    selected?: boolean;
    disabled?: boolean;
    action?: boolean;
    unavailable?: boolean;
  }>(),
  { selected: false, disabled: false, action: false, unavailable: false },
);
</script>
<template>
  <button
    type="button"
    class="ui-choice-card"
    :data-choice-state="disabled || unavailable ? 'disabled' : selected ? 'selected' : 'default'"
    :aria-label="label"
    :aria-pressed="action ? undefined : selected"
    :aria-disabled="unavailable || undefined"
    :disabled="disabled"
  >
    <slot />
    <slot name="label"
      ><span class="ui-choice-label">{{ label }}</span></slot
    >
    <slot name="selection"
      ><span v-if="!action" class="ui-choice-state" aria-hidden="true">{{
        selected ? '✓ 已選擇' : disabled ? '不可用' : ''
      }}</span></slot
    >
  </button>
</template>
