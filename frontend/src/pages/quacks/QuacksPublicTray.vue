<script setup lang="ts">
import { computed } from 'vue';
import type { QuacksRecipe, QuacksChip } from '../../contracts/quacks';
import { ingredientNames } from '../../contracts/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
const props = defineProps<{ recipe: QuacksRecipe }>();
// Use only the accepted public projection of the viewed pot, never mine/cache.
// The tray wraps onto several lines, so it can list every drawn chip in order.
const limit = 40;
const chips = computed(() => (props.recipe.hidden ? [] : (props.recipe.pot || []).slice(-limit)));
const omitted = computed(() =>
  props.recipe.hidden ? 0 : Math.max(0, (props.recipe.pot || []).length - limit),
);
function label(chip: QuacksChip) {
  return (
    ingredientNames[chip.color] +
    ' ' +
    chip.value +
    (chip.effectColor && chip.effectColor !== chip.color
      ? '，本次模仿' + ingredientNames[chip.effectColor] + ' ' + (chip.effectValue ?? chip.value)
      : '')
  );
}
</script>
<template>
  <div
    v-if="recipe.hidden || chips.length"
    class="vue-quacks-public-tray"
    aria-label="已公開投入的藥材"
  >
    <p v-if="recipe.hidden">投入藥材尚未公開</p>
    <template v-else-if="chips.length"
      ><span v-if="omitted" :aria-label="'另有 ' + omitted + ' 片較早投入的藥材'"
        >+{{ omitted }}</span
      ><span
        v-for="chip in chips"
        :key="chip.id"
        role="img"
        :aria-label="label(chip)"
        :title="label(chip)"
        ><QuacksGlyph :chip="chip" :size="26" /></span
    ></template>
  </div>
</template>
