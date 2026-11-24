<script setup lang="ts">
import { lobbyBackgrounds, useLobbyBackgroundStore } from '../stores/lobby-background';
import { onBeforeUnmount, ref, useId } from 'vue';
import { requestJson } from '../services/http';
import { array, record, text } from '../services/validation';
import LobbyBackgroundArt from './LobbyBackgroundArt.vue';
import UiDialog from './UiDialog.vue';
import UiCheckbox from './UiCheckbox.vue';
import UiButton from './UiButton.vue';
import UiChoiceCard from './UiChoiceCard.vue';
import UiNotice from './UiNotice.vue';
import UiLink from './UiLink.vue';
const background = useLobbyBackgroundStore();
const visibilityNoteId = useId();
const owned = ref(['default', 'castle']);
const loading = ref(false),
  error = ref('');
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
let controller: AbortController | undefined;
async function loadOwned() {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  loading.value = true;
  error.value = '';
  try {
    const data = await requestJson('/api/achievements', { signal: request.signal });
    if (!request.signal.aborted)
      owned.value = array(record(record(data).bonusRewards).backgrounds)
        .map((value) => text(value))
        .filter(Boolean);
  } catch (cause) {
    if (!request.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '暫時無法讀取持有背景。';
  } finally {
    if (controller === request) {
      loading.value = false;
      controller = undefined;
    }
  }
}
function open() {
  void background.refresh();
  void loadOwned();
  void dialog.value?.open();
}
function cancelLoad() {
  controller?.abort();
  controller = undefined;
  loading.value = false;
}
onBeforeUnmount(cancelLoad);
</script>
<template>
  <section class="vue-preference-group lobby-background-preference" aria-label="大廳背景設定">
    <UiCheckbox
      label="顯示大廳背景"
      variant="prominent"
      :model-value="background.visible"
      :aria-describedby="visibilityNoteId"
      @update:model-value="background.setVisible($event === true)"
    />
    <p :id="visibilityNoteId" role="status">{{
      background.visibilityPersisted
        ? '只影響此瀏覽器；關閉後保留角色與操作，不更改其他玩家的背景。'
        : '瀏覽器無法保存此設定；本頁仍可切換，重新進入後可能恢復預設。'
    }}</p>
    <UiButton
      class="background-picker-trigger"
      label="大廳背景"
      caption="大廳共用背景"
      icon="frame"
      @click="open"
    />
    <p
      >目前：{{
        lobbyBackgrounds.find((item) => item.id === background.selected)?.label || '原本'
      }}</p
    >
    <UiDialog ref="dialog" title="選擇大廳共用背景" @closing="cancelLoad">
      <p v-if="loading" role="status">讀取持有背景中…</p>
      <UiNotice v-if="error" :message="error" error persistent />
      <UiButton v-if="error" label="重新讀取持有背景" @click="loadOwned" />
      <div
        class="lobby-background-options"
        role="group"
        aria-label="大廳共用背景"
        :aria-busy="loading"
      >
        <UiChoiceCard
          v-for="item in lobbyBackgrounds"
          :key="item.id"
          :label="item.label"
          :selected="background.selected === item.id"
          :disabled="background.pending || loading"
          :unavailable="!owned.includes(item.id)"
          readable-disabled
          @click="
            owned.includes(item.id) && !background.pending && !loading && background.select(item.id)
          "
        >
          <span class="lobby-background-swatch" :data-background="item.id" aria-hidden="true"
            ><LobbyBackgroundArt v-if="item.id !== 'default'" :id="item.id" fit="contain"
          /></span>
          <small v-if="!owned.includes(item.id)">尚未持有 · 抽卡或碎片兌換解鎖</small>
        </UiChoiceCard>
      </div>
      <UiLink href="/gacha" label="前往抽卡機取得背景" />
      <p>所有大廳玩家共用；每 30 秒限更換一次。</p>
      <p role="status">{{ background.message }}</p>
    </UiDialog>
  </section>
</template>
<style scoped>
.background-picker-trigger {
  inline-size: 100%;
}
.lobby-background-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-16);
}
.lobby-background-swatch {
  position: relative;
  display: block;
  inline-size: 100%;
  block-size: 96px;
  overflow: hidden;
}
</style>
