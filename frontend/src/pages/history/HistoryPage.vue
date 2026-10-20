<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useHistoryStore } from '../../stores/history';
import { gameNames, historyStatuses } from '../../contracts/history';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import HistoryBoard from './HistoryBoard.vue';
const store = useHistoryStore();
const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-TW') : '日期不明';
const downloadUrls = new Set<string>();
function download() {
  if (!store.replay || !store.selected) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(store.replay.records, null, 2)], { type: 'application/json' }));
  downloadUrls.add(url);
  const link = document.createElement('a'); link.href = url; link.download = `${store.selected.type}-${store.selected.id}.json`; link.click();
  setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 1000);
}
onBeforeUnmount(() => { for (const url of downloadUrls) URL.revokeObjectURL(url); downloadUrls.clear(); });
onMounted(() => void store.load());
</script>
<template>
  <div class="page-heading"><div class="kicker">EVERY TABLE HAS A STORY</div><h1>對局歷史<span>✦</span></h1><p>選擇已結束的對局，逐步回看棋局。</p></div>
  <div class="history-layout">
    <aside class="page-panel history-catalog" aria-label="對局列表">
      <header><h2>對局列表</h2><label for="filter">遊戲<select id="filter" v-model="store.filter" aria-controls="list"><option value="">全部遊戲</option><option v-for="(name, type) in gameNames" :key="type" :value="type">{{ name }}</option></select></label><UiButton id="refresh" icon="refresh" icon-only label="更新列表" :pending="store.loading" @click="store.load()" /></header>
      <StatusSlot :message="store.loading ? '正在載入對局…' : store.listError || `顯示 ${store.filtered.length} 場對局`" :error="!!store.listError" />
      <div id="list" class="history-list" :aria-busy="store.loading"><p v-if="!store.filtered.length">{{ store.listError ? '請更新列表後重試。' : store.loading ? '正在載入…' : '尚無對局記錄。' }}</p><button v-for="match in store.filtered" :key="match.id" :data-id="match.id" :disabled="match.status === 'playing'" :aria-pressed="store.selected?.id === match.id" @click="store.open(match)"><strong>{{ match.name }}</strong><small>{{ gameNames[match.type] || match.type }} · {{ historyStatuses[match.status] || match.status }}</small><small>{{ date(match.startedAt) }}<br>{{ match.players.join('、') }}</small></button></div>
    </aside>
    <section class="page-panel history-replay-panel" aria-label="對局回看" :aria-busy="store.opening">
      <header class="history-replay-heading"><div><h2 id="title">{{ store.selected?.name || '逐步回看' }}</h2><p id="info">{{ store.selected && store.replay ? `${gameNames[store.selected.type] || store.selected.type} · ${historyStatuses[store.selected.status] || store.selected.status} · ${store.replay.frames.length} 個狀態 · 完整資訊回看` : '啟用記錄功能後的新對局才有完整存檔。' }}</p></div><UiButton id="download" icon="download" icon-only label="下載完整 JSON" :disabled="!store.replay || store.opening" @click="download" /></header>
      <div class="history-transport"><div class="history-controls"><UiButton id="prev" icon="previous" icon-only label="上一步" :disabled="!store.replay || store.step === 0 || store.opening" @click="store.move(store.step - 1)" /><input id="step" type="range" min="0" :max="Math.max(0, (store.replay?.frames.length || 1) - 1)" :value="store.step" :disabled="!store.replay || store.opening" aria-label="歷史步驟" @input="store.move(Number(($event.target as HTMLInputElement).value))"><UiButton id="next" icon="next" icon-only label="下一步" :disabled="!store.replay || store.step === (store.replay?.frames.length || 1) - 1 || store.opening" @click="store.move(store.step + 1)" /></div><label for="jump">步驟<select id="jump" :value="store.step" :disabled="!store.replay || store.opening" @change="store.move(Number(($event.target as HTMLSelectElement).value))"><option v-if="!store.replay" value="0">尚未選擇對局</option><option v-for="(frame, index) in store.replay?.frames || []" :key="index" :value="index">{{ index + 1 }}. {{ frame.label }}</option></select></label></div>
      <StatusSlot id="error" :message="store.opening ? '正在讀取對局…' : store.error" :error="!!store.error" />
      <div class="history-replay-content"><div v-if="!store.frame || !store.selected" id="empty"><p>選擇一場已結束的對局，逐步回看棋局。</p><p>進行中的內容會在結束後開放。</p></div><article v-else id="replay"><HistoryBoard :type="store.selected.type" :state="store.frame.state" /><details><summary>這一步的原始記錄</summary><pre id="raw">{{ JSON.stringify(store.frame.record, null, 2) }}</pre></details></article></div>
    </section>
  </div>
</template>
