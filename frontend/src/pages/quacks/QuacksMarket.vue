<script setup lang="ts">
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import type { QuacksBook } from '../../contracts/quacks';
const props = withDefaults(defineProps<{ extra?: boolean }>(), { extra: false }),
  game = useQuacksStore(),
  bought = computed(() => (props.extra ? game.mine?.extraBought : game.mine?.bought) || []),
  budget = computed(() => (props.extra ? game.mine?.extraBudget : game.mine?.budget) || 0);
function selected(book: QuacksBook, value: number) {
  return bought.value.find((c) => c.color === book.color && c.value === value);
}
function disabled(book: QuacksBook, value: number, price: number) {
  const item = selected(book, value);
  return (
    !game.available ||
    game.mine?.ready ||
    !!game.mine?.pending ||
    game.state?.round === 9 ||
    (!props.extra && !game.mine?.canBuy) ||
    (item
      ? !item.canUndo
      : budget.value < price ||
        bought.value.length >= 2 ||
        bought.value.some((c) => c.color === book.color))
  );
}
function choose(book: QuacksBook, value: number) {
  const item = selected(book, value);
  void game.command(item ? 'unbuy' : props.extra ? 'extra-buy' : 'buy', {
    color: book.color,
    value,
    ...(item ? { extra: props.extra } : {}),
  });
}
</script>
<template>
  <section v-if="game.mine" class="vue-quacks-market"
    ><h2>{{ extra ? '幽靈氣息獨立採購' : '本輪藥材採購' }} · {{ budget }} 金幣</h2
    ><p
      >已買 {{ bought.length }}／2
      片，最多兩種不同顏色；預算不留到下一輪。勾選的藥材可再點取消，已用於後續效果者除外。</p
    ><div v-if="game.state?.round !== 9" class="vue-quacks-market-grid"
      ><article v-for="book in game.state?.books" :key="book.color"
        ><header
          ><QuacksGlyph :chip="{ color: book.color, value: 1 }" :size="32" /><h3>{{
            book.name
          }}</h3></header
        ><p>{{ book.effect }}</p
        ><div class="vue-quacks-market-offers"
          ><button
            v-for="offer in book.offers"
            :key="offer.value"
            type="button"
            :aria-pressed="!!selected(book, offer.value)"
            :aria-label="
              (selected(book, offer.value) ? '取消購買 ' : '購買 ') +
              book.name +
              ' ' +
              offer.value +
              '，' +
              offer.price +
              '金幣'
            "
            :disabled="disabled(book, offer.value, offer.price)"
            @click="choose(book, offer.value)"
            ><QuacksGlyph :chip="{ color: book.color, value: offer.value }" :size="48" /><strong
              >{{ offer.price }} 金幣</strong
            ><span>{{
              selected(book, offer.value)
                ? selected(book, offer.value)?.canUndo
                  ? '✓ 已購買 · 可取消'
                  : '✓ 已購買 · 已鎖定'
                : '購買'
            }}</span></button
          ></div
        ></article
      ></div
    ><p v-else
      >第九輪不再購買藥材；完成結算時，可用普通預算每 5 金幣轉 1 分。獨立預算依規則另行計分。</p
    ></section
  >
</template>
