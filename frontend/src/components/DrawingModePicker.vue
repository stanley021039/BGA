<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { record } from '../services/validation';
import UiField from './UiField.vue';
import UiLink from './UiLink.vue';

const modes = [
  { id: 'classic', type: 'draw', label: '你畫我猜', players: '2–8 人', guide: '/draw?learn=1' },
  { id: 'oracle', type: 'draw', label: '塗鴉神諭', players: '2–8 人', guide: '/draw?learn=1' },
  {
    id: 'brainwave',
    type: 'brainwave',
    label: '電波畫家',
    players: '3–8 人',
    guide: '/brainwave?rules=1',
  },
  {
    id: 'minimal',
    type: 'minimal',
    label: '極簡畫家',
    players: '3–8 人',
    guide: '/minimal?learn=1',
  },
  {
    id: 'telephone',
    type: 'telephone',
    label: '傳情畫意',
    players: '3–8 人',
    guide: '/telephone?learn=1',
  },
] as const;

const room = useRoomStore();
const current = computed(() => {
  if (room.type !== 'draw') return room.type;
  const mode = record(room.snapshot?.options || {}).playMode;
  return mode === 'unselected' ? '' : mode === 'oracle' ? 'oracle' : 'classic';
});
const selected = ref('');
const switching = ref(false);
const notice = ref('');
const active = computed(() => modes.find((mode) => mode.id === current.value));
watch(
  current,
  (mode) => {
    selected.value = mode;
    switching.value = false;
    notice.value = '';
  },
  { immediate: true },
);

const options = [
  { value: '', label: '請選擇玩法', disabled: true },
  ...modes.map((mode) => ({ value: mode.id, label: mode.label + ' · ' + mode.players })),
];
async function change(value: string | number | null | undefined) {
  const mode = modes.find((option) => option.id === value);
  if (
    !mode ||
    !room.host ||
    !room.connected ||
    room.snapshot?.phase !== 'waiting' ||
    room.busy ||
    switching.value ||
    mode.id === current.value
  )
    return;
  notice.value = '';
  selected.value = mode.id;
  switching.value = true;
  const ok = await room.command('change-game', {
    targetType: mode.type,
    ...(mode.type === 'draw' ? { targetDrawMode: mode.id } : {}),
  });
  if (!ok) {
    selected.value = current.value;
    switching.value = false;
    notice.value = room.message;
  }
}
</script>

<template>
  <div class="drawing-mode-picker">
    <template v-if="room.host">
      <UiField
        :model-value="selected"
        control="select"
        label="畫畫玩法"
        :options="options"
        :disabled="switching || room.busy || !room.connected"
        @update:model-value="change"
      />
      <p v-if="switching" role="status">正在切換玩法…</p>
      <p v-if="notice" class="drawing-mode-notice" role="alert">{{ notice }}</p>
    </template>
    <p v-else>{{ active ? '本桌玩法：' + active.label : '等待房主選擇畫畫玩法。' }}</p>
    <UiLink
      v-if="active"
      :href="active.guide"
      target="_blank"
      rel="noopener"
      :label="active.label + '玩法說明'"
    />
  </div>
</template>

<style scoped>
.drawing-mode-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  min-inline-size: 0;
  gap: var(--stitch-space-8);
}
.drawing-mode-notice {
  flex-basis: 100%;
}
.drawing-mode-picker > .ui-field {
  flex: 0 1 12rem;
  min-inline-size: 0;
}
</style>
