<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
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
  points = computed(() => telephone.strokes.reduce((sum, s) => sum + s.points.length, 0)),
  blocked = computed(() => !telephone.editable || telephone.activeStroke);
const drawing = computed(() => state.value.task?.kind === 'drawing');
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
  { label: '每頁作畫／猜詞', value: `${state.value.options.seconds} 秒`, note: '全員同步傳頁' },
  { label: '情境題庫', value: selectedSources.value, note: '畫圖與猜詞交替' },
]);
const syncMessage = computed(() =>
  state.value.phase !== 'passing'
    ? '固定入座順序，不計個人分數。'
    : telephone.expired
      ? '本頁截止，正在傳下一頁；以伺服器接受的內容為準。'
      : state.value.task?.submitted
        ? '本頁已送出；送出後不能修改，時間到才傳下一頁。'
        : telephone.saving
          ? '正在同步私人草稿…'
          : telephone.dirty
            ? '有本地內容尚未同步；到時只採用伺服器接受的內容。'
            : '目前草稿已與伺服器同步。',
);
const displayedNotice = computed(
  () =>
    actions.notice ||
    telephone.storageNotice ||
    (state.value.phase === 'passing' && state.value.task?.submitted ? '' : telephone.notice),
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
    hero-description="每位玩家擁有一本專屬傳遞簿，題目與畫作輪流交替傳遞。只看上一棒，最後一起揭曉故事演變。"
    art="/assets/stitch/telephone-waiting.svg"
    :facts="waitingFacts"
  />
  <section
    v-else
    class="vue-game-panel vue-telephone-stage"
    data-telephone
    :class="{ 'is-passing': state.phase === 'passing', 'is-finished': state.phase === 'finished' }"
    aria-labelledby="telephoneHeading"
  >
    <header v-if="state.phase === 'passing' && state.task" class="vue-telephone-hud" data-private>
      <div class="vue-telephone-hud-prompt">
        <span class="vue-telephone-private">{{
          drawing ? '你的專屬秘密題目' : '接到上一棒傳遞簿'
        }}</span>
        <h1 id="telephoneHeading">{{
          drawing ? state.task.previous.text : '只看上一張圖，猜一句話'
        }}</h1>
        <span class="vue-telephone-private-note">{{
          drawing ? '只給你看；把文字畫成一張圖' : `來自 ${state.task.previous.authorName} 的畫作`
        }}</span>
        <span class="vue-telephone-page-number"
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
        caption="本頁剩餘"
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
    <div class="vue-telephone-live">
      <section
        v-if="state.phase === 'passing' && state.task"
        class="vue-telephone-task"
        :class="{
          'is-drawing': drawing,
          'is-guessing': !drawing,
          'is-submitted': state.task.submitted,
        }"
        data-private
      >
        <div v-if="!drawing" class="vue-telephone-previous">
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
            <p class="vue-telephone-quota" title="顏色與工具列可左右滑動"
              >本地 {{ telephone.strokes.length }}／100 筆 · {{ points }}／3,000 點 · 伺服器已接受
              {{ telephone.acceptedCount }} 筆</p
            >
          </template>
          <div v-else class="vue-telephone-guess">
            <label for="telephoneGuess" class="vue-telephone-guess-heading"
              >猜猜此圖含義 <small>答案即為下一棒題目</small></label
            >
            <input
              id="telephoneGuess"
              :key="room.scope + ':' + state.stepId"
              v-model="guess"
              autocomplete="off"
              placeholder="輸入你推測的詞彙或短句"
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
              stitch
              variant="primary"
              class="vue-telephone-guess-submit"
              icon="check"
              label="提交猜詞答案"
              :pending="telephone.finishing"
              :disabled="blocked || composing || !telephone.text.trim()"
              @click="telephone.submit()"
            />
          </div>
        </template>
        <div v-else class="vue-telephone-submitted" role="status">
          <span class="vue-telephone-submitted-mark" aria-hidden="true">✓</span
          ><h2>這一頁，完成了！</h2>
          <p>已收到你的提交。時間到才傳下一頁，現在可以看看朋友的傳遞狀態，或在聊天室聊聊天。</p>
          <small>其他頁面與朋友的私人草稿仍然保密。</small>
        </div>
      </section>
      <section v-else-if="state.phase === 'finished'" class="vue-telephone-review">
        <p v-if="state.interrupted" class="vue-telephone-review-notice"
          >有人離席，本場中止；只保留已送出的頁面，不包含尚未送出的私人草稿。</p
        >
        <template v-if="selected">
          <h2>{{ selected.ownerName }} 的故事</h2>
          <article :key="selected.ownerId + ':' + selected.index" class="vue-telephone-book-page">
            <header
              ><div
                ><span class="vue-telephone-book-number">{{
                  String(selected.index).padStart(2, '0')
                }}</span
                ><h3
                  >{{ selected.index ? '第 ' + selected.index + ' 頁' : '起始情境' }} ·
                  {{ selected.page.authorName }}</h3
                ></div
              ><span>{{ selected.page.kind === 'drawing' ? '畫圖' : '猜詞／情境' }}</span></header
            >
            <p v-if="selected.page.skipped" class="vue-telephone-skipped"
              >本頁略過{{ selected.page.timedOut ? ' · 時間到時沒有已同步的內容' : '' }}</p
            >
            <template v-else>
              <TelephoneCanvas
                v-if="selected.page.kind === 'drawing'"
                :strokes="selected.page.strokes || []"
                :epoch="state.stepId + ':' + selected.ownerId + ':' + selected.index"
                :label="selected.page.authorName + ' 的第 ' + selected.index + ' 頁畫作'"
              />
              <p v-else class="vue-telephone-book-text">{{ selected.page.text }}</p
              ><small v-if="selected.page.timedOut">時間到，採用已同步的私人草稿</small>
            </template>
          </article>
        </template>
        <p v-else>等待房主開始播放故事。</p>
      </section>
    </div>
    <div class="vue-telephone-status"
      ><p>{{ syncMessage }}</p
      ><StatusSlot
        :message="displayedNotice"
        :error="(!actions.pending && !!actions.notice) || !!telephone.storageNotice"
    /></div>
    <footer
      v-if="drawing || state.phase !== 'passing' || state.task?.submitted"
      class="vue-telephone-actions"
    >
      <template v-if="state.phase === 'passing' && !state.task?.submitted">
        <UiButton
          stitch
          variant="primary"
          class="vue-telephone-submit"
          icon="check"
          label="完成並提交這一頁"
          :pending="telephone.finishing"
          :disabled="blocked || !telephone.strokes.length"
          @click="telephone.submit()"
        />
      </template>
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
          stitch
          variant="primary"
          :icon="state.review.index < 0 ? 'play' : 'next'"
          :label="state.review.index < 0 ? '開始播放故事' : '播放下一頁'"
          :pending="actions.pending"
          :disabled="!telephone.canReveal"
          @click="telephone.reveal()"
        />
      </template>
      <span v-else class="vue-telephone-action-note">{{
        state.phase === 'passing'
          ? '已提交，等待共同倒數結束後傳頁。'
          : '想再玩一次？由房主從房間設定開始新一場。'
      }}</span>
    </footer>
  </section>
  <ConfirmDialog ref="confirm" stitch />
</template>
