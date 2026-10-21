<script setup lang="ts">
import { onMounted } from 'vue';
import { useAchievementsStore } from '../../stores/achievements';
import UiIcon from '../../components/UiIcon.vue';
import AchievementCard from './AchievementCard.vue';
import AchievementRewards from '../../components/AchievementRewards.vue';
const store = useAchievementsStore();
onMounted(() => void store.load());
</script>

<template>
  <div class="page-heading"
    ><div class="kicker">YOUR TABLE MOMENTS</div><h1>成就收藏冊<span>✦</span></h1
    ><p>記下玩過的桌遊時刻。</p></div
  >
  <section
    class="page-panel vue-stitch-panel achievements-panel"
    aria-labelledby="achievementHeading"
  >
    <div class="panel-heading"
      ><span class="panel-number">YOUR COLLECTION / 01</span
      ><h2 id="achievementHeading">成就徽章</h2>
      <p id="achievementSummary" role="status" aria-live="polite" aria-atomic="true">{{
        store.loading
          ? '正在讀取收藏…'
          : store.error
            ? '收藏暫時無法載入。'
            : `已收藏 ${store.unlocked} / ${store.items.length} 枚`
      }}</p>
      <p class="achievement-private-note">此收藏僅自己可見。</p>
    </div>
    <div class="achievement-filters" aria-label="成就篩選">
      <label for="achievementGameFilter"
        >遊戲分類<select
          id="achievementGameFilter"
          v-model="store.gameFilter"
          aria-controls="achievementList"
          :disabled="store.loading || !!store.error"
          ><option value="*">全部遊戲與探索</option
          ><option v-for="group in store.availableGroups" :key="group.key" :value="group.key">{{
            group.label
          }}</option></select
        ></label
      >
      <label for="achievementStatusFilter"
        >解鎖狀態<select
          id="achievementStatusFilter"
          v-model="store.statusFilter"
          aria-controls="achievementList"
          :disabled="store.loading || !!store.error"
          ><option value="*">全部狀態</option
          ><option value="unlocked">已解鎖</option
          ><option value="locked">未解鎖</option></select
        ></label
      >
    </div>
    <p
      id="achievementFilterSummary"
      class="achievement-filter-summary"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      >{{ store.loaded && !store.error ? `目前顯示 ${store.filtered.length} 枚` : '' }}</p
    >
    <div id="achievementList" class="achievement-groups" :aria-busy="store.loading">
      <p v-if="store.loading">正在載入成就…</p>
      <p v-else-if="store.error" class="achievement-empty achievement-error" role="alert">{{
        store.error
      }}</p>
      <template v-else>
        <section
          v-for="group in store.groups"
          :key="group.key"
          class="achievement-group"
          :data-game="group.key"
          :aria-labelledby="'achievement-group-' + group.key"
        >
          <h3 :id="'achievement-group-' + group.key" class="achievement-group-heading"
            ><UiIcon :name="group.icon" class="achievement-group-icon" /><span>{{
              group.label
            }}</span
            ><span class="achievement-group-count"
              >已收藏 {{ group.unlocked }} / {{ group.total }} 枚</span
            ></h3
          >
          <div class="achievement-list"
            ><AchievementCard
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :fallback-icon="group.icon"
          /></div>
        </section>
        <p v-if="!store.filtered.length" class="achievement-empty">{{
          store.items.length ? '此篩選沒有符合的成就。' : '目前沒有可收集的成就。'
        }}</p>
      </template>
    </div>
    <div class="frontend-retry-slot"
      ><button
        v-if="store.error"
        id="achievementRetry"
        class="page-button page-button-outline"
        type="button"
        @click="store.load()"
        ><UiIcon name="refresh" />重新載入成就</button
      ></div
    > </section
  ><AchievementRewards />
</template>
