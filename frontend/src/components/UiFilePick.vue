<script setup lang="ts">
import { ref, watch } from 'vue';
// A labelled file picker that says what is in use now (UiField for files). Browsers never prefill a file
// input, so until a new file is picked it shows `current` instead.
const props = defineProps<{
  label: string;
  accept: string;
  current: string;
  disabled?: boolean;
  inputId?: string;
}>();
const emit = defineEmits<{ change: [file: File | null] }>();
const input = ref<HTMLInputElement | null>(null),
  chosen = ref('');
function picked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null;
  chosen.value = file?.name || '';
  emit('change', file);
}
// A saved upload changes what is current; drop the stale picked name.
watch(
  () => props.current,
  () => {
    chosen.value = '';
    if (input.value) input.value.value = '';
  },
);
defineExpose({ input });
</script>
<template>
  <label class="ui-file-pick"
    ><span class="file-pick-label">{{ label }}</span
    ><span class="file-pick-row"
      ><input
        :id="inputId"
        ref="input"
        type="file"
        class="file-pick-input"
        :accept="accept"
        :disabled="disabled"
        @change="picked"
      /><span class="file-pick-button" aria-hidden="true">選擇檔案</span
      ><span class="file-pick-name">{{ chosen || current }}</span></span
    ></label
  >
</template>
