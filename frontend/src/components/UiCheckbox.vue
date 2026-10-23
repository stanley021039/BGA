<script setup lang="ts">
import { useAttrs, type StyleValue } from 'vue';
// A checkbox with its label to the right (Figma 03 C07 「按鈕與表單」).
// class/style belong to the label; the remaining attributes belong to the input.
defineOptions({ inheritAttrs: false });
defineProps<{ label: string }>();
const model = defineModel<boolean>();
const attrs = useAttrs();
</script>
<template>
  <label
    class="ui-checkbox"
    :class="attrs.class"
    :style="attrs.style as StyleValue"
    :data-disabled="attrs.disabled === '' || !!attrs.disabled ? '' : undefined"
    ><input
      v-model="model"
      type="checkbox"
      class="ui-checkbox-input"
      v-bind="{ ...attrs, class: undefined, style: undefined }"
    /><span class="ui-checkbox-label">{{ label }}</span></label
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
</style>
