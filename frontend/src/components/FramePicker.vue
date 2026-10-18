<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import UiDialog from './UiDialog.vue';
import FrameChoices from './FrameChoices.vue';
const props = defineProps<{ kind: 'barrage' | 'media'; filterable?: boolean }>();
const prefs = usePreferencesStore(), dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const query = ref(''), group = ref('');
const title = computed(() => props.kind === 'barrage' ? '選擇彈幕框' : '播放器外觀');
const groups = computed(() => [...new Set(prefs.frames.map(item => item.group || '經典內建'))]);
function selected() { if (props.kind === 'media') dialog.value?.close(); }
defineExpose({ open: (source?: HTMLElement) => dialog.value?.open(source) });
</script>
<template>
  <UiDialog ref="dialog" :title="title">
    <p v-if="kind === 'media'">套用整個播放器；只改自己的外觀，與彈幕框共用模板。</p>
    <div v-if="filterable" class="vue-frame-filters"><label>搜尋外觀<input v-model="query" type="search"></label><label>外觀分類<select v-model="group"><option value="">全部分類</option><option v-for="name in groups" :key="name">{{ name }}</option></select></label></div>
    <FrameChoices :kind="kind" :query="query" :group="group" @select="selected" />
  </UiDialog>
</template>
