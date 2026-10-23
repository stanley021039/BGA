<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';
const dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  message = ref(''),
  items = ref<string[]>([]),
  label = ref('確認');
let resolve: ((confirmed: boolean) => void) | undefined;
function finish(confirmed: boolean) {
  const complete = resolve;
  resolve = undefined;
  complete?.(confirmed);
  dialog.value?.close();
}
// Optional `list` lines render as bullets under the message.
function ask(text: string, confirmLabel = '確認', list: string[] = []): Promise<boolean> {
  if (resolve) return Promise.resolve(false);
  message.value = text;
  items.value = list;
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
  <UiDialog ref="dialog" compact title="確認操作" @closed="finish(false)"
    ><p class="vue-confirm-message">{{ message }}</p
    ><ul v-if="items.length" class="vue-confirm-list"
      ><li v-for="item in items" :key="item">{{ item }}</li></ul
    ><div class="vue-confirm-actions"
      ><UiButton label="取消" @click="finish(false)" /><UiButton
        variant="primary"
        :label="label"
        @click="finish(true)" /></div
  ></UiDialog>
</template>
