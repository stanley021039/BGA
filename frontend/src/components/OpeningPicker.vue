<script setup lang="ts">
import EntryOpening from '../engines/opening-theme.js';

import { ref } from 'vue';
import UiDialog from './UiDialog.vue';
import UiIcon from './UiIcon.vue';
import { requestJson } from '../services/http';
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const selected = ref('default'),
  unlocked = ref<string[]>([]),
  pending = ref(false),
  message = ref('');
const themes = [
  { id: 'home-family', label: '我們這一家（直接獲得）', image: '/assets/auth/home-family.jpg' },
  { id: 'default', label: '歡迎來到 Ave Mujica 的世界', image: '/assets/auth/login-864.webp' },
  { id: 'soul-world', label: '歡迎來到我的屍魂界', image: '/assets/auth/soul-world.webp' },
];
async function open() {
  dialog.value?.open();
  pending.value = true;
  message.value = '';
  try {
    const data = (await requestJson('/api/profile/opening')) as {
      theme: string;
      unlocked: string[];
    };
    selected.value = data.theme;
    unlocked.value = data.unlocked;
    EntryOpening?.remember(data.theme);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '無法載入開場樣式';
  } finally {
    pending.value = false;
  }
}
async function choose(id: string) {
  if (pending.value || (id !== 'default' && !unlocked.value.includes(id))) return;
  pending.value = true;
  try {
    const data = (await requestJson('/api/profile/opening', {
      method: 'POST',
      body: { theme: id },
    })) as { theme: string };
    selected.value = data.theme;
    EntryOpening?.remember(data.theme);
    message.value = '已套用；下次進入網站時播放。';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '套用失敗';
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <button type="button" class="vue-preference-frame opening-picker-trigger" @click="open"
    ><UiIcon name="play" /><span>網站開場樣式</span><UiIcon name="next"
  /></button>
  <UiDialog ref="dialog" title="網站開場樣式">
    <div class="opening-options">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        :aria-pressed="selected === theme.id"
        :aria-disabled="pending || (theme.id !== 'default' && !unlocked.includes(theme.id))"
        @click="choose(theme.id)"
      >
        <img :src="theme.image" alt="" /><strong>{{ theme.label }}</strong>
        <span>{{
          theme.id !== 'default' && !unlocked.includes(theme.id)
            ? '完成三款不同遊戲解鎖（不含跑團、股市）'
            : selected === theme.id
              ? '✓ 使用中'
              : '套用開場'
        }}</span>
      </button>
    </div>
    <p role="status">{{ message }}</p>
  </UiDialog>
</template>
<style scoped>
.opening-picker-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  --ui-button-radius: 8px;
}
.opening-picker-trigger span {
  flex: 1;
  text-align: start;
}
.opening-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 12px;
}
.opening-options button {
  display: grid;
  gap: 8px;
  padding: 12px;
  --ui-button-radius: 12px;
  text-align: start;
  white-space: normal;
}
.opening-options img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 8px;
}
.opening-options [aria-pressed='true'] {
  box-shadow: 0 0 0 2px var(--play-yellow, #f6c453);
}
</style>
