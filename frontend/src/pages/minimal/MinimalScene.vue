<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useMinimalStore } from '../../stores/minimal';
import { useRoomStore } from '../../stores/room';
import { usePartyActionsStore } from '../../stores/party-actions';
import type { MinimalSnapshot } from '../../contracts/minimal';
import GeometryCanvas from '../../components/GeometryCanvas.vue';
import DrawingToolButton from '../../components/DrawingToolButton.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const editor = useMinimalStore(),
  room = useRoomStore(),
  actions = usePartyActionsStore(),
  state = computed(() => editor.state as MinimalSnapshot),
  guesser = computed(() => state.value.me === state.value.guesserId);
const tool = ref<'line' | 'circle'>('line'),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  input = ref<HTMLInputElement | null>(null),
  composing = ref(false),
  review = ref(0);
let disposed = false;
const selected = computed(
    () =>
      state.value.results.find((result) => result.round === review.value) ||
      state.value.results.at(-1),
  ),
  blocked = computed(() => !room.connected || room.busy || actions.pending),
  syncMessage = computed(() =>
    editor.expired
      ? '倒數已結束，以伺服器接受的圖形為準。'
      : state.value.submitted
        ? '作畫已完成，本輪不能修改。'
        : editor.saving
          ? '正在同步私人草稿…'
          : editor.dirty
            ? '有本地圖形尚未同步。'
            : state.value.phase === 'drawing'
              ? '目前圖形已與伺服器同步。'
              : '',
  );
