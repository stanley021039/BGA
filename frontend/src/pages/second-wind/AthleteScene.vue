<script setup lang="ts">
import { computed } from 'vue';
import { useAthleteStore } from '../../stores/second-wind';
import { usePartyActionsStore } from '../../stores/party-actions';
import { useRoomStore } from '../../stores/room';
import UiPanel from '../../components/UiPanel.vue';
import UiButton from '../../components/UiButton.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiChoiceCard from '../../components/UiChoiceCard.vue';
import UiNotice from '../../components/UiNotice.vue';
import UiHeading from '../../components/UiHeading.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
const athlete = useAthleteStore(),
  actions = usePartyActionsStore(),
  room = useRoomStore();
const game = computed(() => athlete.game!);
const me = computed(() => athlete.state?.me || '');
const cards = computed(() => Object.fromEntries(game.value.catalog.map((c) => [c.id, c])));
const name = (id: string) => athlete.state?.players.find((p) => p.id === id)?.name || id;
const cardName = (id: string) => cards.value[id]?.name || id;
const picking = computed(() => game.value.phase === 'drafting');
const choosing = computed(() => game.value.phase === 'choosing');
const canPick = computed(
  () =>
    athlete.ready &&
    (picking.value
      ? game.value.turnId === me.value
      : choosing.value && !game.value.selectedIds.includes(me.value)),
);
const offered = computed(() =>
  picking.value ? game.value.market || [] : game.value.teams[me.value] || [],
);
const rolloff = computed(() => ['draft-rolloff', 'race-rolloff'].includes(game.value.phase));
const board = computed(() =>
  Array.from({ length: 31 }, (_, position) => ({
    position,
    racers: (game.value.racers || []).filter((r) => !r.eliminated && r.position === position),
  })),
);
function portal(position: number) {
  const pairs = [
    [4, 6],
    [8, 12],
    [11, 15],
    [17, 22],
    [20, 23],
    [24, 28],
  ].map((p) => (game.value.direction === -1 ? p.map((n) => 30 - n) : p));
  return pairs.find((p) => p.includes(position))?.find((n) => n !== position);
}
function pick(racerId: string) {
  athlete.act(picking.value ? 'draft' : 'select', { racerId });
}
const eventText = (e: (typeof game.value.events)[number]) =>
  e.text ||
  (e.type === 'rolloff-die'
    ? name(e.playerId || '') + ' 擲出 ' + e.value
    : e.type === 'draft-picked'
      ? name(e.playerId || '') + ' 招募 ' + cardName(e.racerId || '')
      : e.type === 'selection-locked'
        ? name(e.playerId || '') + ' 已鎖定角色'
        : e.type);
