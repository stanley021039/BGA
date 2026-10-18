<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue';
import UiButton from './UiButton.vue';
defineProps<{ title: string; compact?: boolean }>();
const emit = defineEmits<{ closed: [] }>();
const dialog = ref<HTMLDialogElement | null>(null), visible = ref(false), headingId = useId();
let trigger: HTMLElement | null = null;
async function open(source?: HTMLElement) {
  trigger = source || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  visible.value = true;
  dialog.value?.showModal();
  await nextTick();
  dialog.value?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
}
function close() { dialog.value?.close(); }
function closed() { if (dialog.value?.open) return; visible.value = false; if (trigger?.isConnected) trigger.focus(); emit('closed'); }
onBeforeUnmount(close);
defineExpose({ open, close });
</script>
<template>
  <dialog ref="dialog" class="vue-dialog ui-dialog" :class="{ 'vue-dialog-compact': compact }" :aria-labelledby="headingId" @close="closed">
    <header class="vue-dialog-header"><h2 :id="headingId">{{ title }}</h2><UiButton icon="close" icon-only caption="關閉" :label="'關閉' + title" @click="close" /></header>
    <div v-if="visible" class="vue-dialog-content"><slot /></div>
  </dialog>
</template>
