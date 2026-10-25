<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import {
  drawingTopics,
  drawSettingsKey,
  drawSettingsPayload,
  readDrawSettings,
} from '../../contracts/draw-settings';
import type { DrawSettingsDraft } from '../../contracts/draw-settings';
import { useRoomStore } from '../../stores/room';
import { useQueuedSave } from '../../composables/queued-save';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import '../../styles/draw-settings.scss';
const props = defineProps<{ snapshot: DrawSnapshot }>();
const inputGroup = useId();
const room = useRoomStore(),
  draft = reactive<DrawSettingsDraft>(readDrawSettings(props.snapshot.options)),
  canonical = ref<string | null>(null);
const editable = computed(
  () =>
    room.settingsManager &&
    !!room.seat &&
    !room.terminal &&
    ['waiting', 'finished'].includes(props.snapshot.phase),
);
const save = useQueuedSave<Record<string, unknown>>({
  allowed: () => editable.value,
  blocked: () => room.busy,
  save: (value) => room.command('settings', value),
  failure: () => room.message,
});
const { pending, error } = save;
const dirty = computed(
  () => canonical.value !== null && drawSettingsKey(draft) !== canonical.value,
);
let syncing = false;
watch(
  [() => JSON.stringify(props.snapshot.options), () => editable.value, () => room.scope],
  () => {
    const value = readDrawSettings(props.snapshot.options),
      key = drawSettingsKey(value);
    const adopt = canonical.value === null || !editable.value || (!pending.value && !dirty.value);
    canonical.value = key;
    syncing = true;
    if (adopt) Object.assign(draft, value);
    else if (draft.mode === 'legacy' && value.mode !== 'legacy') {
      draft.mode = value.mode;
      draft.rounds = value.rounds;
      draft.score = value.score;
    }
    syncing = false;
    if (!editable.value) save.reset();
  },
  { immediate: true },
);
function queue() {
  if (syncing || !editable.value) return;
  try {
    save.enqueue(drawSettingsPayload(draft));
  } catch (cause) {
    save.invalidate(cause instanceof Error ? cause.message : '設定資料不正確');
  }
}
watch(() => drawSettingsKey(draft), queue, { flush: 'sync' });
async function flush(): Promise<boolean> {
  if (!editable.value) return false;
  try {
    const value = drawSettingsPayload(draft);
    if (!pending.value && dirty.value && !error.value) save.enqueue(value);
  } catch (cause) {
    save.invalidate(cause instanceof Error ? cause.message : '設定資料不正確');
    return false;
  }
  return (await save.flush()) && !pending.value && !error.value;
}
async function retry() {
  queue();
  await flush();
}
defineExpose({
  flush,
  pending: () => pending.value,
  error: () => error.value,
  dirty: () => dirty.value,
});
</script>
<template>
  <section class="vue-draw-settings vue-draw-approved-settings" aria-label="房間設定">
    <header
      ><h2>房間設定</h2
      ><p>{{
        editable
          ? '更改後自動儲存；開局前會確認最新設定。'
          : '只有房主或管理者能修改；以下為目前房間設定。'
      }}</p></header
    >
    <div class="vue-draw-settings-content">
      <fieldset :disabled="!editable">
        <legend>題目類別</legend>
        <div class="vue-draw-topic-actions"
          ><span>可多選</span
          ><UiButton
            variant="ghost"
            label="全選題目類別"
            caption="全選"
            icon="check"
            @click="draft.topics = drawingTopics.map(([id]) => id)" /><UiButton
            variant="ghost"
            label="清除題目類別"
            caption="清除"
            icon="close"
            @click="draft.topics = []"
        /></div>
        <div class="vue-draw-options"
          ><label v-for="[id, label] in drawingTopics" :key="id"
            ><input v-model="draft.topics" type="checkbox" :value="id" /><span>{{
              label
            }}</span></label
          ></div
        >
        <p>自定義只使用共編題庫的投稿題目；至少選擇一個類別。</p>
      </fieldset>
      <fieldset :disabled="!editable">
        <legend>作畫時間</legend
        ><div class="vue-draw-options"
          ><label v-for="value in [60, 90, 120]" :key="value"
            ><input
              v-model="draft.seconds"
              type="radio"
              :name="'draw-seconds-' + inputGroup"
              :value="value"
            /><span>{{ value }} 秒</span></label
          ></div
        >
      </fieldset>
      <fieldset :disabled="!editable">
        <legend>結算條件</legend>
        <div class="vue-draw-ending">
          <div class="vue-draw-ending-choice"
            ><label
              ><input
                v-model="draft.mode"
                type="radio"
                :name="'draw-ending-' + inputGroup"
                value="rounds"
              /><span>固定題數</span></label
            ><span class="vue-draw-ending-value"
              ><input
                v-if="draft.mode === 'rounds'"
                v-model="draft.rounds"
                type="number"
                min="1"
                max="64"
                step="1"
                aria-label="固定總題數"
              /><span v-else>8 題</span></span
            ></div
          >
          <div class="vue-draw-ending-choice"
            ><label
              ><input
                v-model="draft.mode"
                type="radio"
                :name="'draw-ending-' + inputGroup"
                value="score"
              /><span>先達分數</span></label
            ><span class="vue-draw-ending-value"
              ><input
                v-if="draft.mode === 'score'"
                v-model="draft.score"
                type="number"
                min="10"
                max="1000"
                step="1"
                aria-label="目標分數"
              /><span v-else>100 分</span></span
            ></div
          >
          <label v-if="draft.mode === 'legacy'"
            ><input
              v-model="draft.mode"
              type="radio"
              :name="'draw-ending-' + inputGroup"
              value="legacy"
            /><span>每位玩家畫一次（目前設定）</span></label
          >
        </div>
        <p class="vue-draw-ending-hint">{{
          draft.mode === 'legacy'
            ? '每位玩家畫一次；改用固定題數或分數後，無法切回此設定。'
            : draft.mode === 'score'
              ? '10–1000 分；當題揭曉後結算，最多 64 題。'
              : '1–64 題；畫者依入座順序輪替。'
        }}</p>
      </fieldset>
    </div>
    <footer
      ><StatusSlot
        :persistent="pending || !!error"
        :message="error || (pending ? '正在儲存設定…' : '')"
        :error="!!error" /><UiButton
        variant="ghost"
        v-if="error && editable"
        icon="refresh"
        label="重試儲存設定"
        :disabled="pending || room.busy"
        @click="retry"
    /></footer>
  </section>
</template>
