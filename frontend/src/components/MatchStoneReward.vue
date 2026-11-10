<script setup lang="ts">
import { computed } from 'vue';
import type { RoomSnapshot } from '../contracts/room';
import economy from '../../../public/shared/gacha-economy.json';
import RewardCurrencyIcon from './RewardCurrencyIcon.vue';
import UiBadge from './UiBadge.vue';
import UiPanel from './UiPanel.vue';

const props = defineProps<{ reward: NonNullable<RoomSnapshot['matchReward']> }>();
const number = new Intl.NumberFormat('zh-TW');
const bonus = computed(() =>
  props.reward.winner && props.reward.coins === economy.matchCoins + economy.winnerCoins
    ? economy.winnerCoins
    : 0,
);
</script>

<template>
  <UiPanel title="對局獎勵" density="compact" class="match-stone-reward">
    <template #title-before><RewardCurrencyIcon kind="stone" /></template>
    <div v-if="reward.coins" class="match-stone-reward-content">
      <strong>已入帳 {{ number.format(reward.coins) }} 聖潔石</strong>
      <div class="match-stone-reward-items">
        <UiBadge>有效對局 +{{ number.format(reward.coins - bonus) }}</UiBadge>
        <UiBadge v-if="bonus" tone="primary">勝者加成 +{{ number.format(bonus) }}</UiBadge>
      </div>
    </div>
    <p v-else>這場沒有獲得聖潔石。</p>
  </UiPanel>
</template>

<style scoped>
.match-stone-reward {
  position: relative;
  grid-column: 1 / -1;
}
.match-stone-reward-content,
.match-stone-reward-items {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--stitch-space-8);
}
.match-stone-reward-content {
  justify-content: space-between;
}
.match-stone-reward-content strong {
  font-size: var(--stitch-text-section);
}
</style>
