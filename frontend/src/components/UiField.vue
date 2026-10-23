<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';
// A labelled input, select (dropdown) or textarea (Figma 03 C07 「按鈕與表單」).
// class goes to the label; every other attribute goes to the control.
defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{
    label: string;
    control?: 'input' | 'select' | 'textarea';
    options?: readonly { value: string | number; label: string; disabled?: boolean }[];
    hint?: string;
    error?: string;
    id?: string;
  }>(),
  { control: 'input' },
);
const [model, modifiers] = defineModel<string | number | null | undefined, 'number' | 'trim'>({
  set(value) {
    if (modifiers.trim && typeof value === 'string') return value.trim();
    if (modifiers.number && typeof value === 'string' && value.trim() !== '') {
      const number = Number(value);
      return Number.isNaN(number) ? value : number;
    }
    return value;
  },
});
const attrs = useAttrs(),
  generatedId = useId();
const fieldId = computed(() => props.id || generatedId),
  messageId = computed(() => fieldId.value + '-message');
const controlAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  const describedBy = [rest['aria-describedby'], props.hint || props.error ? messageId.value : '']
    .filter(Boolean)
    .join(' ');
  return {
    ...rest,
    id: fieldId.value,
    class: 'ui-field-control',
    'aria-describedby': describedBy || undefined,
    'aria-invalid': props.error ? ('true' as const) : undefined,
  };
});
</script>
<template>
  <label
    class="ui-field"
    :class="attrs.class"
    :for="fieldId"
    :data-control="control"
    :data-invalid="error ? '' : undefined"
    ><span class="ui-field-label">{{ label }}</span
    ><select v-if="control === 'select'" v-model="model" v-bind="controlAttrs"
      ><slot
        ><option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
          >{{ option.label }}</option
        ></slot
      ></select
    ><textarea v-else-if="control === 'textarea'" v-model="model" v-bind="controlAttrs" /><input
      v-else
      v-model="model"
      v-bind="controlAttrs"
    /><span
      v-if="hint || error"
      :id="messageId"
      class="ui-field-message"
      :role="error ? 'alert' : undefined"
      >{{ error || hint }}</span
    ></label
  >
</template>
