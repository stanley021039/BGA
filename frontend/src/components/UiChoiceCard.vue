<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(
  defineProps<{
    label: string;
    selected?: boolean;
    disabled?: boolean;
    action?: boolean;
    unavailable?: boolean;
    readableDisabled?: boolean;
    imageOnly?: boolean;
  }>(),
  { selected: false, disabled: false, action: false, unavailable: false, readableDisabled: false },
);
</script>
<template>
  <button
    type="button"
    class="ui-choice-card"
    :data-choice-state="disabled || unavailable ? 'disabled' : selected ? 'selected' : 'default'"
    :data-readable-disabled="(readableDisabled && (disabled || unavailable)) || undefined"
    :data-image-only="imageOnly || undefined"
    :aria-label="label"
    :aria-pressed="action ? undefined : selected"
    :aria-disabled="unavailable || undefined"
    :disabled="disabled"
  >
    <slot />
    <slot v-if="!imageOnly" name="label"
      ><span class="ui-choice-label">{{ label }}</span></slot
    >
    <slot v-if="!imageOnly" name="selection"
      ><span v-if="!action" class="ui-choice-state" aria-hidden="true">{{
        selected ? '✓ 已選擇' : disabled ? '不可用' : ''
      }}</span></slot
    >
  </button>
</template>
