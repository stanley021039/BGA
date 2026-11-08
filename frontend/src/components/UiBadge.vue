<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(
  defineProps<{
    tone?: 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'disabled' | 'epic';
    counter?: boolean;
    nowrap?: boolean;
    shape?: 'pill' | 'circle';
    label?: string;
  }>(),
  { tone: 'neutral', counter: false },
);
</script>
<template>
  <span
    class="ui-stitch-badge"
    :data-tone="tone"
    :data-counter="counter || undefined"
    :data-nowrap="nowrap || undefined"
    :data-shape="shape"
    ><slot>{{ label }}</slot></span
  >
</template>
