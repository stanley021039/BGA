<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { readRoomSnapshot, type RoomSnapshot } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import DrawingModePicker from '../../components/DrawingModePicker.vue';
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
const type = location.pathname.startsWith('/brainwave') ? 'brainwave' : 'drama-bar';
const drawing = type === 'brainwave';
const title = drawing ? '電波畫家' : '戲精酒吧';
const description = drawing
  ? '聽領圖者的口令、各自跟畫，搶答找出正確選項。'
  : '只用聲音演出一句台詞，猜猜是哪個情境。';
const room = useRoomStore();
const state = computed(() => room.snapshot as VoicePartyState | null);
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
    state.value.myGuesses.length < (drawing ? 3 : 1),
);
const selected = ref<number | null>(null);
const shape = ref('circle');
const confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null);
watch(
  () => state.value?.roundId,
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
function status(player: { id: string }) {
  if (!state.value || state.value.phase === 'waiting') return '已入座';
  if (reveal.value) return '本輪已揭曉';
  return player.id === state.value.actorId
    ? drawing
      ? '領圖者'
      : '表演者'
    : drawing
      ? '收訊者'
      : '猜題者';
}
</script>

<template>
  <GameRoomPage
    :type="type"
    :title="title"
    :description="'3–8 人 · ' + description"
    :reader="readRoomSnapshot"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 回合` : ''"
    :actor-id="state?.actorId"
    :status="status"
    :max-players="8"
    :score-label="drawing ? '顆水晶' : '杯'"
    :setup="!!state && ['waiting', 'finished'].includes(state.phase)"
    :can-start="(state?.players.length || 0) >= 3"
    :watchable="false"
    :tutorial="false"
    :poll-ms="850"
    @start="room.command('start', {})"
  >
    <template #settings>
      <p v-if="state?.phase === 'waiting'"
        >請先確認大家能透過同桌或外部語音互相聽見。測試 AI 僅用於操作驗證。</p
      >
      <UiField
        v-if="!drawing && state?.phase === 'waiting'"
        control="select"
        label="每人演出次數"
        :model-value="String(state.options?.cycles ?? 1)"
        :options="
          [1, 2, 3].map((count) => ({ value: String(count), label: String(count) + ' 次' }))
        "
        :disabled="!room.settingsManager || room.busy"
        @update:model-value="room.command('settings', { cycles: Number($event) })"
      />
    </template>
    <template #help>
      <ol v-if="drawing">
        <li>領圖者有一次換題機會。確認後，正解只有領圖者可見。</li>
        <li>60 秒內只能說形狀、大小、方向、位置與數量。每個人只看得到自己的畫板。</li>
        <li>收訊者可提交 1–3 個不同選項。正確的先後順序決定水晶獎勵，錯牌與未出牌可能扣分。</li>
        <li>若無人答對，擲訊號不良骰結算。每人輪流領圖，水晶最多者獲勝。</li>
      </ol>
      <ol v-else>
        <li>題卡公開一句台詞及六個情境。抽到的情境只有表演者可見。</li>
        <li>用聲音與語氣說出台詞，其他玩家各自猜一個情境。</li>
        <li>有人答對時，答錯的人各記一杯。全部猜錯時，只有表演者記一杯。</li>
        <li>每人輪流表演。全部演完後，虛擬杯數最少者獲勝。</li>
      </ol>
    </template>
    <RoomWaitingTemplate
      v-if="drawing && state?.phase === 'waiting'"
      type="brainwave"
      :title="title"
      :description="description"
      art="/assets/playful/game-draw.svg"
      :facts="[
        { label: '玩家人數', value: '3–8 人' },
        { label: '每輪時間', value: '60 秒' },
        { label: '語音', value: '同桌或外部語音' },
      ]"
      ><template #mode-picker><DrawingModePicker /></template
    ></RoomWaitingTemplate>
    <UiPanel
      v-else-if="!state || state.phase === 'waiting'"
      :title="title"
      :description="description"
    >
      <p>{{ drawing ? '輪到你時，用一句句口令傳出你的圖。' : '先聽台詞，再選出最像的情境。' }}</p>
    </UiPanel>
    <template v-else>
      <UiPanel
        v-if="state.interrupted"
        title="本場中止"
        description="有玩家離席，可以回等待室重新開局。"
      />
      <div v-else class="party-338-stage">
        <UiPanel
          :title="phase"
          :description="person(state.actorId) + (drawing ? ' 領圖' : ' 表演')"
        >
          <PartyCountdown
            v-if="state.deadline"
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
            v-if="room.gameManager && state.deadline"
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
            v-if="state.phase === 'reveal' && room.gameManager"
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
  </GameRoomPage>
</template>
