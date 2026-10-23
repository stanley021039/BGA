<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useTelephoneStore } from '../../stores/telephone';
import { useRoomStore } from '../../stores/room';
import { usePartyActionsStore } from '../../stores/party-actions';
import type { DrawingTool } from '../../contracts/drawing';
import TelephoneCanvas from '../../components/TelephoneCanvas.vue';
import DrawingToolbar from '../../components/DrawingToolbar.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';

const telephone = useTelephoneStore(),
  room = useRoomStore(),
  actions = usePartyActionsStore(),
  state = computed(() => telephone.state!),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  tool = ref<DrawingTool>('brush'),
  filled = ref(false),
  color = ref('#273942'),
  size = ref(6),
  composing = ref(false);
const reviewPages = computed(() =>
    state.value.books.flatMap((book) =>
      book.pages.map((page, index) => ({ ...book, page, index })),
    ),
  ),
  selected = computed(() => reviewPages.value[state.value.review?.index ?? -1]),
  visiblePages = computed(() => selected.value?.pages.slice(0, selected.value.index + 1) || []),
  blocked = computed(() => !telephone.editable || telephone.activeStroke);
const storyViewport = ref<HTMLElement | null>(null);
function scrollPlayback() {
  if (state.value.phase === 'finished' && selected.value && storyViewport.value)
    storyViewport.value.scrollTop = storyViewport.value.scrollHeight;
}
watch(
  [
    () => room.scope,
    () => state.value.stepId,
    () => state.value.phase,
    () => state.value.review?.index,
  ],
  scrollPlayback,
  { flush: 'post' },
);
onMounted(scrollPlayback);
const drawing = computed(() => state.value.task?.kind === 'drawing');
const prompting = computed(() => state.value.phase === 'prompting');
const playing = computed(() => ['prompting', 'passing'].includes(state.value.phase));
const guess = computed({
  get: () => telephone.text,
  set: (value: string) => telephone.changeText(value),
});
const selectedSources = computed(() =>
  state.value.sources
    .filter((source) => state.value.options.sources.includes(source.id))
    .map((source) => source.label)
    .join('＋'),
);
const playerCount = computed(() => state.value.players.filter((player) => !player.kicked).length);
const waitingFacts = computed(() => [
  {
    label: '遊玩人數',
    value: `${playerCount.value} 人`,
    note:
      playerCount.value >= 3
        ? `本局 ${playerCount.value % 2 ? playerCount.value - 1 : playerCount.value} 頁`
        : '3–8 人入座',
  },
  {
    label: '出題／每頁畫猜',
    value: `${state.value.options.seconds} 秒`,
    note: '出題全員送出可提前開始',
  },
  { label: '空白主題備援', value: selectedSources.value, note: '先各自出題，再畫圖與猜詞交替' },
]);
const displayedNotice = computed(
  () =>
    actions.notice ||
    telephone.storageNotice ||
    (playing.value && state.value.task?.submitted ? '' : telephone.notice),
);
watch(
  [
    () => room.scope,
    () => state.value.stepId,
    () => state.value.phase,
    () => state.value.task?.submitted,
    () => telephone.expired,
  ],
  () => {
    confirm.value?.cancel();
    composing.value = false;
  },
);
async function clear() {
  if (blocked.value) return;
  const scope = room.scope,
    step = state.value.stepId;
  if (
    await confirm.value?.ask('清除這一頁的本地畫布並同步空白草稿？這個動作無法復原。', '清除畫布')
  )
    if (scope === room.scope && step === state.value.stepId && !blocked.value) telephone.clear();
}
function input(event: Event) {
  if (composing.value) return;
  const target = event.target as HTMLInputElement;
  target.value = telephone.text;
}
function visibility() {
  if (document.hidden) confirm.value?.cancel();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility));
