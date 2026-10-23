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
  // Keep the File and visible name, but allow the same file to fire change again.
  if (input.value) input.value.value = '';
  emit('change', file);
}
function clear() {
  chosen.value = '';
  if (input.value) input.value.value = '';
}
// A saved upload changes what is current; drop the stale picked name.
watch(() => props.current, clear);
defineExpose({ input, clear });
</script>
<template>
  <label class="ui-file-pick" :data-disabled="disabled ? '' : undefined"
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

<style scoped>
:root body .ui-file-pick,
:root body .ui-file-pick .file-pick-label {
  font-family: var(--stitch-font-family);
  font-size: var(--stitch-text-label);
  line-height: var(--stitch-line-height-body);
}
:root body .ui-file-pick .file-pick-row {
  box-sizing: border-box;
  min-inline-size: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
:root body .ui-file-pick .file-pick-button {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  min-block-size: var(--stitch-control-height);
  padding: var(--stitch-control-padding-block) var(--stitch-control-padding-inline);
  border: var(--stitch-border-strong);
  border-radius: var(--stitch-radius-button);
  background: var(--stitch-surface);
  color: var(--stitch-ink);
  box-shadow: var(--stitch-shadow-raised-sm);
  font: var(--stitch-weight-button) var(--stitch-text-button) / 1.4 var(--stitch-font-family);
}
:root body .ui-file-pick .file-pick-name {
  font-size: var(--stitch-text-input);
}
:root body .ui-file-pick[data-disabled] .file-pick-button {
  border-color: var(--stitch-disabled-line);
  background: var(--stitch-disabled-bg);
  color: var(--stitch-disabled-ink);
  box-shadow: none;
}
.file-pick-input:disabled {
  cursor: not-allowed;
}
</style>

<style scoped>
:root body .ui-file-pick[hidden] {
  display: none;
}
</style>
