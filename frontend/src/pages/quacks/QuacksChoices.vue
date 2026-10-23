<script setup lang="ts">
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
import QuacksShoppingBag from './QuacksShoppingBag.vue';
const game = useQuacksStore(),
  choice = computed(() => game.mine?.pending),
  grouped = computed(
    () => choice.value?.kind === 'witch-trade' || choice.value?.options.some((o) => o.coin),
  ),
  coins = computed(() => [
    ...new Set(
      choice.value?.options
        .map((o) => o.coin)
        .filter((x): x is 'gold' | 'copper' | 'silver' => !!x),
    ),
  ]),
  options = computed(() =>
    grouped.value && game.coinFilter
      ? choice.value?.options.filter((o) => o.coin === game.coinFilter)
      : choice.value?.options.filter((o) => !grouped.value || !o.coin),
  );
const labels = { gold: '金幣', copper: '銅幣', silver: '銀幣' };
// Choice titles start with the source's name; show that source's full rule on hover.
const help = computed(() => {
  const title = choice.value?.title || '',
    s = game.state;
  if (!s) return '';
  const sources = [
    s.fortune,
    ...Object.values(s.witches || {}),
    s.visitingWitch,
    ...s.books.map((b) => ({ name: b.name, text: b.effect })),
    ...s.patients,
  ].filter((x): x is { name: string; text: string } => !!x?.name && !!x.text);
  const hit = sources.find(
    (x) => title === x.name || title.startsWith(x.name + '：') || title.endsWith('· ' + x.name),
  );
  return hit ? hit.name + '：' + hit.text : '';
});
</script>
<template>
  <section v-if="choice" class="vue-quacks-choice"
    ><header class="vue-quacks-choice-heading"
      ><h2>{{ choice.title }}</h2
      ><UiButton
        v-if="help"
        variant="ghost"
        icon="help"
        icon-only
        data-ui-hint
        :label="help" /></header
    ><div v-if="game.own" class="vue-quacks-choice-status" aria-label="目前狀態"
      ><span><QuacksGlyph resource="droplet" :size="20" />水滴 {{ game.own.droplet }}</span
      ><span><QuacksGlyph resource="rat" :size="20" />起點 {{ game.own.startPosition }}</span
      ><span>當前 {{ game.own.position }}</span
      ><span><QuacksGlyph resource="ruby" :size="20" />紅寶石 {{ game.own.rubies }}</span
      ><QuacksShoppingBag /></div
    ><template v-if="grouped && !game.coinFilter"
      ><p>先選擇要棄掉的女巫幣。</p
      ><div class="vue-quacks-tabs"
        ><button
          v-for="color in coins"
          :key="color"
          type="button"
          :disabled="
            !game.available ||
            choice.options.filter((o) => o.coin === color).every((o) => o.disabled)
          "
          @click="game.coinFilter = color"
          ><QuacksGlyph :resource="color" />棄{{ labels[color] }}</button
        ></div
      ></template
    ><template v-if="grouped && game.coinFilter"
      ><p>已選擇棄{{ labels[game.coinFilter as keyof typeof labels] }}，再選擇要拿的藥材。</p
      ><UiButton
        icon="undo"
        label="重選女巫幣"
        :disabled="!game.available"
        @click="game.coinFilter = ''" /></template
    ><div class="vue-quacks-choice-grid"
      ><button
        v-for="option in options"
        :title="option.label"
        data-ui-hint
        :aria-label="option.label"
        :key="option.id"
        type="button"
        :disabled="!game.available || option.disabled"
        @click="game.command('choice', { choiceId: choice.id, optionId: option.id })"
        ><span v-if="option.ingredient" class="vue-quacks-tabs"
          ><template v-for="(c, index) in option.ingredients || [option.ingredient]" :key="index"
            ><template v-if="c.fromValue"
              ><QuacksGlyph
                :chip="{ color: c.fromColor || c.color, value: c.fromValue }"
              />→</template
            ><QuacksGlyph :chip="c" :size="64" /></template></span
        ><span
          v-for="(reward, index) in option.label.length > 10 ? option.rewards || [] : []"
          :key="index"
          class="vue-quacks-choice-reward"
          ><span v-if="reward.resource === 'dice'" aria-hidden="true">🎲</span
          ><QuacksGlyph v-else :resource="reward.resource" :size="40" /><strong
            >+{{ reward.amount }}</strong
          ></span
        ><span v-if="!option.ingredient" class="vue-quacks-choice-label"
          ><span v-for="(line, index) in option.label.split(/[，；]/)" :key="index">{{
            line
          }}</span></span
        ><span class="ui-sr-only">{{ option.label }}</span
        ><span v-if="option.cost" class="vue-quacks-tabs"
          ><QuacksGlyph :resource="option.cost.resource" :size="24" />−{{
            option.cost.amount
          }}</span
        ></button
      ></div
    ></section
  >
</template>
<style scoped>
.vue-quacks-choice-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 20px;
  font-size: 1.125rem;
}
.vue-quacks-choice-status > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.vue-quacks-choice-status > :deep(.vue-button) {
  width: 56px;
  height: 56px;
  padding: 4px;
}
.vue-quacks-choice-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.vue-quacks-choice-heading > h2 {
  margin: 0;
}
</style>
