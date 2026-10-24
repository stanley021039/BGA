<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import UiHoverInfo from '../../components/UiHoverInfo.vue';
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
import AthleteArt from './AthleteArt.vue';
import { athleteArt, trackArt, trackPoint } from './art';
const athlete = useAthleteStore(),
  actions = usePartyActionsStore(),
  room = useRoomStore();
const game = computed(() => athlete.game!);
const me = computed(() => athlete.state?.me || '');
const cards = computed(() => Object.fromEntries(game.value.catalog.map((c) => [c.id, c])));
const name = (id: string) => athlete.state?.players.find((p) => p.id === id)?.name || id;
const cardName = (id: string) => cards.value[id]?.name || id;
const teamsOpen = ref(true);
watch(
  () => athlete.state?.code,
  () => {
    teamsOpen.value = true;
  },
);
const seat = (id: string) => game.value.players.indexOf(id) + 1;
const track = computed(() => game.value.trackId || 'twisty-twirl');
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
const eventBody = (e: (typeof game.value.events)[number]) =>
  e.text ||
  (e.type === 'rolloff-die'
    ? name(e.playerId || '') + ' 擲出 ' + e.value
    : e.type === 'draft-picked'
      ? name(e.playerId || '') + ' 招募 ' + cardName(e.racerId || '')
      : e.type === 'selection-locked'
        ? name(e.playerId || '') + ' 已鎖定角色'
        : e.type);
const eventText = (e: (typeof game.value.events)[number]) =>
  (e.playerId ? `${name(e.playerId)}（ID：${e.playerId}）｜` : '') + eventBody(e);
