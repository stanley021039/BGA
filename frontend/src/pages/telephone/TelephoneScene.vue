<script setup lang="ts">
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
  book = ref(0),
  composing = ref(false);
const selected = computed(() => state.value.books[book.value] || state.value.books[0]),
  points = computed(() => telephone.strokes.reduce((sum, s) => sum + s.points.length, 0)),
  blocked = computed(() => !telephone.editable || telephone.activeStroke);
const drawing = computed(() => state.value.task?.kind === 'drawing');
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
watch(
  () => state.value.phase,
  (phase) => {
    if (phase !== 'finished') book.value = 0;
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
async function skip() {
  if (blocked.value) return;
  const scope = room.scope,
    step = state.value.stepId;
  if (await confirm.value?.ask('這頁會標記為略過，已畫或已輸入的內容不會送出。', '略過這頁'))
    if (scope === room.scope && step === state.value.stepId && !blocked.value)
      await telephone.submit(true);
}
function input(event: Event) {
  if (composing.value) return;
  const target = event.target as HTMLInputElement;
  telephone.changeText(target.value);
  target.value = telephone.text;
}
function visibility() {
  if (document.hidden) confirm.value?.cancel();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility));
</script>
<template>
  <section
    class="vue-game-panel vue-telephone-stage"
    data-telephone
    :class="{
      'is-waiting': state.phase === 'waiting',
      'is-passing': state.phase === 'passing',
      'is-finished': state.phase === 'finished',
    }"
    aria-labelledby="telephoneHeading"
  >
    <header v-if="state.phase === 'passing' && state.task" class="vue-telephone-hud" data-private>
      <div class="vue-telephone-hud-prompt"
        ><span class="vue-telephone-private">{{
          drawing ? '你的專屬秘密題目' : '接到上一棒傳遞簿'
        }}</span
        ><h1 id="telephoneHeading">{{
          drawing ? state.task.previous.text : '只看上一張圖，猜一句話'
        }}</h1
        ><span class="vue-telephone-private-note">{{
          drawing ? '只給你看；把文字畫成一張圖' : `來自 ${state.task.previous.authorName} 的畫作`
        }}</span></div
      >
      <span class="vue-telephone-page-number"
        >第 {{ String(state.round).padStart(2, '0') }}／{{
          String(state.roundLimit).padStart(2, '0')
        }}
        頁 · {{ state.task.submitted ? '本頁已送出' : drawing ? '限時作畫中' : '看圖猜詞中' }}</span
      >
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
    <header v-else-if="state.phase === 'finished'" class="vue-telephone-finished-heading"
      ><span class="vue-telephone-private">全部故事揭曉</span
      ><h1 id="telephoneHeading">{{
        state.interrupted ? '傳遞中止，回看已完成的頁面' : '故事傳了一圈，變成什麼模樣？'
      }}</h1
      ><p>每一頁都是不同朋友留下的想像，不計分，也不排名。</p></header
    >
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
        <div v-if="!drawing" class="vue-telephone-previous"
          ><div class="vue-telephone-sheet-heading"
            ><h2>上一棒傳給你的內容</h2><span>只看上一頁，其餘頁面仍保密</span></div
          ><TelephoneCanvas
            :strokes="state.task.previous.strokes || []"
            :epoch="state.stepId + ':previous'"
            label="上一位玩家的畫作"
          /><p v-if="state.task.previous.skipped" class="vue-telephone-skipped"
            >上一頁略過；可以自由猜一句話或略過本頁。</p
          ></div
        >
        <template v-if="!state.task.submitted">
          <template v-if="drawing"
            ><DrawingToolbar
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
              /> </DrawingToolbar
            ><p class="vue-telephone-quota" title="顏色與工具列可左右滑動"
              >本地 {{ telephone.strokes.length }}／100 筆 · {{ points }}／3,000 點 · 伺服器已接受
              {{ telephone.acceptedCount }} 筆</p
            ></template
          >
          <label v-else class="vue-telephone-guess" for="telephoneGuess"
            ><span class="vue-telephone-guess-heading"
              >猜猜此圖含義 <small>答案即為下一棒題目</small></span
            ><input
              id="telephoneGuess"
              :value="telephone.text"
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
            /><span id="telephoneGuessCount" class="vue-telephone-guess-count"
              >{{ [...telephone.text].length }}／80 字 · 已接受
              {{ telephone.acceptedCount }} 字；不能換行</span
            ></label
          >
        </template>
        <div v-else class="vue-telephone-submitted" role="status"
          ><span class="vue-telephone-submitted-mark" aria-hidden="true">✓</span
          ><h2>這一頁，完成了！</h2
          ><p>已收到你的提交。時間到才傳下一頁，現在可以看看朋友的傳遞狀態，或在聊天室聊聊天。</p
          ><small>其他頁面與朋友的私人草稿仍然保密。</small></div
        >
      </section>
      <section v-else-if="state.phase === 'finished'" class="vue-telephone-review"
        ><div class="vue-telephone-review-toolbar"
          ><label for="telephoneBook"
            >選擇傳遞簿<select id="telephoneBook" v-model.number="book"
              ><option v-for="(value, index) in state.books" :key="value.ownerId" :value="index"
                >{{ value.ownerName }} 的故事</option
              ></select
            ></label
          ><span>{{ state.books.length }} 本故事 · 固定入座順序</span></div
        ><p v-if="state.interrupted" class="vue-telephone-review-notice"
          >有人離席，本場中止；只保留已送出的頁面，不包含尚未送出的私人草稿。</p
        ><template v-if="selected"
          ><div class="vue-telephone-book-heading"
            ><h2>{{ selected.ownerName }} 的傳遞簿</h2
            ><span>{{ selected.pages.length }} 頁已揭曉</span></div
          ><article
            v-for="(page, index) in selected.pages"
            :key="selected.ownerId + ':' + index"
            class="vue-telephone-book-page"
            ><header
              ><span class="vue-telephone-book-number">{{ String(index).padStart(2, '0') }}</span
              ><div
                ><h3>{{ index ? '第 ' + index + ' 頁' : '起始情境' }} · {{ page.authorName }}</h3
                ><span>{{ page.kind === 'drawing' ? '畫圖' : '猜詞／情境' }}</span></div
              ></header
            ><p v-if="page.skipped" class="vue-telephone-skipped"
              >本頁略過{{ page.timedOut ? ' · 時間到時沒有已同步的內容' : '' }}</p
            ><template v-else
              ><TelephoneCanvas
                v-if="page.kind === 'drawing'"
                :strokes="page.strokes || []"
                :epoch="state.stepId + ':' + selected.ownerId + ':' + index"
                :label="page.authorName + ' 的第 ' + index + ' 頁畫作'"
              /><p v-else class="vue-telephone-book-text">{{ page.text }}</p
              ><small v-if="page.timedOut">時間到，採用已同步的私人草稿</small></template
            ></article
          ></template
        ><p v-else>尚無可揭曉的傳遞簿。</p></section
      >
      <section v-else class="vue-telephone-waiting"
        ><div class="vue-telephone-waiting-mode"
          ><span>TELESTRATIONS · 傳情畫意</span><span>紙筆猜詞接力</span></div
        ><div class="vue-telephone-waiting-illustration"
          ><img
            src="/assets/stitch/telephone-waiting.svg"
            width="192"
            height="192"
            alt=""
            loading="eager" /></div
        ><div class="vue-telephone-waiting-copy"
          ><h1 id="telephoneHeading">經典紙筆畫猜接力！</h1
          ><p
            >每位玩家擁有一本專屬傳遞簿，題目與畫作輪流交替傳遞。只看上一棒的內容，直到傳回自己手中揭曉爆笑演變！</p
          ></div
        ><dl class="vue-telephone-waiting-facts"
          ><div v-for="fact in waitingFacts" :key="fact.label"
            ><dt>{{ fact.label }}</dt
            ><dd
              >{{ fact.value }}<small>{{ fact.note }}</small></dd
            ></div
          ></dl
        ><p class="vue-telephone-waiting-notice">{{
          room.host
            ? '你是房主，邀請至少 3 人入座，再從右側房間設定開始。'
            : '等待房主開始；每人只看上一頁，最後一起揭曉。'
        }}</p></section
      >
    </div>
    <div v-if="state.phase !== 'waiting'" class="vue-telephone-status"
      ><p>{{ syncMessage }}</p
      ><StatusSlot
        :message="displayedNotice"
        :error="(!actions.pending && !!actions.notice) || !!telephone.storageNotice"
    /></div>
    <footer v-if="state.phase !== 'waiting'" class="vue-telephone-actions"
      ><template v-if="state.phase === 'passing' && !state.task?.submitted"
        ><div class="vue-telephone-secondary-actions"
          ><UiButton
            stitch
            variant="ghost"
            icon="refresh"
            label="同步草稿"
            :pending="telephone.saving"
            :disabled="!telephone.allowed || telephone.finishing || room.busy || !telephone.dirty"
            @click="telephone.sync()" /><UiButton
            stitch
            variant="ghost"
            label="略過這頁"
            :disabled="blocked"
            @click="skip" /></div
        ><UiButton
          stitch
          variant="primary"
          class="vue-telephone-submit"
          icon="check"
          :label="drawing ? '完成並提交這一頁' : '提交猜詞答案'"
          :pending="telephone.finishing"
          :disabled="
            blocked || composing || (drawing ? !telephone.strokes.length : !telephone.text.trim())
          "
          @click="telephone.submit()" /></template
      ><span v-else class="vue-telephone-action-note">{{
        state.phase === 'passing'
          ? '已提交，等待共同倒數結束後傳頁。'
          : '想再玩一次？由房主從房間設定開始新一場。'
      }}</span
      ><UiButton
        v-if="actions.canRetry"
        stitch
        variant="secondary"
        icon="refresh"
        label="重試同一操作"
        :disabled="room.busy || !room.connected"
        @click="actions.retrySame()"
    /></footer>
  </section>
  <ConfirmDialog ref="confirm" />
</template>
