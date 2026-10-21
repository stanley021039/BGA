<script setup lang="ts">
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
  'refresh',
  'undo',
  'close',
  'upload',
  'remove',
  'share',
  'expand',
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
  'invite',
  'mail',
  'sun',
  'moon',
]);
declare global {
  interface Window {
    GameUI?: { icon(name: string): string };
  }
}
// The HTML is exclusively from the existing internal icon registry.
const markup = computed(() =>
  allowed.has(props.name) ? window.GameUI?.icon(props.name) || '' : '',
);
</script>

<template><span v-if="markup" aria-hidden="true" v-html="markup"></span></template>
