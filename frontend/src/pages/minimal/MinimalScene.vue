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
import MinimalWaiting from './MinimalWaiting.vue';
const editor = useMinimalStore(),
  room = useRoomStore(),
  actions = usePartyActionsStore(),
  state = computed(() => editor.state as MinimalSnapshot),
  guesser = computed(() => state.value.me === state.value.guesserId);
const tool = ref<'line' | 'circle'>('line'),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  input = ref<HTMLInputElement | null>(null),
  composing = ref(false);
let disposed = false;
const latest = computed(() => state.value.results.at(-1)),
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
  <MinimalWaiting v-if="state.phase === 'waiting'" />
  <section
    v-else
    class="vue-minimal-stage"
    :data-phase="state.phase"
    aria-labelledby="minimalHeading"
  >
    <header
      class="vue-minimal-task-header"
      :data-private="state.phase === 'drawing' && !guesser ? '' : undefined"
      ><div>
        <h1 id="minimalHeading">{{
          state.phase === 'drawing'
            ? guesser
              ? '畫家正在作畫'
              : '秘密題目：' + state.prompt
            : state.phase === 'guessing'
              ? state.currentDrawing?.name + ' · ' + state.currentDrawing?.count + ' 筆'
              : state.phase === 'reveal'
                ? '本輪揭曉：' + latest?.title
                : state.interrupted
                  ? '本場中止'
                  : '本場成績'
        }}</h1>
        <p>{{
          state.phase === 'drawing'
            ? guesser
              ? '等待畫家完成，題目與私人草稿不會公開。'
              : '僅畫家看見'
            : state.phase === 'guessing'
              ? '從少筆畫到多筆畫依序展示'
              : state.phase === 'reveal'
                ? '每輪只用直線與封閉圓。'
                : '已完成回合的分數與畫作'
        }}</p> </div
      ><div class="vue-minimal-task-meta"
        ><span v-if="state.phase === 'drawing' && !guesser" class="vue-minimal-badge"
          >{{ editor.shapes.length }}／40 筆</span
        ><div class="vue-minimal-countdown-slot"
          ><RoomCountdown
            v-if="state.deadline"
            :deadline="state.deadline"
            :duration="10000"
            :offset="room.clockOffset"
            :epoch="state.roundId || ''"
            caption="最後畫家剩餘"
            :now="editor.now"
            urgent /></div></div
    ></header>
    <section
      v-if="state.phase === 'drawing' && !guesser"
      class="vue-minimal-task-panel vue-minimal-private"
      data-private
    >
      <div class="vue-minimal-drawing-area"
        ><div class="vue-minimal-tools" aria-label="幾何畫具">
          <DrawingToolButton
            tool="line"
            label="直線"
            :selected="tool === 'line'"
            :disabled="!editor.editable || editor.activeStroke"
            @click="tool = 'line'"
          />
          <DrawingToolButton
            tool="ellipse"
            label="封閉圓"
            :selected="tool === 'circle'"
            :disabled="!editor.editable || editor.activeStroke"
            @click="tool = 'circle'"
          />
          <DrawingToolButton
            tool="undo"
            label="復原上一個圖形"
            :disabled="!editor.editable || editor.activeStroke || !editor.shapes.length"
            @click="editor.undo()"
          />
          <DrawingToolButton
            tool="clear"
            label="清除畫布"
            :disabled="!editor.editable || editor.activeStroke || !editor.shapes.length"
            @click="clear"
          /> </div
        ><GeometryCanvas
          :shapes="state.submitted || editor.expired ? state.myShapes : editor.shapes"
          :label="'你的私人幾何畫布，秘密題目 ' + state.prompt"
          :epoch="state.roundId || ''"
          :editable="editor.editable"
          :tool="tool"
          @commit="editor.append"
          @active="editor.activeStroke = $event"
      /></div>
      <p class="vue-minimal-drawing-note"
        >直線與封閉圓，每個圖形算一筆，最多 40 筆。放開後同步私人草稿；只剩一位未完成時倒數 10
        秒，時間到保留已同步圖形。</p
      >
      <footer class="vue-minimal-footer vue-minimal-sync"
        ><div class="vue-minimal-sync-counts"
          ><strong>本地 {{ editor.shapes.length }}／40 筆</strong
          ><strong>已同步 {{ state.myShapes.length }} 筆</strong
          ><span>完成後不可修改；空畫布視為本輪略過。</span></div
        ><div class="vue-minimal-submit-actions"
          ><UiButton
            variant="secondary"
            icon="refresh"
            label="同步草稿"
            :pending="editor.saving"
            :disabled="
              !editor.drawingAllowed || editor.finishing || editor.activeStroke || !editor.dirty
            "
            @click="editor.sync()" /><UiButton
            variant="primary"
            icon="check"
            label="完成作畫"
            :pending="editor.finishing"
            :disabled="
              !editor.drawingAllowed || editor.activeStroke || (room.busy && !editor.saving)
            "
            @click="submit" /></div
      ></footer>
    </section>
    <section
      v-else-if="state.phase === 'guessing' && state.currentDrawing"
      class="vue-minimal-task-panel vue-minimal-public"
    >
      <div class="vue-minimal-public-canvas"
        ><GeometryCanvas
          :shapes="state.currentDrawing.shapes"
          :label="state.currentDrawing.name + ' 的公開畫作，' + state.currentDrawing.count + ' 筆'"
          :epoch="state.roundId + ':' + state.attempts.length"
      /></div>
      <footer class="vue-minimal-guess-footer"
        ><form v-if="guesser" @submit.prevent="answer"
          ><label for="minimalAnswer">你猜圖上是什麼？</label
          ><div
            ><input
              id="minimalAnswer"
              ref="input"
              :value="editor.guess"
              maxlength="80"
              placeholder="輸入你的猜測"
              autocomplete="off"
              :disabled="blocked"
              @input="value"
              @compositionstart="composing = true"
              @compositionend="
                composing = false;
                value($event);
              "
              @keydown.enter="
                (composing || $event.isComposing || $event.keyCode === 229) &&
                $event.preventDefault()
              " /><UiButton
              variant="primary"
              type="submit"
              icon="send"
              label="送出猜測"
              :disabled="blocked || composing || !editor.guess.trim()" /></div
          ><small>每張作品猜一次。猜中畫家 +2 分、猜題者 +1 分。</small></form
        ><p v-else>等待本輪猜題者作答。</p
        ><details class="vue-minimal-order"
          ><summary
            >展示順序 · 第 {{ state.attempts.length + 1 }}／{{ state.order.length }} 張</summary
          ><ol
            ><li
              v-for="(drawing, index) in state.order"
              :key="index"
              :aria-current="index === state.attempts.length ? 'step' : undefined"
              >{{ drawing.name }} · {{ drawing.count }} 筆{{
                index === state.attempts.length ? ' · 目前展示' : ''
              }}</li
            ></ol
          ></details
        ></footer
      >
    </section>
    <section
      v-else-if="state.phase === 'drawing'"
      class="vue-minimal-task-panel vue-minimal-pending"
      ><div
        ><h2>等待畫家完成</h2
        ><p>{{ state.readyIds.length }}／{{ state.players.length - 1 }} 位畫家已完成</p
        ><p>只剩一位未完成時會開始十秒倒數。</p></div
      ></section
    >
    <section v-else class="vue-minimal-task-panel vue-minimal-summary"
      ><div class="vue-minimal-result-content">
        <template v-if="state.phase === 'reveal'"
          ><h2>答案：{{ latest?.title }}</h2
          ><p>{{
            latest?.attempts.some((a) => a.correct)
              ? '猜中了！分數已更新。'
              : '本輪未猜中；以下展示本輪已完成的畫作。'
          }}</p
          ><div class="vue-minimal-reveal-drawings"
            ><article v-for="(drawing, index) in latest?.drawings" :key="index"
              ><h3>{{ drawing.name }} · {{ drawing.count }} 筆</h3
              ><GeometryCanvas
                :shapes="drawing.shapes"
                :label="drawing.name + ' 的揭曉畫作'"
                :epoch="'reveal:' + state.roundId" /></article></div
        ></template>
        <template v-else
          ><p v-if="state.interrupted">有人離席，本場中止。只保留已完成回合與分數。</p
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
          ></template
        > </div
      ><footer class="vue-minimal-footer"
        ><span>{{ state.phase === 'reveal' ? '本輪揭曉' : '本場結束' }}</span
        ><UiButton
          v-if="state.phase === 'reveal' && room.host"
          variant="primary"
          icon="next"
          label="下一輪"
          :disabled="blocked"
          @click="actions.command('next')"
        /><div v-else-if="state.phase === 'finished'" id="minimal-setup-slot"></div
        ><span v-else>等待房主開始下一輪。</span></footer
      ></section
    >
    <div class="vue-minimal-feedback"
      ><StatusSlot
        :message="
          actions.notice ||
          editor.notice ||
          editor.storageNotice ||
          (state.phase === 'drawing' && !guesser ? syncMessage : '')
        "
        :error="(!actions.pending && !!actions.notice) || !!editor.storageNotice" /><UiButton
        v-if="actions.canRetry"
        icon="refresh"
        label="重試同一操作"
        :disabled="blocked"
        @click="actions.retrySame()"
    /></div>
  </section>
  <ConfirmDialog ref="confirm" />
</template>
