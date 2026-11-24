<script setup lang="ts">
import { computed } from 'vue';
import type { GachaState } from '../contracts/gacha';
import economy from '../../../public/shared/gacha-economy.json';
import UiNotice from './UiNotice.vue';

const props = defineProps<{ pool?: GachaState['pools'][number] }>();
const message = computed(() => {
  const pool = props.pool;
  if (!pool) return '';
  const remaining = economy.bonusInterval - (pool.drawCount % economy.bonusInterval);
  if (remaining > 10) return '';
  const weights = pool.bonusWeights;
  const total = Object.values(weights ?? {}).reduce((sum, weight) => sum + weight, 0);
  const odds =
    weights && total > 0
      ? (['common', 'rare', 'epic', 'legendary'] as const)
          .filter((id) => weights[id] > 0)
          .map(
            (id) =>
              `${{ common: '普通', rare: '稀有', epic: '史詩', legendary: '傳說' }[id]} ${Number(((weights[id] / total) * 100).toFixed(3))}%`,
          )
          .join('／')
      : '';
  const next = remaining === 1 ? '下一抽' : `再十連第 ${remaining} 張`;
  return `${pool.label}：${next}觸發 ${economy.bonusInterval} 抽加成${odds ? '（' + odds + '）' : ''}`;
});
</script>

<template>
  <UiNotice :message="message" tone="success" persistent density="compact" />
</template>
