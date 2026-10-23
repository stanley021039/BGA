<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(defineProps<{ as?: 'div' | 'li'; active?: boolean; disabled?: boolean }>(), {
  as: 'div',
  active: false,
  disabled: false,
});
</script>
<template>
  <component
    :is="as"
    class="ui-stitch-list-row"
    :role="as === 'div' ? 'listitem' : undefined"
    :data-active="active || undefined"
    :aria-disabled="disabled || undefined"
    ><slot /><span v-if="$slots.actions" class="ui-list-row-actions"><slot name="actions" /></span
  ></component>
</template>
