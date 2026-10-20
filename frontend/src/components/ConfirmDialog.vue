<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';
defineProps<{ stitch?: boolean }>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  message = ref(''),
  label = ref('確認');
let resolve: ((confirmed: boolean) => void) | undefined;
function finish(confirmed: boolean) {
  const complete = resolve;
  resolve = undefined;
  complete?.(confirmed);
  dialog.value?.close();
}
function ask(text: string, confirmLabel = '確認'): Promise<boolean> {
  if (resolve) return Promise.resolve(false);
  message.value = text;
  label.value = confirmLabel;
  return new Promise((complete) => {
    resolve = complete;
    void dialog.value?.open();
  });
}
onBeforeUnmount(() => finish(false));
defineExpose({ ask, cancel: () => finish(false) });
</script>
<template>
  <UiDialog ref="dialog" :stitch="stitch" compact title="確認操作" @closed="finish(false)"
    ><p class="vue-confirm-message">{{ message }}</p
    ><div class="vue-confirm-actions"
      ><UiButton :stitch="stitch" label="取消" @click="finish(false)" /><UiButton
        :stitch="stitch"
        variant="primary"
        :label="label"
        @click="finish(true)" /></div
  ></UiDialog>
</template>
