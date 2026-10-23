<script setup lang="ts">
import { computed, useAttrs, useId, type StyleValue } from 'vue';
// A labelled input, select (dropdown) or textarea (Figma 03 C07 「按鈕與表單」).
// class/style belong to the label; the remaining attributes belong to the control.
defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{
    label: string;
    control?: 'input' | 'select' | 'textarea';
    options?: readonly { value: string | number; label: string; disabled?: boolean }[];
    hint?: string;
    error?: string;
    reserveMessage?: boolean;
    id?: string;
  }>(),
  { control: 'input', reserveMessage: undefined },
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
const hasMessageSlot = computed(
  () => props.reserveMessage ?? (props.hint !== undefined || props.error !== undefined),
);
const controlAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
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
    :style="attrs.style as StyleValue"
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
      v-if="hasMessageSlot"
      class="ui-field-message-slot"
      :tabindex="hint || error ? 0 : undefined"
      :role="hint || error ? 'region' : undefined"
      :aria-label="hint || error ? label + '的欄位說明' : undefined"
      ><span
        v-if="hint || error"
        :id="messageId"
        class="ui-field-message"
        :role="error ? 'alert' : undefined"
        >{{ error || hint }}</span
      ></span
    ></label
  >
</template>

<style scoped>
:root body .ui-field,
:root body .ui-field-label {
  font-family: var(--stitch-font-family);
  font-size: var(--stitch-text-label);
  line-height: var(--stitch-line-height-body);
}
:root body .ui-field-control {
  font-size: var(--stitch-text-input);
  line-height: var(--stitch-line-height-body);
}
.ui-field-message-slot {
  box-sizing: border-box;
  display: block;
  inline-size: 100%;
  min-inline-size: 0;
  block-size: var(--stitch-field-message-height);
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  font-size: var(--stitch-text-hint);
  line-height: var(--stitch-line-height-body);
}
.ui-field-message-slot:focus-visible {
  outline: var(--stitch-focus-ring);
  outline-offset: var(--stitch-focus-offset);
}
.ui-field-message-slot > .ui-field-message {
  display: block;
  min-inline-size: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
@media (max-width: 760px) {
  .ui-field-message-slot {
    block-size: var(--stitch-field-message-height-mobile);
  }
}
</style>
