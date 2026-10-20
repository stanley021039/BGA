<script setup lang="ts">
import { computed } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import FramePreview from './FramePreview.vue';
const props = withDefaults(
  defineProps<{ kind?: 'barrage' | 'media'; query?: string; group?: string; stitch?: boolean }>(),
  { kind: 'barrage', query: '', group: '', stitch: false },
);
const emit = defineEmits<{ select: [id: string] }>();
const prefs = usePreferencesStore();
const selected = computed(() =>
  props.kind === 'barrage' ? prefs.barrage?.selected || 'default' : prefs.media,
);
const options = computed(() =>
  prefs.frames.filter(
    (item) =>
      (!props.group || props.group === 'all' || (item.group || '經典內建') === props.group) &&
      item.label.includes(props.query.trim()),
  ),
);
function select(id: string) {
  prefs.setFrame(props.kind, id);
  emit('select', id);
}
</script>
<template>
  <div
    class="barrage-frame-grid"
    :class="{ 'vue-stitch-frame-grid': stitch }"
    role="group"
    :aria-label="kind === 'barrage' ? '可用彈幕框' : '播放器外觀'"
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="barrage-frame-choice"
      :aria-label="option.label + (kind === 'barrage' ? '彈幕框' : '播放器風格')"
      :aria-pressed="selected === option.id"
      @click="select(option.id)"
      ><span class="barrage-frame-label"
        >{{ stitch ? prefs.frames.findIndex((frame) => frame.id === option.id) + 1 + '. ' : ''
        }}{{ option.label }}</span
      ><span v-if="stitch" class="vue-frame-preview-slot" aria-hidden="true"
        ><FramePreview
          :kind="kind"
          :frame="option.id"
          :name="option.label"
          message="這一桌好好玩！" /></span
      ><FramePreview
        v-else
        :frame="option.id"
        :name="kind === 'media' ? '播放器' : '小雨'"
        :message="kind === 'media' ? '我的風格' : '這一桌好好玩！'"
        aria-hidden="true"
      /><span class="barrage-frame-selection">{{
        selected === option.id ? '✓ 使用中' : '套用外觀'
      }}</span></button
    >
    <p v-if="!options.length" class="barrage-frame-empty" role="status">沒有符合的外觀。</p>
  </div>
</template>
