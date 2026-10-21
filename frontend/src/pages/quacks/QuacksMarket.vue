<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import type { QuacksBook } from '../../contracts/quacks';
import QuacksBooks from './QuacksBooks.vue';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import UiIcon from '../../components/UiIcon.vue';
import '../../styles/quacks-market.scss';
const props = withDefaults(defineProps<{ extra?: boolean }>(), { extra: false }),
  game = useQuacksStore(),
  bought = computed(() => (props.extra ? game.mine?.extraBought : game.mine?.bought) || []),
  budget = computed(() => (props.extra ? game.mine?.extraBudget : game.mine?.budget) || 0);
const bookDialog = ref<InstanceType<typeof UiDialog> | null>(null),
  id = useId();
function openBook(book: QuacksBook, event: MouseEvent) {
  game.selectedBook = book.color;
  void bookDialog.value?.open(event.currentTarget as HTMLElement);
}
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
  <section v-if="game.mine" class="vue-quacks-market vue-quacks-compact-market"
    ><div class="vue-quacks-market-top"
      ><header class="vue-quacks-market-heading"
        ><h2>{{ extra ? '幽靈氣息獨立採購' : '藥材市集' }}</h2
        ><span>第 {{ game.state?.round }}／9 回合</span></header
      >
      <div class="vue-quacks-market-budget"
        ><strong :aria-label="'剩餘預算 ' + budget + ' 金幣'">{{ budget }}<span>金幣</span></strong
        ><span :aria-label="'已買 ' + bought.length + '／2 片'"
          ><QuacksGlyph resource="bag" :size="32" /><strong>{{ bought.length }}／2</strong></span
        ></div
      ></div
    >
    <p class="vue-quacks-market-note"
      >最多兩種不同顏色；預算不保留。已購藥材可再點取消，已用於後續效果者除外。</p
    >
    <div class="vue-quacks-market-cart" data-quacks-purchase aria-label="本輪已購藥材"
      ><QuacksGlyph v-if="!bought.length" resource="bag" :size="32" /><span
        v-for="item in bought"
        :key="item.color + ':' + item.value"
        ><QuacksGlyph :chip="item" :size="32" /><span
          >{{ game.state?.books.find((book) => book.color === item.color)?.name }}
          {{ item.value }} · {{ item.price }} 金幣{{ item.canUndo ? '' : ' · 已鎖定' }}</span
        ></span
      ></div
    >
    <div v-if="game.state?.round !== 9" class="vue-quacks-market-grid"
      ><article v-for="book in game.state?.books" :key="book.color" :aria-label="book.name + '採購'"
        ><header
          ><QuacksGlyph :chip="{ color: book.color, value: 1 }" :size="34" /><h3
            class="ui-sr-only"
            >{{ book.name }}</h3
          ><UiButton
            stitch
            icon="book"
            icon-only
            :label="'查閱' + book.name + '藥材書'"
            @click="openBook(book, $event)"
        /></header>
        <p :id="id + '-effect-' + book.color" class="ui-sr-only"
          >{{ book.faceName }}：{{ book.effect }}</p
        >
        <div class="vue-quacks-market-offers"
          ><button
            v-for="offer in book.offers"
            :key="offer.value"
            type="button"
            data-ui-hint
            :aria-pressed="!!selected(book, offer.value)"
            :aria-label="
              (selected(book, offer.value) ? '取消購買 ' : '購買 ') +
              book.name +
              ' ' +
              offer.value +
              '，' +
              offer.price +
              '金幣' +
              (selected(book, offer.value)
                ? selected(book, offer.value)?.canUndo
                  ? '，再點一次取消並退還預算'
                  : '，已鎖定，無法取消'
                : '')
            "
            :aria-describedby="id + '-effect-' + book.color"
            :disabled="disabled(book, offer.value, offer.price)"
            @click="choose(book, offer.value)"
            ><QuacksGlyph :chip="{ color: book.color, value: offer.value }" :size="52" /><strong
              class="vue-quacks-market-price"
              >{{ offer.price }}<span class="ui-sr-only">金幣</span></strong
            ><span class="vue-quacks-market-mark" aria-hidden="true"
              ><UiIcon
                v-if="selected(book, offer.value)"
                :name="
                  selected(book, offer.value)?.canUndo ? 'check' : 'lock'
                " /></span></button></div></article></div
    ><p v-else
      >第九輪不再購買藥材；完成結算時，可用普通預算每 5 金幣轉 1 分。獨立預算依規則另行計分。</p
    ><UiDialog
      ref="bookDialog"
      stitch
      title="本局藥材書"
      class="vue-quacks-market-book-dialog vue-quacks-tools-dialog"
      ><QuacksBooks /></UiDialog
  ></section>
</template>
