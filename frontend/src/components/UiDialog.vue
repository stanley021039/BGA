<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue';
import UiButton from './UiButton.vue';
const props = withDefaults(
  defineProps<{ title: string; compact?: boolean; stitch?: boolean; dismissible?: boolean }>(),
  { dismissible: true },
);
const emit = defineEmits<{ closing: []; closed: [] }>();
const dialog = ref<HTMLDialogElement | null>(null),
  visible = ref(false),
  headingId = useId();
let trigger: HTMLElement | null = null;
async function open(source?: HTMLElement) {
  if (dialog.value?.open) return;
  trigger =
    source || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  visible.value = true;
  dialog.value?.showModal();
  await nextTick();
  if (!dialog.value?.open) return;
  const selected = dialog.value.querySelector<HTMLElement>('[aria-pressed="true"]');
  (selected || dialog.value).focus({ preventScroll: true });
}
function close() {
  if (dialog.value?.open) {
    emit('closing');
    dialog.value.close();
  }
}
function cancel(event: Event) {
  if (!props.dismissible) event.preventDefault();
  else emit('closing');
}
function closed() {
  if (dialog.value?.open) return;
  visible.value = false;
  if (trigger?.isConnected) trigger.focus();
  emit('closed');
}
onBeforeUnmount(close);
defineExpose({ open, close });
</script>
<template>
  <dialog
    ref="dialog"
    autofocus
    class="vue-dialog ui-dialog"
    :class="{ 'vue-dialog-compact': compact, 'vue-stitch-dialog': stitch }"
    :aria-labelledby="headingId"
    @cancel="cancel"
    @close="closed"
  >
    <header class="vue-dialog-header"
      ><h2 :id="headingId">{{ title }}</h2
      ><UiButton
        :stitch="stitch"
        icon="close"
        icon-only
        caption="關閉"
        :label="'關閉' + title"
        :disabled="!dismissible"
        @click="close"
    /></header>
    <div v-if="visible" class="vue-dialog-content"><slot /></div>
  </dialog>
</template>
