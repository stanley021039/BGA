<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import type { Ingredient } from '../../contracts/quacks';
const game = useQuacksStore(),
  room = useRoomStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  viewer = ref(''),
  person = computed(() => game.state?.recipes.find((p) => p.id === viewer.value)),
  own = computed(() => viewer.value === game.state?.me),
  peek = computed(() => (own.value ? game.mine?.bagPeek : null)),
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
  viewer.value = game.viewed?.id || game.state?.me || '';
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
    :data-quacks-bag="game.viewed?.id"
    :caption="String(game.viewed?.bagCount ?? 0)"
    :label="(game.viewed?.name || '我的') + '的藥袋，剩餘 ' + (game.viewed?.bagCount ?? 0) + ' 片'"
    :disabled="!game.state"
    @click="open"
    ><template #icon><QuacksGlyph resource="bag" :size="42" /></template></UiButton
  ><UiDialog
    ref="dialog"
    stitch
    class="vue-quacks-bag-dialog"
    :class="{ 'has-peek': !!peek }"
    :title="(own ? '我的' : (person?.name || '玩家') + '的') + '藥袋'"
    :dismissible="!commitClose"
    ><p
      >袋中剩餘 {{ person?.bagCount || 0 }} 片。{{
        own ? '裝滿藥水瓶：' + (game.mine?.potion ? '是' : '否') : '其他人的藥袋只公開總數。'
      }}</p
    ><template v-if="own"
      ><UiButton
        stitch
        variant="secondary"
        icon="eye"
        :label="game.mine?.peekUsed ? '本回合查看機會已用過' : '查看真正內容（每回合一次）'"
        :disabled="!game.available || !game.mine?.peekAvailable"
        @click="game.command('peek-bag')"
      /><p v-if="peek">第 {{ peek.round }} 回合查看當下的內容；關閉後本輪不能再查看。</p
      ><div v-if="peek" class="vue-quacks-bag-grid" data-quacks-private-bag
        ><div v-for="c in groups" :key="c.color + ':' + c.value"
          ><QuacksGlyph :chip="c" :size="48" /><strong>× {{ c.count }}</strong></div
        ></div
      ><p v-else>平常只顯示總數，內容快照只有你看得到。</p><h3>暫存藥材</h3
      ><div class="vue-quacks-tabs"
        ><span v-for="c in game.mine?.reserve || []" :key="c.id"
          ><QuacksGlyph :chip="c" />{{ c.must ? '本輪必須投入' : '可保留' }}</span
        ></div
      ><p v-if="!game.mine?.reserve.length">目前沒有暫存藥材。</p></template
    ><UiButton
      stitch
      variant="secondary"
      icon="close"
      label="關閉藥袋查看"
      :disabled="commitClose && !game.available"
      @click="close" /><StatusSlot
      :message="game.pending ? '正在送出…' : game.notice"
      :error="!!game.notice && !game.pending"
  /></UiDialog>
</template>