</script>
<template>
  <div class="athlete-scene">
    <UiPanel title="積分與隊伍" density="compact">
      <template #actions
        ><UiButton
          :label="teamsOpen ? '收合積分與隊伍' : '展開積分與隊伍'"
          :aria-expanded="teamsOpen"
          :aria-controls="
            game.players
              .map((id) => 'athlete-team-' + id)
              .concat('athlete-team-details')
              .join(' ')
          "
          @click="teamsOpen = !teamsOpen"
      /></template>
      <div class="athlete-scores"
        ><div v-for="id in game.players" :key="id"
          ><strong>{{ seat(id) }} · {{ name(id) }}</strong
          ><UiBadge :label="`${game.scores?.[id] || 0} 分`" />
          <div :id="'athlete-team-' + id" v-show="teamsOpen" class="athlete-team"
            ><div
              v-for="racerId in game.teams[id] || []"
              :key="racerId"
              class="athlete-team-member"
            >
              <AthleteArt
                :src="athleteArt(racerId)"
                :alt="cardName(racerId)"
                :width="96"
                :height="70"
              />
              <span>{{ cardName(racerId) }}</span>
            </div></div
          >
          <p v-if="!game.teams[id]?.length">{{ picking ? '等待招募角色' : '全部角色已出賽' }}</p>
          <span v-if="choosing">{{
            game.selectedIds.includes(id) ? '已鎖定' : '選角中'
          }}</span></div
        ></div
      >
      <div id="athlete-team-details" v-show="teamsOpen"
        ><p>四場測試獎分：3／1、4／2、5／3、7／4（後三場待核對）。</p></div
      >
      <UiNotice :message="actions.notice" :persistent="actions.canRetry" density="compact"
        ><UiButton v-if="actions.canRetry" label="重試同一操作" @click="actions.retrySame()"
      /></UiNotice>
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
      :title="
        picking
          ? `第 ${game.draftRound} 輪蛇形選秀`
          : game.race
            ? `第 ${game.race} 場：秘密選角`
            : '秘密選角'
      "
    >
      <p>{{
        picking
          ? `輪到 ${name(game.turnId || '')} 招募`
          : game.selectedIds.includes(me)
            ? `已鎖定 ${cardName(game.ownSelection || '')}，等待其他玩家`
            : '選擇本場出賽角色；全員鎖定後一起揭示'
      }}</p>
      <div class="athlete-card-grid"
        ><UiHoverInfo
          v-for="id in offered"
          :key="id"
          :title="cardName(id) + ' 中文能力說明'"
          :disabled="!canPick"
          ><UiChoiceCard
            :label="cardName(id)"
            :disabled="!canPick"
            readable-disabled
            :selected="game.ownSelection === id"
            @click="pick(id)"
            ><AthleteArt
              class="athlete-draft-art"
              :src="athleteArt(id, 'card')"
              :alt="cardName(id) + ' 中文翻譯角色卡'"
              :width="272"
              :height="380"
            />
            <strong>{{ cardName(id) }}</strong>
            <template #label
              ><span>{{ picking ? '招募這名選手' : '派出這名選手' }}</span></template
            ></UiChoiceCard
          ><template #info
            ><p>{{ cards[id]?.summary }}</p
            ><p>{{ cards[id]?.notes }}</p></template
          ></UiHoverInfo
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
        <p
          >棋子上的數字對應玩家席位；同格超過兩位時顯示總數，下方名單列出全部角色。手機可左右捲動賽道。</p
        >
        <div class="athlete-track-scroll" tabindex="0" aria-label="原版賽道，可左右捲動">
          <div class="athlete-track">
            <AthleteArt
              :src="trackArt(track)"
              :srcset="`${trackArt(track, 800)} 800w, ${trackArt(track)} 1600w`"
              sizes="(max-width: 1000px) 960px, 1300px"
              :alt="
                track === 'twisty-twirl'
                  ? 'Twisty Twirl 原版賽道，順時針由左上起跑'
                  : 'Whirly World 原版漩渦賽道，順時針由左上起跑'
              "
              :width="2688"
              :height="830"
              eager
            />
            <template v-for="cell in board" :key="cell.position">
              <span class="athlete-track-number" :style="trackPoint(cell.position, game.direction)"
                ><UiBadge
                  :label="
                    cell.position === 0
                      ? '起點'
                      : cell.position === 30
                        ? '終點'
                        : String(cell.position)
                  "
              /></span>
              <div
                v-if="cell.racers.length || game.coins?.includes(cell.position)"
                class="athlete-track-cell"
                :style="trackPoint(cell.position, game.direction)"
                :aria-label="`${cell.position} 格：${cell.racers.map((r) => cardName(r.racerId) + ' · ' + name(r.playerId)).join('、')}`"
              >
                <div class="athlete-track-pieces">
                  <div
                    v-for="r in cell.racers.slice(0, 2)"
                    :key="r.id"
                    class="athlete-piece"
                    :title="`${cardName(r.racerId)} · ${name(r.playerId)}${r.tripped ? ' · 絆倒' : ''}`"
                  >
                    <AthleteArt
                      :class="{ 'athlete-tripped': r.tripped }"
                      :src="athleteArt(r.transformed ? 'weremouth' : r.racerId)"
                      :alt="cardName(r.racerId)"
                      :width="96"
                      :height="70"
                      eager
                    />
                    <UiBadge
                      :label="String(seat(r.playerId))"
                      :tone="r.playerId === me ? 'primary' : 'neutral'"
                    />
                  </div>
                </div>
                <UiBadge
                  v-if="cell.racers.length > 2"
                  :label="`×${cell.racers.length}`"
                  :aria-label="`${cell.racers.length} 位同格`"
                />
                <UiBadge v-if="game.coins?.includes(cell.position)" label="＋1 分" tone="primary" />
              </div>
            </template>
            <div
              v-if="game.monster !== null && game.monster !== undefined"
              class="athlete-track-cell"
              :style="trackPoint(game.monster, game.direction)"
            >
              <AthleteArt
                :src="athleteArt('weremouth')"
                alt="追擊中的 W.E.R.E.M.O.U.T.H."
                :width="96"
                :height="93"
                eager
              />
              <UiBadge label="追擊者" tone="danger" />
            </div>
          </div>
        </div>
        <div class="athlete-track-key"
          ><UiBadge :label="game.direction === -1 ? '逆向競速 ←' : '順向競速 →'" tone="info" />
          <span v-if="track === 'twisty-twirl'">Twist 觸發進度：14 格（待核對）</span>
        </div>
        <div v-if="track === 'whirly-world'" class="athlete-track-key" aria-label="目前漩渦出口">
          <UiBadge
            v-for="position in [4, 8, 11, 17, 20, 24].map((n) =>
              game.direction === -1 ? 30 - n : n,
            )"
            :key="position"
            :label="`${position} ↔ ${portal(position)}`"
            tone="info"
          />
        </div>
        <p v-if="game.monster !== null && game.monster !== undefined"
          >W.E.R.E.M.O.U.T.H.：{{ game.monster }} 格</p
        >
      </UiPanel>
      <UiPanel v-if="game.twistCards?.length" title="本場 Twist"
        ><div class="athlete-twists"
          ><div v-for="card in game.twistCards" :key="card.id">
            <AthleteArt
              :src="athleteArt(card.id, 'twist')"
              alt="本場生效的原版 Twist 卡"
              :width="428"
              :height="236"
            />
            <p>{{ card.summary }}</p>
          </div></div
        ></UiPanel
      >
      <UiPanel title="本場角色與能力"
        ><UiList
          ><UiListRow v-for="r in game.racers" :key="r.id"
            ><div class="athlete-racer-row"
              ><AthleteArt
                class="athlete-racer-art"
                :src="athleteArt(r.transformed ? 'weremouth' : r.racerId)"
                :alt="cardName(r.racerId)"
                :width="96"
                :height="70"
              /><div
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
                ><p v-if="r.transformed">已變身 W.E.R.E.M.O.U.T.H.</p
                ><p>{{ cards[r.racerId]?.notes }}</p></div
              ></div
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
        ><div v-for="rank in result.ranking" :key="rank.rank" class="athlete-racer-row">
          <AthleteArt
            class="athlete-racer-art"
            :src="athleteArt(rank.racerId)"
            :alt="cardName(rank.racerId)"
            :width="96"
            :height="70"
          />
          <p
            ><UiBadge
              :label="`第 ${rank.rank} 名`"
              :tone="rank.rank === 1 ? 'primary' : 'neutral'"
            />
            {{ name(rank.playerId) }} · {{ cardName(rank.racerId) }} · 名次分 +{{ rank.points }}</p
          >
        </div></div
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
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
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
.athlete-draft-art {
  max-width: 12rem;
  align-self: center;
}
.athlete-team {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-gap-label);
}
.athlete-team-member {
  display: grid;
  align-content: start;
  width: 5rem;
  overflow-wrap: anywhere;
  font-size: var(--stitch-text-small);
}
.athlete-track-scroll {
  max-width: 100%;
  overflow-x: auto;
}
.athlete-track-scroll:focus-visible {
  outline: var(--stitch-focus-ring);
  outline-offset: var(--stitch-focus-offset);
}
.athlete-track {
  position: relative;
  min-width: 960px;
  aspect-ratio: 2688 / 830;
}
.athlete-track-number {
  position: absolute;
  transform: translate(-50%, -175%);
}
.athlete-track-cell {
  position: absolute;
  width: 5.5%;
  transform: translate(-50%, -25%);
  display: grid;
  justify-items: center;
}
.athlete-track-pieces {
  display: flex;
  align-items: start;
  justify-content: center;
}
.athlete-piece {
  width: 2rem;
  display: grid;
  justify-items: center;
}
.athlete-tripped {
  transform: rotate(-25deg);
}
.athlete-track-key {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-gap-label);
}
.athlete-racer-row {
  display: flex;
  align-items: center;
  gap: var(--stitch-gap-controls);
  min-width: 0;
}
.athlete-racer-row > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.athlete-racer-art {
  width: 5rem;
  flex: 0 0 5rem;
}
.athlete-twists {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--stitch-gap-controls);
}
.athlete-twists > div {
  max-width: 27rem;
}
.athlete-events {
  overflow-wrap: anywhere;
  max-height: 20rem;
  overflow: auto;
}
@media (max-width: 700px) {
  .athlete-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
