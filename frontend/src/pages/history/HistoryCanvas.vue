<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type {} from '../../contracts/drawing';
const props = defineProps<{ values: unknown[]; shapes: boolean; label: string }>();
const canvas = ref<HTMLCanvasElement | null>(null), error = ref('');
declare global { interface Window { PartyShapes?: { toStrokes(values: unknown[]): unknown[] } } }
function render() {
  if (!canvas.value) return;
  error.value = '';
  try {
    if (!window.StrokeCanvas || props.shapes && !window.PartyShapes) throw Error('畫作工具暫時無法載入，請重新整理');
    window.StrokeCanvas.redraw(canvas.value, props.shapes ? window.PartyShapes!.toStrokes(props.values) : props.values);
  } catch (cause) { canvas.value.getContext('2d')?.clearRect(0, 0, 512, 256); error.value = cause instanceof Error ? cause.message : '無法顯示畫作'; }
}
onMounted(render); watch(() => [props.values, props.shapes], render, { flush: 'post' });
</script>
<template><figure class="history-drawing"><canvas ref="canvas" width="512" height="256" role="img" :aria-label="label" /><figcaption>{{ error || label }}</figcaption></figure></template>
