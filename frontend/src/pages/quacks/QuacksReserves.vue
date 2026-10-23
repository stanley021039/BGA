<script setup lang="ts">
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { ingredientNames } from '../../contracts/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
const game = useQuacksStore(),
  s = computed(() => game.state!),
  m = computed(() => game.mine),
  own = computed(() => game.own!);
// Mirrors QuacksScene's chipActions count; the page is shown only while it is non-zero.
const count = computed(
  () =>
    (m.value?.reserve.length || 0) +
    (m.value?.canDraw ? m.value.alchemy?.drawablePool.length || 0 : 0) +
    (s.value.stage === 'reserves' ? redPool.value.length : 0) +
    (m.value?.alchemy?.returnable.length || 0),
);
const redPool = computed(() =>
  (m.value?.alchemy?.pool || []).filter(
    (c) => c.color === 'red' && (s.value.options.books?.red ?? s.value.options.bookSet) === 2,
  ),
);
// Reserve chips only come from the red book (its 2nd face holds red chips; the 6th
// draws an extra chip that must be placed), so the red book names their source.
const reserveSource = computed(() => s.value.books.find((b) => b.color === 'red'));
// Pre-drawn and returnable chips exist because of the treated patient.
const patient = computed(() => s.value.patients.find((p) => p.id === m.value?.alchemy?.patientId));
function act(action: string, chip: { id: string; must?: boolean; effectColor?: string }) {
  if (
    action === 'reserve' ? reserveBlocked(chip) : !game.available || own.value.chosen || chip.must
  )
    return;
  void game.command(action, { chipId: chip.id });
}
function reserveBlocked(c: { effectColor?: string; must?: boolean }) {
  return (
    !game.available ||
    own.value.chosen ||
    ((s.value.options.books?.red ?? s.value.options.bookSet) === 2 &&
      c.effectColor === 'red' &&
      !own.value.stopped)
  );
}
</script>
<template>
  <section v-if="count" class="vue-quacks-choice vue-quacks-chip-actions" aria-label="藥材操作"
    ><h2>藥材操作</h2
    ><small
      v-if="patient && m?.canDraw && m.alchemy?.drawablePool.length"
      class="vue-quacks-action-source"
      data-ui-hint
      tabindex="0"
      :title="patient.name + '：' + patient.text"
      >因「{{ patient.name }}」的效果</small
    ><div
      v-if="m?.canDraw && m.alchemy?.drawablePool.length"
      class="vue-quacks-choice-grid"
      data-private
      ><!-- ui-check-allow raw-control: 與 QuacksChoices 相同的藥材圖選項格 --><button
        v-for="c in m.alchemy.drawablePool"
        :key="c.id"
        type="button"
        :disabled="!game.available"
        @click="game.command('draw', { step: s.step, chipId: c.id })"
        ><QuacksGlyph :chip="c" :size="56" />改放預抽 {{ ingredientNames[c.color] }}
        {{ c.value }}</button
      ></div
    ><article
      v-for="c in m?.reserve || []"
      :key="c.id"
      class="vue-quacks-reserve-card"
      :aria-label="ingredientNames[c.color] + ' ' + c.value + (c.must ? '，本輪必須投入' : '')"
      ><span
        class="vue-quacks-reserve-chip"
        data-ui-hint
        tabindex="0"
        :title="
          ingredientNames[c.color] +
          ' ' +
          c.value +
          '。' +
          (c.must ? '本輪必須投入。' : '可保留到下輪。') +
          (s.books.find((book) => book.color === c.color)?.effect || '')
        "
        ><QuacksGlyph :chip="c" :size="56" /></span
      ><div class="vue-quacks-reserve-text"
        ><strong
          >{{ ingredientNames[c.color] }} {{ c.value }}{{ c.must ? ' · 本輪必須投入' : '' }}</strong
        ><small
          v-if="reserveSource"
          class="vue-quacks-action-source"
          data-ui-hint
          tabindex="0"
          :title="reserveSource.name + '：' + reserveSource.effect"
          >因「{{ reserveSource.name }}」的效果</small
        ></div
      ><UiButton
        icon="play"
        label="投入暫存"
        :disabled="reserveBlocked(c)"
        @click="act('reserve', c)" /><UiButton
        icon="undo"
        label="放回藥袋"
        :disabled="!game.available || own.chosen || c.must"
        :title="c.must ? '本輪必須投入，不能放回藥袋' : undefined"
        data-ui-hint
        @click="act('reserve-return', c)" /></article
    ><div v-if="s.stage === 'reserves' && redPool.length" class="vue-quacks-choice-grid"
      ><UiButton
        v-for="c in redPool"
        :key="c.id"
        icon="play"
        :label="'投入預抽紅色 ' + c.value"
        :disabled="!game.available"
        @click="game.command('alchemy-pool', { chipId: c.id })" /></div
    ><small
      v-if="patient && m?.alchemy?.returnable.length"
      class="vue-quacks-action-source"
      data-ui-hint
      tabindex="0"
      :title="patient.name + '：' + patient.text"
      >因「{{ patient.name }}」的效果</small
    ><div v-if="m?.alchemy?.returnable.length" class="vue-quacks-choice-grid"
      ><!-- ui-check-allow raw-control: 與 QuacksChoices 相同的藥材圖選項格 --><button
        v-for="c in m.alchemy.returnable"
        :key="c.id"
        type="button"
        :disabled="!game.available"
        @click="game.command('alchemy-return', { chipId: c.id })"
        ><QuacksGlyph :chip="c" :size="56" />收回 {{ ingredientNames[c.color] }} {{ c.value }} · 花
        {{ c.value }} 格特效藥</button
      ></div
    ></section
  >
</template>
<style scoped>
.vue-quacks-chip-actions {
  display: grid;
  gap: 16px;
  align-content: start;
}
.vue-quacks-reserve-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--stitch-line);
  border-radius: 12px;
}
.vue-quacks-reserve-card > .vue-quacks-reserve-chip {
  display: inline-flex;
}
.vue-quacks-action-source {
  justify-self: start;
  color: var(--stitch-muted);
  cursor: help;
}
.vue-quacks-reserve-text {
  display: grid;
  flex: 1;
  min-width: 200px;
  gap: 4px;
  line-height: 1.5;
}
</style>
