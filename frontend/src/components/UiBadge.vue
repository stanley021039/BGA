<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(
  defineProps<{
    tone?: 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'disabled';
    counter?: boolean;
    label?: string;
  }>(),
  { tone: 'neutral', counter: false },
);
</script>
<template>
  <span class="ui-stitch-badge" :data-tone="tone" :data-counter="counter || undefined"
    ><slot>{{ label }}</slot></span
  >
</template>
