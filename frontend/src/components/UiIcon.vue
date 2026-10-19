<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ name: string }>();
const allowed = new Set(['edit', 'gift', 'users', 'cards', 'car', 'table', 'book', 'check', 'lock', 'emoji', 'frame', 'save', 'sound', 'help', 'refresh', 'close', 'upload', 'remove', 'share', 'expand', 'add', 'previous', 'next', 'download']);
declare global { interface Window { GameUI?: { icon(name: string): string } } }
// The HTML is exclusively from the existing internal icon registry.
const markup = computed(() => allowed.has(props.name) ? window.GameUI?.icon(props.name) || '' : '');
</script>

<template><span aria-hidden="true" v-html="markup"></span></template>
