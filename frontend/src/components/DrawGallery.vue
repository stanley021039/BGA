<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useDrawResultsStore } from '../stores/draw-results';
import { useRoomStore } from '../stores/room';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import UiTabs from './UiTabs.vue';
import StatusSlot from './StatusSlot.vue';
import ResultCanvas from './ResultCanvas.vue';
import DrawVote from './DrawVote.vue';
import PlayerAvatar from './PlayerAvatar.vue';
import DrawGalleryThumbnail from './DrawGalleryThumbnail.vue';
import '../styles/draw-gallery.scss';
defineProps<{ stitch?: boolean }>();
const results = useDrawResultsStore(), room = useRoomStore(), prefix = useId();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null), confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null), opened = ref(false);
let disposed = false;
const tabs = computed(() => [
  { id: 'all', label: '最近全部', count: String(results.results.length) },
  { id: 'mine', label: '我作畫的', count: String(results.results.filter(result => result.artist.id === room.snapshot?.me).length) },
  { id: 'saved', label: '已收藏', count: String(results.results.filter(result => results.saved.has(result.resultId)).length) },
]);
const selection = computed(() => results.view?.summary), snapshot = computed(() => results.view?.snapshot || null);
const selectedSaved = computed(() => !!results.view?.selectedId && results.saved.has(results.view.selectedId));
const saveState = computed(() => results.view?.save), recollect = computed(() => saveState.value?.error?.code === 'DRAW_SAVED_ARTWORK_DELETED');
const canvasStatus = computed(() => results.initError || (results.view?.error ? results.view.error.code === 'DRAW_RESULT_NOT_FOUND' ? '這輪已不在最近畫作中；答案與得分仍保留在目前畫面。' : results.view.error.message : results.view?.loading ? '正在讀取這輪畫作…' : ''));
const saveStatus = computed(() => saveState.value?.status === 'saved' ? '已加入你的私人素材庫。' : saveState.value?.status === 'pending' ? '正在收藏這輪已公開的畫作；遊戲繼續進行。' : saveState.value?.status === 'error' ? recollect.value ? '之前收藏的作品已被刪除。可明確選擇重新收藏。' : saveState.value.error?.message || '收藏失敗，請重試。' : '收藏會保存目前選定的這一輪。');
async function open(id?: string, source?: HTMLElement) {
  if (!results.enabled) return null;
  opened.value = true; await dialog.value?.open(source);
  if (disposed || !opened.value || !results.enabled) return null;
  return results.select(id);
}
function setFilter(value: string) { if (value === 'all' || value === 'mine' || value === 'saved') results.filter = value; }
async function favorite() {
  const id = results.view?.selectedId, scope = room.scope;
  if (!id || results.busy || results.view?.savingId || results.view?.loading) return;
  if (!results.saved.has(id)) { await results.save(id); return; }
  if (!await confirmation.value?.ask('這會移除私人素材庫中的收藏；房間公開畫作與得分會保留。', '取消收藏')) return;
  if (scope === room.scope && results.enabled) await results.unsave(id);
}
function close() { opened.value = false; confirmation.value?.cancel(); }
watch([() => results.filtered.map(result => result.resultId).join('|'), () => results.view?.selectedId], () => {
  if (!opened.value || !results.enabled) return;
  if (!results.filtered.some(result => result.resultId === results.view?.selectedId)) void results.select(results.filtered[0]?.resultId || null);
});
watch(() => results.enabled, enabled => { if (!enabled) { close(); dialog.value?.close(); } });
watch(() => room.scope, () => { close(); dialog.value?.close(); });
onBeforeUnmount(() => { disposed = true; close(); });
defineExpose({ open });
</script>
<template>
  <UiButton :stitch="stitch" variant="ghost" icon="frame" icon-only caption="畫作" :label="'最近畫作 · ' + results.results.length" :disabled="!results.enabled || (!results.results.length && !results.initError)" @click="open(undefined, $event.currentTarget as HTMLElement)" />
  <UiDialog ref="dialog" stitch class="vue-draw-gallery-dialog" title="最近畫作 · 往期檢視" @closing="close">
    <p class="vue-gallery-introduction">已公開作品及自己的收藏紀錄；保留最近八幅畫作。</p>
    <UiTabs :items="tabs" :model-value="results.filter" label="篩選公開畫作" :id-prefix="prefix + '-tab'" :panel-prefix="prefix + '-panel'" @update:model-value="setFilter" />
    <div v-for="tab in tabs" v-show="results.filter === tab.id" :id="prefix + '-panel-' + tab.id" :key="tab.id" role="tabpanel" :aria-labelledby="prefix + '-tab-' + tab.id" class="vue-gallery-tab-panel">
      <div v-if="results.filter === tab.id" class="vue-gallery-layout">
        <aside class="vue-gallery-list" aria-label="最近畫作清單">
          <header><h3>本局與最近畫作</h3><span>{{ results.filtered.length }} 幅</span></header>
          <p v-if="!results.filtered.length" class="vue-gallery-list-empty">此篩選目前沒有畫作。</p>
          <button v-for="result in results.filtered" :key="result.resultId" type="button" :aria-pressed="results.view?.selectedId === result.resultId" @click="results.select(result.resultId)">
            <DrawGalleryThumbnail :result-id="result.resultId" />
            <span class="vue-gallery-list-copy"><strong>第 {{ result.round }} 輪 · {{ result.answer || '未選定題目' }}</strong><small>{{ result.artist.name }}</small><small>{{ result.gameRunId === results.view?.gameRunId ? '本局' : '先前對局' }}{{ results.saved.has(result.resultId) ? ' · ★ 已收藏' : '' }}</small></span>
          </button>
        </aside>
        <section class="vue-gallery-detail" aria-label="選定畫作">
          <header>
            <div class="vue-gallery-title-row"><h2>{{ selection?.answer ? '【 ' + selection.answer + ' 】' : selection ? '這輪沒有選定題目' : '選擇一幅畫作' }}</h2><span v-if="selection" class="vue-gallery-round-tag">{{ selection.gameRunId === results.view?.gameRunId ? '本局' : '先前對局' }}第 {{ selection.round }} 輪</span><span v-if="selection?.answer" class="vue-gallery-word-length">{{ [...selection.answer].length }} 字</span></div>
            <p>{{ selection ? '畫者：' + selection.artist.name : '從左側清單選擇要查看的回合。' }}</p>
            <p v-if="selection?.reason" class="vue-gallery-result-reason">{{ selection.reason }}</p>
          </header>
          <div class="vue-gallery-detail-content">
            <div class="vue-gallery-canvas-feedback"><StatusSlot :message="canvasStatus" :error="!!results.view?.error || !!results.initError" /></div>
            <ResultCanvas v-if="snapshot && !results.view?.loading" :snapshot="snapshot" />
            <div v-else class="vue-gallery-canvas-empty"><strong>{{ results.view?.loading ? '正在讀取畫作…' : selection ? '畫作尚未載入' : '這裡還沒有畫作' }}</strong><p>{{ selection ? '可以重新載入，或選擇另一幅已公開的畫作。' : '切換篩選查看其他已公開的回合；完成作畫後會出現在這裡。' }}</p></div>
            <section v-if="selection" class="vue-gallery-score-panel" aria-label="本輪得分與紀錄"><header><h3>本輪得分與紀錄</h3><span>共 {{ selection.scores.length }} 人參與</span></header><ul class="vue-gallery-scores">
              <li v-for="score in selection.scores" :key="score.id" :class="{ 'is-positive': score.roundPoints > 0 }"><PlayerAvatar :name="score.name" :avatar="score.avatar" /><div><strong>{{ score.name }}</strong><small>{{ score.id === selection.artist.id ? '畫者' : '猜題者' }} · 累計 {{ score.score }} 分</small></div><span class="vue-gallery-round-points">{{ score.roundPoints > 0 ? '+' : '' }}{{ score.roundPoints }} 分</span></li>
            </ul></section>
            <DrawVote v-if="selection" :result-id="results.view?.selectedId || null" />
          </div>
        </section>
      </div>
    </div>
    <footer class="vue-gallery-export">
      <div class="vue-gallery-footer-summary"><p>查看與收藏時，遊戲繼續進行。</p><StatusSlot :message="selection ? saveStatus : ''" :error="saveState?.status === 'error'" /></div>
      <div class="vue-gallery-actions">
        <UiButton stitch variant="ghost" icon="download" icon-only caption="PNG" label="下載畫作 PNG" :disabled="!snapshot || results.view?.loading || results.busy" @click="results.download()" />
        <UiButton stitch variant="ghost" icon="refresh" icon-only caption="重試" label="重新載入畫作" :disabled="!selection || results.view?.loading || results.busy" @click="results.select(results.view?.selectedId, true)" />
        <UiButton stitch variant="secondary" icon="save" :caption="selectedSaved ? '取消收藏' : '收藏畫作'" :label="selectedSaved ? '取消這幅畫的收藏' : saveState?.status === 'error' ? '重試收藏這幅畫' : '收藏這幅畫'" :aria-pressed="selectedSaved" :pending="!!results.view?.savingId" :disabled="!snapshot || results.view?.loading || results.busy || recollect" @click="favorite" />
        <UiButton v-if="recollect" stitch variant="secondary" icon="save" label="重新收藏這幅畫" :disabled="!!results.view?.savingId || results.busy" @click="results.save(results.view?.selectedId, true)" />
        <UiButton stitch variant="primary" icon="download" label="匯出畫作集 ZIP" :pending="results.busy" :disabled="!results.filtered.length" @click="results.exportAll()" />
      </div>
      <StatusSlot class="vue-gallery-export-feedback" :message="results.message" :error="results.failed" />
    </footer>
  </UiDialog>
  <ConfirmDialog ref="confirmation" />
</template>
