<script setup lang="ts">
import { lobbyBackgrounds, useLobbyBackgroundStore } from '../stores/lobby-background';
import { ref } from 'vue';
import { requestJson } from '../services/http';
import '../styles/lobby-backgrounds.scss';
import UiDialog from './UiDialog.vue';
import UiIcon from './UiIcon.vue';
const background = useLobbyBackgroundStore();
const owned = ref(['default', 'castle']);
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
function open() {
  void background.refresh();
  void requestJson('/api/achievements')
    .then((data) => {
      owned.value = (data as { bonusRewards: { backgrounds: string[] } }).bonusRewards.backgrounds;
    })
    .catch(() => {});
  dialog.value?.open();
}
</script>
<template>
  <section class="vue-preference-group lobby-background-preference" aria-label="大廳背景設定">
    <button
      type="button"
      class="vue-preference-frame background-picker-trigger"
      aria-label="大廳背景"
      @click="open"
    >
      <UiIcon name="frame" /><span>大廳共用背景</span>
      <small>{{
        lobbyBackgrounds.find((item) => item.id === background.selected)?.label || '原本'
      }}</small
      ><UiIcon name="next" />
    </button>
    <UiDialog ref="dialog" title="選擇大廳共用背景">
      <div class="lobby-background-options" role="group" aria-label="大廳共用背景">
        <button
          v-for="item in lobbyBackgrounds"
          :key="item.id"
          type="button"
          :aria-pressed="background.selected === item.id"
          :disabled="background.pending"
          :aria-disabled="!owned.includes(item.id)"
          @click="owned.includes(item.id) && background.select(item.id)"
        >
          <span
            class="lobby-background-swatch"
            :data-background="item.id"
            aria-hidden="true"
          ></span>
          <span>{{ item.label }}</span
          ><small v-if="!owned.includes(item.id)"
            >🔒 {{ item.target }} 次對應遊戲正式結算解鎖；詳見成就</small
          >
        </button>
      </div>
      <p>所有大廳玩家共用；每 30 秒限更換一次。</p>
      <p role="status">{{ background.message }}</p>
    </UiDialog>
  </section>
</template>
<style scoped>
.background-picker-trigger {
  display: grid;
  grid-template-columns: 24px 1fr auto 24px;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  text-align: start;
  --ui-button-radius: 8px;
  background: var(--play-surface, #272525);
  color: inherit;
}
.lobby-background-preference h3 {
  margin: 0 0 8px;
  font-size: 16px;
}
.lobby-background-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.lobby-background-options button {
  --ui-button-radius: 12px;
  --ui-button-border-color: var(--play-line, #8a928d);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: stretch;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--play-line, #8a928d);
  border-radius: 12px;
  background: var(--play-surface, #1c2826);
  color: inherit;
  cursor: pointer;
}
.lobby-background-options button[aria-pressed='true'] {
  --ui-button-border-color: #edbc5b;
  border-color: #edbc5b;
  box-shadow: 0 0 0 2px #edbc5b66;
}
.lobby-background-swatch {
  display: block;
  width: 100%;
  height: 64px;
  border-radius: 6px;
  background-color: var(--play-paper, #304238);
}
</style>
