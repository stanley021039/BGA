<script setup lang="ts">
import { useId } from 'vue';
const props = defineProps<{ items: { id: string; label: string; count?: string }[]; modelValue: string; label: string; idPrefix?: string; panelPrefix: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();
const fallbackPrefix = useId();
function keydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const button = event.target as HTMLButtonElement;
  const buttons = [...(button.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') || [])];
  const index = buttons.indexOf(button); if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}
</script>
<template><nav role="tablist" :aria-label="label" class="vue-tabs" @keydown="keydown"><button v-for="item in items" :id="`${idPrefix || fallbackPrefix}-${item.id}`" :key="item.id" type="button" role="tab" :aria-selected="item.id === modelValue" :aria-controls="`${panelPrefix}-${item.id}`" :tabindex="item.id === modelValue ? 0 : -1" :disabled="disabled" @click="emit('update:modelValue', item.id)">{{ item.label }}<span v-if="item.count !== undefined" class="ui-badge collection-count">{{ item.count }}</span></button></nav></template>
