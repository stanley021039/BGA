<script setup lang="ts">
import { computed } from 'vue';
import type { Achievement } from '../../contracts/achievements';
import UiIcon from '../../components/UiIcon.vue';
const props = defineProps<{ item: Achievement; fallbackIcon: string }>();
const categories: Record<string, string> = { intro: '入門', fun: '趣味', exploration: '探索' };
const icons = new Set([
  'edit',
  'gift',
  'users',
  'cards',
  'car',
  'table',
  'book',
  'check',
  'lock',
  'emoji',
  'frame',
  'save',
  'sound',
  'help',
]);
const icon = computed(() => (icons.has(props.item.icon) ? props.item.icon : props.fallbackIcon));
const dateFormat = new Intl.DateTimeFormat('zh-TW', {
  dateStyle: 'medium',
  timeZone: 'Asia/Taipei',
});
const date = computed(() => {
  const value = new Date(props.item.unlockedAt || '');
  return Number.isFinite(value.getTime())
    ? { iso: value.toISOString(), text: '取得於 ' + dateFormat.format(value) }
    : { iso: undefined, text: '取得日期待確認' };
});
</script>

<template>
  <article
    class="achievement-card"
    :class="{ unlocked: !!item.unlockedAt }"
    :data-achievement-id="item.id"
  >
    <UiIcon :name="icon" class="achievement-mark" />
    <div class="achievement-body">
      <h4>{{ item.title }}</h4
      ><p>{{ item.description }}</p>
      <p v-if="item.rewardLabels.length" class="achievement-reward"
        >獎勵：{{ item.rewardLabels.join('、') }}</p
      >
      <span class="achievement-status ui-sr-only">{{
        item.unlockedAt ? '已解鎖' : '尚未解鎖'
      }}</span>
      <time v-if="item.unlockedAt" class="achievement-date" :datetime="date.iso">{{
        date.text
      }}</time>
      <div class="achievement-metadata"
        ><span v-if="categories[item.category]">{{ categories[item.category] }}</span></div
      >
      <p v-if="item.status === 'paused'" class="achievement-paused">暫停新授予，已取得紀錄保留。</p>
    </div>
  </article>
</template>
