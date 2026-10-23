<script setup lang="ts">
import { ref } from 'vue';
import type { Artwork } from '../contracts/libraries';
import ArtworkPicker from './ArtworkPicker.vue';
import UiFilePick from './UiFilePick.vue';
defineProps<{ inputId: string; label: string; artworks: Artwork[]; disabled?: boolean }>();
const file = defineModel<File | null>('file', { default: null }),
  artworkId = defineModel<string | null>('artworkId', { default: null });
const input = ref<InstanceType<typeof UiFilePick> | null>(null),
  dragging = ref(false);
function chooseFile(value: File | null) {
  file.value = value;
  if (value) artworkId.value = null;
}
function chooseArtwork(value: string | null) {
  artworkId.value = value;
  file.value = null;
  input.value?.clear();
}
function clear() {
  file.value = null;
  artworkId.value = null;
  input.value?.clear();
}
function drop(event: DragEvent, disabled: boolean | undefined) {
  dragging.value = false;
  if (!disabled) {
    input.value?.clear();
    chooseFile(event.dataTransfer?.files[0] || null);
  }
}
defineExpose({ clear });
</script>
<template>
  <UiFilePick
    :input-id="inputId"
    ref="input"
    :label="label"
    accept="image/png,image/gif,image/webp"
    :current="file?.name || (artworkId ? '使用我的圖庫圖片' : '尚未選擇圖片')"
    :disabled="disabled"
    @change="chooseFile"
  />
  <div
    class="upload-drop"
    :class="{ dragging }"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled"
    :aria-label="'選擇或拖放' + label"
    @dragover.prevent="dragging = !disabled"
    @dragleave="dragging = false"
    @drop.prevent="drop($event, disabled)"
    @click="!disabled && input?.input?.click()"
    @keydown.enter.prevent="!disabled && input?.input?.click()"
    @keydown.space.prevent="!disabled && input?.input?.click()"
    >{{ file ? '已選取：' + file.name : '或將圖片拖到這裡' }}</div
  >
  <div class="artwork-picker"
    ><strong>或從我的圖庫選圖</strong
    ><ArtworkPicker
      class="artwork-choices"
      :items="artworks"
      :model-value="artworkId"
      :disabled="disabled"
      variant="profile"
      @update:model-value="chooseArtwork"
  /></div>
</template>

<style scoped>
.upload-drop {
  box-sizing: border-box;
  min-inline-size: 0;
  min-block-size: var(--stitch-control-height);
  padding: var(--stitch-space-16);
  border: var(--stitch-border-width) dashed var(--stitch-line);
  border-radius: var(--stitch-radius-panel);
  background: var(--stitch-surface-subtle);
  color: var(--stitch-ink);
  font-size: var(--stitch-text-body);
  line-height: var(--stitch-line-height-body);
  overflow-wrap: anywhere;
  cursor: pointer;
}
.upload-drop:focus-visible,
.upload-drop.dragging {
  outline: var(--stitch-focus-ring);
  outline-offset: var(--stitch-focus-offset);
}
.upload-drop[aria-disabled='true'] {
  cursor: not-allowed;
}
</style>
