<script setup lang="ts">
import UiIcon from './UiIcon.vue';
import { useAttrs, type StyleValue } from 'vue';
// A checkbox with its label to the right (Figma 03 C07 「按鈕與表單」).
// class/style belong to the label; the remaining attributes belong to the input.
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ label: string; variant?: 'prominent' | 'compact' }>(), {
  variant: 'prominent',
});
const model = defineModel<boolean | string[] | number[]>();
const attrs = useAttrs();
</script>
<template>
  <label
    class="ui-checkbox"
    :class="attrs.class"
    :data-variant="variant"
    :style="attrs.style as StyleValue"
    :data-disabled="attrs.disabled === '' || !!attrs.disabled ? '' : undefined"
    ><input
      v-model="model"
      type="checkbox"
      class="ui-checkbox-input"
      v-bind="{ ...attrs, class: undefined, style: undefined }"
    /><UiIcon
      v-if="variant === 'prominent'"
      class="ui-checkbox-check"
      name="check"
      aria-hidden="true"
    /><slot
      ><span class="ui-checkbox-label">{{ label }}</span></slot
    ></label
  >
</template>

<style scoped>
.ui-checkbox {
  min-inline-size: 0;
}
:root body .ui-checkbox,
:root body .ui-checkbox-label {
  font-family: var(--stitch-font-family);
  font-size: var(--stitch-text-label);
  line-height: var(--stitch-line-height-body);
}
.ui-checkbox-label {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
:root body .ui-checkbox[data-disabled] {
  color: var(--stitch-muted);
  cursor: not-allowed;
}
.ui-checkbox-input:disabled {
  cursor: not-allowed;
}
:root body .ui-checkbox[data-variant='prominent'] {
  display: grid;
  grid-template-columns: var(--stitch-space-24) minmax(0, 1fr);
  inline-size: fit-content;
  max-inline-size: 100%;
}
:root body .ui-checkbox[data-variant='prominent'] .ui-checkbox-label {
  font-size: var(--stitch-text-body);
}
:root body .ui-checkbox[data-variant='prominent'] .ui-checkbox-input,
.ui-checkbox-check {
  grid-area: 1 / 1;
  place-self: center;
}
:root body .ui-checkbox[data-variant='prominent'] .ui-checkbox-input {
  appearance: none;
  box-sizing: border-box;
  min-inline-size: 0;
  min-block-size: 0;
  padding: 0;
  inline-size: var(--stitch-space-24);
  block-size: var(--stitch-space-24);
  border: var(--stitch-border-width-strong) solid var(--stitch-muted);
  border-radius: var(--stitch-radius-control);
  background: var(--stitch-surface);
  cursor: inherit;
}
:root body .ui-checkbox[data-variant='prominent'] .ui-checkbox-input:enabled:hover {
  border-color: var(--stitch-primary);
}
:root body .ui-checkbox[data-variant='prominent'] .ui-checkbox-input:checked {
  background: var(--stitch-primary);
  border-color: var(--stitch-primary);
}
.ui-checkbox-check {
  visibility: hidden;
  color: var(--stitch-on-primary);
  pointer-events: none;
}
.ui-checkbox-input:checked + .ui-checkbox-check {
  visibility: visible;
}
@media (forced-colors: active) {
  :root body .ui-checkbox[data-variant='prominent'] .ui-checkbox-input {
    appearance: auto;
  }
  .ui-checkbox-check {
    display: none;
  }
}
</style>
