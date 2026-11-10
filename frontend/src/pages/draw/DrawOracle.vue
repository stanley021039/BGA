<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import type { DrawSnapshot } from '../../contracts/drawing';
import PartyArtwork, { type TraceBoard } from '../../components/PartyArtwork.vue';
import PartyCountdown from '../../components/PartyCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import UiChoiceCard from '../../components/UiChoiceCard.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiField from '../../components/UiField.vue';
import UiHeading from '../../components/UiHeading.vue';
import '../../styles/party-338.scss';

interface OracleState {
  roundId: string;
  deadline: number | null;
  turnId: string | null;
  errors: number;
  maxErrors: number;
  readyCount: number;
  board: TraceBoard | null;
  words: string[];
  boards: Record<string, TraceBoard>;
  terms: { id: string; word: string; eliminated: boolean; artist?: string | null }[];
  summary: { mistakes: number; round: number } | null;
}
const props = defineProps<{
  snapshot: DrawSnapshot;
  tutorial?: boolean;
  observer?: boolean;
  following?: string;
}>();
const room = useRoomStore();
const oracle = computed(() => props.snapshot.oracle as OracleState);
const selected = ref('');
const viewBoard = ref('');
const activeBoard = computed(() => {
  const focused = viewBoard.value || props.following || '';
  return oracle.value.boards[focused] ? focused : Object.keys(oracle.value.boards)[0];
});
watch(
  () => props.following,
  () => {
    viewBoard.value = '';
  },
);
const person = (id: string | null) =>
  props.snapshot.players.find((player) => player.id === id)?.name || '玩家';
const myTurn = computed(() => oracle.value.turnId === props.snapshot.me);
const editable = computed(
  () => !!oracle.value.board && !oracle.value.board.submitted && !room.busy,
);
watch(
  () => [oracle.value.roundId, oracle.value.turnId, props.snapshot.me],
  () => {
    selected.value = '';
  },
);
function act(action: string, data: Record<string, unknown> = {}) {
  if (props.observer) return;
  return room.command('action', {
    action: 'oracle-' + action,
    roundId: oracle.value.roundId,
    requestId: crypto.randomUUID(),
    ...data,
  });
}
async function eliminate() {
  if (await act('eliminate', { termId: selected.value })) selected.value = '';
}
</script>

<template>
  <div class="party-338-stage vue-draw-oracle-stage">
    <UiPanel title="塗鴉神諭" :note="'第 ' + snapshot.round + '／4 輪'" density="compact">
      <div class="vue-draw-oracle-status">
        <span>全隊錯誤 {{ oracle.errors }}／{{ oracle.maxErrors }}，超過上限即結束。</span>
        <span v-if="oracle.board || (observer && snapshot.phase === 'oracle-drawing')"
          >已交畫 {{ oracle.readyCount }}／{{ oracle.maxErrors }} 人</span
        >
      </div>
      <PartyCountdown
        v-if="oracle.deadline && !tutorial"
        :deadline="oracle.deadline"
        :epoch="oracle.roundId + snapshot.phase + (oracle.turnId || '')"
        :duration="snapshot.phase === 'oracle-drawing' ? 120000 : 30000"
        :caption="snapshot.phase === 'oracle-drawing' ? '作畫剩餘' : '本次淘汰剩餘'"
      />
      <p v-if="oracle.turnId && !tutorial">輪到的玩家逾時時，系統會代選一張牌。</p>
      <UiHeading v-if="oracle.turnId" :level="3">{{
        myTurn ? '輪到你淘汰一個沒人畫過的詞。' : '等待 ' + person(oracle.turnId) + ' 淘汰一個詞。'
      }}</UiHeading>
    </UiPanel>
    <UiPanel
      v-if="oracle.board"
      class="vue-draw-oracle-board"
      density="compact"
      :title="oracle.words.join('、')"
      title-label="你的秘密題目 · 沿虛線描畫"
    >
      <template #actions>
        <div class="party-338-controls">
          <UiButton
            label="翻面"
            :disabled="!editable || oracle.board.marks.length > 0"
            @click="act('board', { side: 1 - oracle.board.side, rotation: oracle.board.rotation })"
          />
          <UiButton
            label="旋轉畫板"
            :disabled="!editable"
            @click="
              act('board', { side: oracle.board.side, rotation: (oracle.board.rotation + 1) % 4 })
            "
          />
          <UiButton
            label="復原上一筆"
            :disabled="!editable || !oracle.board.marks.length"
            @click="act('undo')"
          />
          <UiButton
            variant="primary"
            label="完成作畫"
            :disabled="!editable"
            @click="act('submit')"
          />
        </div>
      </template>
      <PartyArtwork
        :key="oracle.roundId + ':' + oracle.board.side"
        class="vue-draw-oracle-artwork"
        label="沿虛線拖曳作畫"
        :board="oracle.board"
        :editable="!oracle.board.submitted"
        :saving="room.busy"
        @trace="(trace) => act('trace', { trace })"
      />
      <p>{{
        oracle.board.submitted
          ? '已交畫，等候其他玩家。'
          : '可在虛線中途停筆。交畫後等待全員完成或倒數結束。'
      }}</p>
    </UiPanel>
    <div v-else-if="activeBoard" class="party-338-columns party-338-two-columns">
      <UiPanel title="查看畫作">
        <UiField
          control="select"
          label="玩家作品"
          :model-value="activeBoard"
          :options="Object.keys(oracle.boards).map((id) => ({ value: id, label: person(id) }))"
          @update:model-value="viewBoard = String($event)"
        />
        <PartyArtwork
          :key="activeBoard"
          :label="person(activeBoard) + ' 的畫作'"
          :board="oracle.boards[activeBoard]"
        />
        <p v-if="oracle.summary"
          >畫的是
          {{
            oracle.terms
              .filter((term) => term.artist === activeBoard)
              .map(({ word }) => word)
              .join('、')
          }}</p
        >
      </UiPanel>
      <UiPanel :title="oracle.summary ? '本輪揭曉' : '候選詞'">
        <div class="party-338-choices">
          <UiChoiceCard
            v-for="term in oracle.terms"
            :key="term.id"
            :label="term.word"
            readable-disabled
            :selected="selected === term.id"
            :disabled="!myTurn || term.eliminated || room.busy"
            @click="selected = term.id"
            ><template #selection
              ><span>{{
                oracle.summary
                  ? (term.artist ? person(term.artist) + ' 畫的' : '干擾詞') +
                    (term.eliminated ? ' · 已淘汰' : '')
                  : term.eliminated
                    ? '已淘汰'
                    : selected === term.id
                      ? '已選擇'
                      : ''
              }}</span></template
            ></UiChoiceCard
          >
        </div>
        <UiButton
          v-if="myTurn"
          variant="primary"
          label="確認淘汰"
          :disabled="room.busy || !selected"
          @click="eliminate"
        />
        <p v-if="oracle.summary">本輪誤刪 {{ oracle.summary.mistakes }} 個真題。</p>
        <UiButton
          v-if="!tutorial && snapshot.phase === 'oracle-reveal' && room.gameManager"
          variant="primary"
          label="下一輪"
          :disabled="room.busy"
          @click="act('next')"
        />
      </UiPanel>
    </div>
    <UiPanel v-if="snapshot.phase === 'finished'" title="團隊結果">
      <p v-if="oracle.summary">{{
        oracle.errors > oracle.maxErrors ? '錯誤超過上限，挑戰失敗。' : '完成四輪，挑戰成功！'
      }}</p>
      <p v-else>有玩家離席，本場中止。</p>
    </UiPanel>
  </div>
</template>
