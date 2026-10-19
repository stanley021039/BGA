<script setup lang="ts">
import { computed } from 'vue';
import type {} from '../contracts/drawing';
import '../styles/drawing-tool-button.scss';
const props = defineProps<{ tool: string; label: string; selected?: boolean; disabled?: boolean }>();
const allowed = new Set(['brush', 'erase', 'line', 'rect', 'ellipse', 'rectFilled', 'ellipseFilled', 'fill', 'undo', 'clear']);
const icon = computed(() => allowed.has(props.tool) ? window.StrokeCanvas?.iconMarkup(props.tool) || '' : '');
</script>
<template><button type="button" class="vue-drawing-tool" data-ui-hint :title="label" :aria-label="label" :aria-pressed="selected" :disabled="disabled"><span class="ui-icon" aria-hidden="true" v-html="icon" /><span class="vue-drawing-tool-caption">{{ label }}</span></button></template>