</script>
<template>
  <RoomWaitingTemplate
    v-if="state.phase === 'waiting'"
    type="telephone"
    title="傳情畫意"
    hero-title="經典紙筆畫猜接力！"
    description="只看上一棒，最後回看故事演變。"
    hero-description="先各自想一個主題，交給下一位畫圖，再交替猜詞與作畫。只看上一棒，最後由房主逐頁揭曉故事演變。"
    art="/assets/stitch/telephone-waiting.svg"
    :facts="waitingFacts"
  />
  <section
    v-else
    class="vue-game-panel vue-telephone-stage"
    data-telephone
    :class="{
      'is-passing': playing,
      'is-prompting': prompting,
      'is-finished': state.phase === 'finished',
    }"
    aria-labelledby="telephoneHeading"
  >
    <header v-if="playing && state.task" class="vue-telephone-hud" data-private>
      <div
        class="vue-telephone-hud-prompt"
        tabindex="0"
        role="group"
        aria-labelledby="telephoneHeading"
      >
        <span class="vue-telephone-private">{{
          prompting ? '為你的故事出題' : drawing ? '你的專屬秘密題目' : '接到上一棒傳遞簿'
        }}</span>
        <h1 id="telephoneHeading">{{
          prompting ? '先想一個主題' : drawing ? state.task.previous.text : '只看上一張圖，猜一句話'
        }}</h1>
        <span class="vue-telephone-private-note">{{
          prompting
            ? '送出後會交給下一位玩家作畫。'
            : drawing
              ? '只給你看；把文字畫成一張圖'
              : `來自 ${state.task.previous.authorName} 的畫作`
        }}</span>
        <span v-if="prompting" class="vue-telephone-page-number">{{
          state.task.submitted ? '主題已送出，等待其他玩家' : '90 秒內出題；全員送出即可開始'
        }}</span>
        <span v-else class="vue-telephone-page-number"
          >第 {{ String(state.round).padStart(2, '0') }}／{{
            String(state.roundLimit).padStart(2, '0')
          }}
          頁 ·
          {{ state.task.submitted ? '本頁已送出' : drawing ? '限時作畫中' : '看圖猜詞中' }}</span
        >
      </div>
      <RoomCountdown
        :deadline="state.deadline"
        :duration="90000"
        :offset="telephone.offset"
        :epoch="state.stepId || 'waiting'"
        :now="telephone.now"
        :caption="prompting ? '出題剩餘' : '本頁剩餘'"
        empty-value="每頁 90 秒"
        urgent
      />
    </header>
    <header v-else-if="state.phase === 'finished'" class="vue-telephone-finished-heading">
      <div
        ><h1 id="telephoneHeading">{{
          state.interrupted ? '傳遞中止，回看已完成的頁面' : '故事傳了一圈，變成什麼模樣？'
        }}</h1
        ><p>不計分，也不排名。</p></div
      >
      <p role="status"
        >{{ Math.max(0, (state.review?.index ?? -1) + 1) }}／{{
          state.review?.total || 0
        }}
        個片段</p
      >
    </header>
    <div
      ref="storyViewport"
      class="vue-telephone-live"
      :role="state.phase === 'finished' ? 'region' : undefined"
      :aria-label="state.phase === 'finished' ? '故事播放內容' : undefined"
      :tabindex="state.phase === 'finished' ? 0 : undefined"
    >
      <section
        v-if="playing && state.task"
        class="vue-telephone-task"
        :class="{
          'is-drawing': drawing,
          'is-guessing': !drawing && !prompting,
          'is-prompting': prompting,
          'is-submitted': state.task.submitted,
        }"
        data-private
      >
        <div v-if="!drawing && !prompting" class="vue-telephone-previous">
          <div class="vue-telephone-sheet-heading"
            ><h2>上一棒傳給你的內容</h2><span>其餘頁面仍保密</span></div
          >
          <TelephoneCanvas
            :strokes="state.task.previous.strokes || []"
            :epoch="state.stepId + ':previous'"
            label="上一位玩家的畫作"
          />
          <p v-if="state.task.previous.skipped" class="vue-telephone-skipped"
            >上一頁略過；可以自由猜一句話或略過本頁。</p
          >
        </div>
        <template v-if="!state.task.submitted">
          <template v-if="drawing">
            <DrawingToolbar
              v-model:tool="tool"
              v-model:filled="filled"
              v-model:color="color"
              v-model:size="size"
              class="vue-telephone-drawing-console"
              :editable="telephone.editable"
              :disabled="blocked"
              :undo-disabled="!telephone.strokes.length"
              :clear-disabled="!telephone.strokes.length"
              :epoch="room.scope + ':' + state.stepId"
              @undo="telephone.undo()"
              @clear="clear"
            >
              <TelephoneCanvas
                :strokes="telephone.strokes"
                :epoch="state.stepId || ''"
                label="你的私人畫布；可用滑鼠、觸控、方向鍵與空白鍵作畫"
                :editable="telephone.editable"
                :tool="tool"
                :color="color"
                :size="size"
                :filled="filled"
                @change="telephone.changeStrokes"
                @active="telephone.activeStroke = $event"
                @notice="telephone.notice = $event"
              />
            </DrawingToolbar>
          </template>
          <div v-else class="vue-telephone-guess">
            <label for="telephoneGuess" class="vue-telephone-guess-heading"
              >{{ prompting ? '寫下你的主題' : '猜猜此圖含義' }}
              <small>{{
                prompting ? '逾時空白由題庫補上主題' : '答案即為下一棒題目'
              }}</small></label
            >
            <input
              id="telephoneGuess"
              :key="room.scope + ':' + state.stepId"
              v-model="guess"
              autocomplete="off"
              :placeholder="prompting ? '想一個有趣的詞彙或短句' : '輸入你推測的詞彙或短句'"
              :disabled="!telephone.editable"
              aria-describedby="telephoneGuessCount"
              @input="input"
              @compositionstart="composing = true"
              @compositionend="
                composing = false;
                input($event);
              "
            />
            <span id="telephoneGuessCount" class="vue-telephone-guess-count"
              >{{ [...telephone.text].length }}／80 字 · 已接受
              {{ telephone.acceptedCount }} 字；不能換行</span
            >
            <UiButton
              variant="primary"
              class="vue-telephone-guess-submit"
              icon="check"
              :label="prompting ? '送出主題' : '提交猜詞答案'"
              :pending="telephone.finishing"
              :disabled="blocked || composing || !telephone.text.trim()"
              @click="telephone.submit()"
            />
          </div>
        </template>
        <div v-else class="vue-telephone-submitted" role="status">
          <span class="vue-telephone-submitted-mark" aria-hidden="true">✓</span
          ><h2>{{ prompting ? '主題已送出！' : '這一頁，完成了！' }}</h2>
          <p>{{
            prompting
              ? '等待其他玩家出題；全員送出就開始作畫，最多等到倒數結束。'
              : '已收到你的提交。時間到才傳下一頁，現在可以看看朋友的傳遞狀態，或在聊天室聊聊天。'
          }}</p>
          <small>其他頁面與朋友的私人草稿仍然保密。</small>
        </div>
      </section>
      <section v-else-if="state.phase === 'finished'" class="vue-telephone-review">
        <p v-if="state.interrupted" class="vue-telephone-review-notice"
          >有人離席，本場中止；只保留已送出的頁面，不包含尚未送出的私人草稿。</p
        >
        <template v-if="selected">
          <h2>{{ selected.ownerName }} 的故事</h2>
          <article
            v-for="(page, index) in visiblePages"
            :key="selected.ownerId + ':' + index"
            class="vue-telephone-book-page"
          >
            <header
              ><div
                ><span class="vue-telephone-book-number">{{ String(index).padStart(2, '0') }}</span
                ><h3
                  >{{ index ? '第 ' + index + ' 頁' : '起始情境' }} · {{ page.authorName }}</h3
                ></div
              ><span>{{ page.kind === 'drawing' ? '畫圖' : '猜詞／情境' }}</span></header
            >
            <p v-if="page.skipped" class="vue-telephone-skipped"
              >本頁略過{{ page.timedOut ? ' · 時間到時沒有已同步的內容' : '' }}</p
            >
            <template v-else>
              <TelephoneCanvas
                v-if="page.kind === 'drawing'"
                :strokes="page.strokes || []"
                :epoch="state.stepId + ':' + selected.ownerId + ':' + index"
                :label="page.authorName + ' 的第 ' + index + ' 頁畫作'"
              />
              <p v-else class="vue-telephone-book-text">{{ page.text }}</p
              ><small v-if="page.timedOut">{{
                page.topicFallback ? '時間到，由情境題庫補上主題。' : '時間到，採用已同步的私人草稿'
              }}</small>
            </template>
          </article>
        </template>
        <p v-else>等待房主開始播放故事。</p>
      </section>
    </div>
    <div class="vue-telephone-status"
      ><StatusSlot
        :message="displayedNotice"
        :error="(!actions.pending && !!actions.notice) || !!telephone.storageNotice"
    /></div>
    <footer
      v-if="prompting || drawing || !playing || state.task?.submitted"
      class="vue-telephone-actions"
    >
      <template v-if="drawing && playing && !state.task?.submitted">
        <UiButton
          variant="primary"
          class="vue-telephone-submit"
          icon="check"
          label="完成並提交這一頁"
          :pending="telephone.finishing"
          :disabled="blocked || !telephone.strokes.length"
          @click="telephone.submit()"
        />
      </template>
      <span v-else-if="prompting" class="vue-telephone-action-note">{{
        state.task?.submitted ? '等待其他玩家完成或倒數結束。' : '主題會交給下一位玩家作畫。'
      }}</span>
      <template v-else-if="state.phase === 'finished' && state.review">
        <span class="vue-telephone-action-note">{{
          state.review.index >= state.review.total - 1
            ? '所有故事已播放完畢。'
            : room.host
              ? '按一下揭曉下一個片段。'
              : '等待房主播放下一頁。'
        }}</span>
        <UiButton
          v-if="state.review.index < state.review.total - 1 && room.host"
          variant="primary"
          :icon="state.review.index < 0 ? 'play' : 'next'"
          :label="state.review.index < 0 ? '開始播放故事' : '播放下一頁'"
          :pending="actions.pending"
          :disabled="!telephone.canReveal"
          @click="telephone.reveal()"
        />
      </template>
      <span v-else class="vue-telephone-action-note">{{
        playing
          ? prompting
            ? '已出題，等待其他玩家完成或倒數結束。'
            : '已提交，等待共同倒數結束後傳頁。'
          : '想再玩一次？由房主從房間設定開始新一場。'
      }}</span>
    </footer>
  </section>
  <ConfirmDialog ref="confirm" />
</template>
