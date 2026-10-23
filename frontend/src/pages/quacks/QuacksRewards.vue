<script setup lang="ts">
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import UiButton from '../../components/UiButton.vue';
import UiIcon from '../../components/UiIcon.vue';
const game = useQuacksStore(),
  reward = computed(() => game.mine?.rewardPreview);
const fields = [
  { mode: 'score', label: '勝利分數', key: 'points' },
  { mode: 'buy', label: '購物預算', key: 'coins' },
] as const;
</script>
<template>
  <section v-if="reward" class="vue-quacks-reward-columns" aria-label="格位獎勵">
    <article v-for="field in fields" :key="field.mode">
      <h2>{{ field.label }}</h2
      ><strong class="vue-quacks-reward-number">{{ reward[field.key] }}</strong>
      <span
        v-if="reward.both || reward.choice === field.mode"
        class="vue-quacks-reward-check"
        :aria-label="field.label + '可領取'"
        ><UiIcon name="check"
      /></span>
      <UiButton
        v-if="!reward.both"
        icon="check"
        :label="'選擇' + field.label"
        :disabled="!game.available || game.mine?.ready"
        @click="game.command('reward', { mode: field.mode })"
      />
    </article>
  </section>
</template>
<style scoped>
.vue-quacks-reward-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
}
article {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 20px;
  min-height: 240px;
  padding: 24px;
  border: 1px solid var(--play-line);
  border-radius: 16px;
  background: var(--play-paper);
}
h2 {
  margin: 0;
  font-size: 1.25rem;
}
.vue-quacks-reward-number {
  font-size: 4rem;
  font-variant-numeric: tabular-nums;
}
.vue-quacks-reward-check {
  position: absolute;
  right: 16px;
  bottom: 16px;
  color: var(--stitch-primary);
}
.vue-quacks-reward-check :deep(.ui-icon) {
  width: 40px;
  height: 40px;
  stroke-width: 3;
}
@media (max-width: 600px) {
  article {
    padding: 16px 8px;
    min-height: 200px;
  }
  h2 {
    font-size: 1rem;
  }
}
</style>
