<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import type { Ingredient } from '../../contracts/quacks';
const game = useQuacksStore(),
  room = useRoomStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  peek = computed(() => game.mine?.bagPeek),
  commitClose = computed(
    () =>
      !!peek.value &&
      room.connected &&
      !room.terminal &&
      !game.state?.interrupted &&
      game.state?.phase !== 'finished',
  );
const groups = computed(() => {
  const map = new Map<string, Ingredient & { count: number }>();
  for (const c of peek.value?.chips || []) {
    const key = c.color + ':' + c.value,
      item = map.get(key);
    if (item) item.count++;
    else map.set(key, { ...c, count: 1 });
  }
  return [...map.values()];
});
async function close() {
  if (commitClose.value) {
    if (!(await game.command('close-bag'))) return;
  }
  dialog.value?.close();
}
function open() {
  void dialog.value?.open();
}
watch(
  () => room.scope,
  () => dialog.value?.close(),
);
watch(
  () => game.state?.roundId,
  () => {
    if (!game.mine?.bagPeek) dialog.value?.close();
  },
);
</script>
<template>
  <UiButton
    class="vue-quacks-bag-button"
    :data-quacks-bag="game.own?.id"
    :caption="String(game.own?.bagCount ?? 0)"
    :label="'我的藥袋，剩餘 ' + (game.own?.bagCount ?? 0) + ' 片'"
    :disabled="!game.state"
    @click="open"
  >
    <template #icon><QuacksGlyph resource="bag" :size="42" /></template>
  </UiButton>
  <UiDialog
    ref="dialog"
    title="我的藥袋"
    class="vue-quacks-bag-dialog"
    :dismissible="!commitClose"
    @cancel.prevent="close"
  >
    <template #close>
      <UiButton
        icon="close"
        icon-only
        label="關閉我的藥袋"
        :disabled="commitClose && !game.available"
        @click="close"
      />
    </template>
    <UiButton
      v-if="!peek && !game.mine?.peekUsed"
      icon="eye"
      label="查看（本輪只有一次哦！）"
      :disabled="!game.available || !game.mine?.peekAvailable"
      @click="game.command('peek-bag')"
    />
    <div v-if="peek" class="vue-quacks-bag-grid">
      <div v-for="c in groups" :key="c.color + ':' + c.value"
        ><QuacksGlyph :chip="c" :size="48" /><strong>× {{ c.count }}</strong></div
      >
    </div>
    <p v-if="peek || game.mine?.peekUsed" role="status">本輪不能再查看</p>
  </UiDialog>
</template>
