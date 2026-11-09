<script setup lang="ts">
import AudioSettings from '../../engines/audio-settings.js';
import { playActionFeedback } from '../../services/action-sounds';
import { computed, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import type { RoomSnapshot } from '../../contracts/room';
import PartyArtwork, { shapeOptions, type PartyShape } from '../../components/PartyArtwork.vue';
import PartyCountdown from '../../components/PartyCountdown.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiButton from '../../components/UiButton.vue';
import UiChoiceCard from '../../components/UiChoiceCard.vue';
import UiField from '../../components/UiField.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiHeading from '../../components/UiHeading.vue';
import '../../styles/party-338.scss';

interface DramaQuestion {
  phrase: string;
  options: string[];
}
interface Result {
  correct: number;
  guesses: { id: string; option: number }[] | Record<string, number>;
  deltas?: Record<string, number>;
  die?: number | null;
  penalized?: string[];
}
interface VoicePartyState extends RoomSnapshot {
  round: number;
  roundLimit: number;
  roundId: string | null;
  actorId: string | null;
  correct: number | null;
  question: string[] | DramaQuestion | null;
  deadline: number | null;
  changedQuestion?: boolean;
  myGuesses: number[];
  submissions: number;
  board?: PartyShape[];
  revealedBoards?: Record<string, PartyShape[]> | null;
  latest: Result | null;
  interrupted: boolean;
  options?: { cycles: number };
  winner: { score: number; names: string[] } | null;
}
const props = defineProps<{ type: 'brainwave' | 'drama-bar'; tutorial?: boolean }>();
const drawing = computed(() => props.type === 'brainwave');
const room = useRoomStore();
const state = computed(() => room.snapshot as VoicePartyState | null);
watch(state, (next, previous) => {
  if (
    !next?.roundId ||
    next.roundId !== previous?.roundId ||
    next.code !== previous.code ||
    next.interrupted
  )
    return;
  if (
    ['reveal', 'finished'].includes(next.phase) &&
    !['reveal', 'finished'].includes(previous.phase) &&
    next.latest
  ) {
    AudioSettings?.playEffect?.('settlement');
  } else if (next.me === previous.me && next.myGuesses.length > previous.myGuesses.length) {
    playActionFeedback();
  }
});
const phaseLabels: Record<string, string> = {
  waiting: '等待玩家',
  prepare: '領圖者選題',
  drawing: '領圖與搶答',
  performing: '聲音表演',
  guessing: '猜情境',
  reveal: '本輪揭曉',
  finished: '本局結束',
};
const phase = computed(() => phaseLabels[state.value?.phase || 'waiting']);
const active = computed(
  () => state.value?.phase === 'drawing' || state.value?.phase === 'guessing',
);
const reveal = computed(() => ['reveal', 'finished'].includes(state.value?.phase || ''));
const actor = computed(() => state.value?.actorId === state.value?.me);
const person = (id: string | null) =>
  state.value?.players.find((player) => player.id === id)?.name || '玩家';
const choices = computed(() => {
  const question = state.value?.question;
  return Array.isArray(question) ? question : question?.options || [];
});
const phrase = computed(() => {
  const question = state.value?.question;
  return Array.isArray(question) ? '' : question?.phrase || '';
});
const finalGuesses = computed(() => {
  const guesses = state.value?.latest?.guesses;
  if (!guesses) return [];
  return Array.isArray(guesses)
    ? guesses
    : Object.entries(guesses).map(([id, option]) => ({ id, option }));
});
const canGuess = computed(
  () =>
    !!state.value &&
    active.value &&
    !actor.value &&
    state.value.myGuesses.length < (drawing.value ? 3 : 1),
);
const selected = ref<number | null>(null);
const shape = ref('circle');
const confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null);
watch(
  () => [state.value?.roundId, state.value?.me],
  () => {
    selected.value = null;
  },
);
function act(action: string, data: Record<string, unknown> = {}) {
  const roundId = state.value?.roundId;
  if (!roundId) return Promise.resolve(false);
  return room.command('action', { action, roundId, requestId: crypto.randomUUID(), ...data });
}
async function guess() {
  if (selected.value === null) return;
  if (await act('guess', { option: selected.value })) selected.value = null;
}
async function restart() {
  const roundId = state.value?.roundId;
  if (
    (await confirm.value?.ask('重開本回合會更換題目，當前提交將作廢。')) &&
    state.value?.roundId === roundId
  )
    await act('restart');
}
</script>

