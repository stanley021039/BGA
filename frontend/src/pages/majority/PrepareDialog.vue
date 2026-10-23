<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import UiDialog from '../../components/UiDialog.vue';
import UiButton from '../../components/UiButton.vue';
import UiField from '../../components/UiField.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import QuestionEditor from './QuestionEditor.vue';
import QuestionPreview from './QuestionPreview.vue';
import { majorityKindLabels } from '../../contracts/majority';
const room = useRoomStore(),
  game = useMajorityStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  tab = ref<'bank' | 'custom'>('bank');
const prepareNoticeKey = ref(0);
watch(
  [() => game.pending, () => game.libraryLoading],
  (pending, previous) => {
    if (pending.some((value, index) => previous[index] && !value)) prepareNoticeKey.value++;
  },
  { flush: 'sync' },
);
const blocked = computed(
  () =>
    !room.connected ||
    game.pending ||
    room.busy ||
    game.uncertain ||
    !!room.terminal ||
    !!game.state?.cruel ||
    game.state?.phase === 'finished',
);
async function open(source?: HTMLElement) {
  await dialog.value?.open(source);
  await game.loadLibrary();
}
async function send(intent: 'ask' | 'enqueue', id?: string) {
  if (blocked.value) return;
  const ok = id ? await game.act(intent, { questionId: id }) : await game.askCustom(true, intent);
  if (ok && intent === 'ask') dialog.value?.close();
}
async function random(intent: 'ask' | 'enqueue') {
  if ((await game.randomQuestion(intent)) && intent === 'ask') dialog.value?.close();
}
defineExpose({ open });
</script>
<template>
  <UiDialog ref="dialog" title="挑題庫或預備題目" class="vue-majority-prepare-dialog"
    ><div class="vue-majority-prepare"
      ><p
        >每人最多排 5
        題，依提交順序揭題。未揭題前只有你能看到自己的預備內容；殘酷模式使用獨立牌庫。</p
      ><StatusSlot
        :message="game.message"
        :error="game.failed"
        :notice-key="prepareNoticeKey"
      /><div class="vue-majority-tabs"
        ><UiButton
          label="共用題庫"
          :variant="tab === 'bank' ? 'primary' : 'secondary'"
          :aria-pressed="tab === 'bank'"
          @click="tab = 'bank'" /><UiButton
          label="自己出題"
          :variant="tab === 'custom' ? 'primary' : 'secondary'"
          :aria-pressed="tab === 'custom'"
          @click="tab = 'custom'"
      /></div>
      <section v-show="tab === 'bank'" class="vue-majority-library"
        ><div class="vue-majority-library-filters"
          ><UiField label="搜尋題目、題庫名稱" v-model="game.search" type="search" />
          <UiField label="題庫" control="select" v-model="game.pack"
            ><option value="">所有題庫</option><option value="favorites">我的收藏</option
            ><option v-for="pack in game.packs" :key="pack" :value="pack">{{
              pack
            }}</option></UiField
          ><UiField label="主題" control="select" v-model="game.libraryTopic"
            ><option value="">全部主題</option
            ><option
              v-for="topic in game.library?.topics || []"
              :key="topic.id"
              :value="topic.id"
              >{{ topic.label }}</option
            ></UiField
          ><UiField label="題型" control="select" v-model="game.libraryKind"
            ><option value="">全部題型</option
            ><option v-for="(label, key) in majorityKindLabels" :key="key" :value="key">{{
              label
            }}</option></UiField
          ></div
        ><div class="vue-majority-actions"
          ><UiButton
            variant="primary"
            label="隨機一題加入預備"
            icon="shuffle"
            :disabled="blocked || !game.filtered.length || (game.state?.ownQueue.length || 0) >= 5"
            @click="random('enqueue')" /><UiButton
            v-if="game.canAsk"
            label="隨機一題現在出題"
            icon="play"
            :disabled="blocked || !game.filtered.length"
            @click="random('ask')" /><UiButton
            icon="refresh"
            label="更新題庫"
            :pending="game.libraryLoading"
            @click="game.loadLibrary()" /></div
        ><StatusSlot
          :message="
            game.libraryLoading
              ? '正在載入題庫…'
              : game.libraryError || `找到 ${game.filtered.length} 題`
          "
          :error="!!game.libraryError"
          :notice-key="prepareNoticeKey"
          persistent
        /><div class="vue-majority-library-results"
          ><article
            v-for="(question, i) in game.filtered.slice(0, game.limit)"
            :key="question.id || i"
            ><QuestionPreview :question="question" compact
              ><div class="vue-majority-actions"
                ><UiButton
                  icon="add"
                  variant="primary"
                  label="加入預備"
                  :disabled="blocked || (game.state?.ownQueue.length || 0) >= 5"
                  @click="send('enqueue', question.id || undefined)" /><UiButton
                  v-if="game.canAsk"
                  icon="play"
                  variant="primary"
                  label="現在出題"
                  :disabled="blocked"
                  @click="
                    send('ask', question.id || undefined)
                  " /></div></QuestionPreview></article></div
        ><UiButton
          v-if="game.filtered.length > game.limit"
          label="顯示更多題目"
          @click="game.limit += 20"
        /><a href="/community?tab=questions" target="_blank" rel="noopener"
          >擴充或收藏題庫 ↗</a
        ></section
      >
      <form v-show="tab === 'custom'" @submit.prevent="send('enqueue')"
        ><QuestionEditor
          :draft="game.prepared"
          :topics="game.library?.topics || game.state?.topics || []"
          show-topic
          :disabled="blocked" /><div class="vue-majority-actions"
          ><UiButton
            type="submit"
            icon="add"
            variant="primary"
            label="加入預備題目"
            :disabled="blocked || (game.state?.ownQueue.length || 0) >= 5" /><UiButton
            v-if="game.canAsk"
            icon="play"
            variant="primary"
            label="現在出題"
            :disabled="blocked"
            @click="send('ask')" /></div
      ></form>
      <section class="vue-majority-own-queue"
        ><h3>我的預備題目 {{ game.state?.ownQueue.length || 0 }} / 5</h3
        ><p v-if="!game.state?.ownQueue.length">尚未預備題目。</p
        ><div v-for="(item, i) in game.state?.ownQueue || []" :key="item.id"
          ><span>{{ i + 1 }}. {{ item.question.prompt }}</span
          ><UiButton
            icon="remove"
            :label="'移除預備題目：' + item.question.prompt"
            :disabled="blocked"
            @click="game.act('unqueue', { queueId: item.id })" /></div
      ></section> </div
  ></UiDialog>
</template>