watch(
  [
    () => room.scope,
    () => state.value?.roundId,
    () => state.value?.phase,
    () => state.value?.submitted,
    () => editor.expired,
  ],
  () => confirm.value?.cancel(),
);
watch(
  () => state.value?.results.length,
  () => {
    if (
      !state.value?.results.some((result) => result.round === review.value) ||
      review.value === state.value?.results.at(-2)?.round
    )
      review.value = state.value?.results.at(-1)?.round || 0;
  },
  { immediate: true },
);
async function clear() {
  if (!editor.editable || editor.activeStroke) return;
  const scope = room.scope,
    id = state.value.roundId;
  if (
    !(await confirm.value?.ask('清除本地畫布並同步空白草稿，這個動作無法復原。', '清除幾何畫布？'))
  )
    return;
  if (scope === room.scope && id === state.value.roundId && editor.editable) editor.clear();
}
async function submit() {
  if (!editor.drawingAllowed || editor.activeStroke) return;
  if (!editor.shapes.length) {
    const scope = room.scope,
      id = state.value.roundId;
    if (
      !(await confirm.value?.ask('空白送出代表本輪略過，你的畫作不會進入猜圖排序。', '空白送出？'))
    )
      return;
    if (scope !== room.scope || id !== state.value.roundId) return;
  }
  await editor.submit();
}
async function answer() {
  if (composing.value || blocked.value) return;
  const scope = room.scope,
    trigger = document.activeElement;
  await editor.answer();
  await nextTick();
  if (
    !disposed &&
    scope === room.scope &&
    !document.querySelector('dialog[open]') &&
    (document.activeElement === trigger || document.activeElement === document.body)
  )
    input.value?.focus({ preventScroll: true });
}
function value(event: Event) {
  if (!composing.value) editor.saveGuess((event.target as HTMLInputElement).value);
}
function visibility() {
  if (document.hidden) confirm.value?.cancel();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <section class="vue-game-panel vue-minimal-stage" aria-labelledby="minimalHeading"
    ><header class="vue-minimal-heading"
      ><div
        ><small>LINES · CIRCLES · ONE GUESS</small
        ><h1 id="minimalHeading">{{
          state.phase === 'waiting'
            ? '少一筆，也能讓朋友猜中'
            : state.phase === 'drawing'
              ? guesser
                ? '你是本輪猜題者'
                : '用幾何，畫出秘密題目'
              : state.phase === 'guessing'
                ? '從最少筆畫開始猜'
                : state.phase === 'reveal'
                  ? '本輪答案與畫作'
                  : state.interrupted
                    ? '本場中止'
                    : '本場成績'
        }}</h1
        ><p>{{
          state.phase === 'drawing' && guesser
            ? '畫家正在作畫，答案與私人草稿不會公開。'
            : '只用直線與完整封閉圓，每個圖形算一筆。'
        }}</p></div
      ><RoomCountdown
        :deadline="state.deadline"
        :duration="10000"
        :offset="room.clockOffset"
        :epoch="state.roundId || 'waiting'"
        caption="最後畫家剩餘"
        :now="editor.now"
        urgent
    /></header>
    <div class="vue-minimal-live-slot"
      ><section
        v-if="state.phase === 'drawing' && !guesser"
        class="vue-minimal-private"
        data-private
        ><h2>秘密題目：{{ state.prompt }}</h2
        ><div class="vue-minimal-tools"
          ><DrawingToolButton
            tool="line"
            label="直線"
            :selected="tool === 'line'"
            :disabled="!editor.editable || editor.activeStroke"
            @click="tool = 'line'" /><DrawingToolButton
            tool="ellipse"
            label="封閉圓"
            :selected="tool === 'circle'"
            :disabled="!editor.editable || editor.activeStroke"
            @click="tool = 'circle'" /><DrawingToolButton
            tool="undo"
            label="復原上一個圖形"
            :disabled="!editor.editable || editor.activeStroke || !editor.shapes.length"
            @click="editor.undo()" /><DrawingToolButton
            tool="clear"
            label="清除畫布"
            :disabled="!editor.editable || editor.activeStroke || !editor.shapes.length"
            @click="clear" /></div
        ><GeometryCanvas
          :shapes="state.submitted || editor.expired ? state.myShapes : editor.shapes"
          :label="'你的私人幾何畫布，秘密題目 ' + state.prompt"
          :epoch="state.roundId || ''"
          :editable="editor.editable"
          :tool="tool"
          @commit="editor.append"
          @active="editor.activeStroke = $event"
        /><div class="vue-minimal-sync"
          ><strong>本地 {{ editor.shapes.length }}／40 筆</strong
          ><strong>已同步 {{ state.myShapes.length }} 筆</strong
          ><UiButton
            icon="refresh"
            label="同步草稿"
            :pending="editor.saving"
            :disabled="
              !editor.drawingAllowed || editor.finishing || editor.activeStroke || !editor.dirty
            "
            @click="editor.sync()" /><UiButton
            icon="check"
            label="完成作畫"
            :pending="editor.finishing"
            :disabled="
              !editor.drawingAllowed || editor.activeStroke || (room.busy && !editor.saving)
            "
            @click="submit" /></div
        ><p>{{ syncMessage }}</p
        ><p>送出後不能修改；倒數只保留伺服器已接受的圖形。</p></section
      >
      <section
        v-else-if="state.phase === 'guessing' && state.currentDrawing"
        class="vue-minimal-public"
        ><h2>{{ state.currentDrawing.name }} · {{ state.currentDrawing.count }} 筆</h2
        ><GeometryCanvas
          :shapes="state.currentDrawing.shapes"
          :label="state.currentDrawing.name + ' 的公開畫作，' + state.currentDrawing.count + ' 筆'"
          :epoch="state.roundId + ':' + state.attempts.length"
        /><p>每張猜一次；猜中畫家 +2、猜題者 +1。</p
        ><form v-if="guesser" @submit.prevent="answer"
          ><label for="minimalAnswer">你猜圖上是什麼？</label
          ><input
            id="minimalAnswer"
            ref="input"
            :value="editor.guess"
            maxlength="80"
            autocomplete="off"
            :disabled="blocked"
            @input="value"
            @compositionstart="composing = true"
            @compositionend="
              composing = false;
              value($event);
            "
            @keydown.enter="
              (composing || $event.isComposing || $event.keyCode === 229) && $event.preventDefault()
            " /><UiButton
            type="submit"
            icon="send"
            label="送出猜詞"
            :disabled="blocked || composing || !editor.guess.trim()" /></form
        ><p v-else>等待本輪猜題者作答。</p
        ><ol class="vue-minimal-order" aria-label="由少到多的展示順序"
          ><li
            v-for="(drawing, index) in state.order"
            :key="index"
            :aria-current="index === state.attempts.length ? 'step' : undefined"
            >{{ drawing.name }} · {{ drawing.count }} 筆{{
              index === state.attempts.length ? ' · 目前展示' : ''
            }}</li
          ></ol
        ></section
      >
      <section v-else-if="state.phase === 'reveal'" class="vue-minimal-summary"
        ><h2>答案：{{ state.results.at(-1)?.title }}</h2
        ><p>{{
          state.results.at(-1)?.attempts.some((attempt) => attempt.correct)
            ? '猜中了！回顧下方畫作與猜詞。'
            : '本輪未猜中；已完成畫作保留於下方回顧。'
        }}</p
        ><UiButton
          v-if="room.host"
          icon="next"
          label="下一輪"
          :disabled="blocked"
          @click="actions.command('next')"
        /><p v-else>等待房主開始下一輪。</p></section
      >
      <section v-else-if="state.phase === 'finished'" class="vue-minimal-summary"
        ><p v-if="state.interrupted">有人離席，本場中止。僅保留已完成的回合與分數。</p
        ><template v-else-if="state.winner"
          ><h2>最高分 {{ state.winner.score }} 分</h2
          ><p
            >{{ state.winner.names.join('、')
            }}{{ state.winner.names.length > 1 ? ' 並列' : '' }}獲勝</p
          ></template
        ><ol class="vue-minimal-rankings"
          ><li
            v-for="player in [...state.players].sort((a, b) => Number(b.score) - Number(a.score))"
            :key="player.id"
            ><strong>{{ player.name }}</strong
            ><span>{{ player.score }} 分</span></li
          ></ol
        ></section
      >
      <section v-else class="vue-minimal-waiting"
        ><img
          :src="room.host ? '/assets/stitch/waiting-host.jpg' : '/assets/stitch/waiting-guest.jpg'"
          alt=""
        /><p>{{
          state.phase === 'drawing'
            ? '等待其他畫家完成；只剩一人時會開始十秒倒數。'
            : '邀請三至六位朋友，或加入腳本夥伴測試流程。'
        }}</p></section
      ></div
    ><StatusSlot
      :message="actions.notice || editor.notice || editor.storageNotice"
      :error="(!actions.pending && !!actions.notice) || !!editor.storageNotice" /><div
      class="vue-minimal-retry"
      ><UiButton
        v-if="actions.canRetry"
        icon="refresh"
        label="重試同一操作"
        :disabled="blocked"
        @click="actions.retrySame()" /></div
  ></section>
  <details class="vue-game-panel vue-minimal-review"
    ><summary
      ><strong id="minimalReview">本場回顧</strong
      ><span
        >{{
          state.roundLimit ? state.results.length + '／' + state.roundLimit + ' 輪' : '尚未開始'
        }}
        · 展開查看題目、畫作與猜詞</span
      ></summary
    ><header
      ><label v-if="state.results.length"
        >選擇回合<select v-model.number="review"
          ><option v-for="result in state.results" :key="result.round" :value="result.round"
            >第 {{ result.round }} 輪 · {{ result.title }}</option
          ></select
        ></label
      ></header
    ><p v-if="!selected">完成一輪後，題目、畫作與猜詞會保留於這裡。</p
    ><div v-else class="vue-minimal-review-content"
      ><h3>第 {{ selected.round }} 輪 · {{ selected.title }}</h3
      ><p>猜題者：{{ selected.guesserName }}</p
      ><ul
        ><li v-if="!selected.attempts.length">本輪全部空白，中性揭曉。</li
        ><li v-for="(attempt, index) in selected.attempts" :key="index"
          >{{ selected.guesserName }} 猜「{{ attempt.text }}」 · {{ attempt.artistName
          }}{{ attempt.correct ? ' ✓ 畫家 +2，猜題者 +1' : ' · 未猜中' }}</li
        ></ul
      ><div class="vue-minimal-review-drawings"
        ><article v-for="(drawing, index) in selected.drawings" :key="selected.round + ':' + index"
          ><h3>{{ drawing.name }} · {{ drawing.count }} 筆</h3
          ><GeometryCanvas
            :shapes="drawing.shapes"
            :label="drawing.name + ' 的回顧畫作，' + drawing.count + ' 筆'"
            :epoch="'review:' + selected.round" /></article></div></div></details
  ><ConfirmDialog ref="confirm" />
</template>
