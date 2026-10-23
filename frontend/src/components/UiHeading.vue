<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(defineProps<{ level?: 1 | 2 | 3; kind?: 'page' | 'section' }>(), {
  level: 2,
  kind: 'section',
});
</script>
<template>
  <component :is="`h${level}`" class="ui-heading" :data-kind="kind"
    ><span class="ui-heading-text"><slot /></span
  ></component>
</template>
