<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(
  defineProps<{
    level?: 1 | 2 | 3;
    kind?: 'page' | 'section' | 'prompt' | 'card';
    cardSize?: 'section' | 'page';
    label?: string;
  }>(),
  {
    level: 2,
    kind: 'section',
  },
);
</script>
<template>
  <component :is="`h${level}`" class="ui-heading" :data-kind="kind" :data-card-size="cardSize"
    ><span v-if="label" class="ui-heading-label">{{ label }}</span
    ><span class="ui-heading-text"><slot /></span
  ></component>
</template>
