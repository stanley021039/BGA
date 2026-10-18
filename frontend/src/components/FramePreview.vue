<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
const props = withDefaults(defineProps<{ frame: string; name?: string; message?: string }>(), { name: '小雨', message: '這一桌好好玩！' });
const root = ref<HTMLElement | null>(null);
function draw() {
  if (!root.value) return;
  root.value.replaceChildren();
  // Preserve the original allowlisted CSS/SVG artwork renderer in an isolated leaf.
  window.BarrageFrames?.decorate(root.value, { kind: 'builtin', id: props.frame, version: 1 }, props.name, props.message);
}
onMounted(draw);
watch(() => [props.frame, props.name, props.message], draw);
</script>
<template><span ref="root" class="barrage-frame-preview"></span></template>
