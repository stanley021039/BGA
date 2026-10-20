<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
import type { IngredientColor } from '../../contracts/quacks';
import '../../styles/quacks-books.scss';
const game = useQuacksStore(),
  room = useRoomStore(),
  pages = reactive<Partial<Record<IngredientColor, number>>>({}),
  row = computed(
    () =>
      game.state?.bookSelection.find((b) => b.color === game.selectedBook) ||
      game.state?.bookSelection[0],
  ),
  face = computed(
    () =>
      row.value?.candidates.find((b) => b.set === pages[row.value!.color]) ||
      row.value?.candidates.find((b) => b.set === row.value?.selected) ||
      row.value?.candidates[0],
  ),
  author = computed(() => game.state?.players.find((p) => p.id === row.value?.chosenBy)?.name);
let lastRandomId: number | undefined;
watch(
  [
    () => room.scope,
    () =>
      game.state?.bookSelection
        .map((b) => b.color + ':' + b.candidates.map((c) => c.set).join(','))
        .join('|'),
    () => game.state?.events.filter((e) => e.kind === 'book-random').at(-1)?.id,
  ],
  ([scope, , randomId], previous) => {
    const reset = scope !== previous?.[0] || (randomId !== undefined && randomId !== lastRandomId);
    for (const b of game.state?.bookSelection || []) {
      if (reset || !b.candidates.some((candidate) => candidate.set === pages[b.color]))
        pages[b.color] = b.selected;
    }
    if (scope !== previous?.[0]) lastRandomId = undefined;
    if (randomId !== undefined) lastRandomId = randomId;
  },
  { immediate: true },
);
function turn(delta: number) {
  const r = row.value,
    f = face.value;
  if (!r || !f) return;
  pages[r.color] =
    r.candidates[
      (r.candidates.findIndex((b) => b.set === f.set) + delta + r.candidates.length) %
        r.candidates.length
    ]!.set;
}
function keydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  turn(event.key === 'ArrowLeft' ? -1 : 1);
}
</script>
<template>
  <section class="vue-quacks-books vue-quacks-codex">
    <header class="vue-quacks-codex-heading"
      ><h2>{{ game.setup ? '本局藥材書選擇' : '本局藥材書' }}</h2
      ><UiButton
        v-if="game.setup"
        stitch
        icon="refresh"
        icon-only
        label="隨機挑選藥材書"
        :disabled="!game.available"
        @click="game.command('book-random')"
    /></header>
    <nav class="vue-quacks-codex-tabs" aria-label="藥材顏色"
      ><button
        v-for="book in game.state?.bookSelection"
        :key="book.color"
        type="button"
        :aria-pressed="row?.color === book.color"
        @click="game.selectedBook = book.color"
        ><QuacksGlyph :chip="{ color: book.color, value: 1 }" :size="32" /><span>{{
          book.name
        }}</span></button
      ></nav
    >
    <article
      v-if="row && face"
      class="vue-quacks-codex-spread"
      :aria-label="row.name + '藥材書'"
      :data-ingredient="row.color"
    >
      <section class="vue-quacks-codex-page vue-quacks-codex-left">
        <small>本局藥材 · {{ row.name }}</small>
        <span class="vue-quacks-codex-seal" :class="{ 'is-selected': face.set === row.selected }">{{
          face.set === row.selected ? '已選' : '已選第 ' + row.selected + ' 面'
        }}</span>
        <header class="vue-quacks-codex-cover"
          ><QuacksGlyph :chip="{ color: row.color, value: 1 }" :size="76" /><div
            ><h3>{{ row.name }}</h3
            ><p
              >第 {{ face.set }} 面 · {{ face.set === row.selected ? '本局採用' : '瀏覽中' }}</p
            ></div
          ></header
        >
        <div class="vue-quacks-codex-prices" :aria-label="row.name + '第 ' + face.set + ' 面價格'"
          ><div
            v-for="offer in face.offers"
            :key="offer.value"
            :aria-label="'數值 ' + offer.value + '，' + offer.price + ' 金幣'"
            ><QuacksGlyph :chip="{ color: row.color, value: offer.value }" :size="48" /><strong
              >{{ offer.price }} 金幣</strong
            ></div
          ></div
        >
        <p class="vue-quacks-codex-caption">藥材數值與購買價格依這一面顯示。</p>
      </section>
      <section class="vue-quacks-codex-page vue-quacks-codex-right">
        <small>效果翻頁 · {{ row.candidates.length }} 面</small>
        <div class="vue-quacks-codex-effect"
          ><strong>第 {{ face.set }} 面效果</strong
          ><div class="vue-quacks-codex-effect-stack"
            ><p
              v-for="candidate in row.candidates"
              :key="candidate.set"
              :class="{ 'is-measure': candidate.set !== face.set }"
              :aria-hidden="candidate.set !== face.set ? true : undefined"
              >{{ candidate.effect }}</p
            ></div
          ></div
        >
        <div class="vue-quacks-codex-controls" @keydown="keydown">
          <div
            class="vue-quacks-codex-faces"
            role="group"
            :aria-label="row.name + '選擇要查看的書面'"
            ><button
              v-for="candidate in row.candidates"
              :key="candidate.set"
              type="button"
              :aria-pressed="candidate.set === face.set"
              :aria-label="'查看' + row.name + '第 ' + candidate.set + ' 面：' + candidate.effect"
              @click="pages[row.color] = candidate.set"
              ><strong>第 {{ candidate.set }} 面</strong><span>{{ candidate.effect }}</span></button
            ></div
          >
          <div class="vue-quacks-codex-turn"
            ><UiButton
              stitch
              icon="previous"
              icon-only
              :label="row.name + '上一面'"
              :disabled="row.candidates.length < 2"
              @click="turn(-1)" /><span>{{ face.faceName }}</span
            ><UiButton
              stitch
              icon="next"
              icon-only
              :label="row.name + '下一面'"
              :disabled="row.candidates.length < 2"
              @click="turn(1)"
          /></div>
          <UiButton
            v-if="game.setup"
            stitch
            variant="primary"
            icon="check"
            :label="face.set === row.selected ? '本局已採用' : '選擇這一面'"
            :aria-label="'選擇' + row.name + '第 ' + face.set + ' 面'"
            :disabled="!game.available || face.set === row.selected"
            @click="game.command('book-select', { color: row.color, set: face.set })"
          />
        </div>
        <div class="vue-quacks-codex-result"
          ><strong>{{
            row.candidates.length === 1 ? '固定書面' : '本局採用第 ' + row.selected + ' 面'
          }}</strong
          ><span>{{
            author ? '由 ' + author + ' 選擇' : row.chosenBy ? '已離席藥師選用' : '預設效果'
          }}</span></div
        >
      </section>
    </article>
    <p class="vue-quacks-codex-note">{{
      game.setup ? '每位真人都可選書；全桌採用最後一次選擇。' : '本局藥材書已鎖定；翻面僅供查閱。'
    }}</p>
  </section>
</template>