<template>
  <template v-if="state">
    <UiPanel
      v-if="state.interrupted"
      title="本場中止"
      description="有玩家離席，可以回等待室重新開局。"
    />
    <div v-else class="party-338-stage">
      <UiPanel :title="phase" :description="person(state.actorId) + (drawing ? ' 領圖' : ' 表演')">
        <PartyCountdown
          v-if="state.deadline && !tutorial"
          :deadline="state.deadline"
          :duration="
            state.phase === 'drawing'
              ? 60000
              : state.phase === 'performing'
                ? 45000
                : state.phase === 'guessing'
                  ? 20000
                  : 30000
          "
          :epoch="String(state.roundId) + state.phase"
          caption="剩餘時間"
        />
        <p v-if="state.phase === 'prepare'">{{
          actor ? '檢查五個選項。確認後會抽出一個秘密正解。' : '等待領圖者確認題目。'
        }}</p>
        <p v-if="state.phase === 'performing'">{{
          actor ? '只說卡上的台詞，用語氣演出你的秘密情境。' : '請聽表演者說出台詞。'
        }}</p>
        <UiHeading
          v-if="!reveal && state.correct !== null"
          :level="3"
          kind="prompt"
          :label="drawing ? '你的秘密題目' : '你的秘密情境'"
          >{{ choices[state.correct] }}</UiHeading
        >
        <div v-if="actor && state.phase === 'prepare'" class="party-338-controls">
          <UiButton
            label="換一組題目"
            :disabled="room.busy || state.changedQuestion"
            @click="act('change-question')"
          />
          <UiButton
            variant="primary"
            label="開始領圖"
            :disabled="room.busy"
            @click="act('ready')"
          />
        </div>
        <UiButton
          v-if="actor && state.phase === 'performing'"
          variant="primary"
          label="演完了"
          :disabled="room.busy"
          @click="act('performed')"
        />
        <UiButton
          v-if="!tutorial && room.gameManager && state.deadline"
          variant="ghost"
          label="重開本回合"
          :disabled="room.busy"
          @click="restart"
        />
      </UiPanel>

      <div
        class="party-338-columns"
        :class="{ 'party-338-two-columns': drawing && state.phase === 'drawing' }"
      >
        <UiPanel v-if="drawing && state.phase === 'drawing'" title="你的畫板">
          <div class="party-338-controls">
            <UiField v-model="shape" control="select" label="圖形" :options="shapeOptions" />
            <UiButton
              label="復原上一筆"
              :disabled="room.busy || !state.board?.length"
              @click="act('undo')"
            />
          </div>
          <PartyArtwork
            :key="state.roundId!"
            label="私人畫板，拖曳放置圖形"
            :shapes="state.board"
            :kind="shape"
            :editable="true"
            :saving="room.busy"
            @shape="(shape) => act('shape', { shape })"
          />
        </UiPanel>
        <UiPanel
          v-if="choices.length"
          title="選項"
          :note="active ? '已提交 ' + state.submissions + ' 份' : ''"
        >
          <UiHeading v-if="phrase" :level="3" kind="prompt" label="本輪台詞">{{
            phrase
          }}</UiHeading>
          <div class="party-338-choices">
            <UiChoiceCard
              v-for="(choice, index) in choices"
              :key="index"
              :label="index + 1 + '. ' + choice"
              readable-disabled
              :selected="
                selected === index ||
                state.myGuesses.includes(index) ||
                (reveal && index === state.latest?.correct)
              "
              :disabled="!canGuess || state.myGuesses.includes(index) || room.busy"
              @click="selected = index"
            />
          </div>
          <UiButton
            v-if="canGuess"
            variant="primary"
            label="確認送出"
            :disabled="selected === null || room.busy"
            @click="guess"
          />
          <p v-if="drawing && !actor && active"
            >已出 {{ state.myGuesses.length }}／3 張。每個選項只能出一次。</p
          >
        </UiPanel>
      </div>

      <UiPanel v-if="reveal && state.latest" :title="state.winner ? '本局結果' : '回合結果'">
        <UiHeading :level="3" kind="prompt" label="本輪正解">{{
          choices[state.latest.correct]
        }}</UiHeading>
        <ol v-if="finalGuesses.length">
          <li v-for="(entry, index) in finalGuesses" :key="index"
            >{{ person(entry.id) }} 選了 {{ choices[entry.option] }}</li
          >
        </ol>
        <p v-else>本輪沒有提交。</p>
        <p v-if="state.latest.die != null"
          >訊號不良骰：{{ state.latest.die === 5 ? '訊號不良' : state.latest.die + 1 }}</p
        >
        <p v-if="state.latest.penalized"
          >本輪記杯：{{ state.latest.penalized.map(person).join('、') || '無' }}</p
        >
        <div v-if="state.latest.deltas" class="party-338-controls">
          <UiBadge
            v-for="(delta, id) in state.latest.deltas"
            :key="id"
            :label="person(id) + ' ' + (delta > 0 ? '+' : '') + delta"
          />
        </div>
        <p v-if="state.winner"
          >勝出：{{ state.winner.names.join('、') }}（{{ state.winner.score }}
          {{ drawing ? '顆水晶' : '杯' }}）</p
        >
        <UiButton
          v-if="!tutorial && state.phase === 'reveal' && room.gameManager"
          variant="primary"
          label="下一回合"
          :disabled="room.busy"
          @click="act('next')"
        />
      </UiPanel>
      <div v-if="state.revealedBoards" class="party-338-choices">
        <UiPanel
          v-for="(board, id) in state.revealedBoards"
          :key="id"
          :title="person(id) + ' 的畫作'"
        >
          <PartyArtwork :label="person(id) + ' 的畫作'" :shapes="board" />
        </UiPanel>
      </div>
    </div>
  </template>
  <ConfirmDialog ref="confirm" />
</template>
