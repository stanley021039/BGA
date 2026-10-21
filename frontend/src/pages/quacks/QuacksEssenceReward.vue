<script setup lang="ts">
import QuacksGlyph from './QuacksGlyph.vue';
import type { QuacksEssenceReward } from '../../contracts/quacks';
defineProps<{ reward: QuacksEssenceReward; final?: boolean; decorative?: boolean }>();
</script>
<template>
  <span
    class="quacks-essence-reward"
    :inert="decorative || undefined"
    :aria-hidden="decorative || undefined"
  >
    <strong v-if="final">{{ reward.position }} 分</strong>
    <template v-else>
      <QuacksGlyph v-if="reward.chip" :chip="reward.chip" :size="44" />
      <span v-if="reward.rat"><QuacksGlyph resource="rat" :size="28" />+{{ reward.rat }}</span>
      <span v-if="reward.points">{{ reward.points }} 分</span>
      <span v-if="reward.preview">預抽 {{ reward.preview }} 片</span>
      <span v-if="reward.draw">加抽 {{ reward.draw }} 片</span>
      <span v-if="reward.buy"><QuacksGlyph resource="bag" :size="28" />{{ reward.buy }} 金幣</span>
      <span v-if="reward.rubies"
        ><QuacksGlyph resource="ruby" :size="28" />×{{ reward.rubies }}</span
      >
      <span v-if="reward.upgrade">1 → {{ reward.upgrade }} 級</span>
      <span v-if="reward.refill"><QuacksGlyph resource="potion" :size="32" />補滿</span>
      <span v-if="reward.dice">擲骰 {{ reward.dice }} 次</span>
      <span v-if="reward.droplet"
        ><QuacksGlyph resource="droplet" :size="28" />+{{ reward.droplet }}</span
      >
      <span v-if="!Object.keys(reward).some((key) => !['position', 'text'].includes(key))"
        >保留</span
      >
    </template>
  </span>
</template>
<style scoped>
.quacks-essence-reward {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 8px;
  min-height: 44px;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
}
.quacks-essence-reward > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
</style>