</script>
<template>
  <div class="athlete-scene">
    <UiNotice :message="actions.notice" :persistent="actions.canRetry"
      ><UiButton v-if="actions.canRetry" label="重試同一操作" @click="actions.retrySame()"
    /></UiNotice>
    <UiPanel title="積分與隊伍" density="compact">
      <div class="athlete-scores"
        ><div v-for="id in game.players" :key="id"
          ><strong>{{ name(id) }}</strong
          ><UiBadge :label="`${game.scores?.[id] || 0} 分`" /><p>{{
            (game.teams[id] || []).map(cardName).join('、') || '全部角色已出賽'
          }}</p
          ><span v-if="choosing">{{
            game.selectedIds.includes(id) ? '已鎖定' : '選角中'
          }}</span></div
        ></div
      >
      <p>四場測試獎分：3／1、4／2、5／3、7／4（後三場待核對）。</p>
    </UiPanel>
    <UiPanel v-if="rolloff" title="擲骰決定先手">
      <p>最高不重複點數先行；沒有單獨點數時全員重擲。</p>
      <p v-for="id in game.players" :key="id"
        >{{ name(id) }}：{{ game.rolls?.[id] || '等待擲骰' }}</p
      >
      <UiButton
        variant="primary"
        label="擲骰"
        :disabled="!athlete.ready || !!game.rolls?.[me]"
        @click="athlete.act('roll')"
      />
    </UiPanel>
    <UiPanel
      v-if="picking || choosing"
      :title="picking ? `第 ${game.draftRound} 輪蛇形選秀` : `第 ${game.race} 場：秘密選角`"
    >
      <p>{{
        picking
          ? `輪到 ${name(game.turnId || '')} 招募`
          : game.selectedIds.includes(me)
            ? `已鎖定 ${cardName(game.ownSelection || '')}，等待其他玩家`
            : '選擇本場出賽角色；全員鎖定後一起揭示'
      }}</p>
      <div class="athlete-card-grid"
        ><UiChoiceCard
          v-for="id in offered"
          :key="id"
          :label="cardName(id)"
          :disabled="!canPick"
          :selected="game.ownSelection === id"
          @click="pick(id)"
          ><p>{{ cards[id]?.summary }}</p
          ><small>{{ cards[id]?.notes }}</small></UiChoiceCard
        ></div
      >
    </UiPanel>
    <template v-if="game.racers?.length">
      <UiPanel
        :title="
          game.trackId === 'twisty-twirl' ? 'Twisty Twirl｜曲折賽道' : 'Whirly World｜漩渦賽道'
        "
      >
        <p v-if="game.direction === -1">Mirror World 已反轉方向；以下格數表示往新終點的進度。</p>
        <p v-if="game.phase === 'racing'">{{
          game.pending
            ? name(game.pending.playerId) + ' 正在選擇能力'
            : `輪到 ${name(game.turnId || '')} 行動`
        }}</p>
        <div class="athlete-action-slot"
          ><UiButton
            v-if="game.phase === 'racing' && !game.pending"
            variant="primary"
            label="開始角色回合"
            :disabled="!athlete.ready || game.turnId !== me"
            @click="athlete.act('roll')" /><template v-if="game.pending"
            ><p>{{ game.pending.title }}</p
            ><div class="athlete-actions"
              ><UiButton
                v-for="option in game.pending.options"
                :key="option.value"
                :label="option.label"
                :disabled="!athlete.ready || game.pending.playerId !== me"
                @click="
                  athlete.act('choice', { choiceId: game.pending.id, value: option.value })
                " /></div></template
        ></div>
        <div class="athlete-board" aria-label="賽道格位與角色位置"
          ><UiPanel
            v-for="cell in board"
            :key="cell.position"
            density="compact"
            :tone="cell.racers.length ? 'selected' : 'subtle'"
          >
            <strong>{{
              cell.position === 0 ? '起點' : cell.position === 30 ? '終點' : cell.position
            }}</strong>
            <small v-if="game.trackId === 'twisty-twirl' && cell.position === 14">Twist 界線</small>
            <small v-if="game.trackId === 'whirly-world' && portal(cell.position) !== undefined"
              >漩渦 → {{ portal(cell.position) }}</small
            >
            <small v-if="cell.position === 12">第一彎角</small
            ><small v-if="cell.position === 15">第二彎角</small>
            <span v-for="r in cell.racers" :key="r.id"
              >{{ cardName(r.racerId) }} · {{ name(r.playerId) }}{{ r.tripped ? '（絆倒）' : ''
              }}{{ r.finished ? '（完賽）' : '' }}</span
            >
            <UiBadge v-if="game.coins?.includes(cell.position)" label="1 分" /> </UiPanel
        ></div>
        <p v-if="game.monster !== null && game.monster !== undefined"
          >W.E.R.E.M.O.U.T.H.：{{ game.monster }} 格</p
        >
      </UiPanel>
      <UiPanel v-if="game.twistCards?.length" title="本場 Twist"
        ><UiList
          ><UiListRow v-for="card in game.twistCards" :key="card.id">{{
            card.summary
          }}</UiListRow></UiList
        ></UiPanel
      >
      <UiPanel title="本場角色與能力"
        ><UiList
          ><UiListRow v-for="r in game.racers" :key="r.id"
            ><div
              ><strong>{{ cardName(r.racerId) }} · {{ name(r.playerId) }}</strong
              ><UiBadge
                :label="
                  r.eliminated
                    ? '淘汰'
                    : r.finished
                      ? '完賽'
                      : `${r.position} 格${r.tripped ? ' · 絆倒' : ''}`
                "
              /><p>{{ cards[r.racerId]?.summary }}</p
              ><p v-if="r.copiedPowers.length"
                >額外能力：{{ r.copiedPowers.map(cardName).join('、') }}</p
              ><p v-if="r.transformed">已變身 W.E.R.E.M.O.U.T.H.</p></div
            ></UiListRow
          ></UiList
        ></UiPanel
      >
    </template>
    <UiPanel
      v-if="game.phase === 'race-result' || game.phase === 'finished'"
      :title="game.phase === 'finished' ? '四場總結算' : '本場結算'"
    >
      <p v-if="game.phase === 'finished'">獲勝：{{ game.winners?.map(name).join('、') }}</p>
      <div v-for="result in game.results" :key="result.race"
        ><UiHeading>第 {{ result.race }} 場</UiHeading><p>{{ result.reason }}</p
        ><p v-for="rank in result.ranking" :key="rank.rank"
          >第 {{ rank.rank }} 名 · {{ name(rank.playerId) }} · {{ cardName(rank.racerId) }} · 名次分
          +{{ rank.points }}</p
        ></div
      >
      <template v-if="game.phase === 'race-result'"
        ><p>下一場由 {{ name(game.first || '') }} 先行。</p
        ><UiButton
          label="開始下一場選角"
          variant="primary"
          :disabled="!athlete.ready || game.first !== me"
          @click="athlete.act('next-race')"
      /></template>
      <div v-else id="athlete-restart-settings"
        ><UiButton v-if="room.host" label="再玩一局" @click="athlete.start()"
      /></div>
    </UiPanel>
    <UiPanel title="賽況紀錄"
      ><UiList class="athlete-events"
        ><UiListRow v-for="event in [...game.events].reverse()" :key="event.id">{{
          eventText(event)
        }}</UiListRow></UiList
      ></UiPanel
    >
  </div>
</template>
<style scoped>
.athlete-scene {
  display: grid;
  gap: var(--stitch-gap-section);
  min-width: 0;
}
.athlete-scores {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--stitch-gap-controls);
}
.athlete-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--stitch-gap-controls);
}
.athlete-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-gap-controls);
}
.athlete-action-slot {
  min-height: 8rem;
}
.athlete-board {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--stitch-gap-label);
}
.athlete-board span,
.athlete-board small {
  display: block;
  overflow-wrap: anywhere;
}
.athlete-board > * {
  min-height: 7rem;
  height: 7rem;
  overflow: auto;
}
.athlete-events {
  max-height: 20rem;
  overflow: auto;
}
@media (max-width: 700px) {
  .athlete-board {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .athlete-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
