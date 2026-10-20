<script setup lang="ts">
import { ref } from 'vue';
import type { Artwork } from '../contracts/libraries';
import ArtworkPicker from './ArtworkPicker.vue';
defineProps<{ inputId: string; label: string; artworks: Artwork[]; disabled?: boolean }>();
const file = defineModel<File | null>('file', { default: null }), artworkId = defineModel<string | null>('artworkId', { default: null });
const input = ref<HTMLInputElement | null>(null), dragging = ref(false);
function chooseFile(value: File | null) { file.value = value; if (value) artworkId.value = null; }
function chooseArtwork(value: string | null) { artworkId.value = value; file.value = null; if (input.value) input.value.value = ''; }
function clear() { file.value = null; artworkId.value = null; if (input.value) input.value.value = ''; }
function drop(event: DragEvent, disabled: boolean | undefined) { dragging.value = false; if (!disabled) { if (input.value) input.value.value = ''; chooseFile(event.dataTransfer?.files[0] || null); } }
defineExpose({ clear });
</script>
<template>
  <label :for="inputId">{{ label }}<input :id="inputId" ref="input" type="file" accept="image/png,image/gif,image/webp" :disabled="disabled" @change="chooseFile(($event.target as HTMLInputElement).files?.[0] || null)"></label>
  <div class="upload-drop" :class="{ dragging }" role="button" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled" :aria-label="'選擇或拖放' + label" @dragover.prevent="dragging = !disabled" @dragleave="dragging = false" @drop.prevent="drop($event, disabled)" @click="!disabled && input?.click()" @keydown.enter.prevent="!disabled && input?.click()" @keydown.space.prevent="!disabled && input?.click()">{{ file ? '已選取：' + file.name : '或將圖片拖到這裡' }}</div>
  <div class="artwork-picker"><strong>或從我的圖庫選圖</strong><ArtworkPicker class="artwork-choices" :items="artworks" :model-value="artworkId" :disabled="disabled" variant="profile" @update:model-value="chooseArtwork" /></div>
</template>
