<script setup lang="ts">
import GameUI from '../engines/ui-widgets.js';

import { computed } from 'vue';
const props = defineProps<{ name: string }>();
const allowed = new Set([
  'edit',
  'gift',
  'users',
  'cards',
  'car',
  'table',
  'book',
  'check',
  'lock',
  'emoji',
  'frame',
  'save',
  'sound',
  'help',
  'info',
  'refresh',
  'undo',
  'close',
  'upload',
  'remove',
  'share',
  'expand',
  'pictureInPicture',
  'contract',
  'landscape',
  'add',
  'previous',
  'next',
  'download',
  'crown',
  'leave',
  'play',
  'settings',
  'replay',
  'chat',
  'send',
  'ban',
  'video',
  'pause',
  'stop',
  'muted',
  'minimize',
  'dragHandle',
  'ping',
  'ping-attention',
  'ping-question',
  'ping-help',
  'ping-look',
  'ping-angry',
  'ping-sleep',
  'ping-speechless',
  'ping-surprised',
  'ping-admire',
  'invite',
  'mail',
  'sun',
  'moon',
  'health-up',
  'attack-up',
  'regen-up',
  'healing',
  'shield',
  'timer',
]);
declare global {
  interface Window {
    GameUI?: { icon(name: string): string };
  }
}
// The HTML is exclusively from the existing internal icon registry.
const markup = computed(() => (allowed.has(props.name) ? GameUI?.icon(props.name) || '' : ''));
</script>

<template><span v-if="markup" aria-hidden="true" v-html="markup"></span></template>
<style scoped>
span {
  display: inline-flex;
  flex: none;
}
:deep(svg) {
  display: block;
  inline-size: var(--stitch-icon-size);
  block-size: var(--stitch-icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
