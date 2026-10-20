<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import FrameChoices from './FrameChoices.vue';
import '../styles/frame-picker.scss';
const props = defineProps<{ kind: 'barrage' | 'media'; filterable?: boolean }>();
const prefs = usePreferencesStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const query = ref(''),
  group = ref('');
const title = computed(() => (props.kind === 'barrage' ? '選擇彈幕框' : '播放器外觀'));
const groups = computed(() => [...new Set(prefs.frames.map((item) => item.group || '經典內建'))]);
const selectedId = computed(() =>
  props.kind === 'barrage' ? prefs.barrage?.selected || 'default' : prefs.media,
);
const selectedLabel = computed(
  () => prefs.frames.find((item) => item.id === selectedId.value)?.label || '預設',
);
defineExpose({ open: (source?: HTMLElement) => dialog.value?.open(source) });
</script>
<template>
  <UiDialog
    ref="dialog"
    stitch
    :title="title"
    class="vue-frame-picker-dialog"
    :class="{ 'is-media-picker': kind === 'media' }"
  >
    <div class="vue-frame-picker-context"
      ><span class="vue-frame-picker-type"
        ><UiIcon class="ui-icon" :name="kind === 'media' ? 'video' : 'frame'" />{{
          kind === 'media' ? '共用主題外觀' : '共 ' + prefs.frames.length + ' 款樣式'
        }}</span
      ><p>{{
        kind === 'media' ? '預覽播放器外觀，選擇喜歡的框飾。' : '全站遊戲文字與 emoji 彈幕共用。'
      }}</p></div
    >
    <p class="vue-frame-picker-note"
      ><UiIcon class="ui-icon" name="help" />點選款式即可套用並儲存。</p
    >
    <div class="vue-frame-picker-scroll"
      ><div v-if="filterable" class="vue-frame-filters"
        ><label>搜尋外觀<input v-model="query" type="search" /></label
        ><label
          >外觀分類<select v-model="group"
            ><option value="">全部分類</option
            ><option v-for="name in groups" :key="name">{{ name }}</option></select
          ></label
        ></div
      >
      <FrameChoices stitch :kind="kind" :query="query" :group="group" />
    </div>
    <footer class="vue-frame-picker-footer"
      ><div
        ><span>{{ kind === 'media' ? '當前外觀：' : '目前使用：' }}</span
        ><strong class="vue-frame-current-selection">✓ {{ selectedLabel }}</strong
        ><span class="vue-frame-picker-save-note">點選即儲存</span></div
      ><UiButton stitch variant="contrast" label="關閉視窗" @click="dialog?.close()"
    /></footer>
  </UiDialog>
</template>
