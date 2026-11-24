<script setup lang="ts">
import { computed, useId } from 'vue';
import scenes from '../../../public/shared/lobby-background-live.json';
import '../assets/lobby-background-live.css';
const props = defineProps<{ id: string; fit?: 'cover' | 'contain' }>(),
  suffix = '-bg-' + useId().replace(/[^a-z0-9-]/gi, '');
const svg = computed(() => {
  let html = scenes.find((scene) => scene.id === props.id)?.svg || '';
  if (props.fit === 'contain')
    html = html
      .replace(/\spreserveAspectRatio="[^"]*"/, '')
      .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids)
    html = html
      .split('id="' + id + '"')
      .join('id="' + id + suffix + '"')
      .split('url(#' + id + ')')
      .join('url(#' + id + suffix + ')');
  return html;
});
</script>
<template>
  <div v-if="svg" class="lobby-live-art" :data-scene="id" aria-hidden="true" v-html="svg" />
</template>
<style lang="scss">
.lobby-live-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.lobby-live-art svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.lobby-live-art * {
  pointer-events: none;
}
</style>
