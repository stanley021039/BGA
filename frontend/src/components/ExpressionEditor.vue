<script setup lang="ts">
import { computed, ref, useId, watch, shallowRef } from 'vue';
import type { Character } from '../contracts/profile';
import { useMutation } from '../composables/mutation';
import { fileBase64 } from '../services/files';
import { sizedImage } from '../services/image-size';
import UiButton from './UiButton.vue';
import FilePickField from './FilePickField.vue';
import UiDialog from './UiDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ character: Character; expression: string }>(),
  emit = defineEmits<{ changed: [removed: boolean] }>(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  name = ref(''),
  file = shallowRef<File | null>(null),
  // Remounts the file field on every open so no earlier pick lingers.
  opened = ref(0),
  formId = useId(),
  image = computed(() => props.character.expressions[props.expression] || ''),
  mutation = useMutation();
let target: { id: string; expression: string } | null = null;
function open() {
  target = { id: props.character.id, expression: props.expression };
  name.value = props.character.labels[props.expression] || props.expression;
  file.value = null;
  opened.value++;
  dialog.value?.open();
}
watch(
  () => props.character.id + ':' + props.expression,
  () => {
    dialog.value?.close();
    confirm.value?.cancel();
    target = null;
  },
);
async function save() {
  const original = target;
  if (!original || !name.value.trim()) return;
  const ok = await mutation.run(async (request) => {
    const image = file.value ? { base64: await fileBase64(file.value, 4 * 1024 * 1024) } : {};
    await request(
      '/api/profile/characters/' +
        original.id.slice(5) +
        '/expressions/' +
        original.expression +
        '/edit',
      { name: name.value.trim(), ...image },
    );
  }, '表情已更新');
  if (ok) {
    dialog.value?.close();
    emit('changed', false);
  }
}
async function remove() {
  const original = { id: props.character.id, expression: props.expression };
  if (
    original.expression === 'neutral' ||
    !(await confirm.value?.ask('刪除後相關音效也會移除，無法復原。', '刪除這個表情？'))
  )
    return;
  if (props.character.id !== original.id || props.expression !== original.expression) return;
  const ok = await mutation.run(async (request) => {
    await request(
      '/api/profile/characters/' +
        original.id.slice(5) +
        '/expressions/' +
        original.expression +
        '/delete',
      {},
    );
  }, '表情已刪除');
  if (ok)
    emit('changed', props.character.id === original.id && props.expression === original.expression);
}
</script>
<template>
  <section v-if="character.owned && character.id.startsWith('user:')" class="expression-editor"
    ><UiButton
      icon="edit"
      label="編輯目前表情"
      :disabled="mutation.pending.value"
      @click="open" /><UiButton
      v-if="expression !== 'neutral'"
      icon="remove"
      label="刪除目前表情"
      :disabled="mutation.pending.value"
      @click="remove" /><slot name="actions" /><StatusSlot
      :message="mutation.message.value"
      :error="mutation.failed.value" /><UiDialog ref="dialog" title="編輯表情"
      ><div class="expression-edit-body"
        ><form :id="formId" class="expression-edit-form" @submit.prevent="save"
          ><section class="expression-edit-section"
            ><label
              ><span class="expression-edit-title">表情名稱</span
              ><input
                v-model="name"
                maxlength="20"
                required
                :disabled="mutation.pending.value" /></label></section
          ><section class="expression-edit-section"
            ><h3 class="expression-edit-title">表情圖片</h3
            ><img
              v-if="image"
              class="expression-edit-preview"
              :src="sizedImage(image, 256)"
              alt="目前的表情圖片" /><FilePickField
              :key="opened"
              label="替換圖片（未選擇則保留目前圖片）"
              accept="image/png,image/webp,image/gif"
              current="目前：使用中的圖片"
              :disabled="mutation.pending.value"
              @change="file = $event" /></section></form
        ><slot name="sound" /><footer class="expression-edit-footer"
          ><UiButton
            type="submit"
            :form="formId"
            icon="save"
            label="儲存表情"
            :disabled="mutation.pending.value" /><StatusSlot
            :message="mutation.message.value"
            :error="mutation.failed.value" /></footer></div></UiDialog
    ><ConfirmDialog ref="confirm"
  /></section>
</template>
