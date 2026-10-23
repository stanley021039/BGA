<script setup lang="ts">
// A checkbox with its label to the right (Figma 03 C07 「按鈕與表單」).
// class goes to the label; every other attribute goes to the input.
defineOptions({ inheritAttrs: false });
defineProps<{ label: string }>();
const model = defineModel<boolean>();
</script>
<template>
  <label class="ui-checkbox" :class="$attrs.class"
    ><input
      v-model="model"
      type="checkbox"
      class="ui-checkbox-input"
      v-bind="{ ...$attrs, class: undefined }"
    /><span class="ui-checkbox-label">{{ label }}</span></label
  >
</template>
