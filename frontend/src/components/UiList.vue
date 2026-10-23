<script setup lang="ts">
import '../styles/ui-patterns.scss';
withDefaults(defineProps<{ as?: 'div' | 'ul' | 'ol' }>(), { as: 'div' });
</script>
<template>
  <component :is="as" class="ui-stitch-list" :role="as === 'div' ? 'list' : undefined"
    ><slot
  /></component>
</template>
