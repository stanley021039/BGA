<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PublicDrawSnapshot } from '../contracts/draw-results';
import StatusSlot from './StatusSlot.vue';
import '../styles/draw-gallery.scss';
const props = defineProps<{ snapshot: PublicDrawSnapshot | null; compact?: boolean }>();
const canvas = ref<HTMLCanvasElement | null>(null), ready = ref(false), error = ref('');
let renderer: ReturnType<NonNullable<Window['StrokeCanvas']>['createDrawingRenderer']> | null = null, generation = 0, mounted = false;
async function paint() {
  const token = ++generation; ready.value = false; error.value = ''; renderer?.reset();
  if (!mounted || !canvas.value || !props.snapshot) return;
  try {
    if (!window.StrokeCanvas) throw Error('畫作工具無法載入，請重新整理。');
    renderer ||= window.StrokeCanvas.createDrawingRenderer(canvas.value, { maxCheckpoints: 2 });
    await renderer.renderCooperatively(props.snapshot.canvas.strokes);
    if (generation === token && mounted) ready.value = true;
  } catch (cause) { if (generation === token && mounted) error.value = cause instanceof Error ? cause.message : '畫作無法還原'; }
}
onMounted(() => { mounted = true; void paint(); }); watch(() => props.snapshot, paint);
onBeforeUnmount(() => { mounted = false; generation++; renderer?.reset(); renderer = null; });
defineExpose({ retry: paint });
</script>
<template><figure class="vue-result-canvas" :class="{ 'vue-result-compact': compact }"><div class="vue-result-frame"><canvas ref="canvas" v-show="ready" width="512" height="256" role="img" :aria-label="snapshot ? `第 ${snapshot.result.round} 輪，${snapshot.result.artist.name} 的畫作：${snapshot.result.answer || '未選題'}` : '尚未選擇畫作'" /><p v-if="!ready" class="vue-result-placeholder">{{ error || (snapshot ? '正在還原畫作…' : '尚未載入畫作') }}</p></div><StatusSlot v-if="!compact" :message="error || (snapshot && !ready ? '正在還原畫作，仍可關閉回到遊戲。' : '')" :error="!!error" /></figure></template>
