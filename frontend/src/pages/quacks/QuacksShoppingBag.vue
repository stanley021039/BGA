<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import type { Ingredient } from '../../contracts/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
// Owned-chip view for shopping and choice screens; unlike the brewing peek it has no per-round limit.
const game = useQuacksStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const order = ['white', 'orange', 'green', 'blue', 'red', 'yellow', 'black', 'purple', 'locoweed'];
const chips = computed(() => game.mine?.shoppingBag || []);
const groups = computed(() => {
  const counts = new Map<string, Ingredient & { count: number }>();
  for (const chip of chips.value) {
    const key = chip.color + ':' + chip.value,
      prior = counts.get(key);
    if (prior) prior.count++;
    else counts.set(key, { ...chip, count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => order.indexOf(a.color) - order.indexOf(b.color) || a.value - b.value,
  );
});
</script>
<template>
  <UiButton
    class="vue-quacks-shopping-bag-button"
    icon-only
    :label="'查看目前藥袋內容，共 ' + chips.length + ' 片（可重複查看）'"
    :disabled="!game.mine?.shoppingBag"
    @click="dialog?.open()"
    ><template #icon><QuacksGlyph resource="bag" :size="48" /></template
  ></UiButton>
  <UiDialog
    ref="dialog"
    class="vue-quacks-bag-dialog"
    :title="
      (game.state?.stage === 'shopping' ? '目前藥袋 · ' : '持有藥材 · ') + chips.length + ' 片'
    "
  >
    <div class="vue-quacks-bag-grid"
      ><div v-for="chip in groups" :key="chip.color + ':' + chip.value"
        ><QuacksGlyph :chip="chip" :size="48" /><strong>× {{ chip.count }}</strong></div
      ></div
    >
  </UiDialog>
</template>
