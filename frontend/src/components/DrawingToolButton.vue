<script setup lang="ts">
import StrokeCanvas from '../engines/stroke-canvas.js';

import { computed, useId } from 'vue';
import type {} from '../contracts/drawing';
import '../styles/drawing-tool-button.scss';
const props = defineProps<{
  tool: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
}>();
const captionId = useId();
function focus(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement).focus({ preventScroll: true });
}
const allowed = new Set([
  'brush',
  'erase',
  'line',
  'rect',
  'ellipse',
  'rectFilled',
  'ellipseFilled',
  'fill',
  'undo',
  'clear',
]);
const icon = computed(() =>
  allowed.has(props.tool) ? StrokeCanvas?.iconMarkup(props.tool) || '' : '',
);
</script>
<template>
  <button
    type="button"
    class="vue-drawing-tool"
    data-ui-hint
    :title="label"
    :aria-label="label"
    :aria-describedby="captionId"
    :aria-pressed="selected"
    :disabled="disabled"
    @click="focus"
    ><span class="ui-icon" aria-hidden="true" v-html="icon" /><span
      :id="captionId"
      class="vue-drawing-tool-caption"
      role="tooltip"
      >{{ label }}</span
    ></button
  >
</template>
