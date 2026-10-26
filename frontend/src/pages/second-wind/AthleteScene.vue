<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import UiDialog from '../../components/UiDialog.vue';
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
import AthletePlayerAvatar from './AthletePlayerAvatar.vue';
import AthleteTurnOrder from './AthleteTurnOrder.vue';
import { athleteArt, trackArt, trackPoint } from './art';
const athlete = useAthleteStore(),
  actions = usePartyActionsStore(),
  room = useRoomStore();
const game = computed(() => athlete.game!);
const me = computed(() => athlete.state?.me || '');
const cards = computed(() => Object.fromEntries(game.value.catalog.map((c) => [c.id, c])));
const name = (id: string) => athlete.state?.players.find((p) => p.id === id)?.name || id;
const cardName = (id: string) => cards.value[id]?.name || id;
const ownerName = (id: string) =>
  game.value.players
    .filter((player) => game.value.teams[player]?.includes(id))
    .map(name)
    .join('、');
const racersOpen = ref(false);
const twistDialog = ref<InstanceType<typeof UiDialog> | null>(null);
// The server retains the preceding race's cards during secret selection.
// Those cards must not mark the new race as already shown.
const twistCount = computed(() =>
  ['racing', 'race-result', 'finished'].includes(game.value.phase)
    ? game.value.twistCards?.length || 0
    : 0,
);
const twistScope = computed(
  () => `${athlete.state?.code}:${athlete.state?.roundId}:${game.value.race}`,
);
let twistAutoShown = twistCount.value > 0;
watch(
  () => [twistScope.value, twistCount.value] as const,
  ([scope, count], [previousScope]) => {
    if (scope !== previousScope) {
      twistAutoShown = count > 0;
      twistDialog.value?.close();
      // Fast consecutive remote actions may skip the empty new-race snapshot.
      // A live new race in this game still announces its first observed Twist.
      const session = scope.slice(0, scope.lastIndexOf(':'));
      const previousSession = previousScope.slice(0, previousScope.lastIndexOf(':'));
      if (count > 0 && session === previousSession) void twistDialog.value?.open();
    } else if (count > 0 && !twistAutoShown) {
      twistAutoShown = true;
      void twistDialog.value?.open();
    }
  },
  { flush: 'post' },
);
const turnPlayers = computed(() => {
  const ids = picking.value
    ? [...new Set(game.value.draftOrder || game.value.players)]
    : (() => {
        const at = game.value.players.indexOf(game.value.first || game.value.players[0]);
        return [...game.value.players.slice(at), ...game.value.players.slice(0, at)];
      })();
  return ids.map((id) => ({ id, name: name(id) }));
});
const teamsOpen = ref(true);
watch(
  () => athlete.state?.code,
  () => {
    teamsOpen.value = true;
    racersOpen.value = false;
  },
);
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
const eventText = eventBody;
</script>
<template>
  <div class="athlete-scene">
    <UiPanel title="積分與隊伍">
      <template #title-after
        ><UiHoverInfo title="四場名次積分" help-only
          ><template #info>
            <table class="athlete-awards"
              ><thead
                ><tr
                  ><th scope="col">場次</th><th scope="col">冠軍</th><th scope="col">亞軍</th></tr
                ></thead
              ><tbody
                ><tr v-for="(award, index) in game.awards" :key="index"
                  ><th scope="row">第 {{ index + 1 }} 場</th><td>{{ award[0] }}</td
                  ><td>{{ award[1] }}</td></tr
                ></tbody
              ></table
            >
          </template></UiHoverInfo
        ></template
      >
      <template #actions
        ><UiButton
          :label="teamsOpen ? '收合積分與隊伍' : '展開積分與隊伍'"
          :caption="teamsOpen ? '收合' : '展開'"
          :aria-expanded="teamsOpen"
          :aria-controls="
            game.players
              .map((id) => 'athlete-team-' + id)
              .concat('athlete-scores')
              .join(' ')
          "
          @click="teamsOpen = !teamsOpen"
      /></template>
      <div id="athlete-scores" v-show="teamsOpen" class="athlete-scores"
        ><div v-for="id in game.players" :key="id" class="athlete-player-group"
          ><div class="athlete-score-owner"
            ><AthletePlayerAvatar :player-id="id" /><UiBadge
              :label="`${game.scores?.[id] || 0} 分`"
          /></div>
          <div :id="'athlete-team-' + id" v-show="teamsOpen" class="athlete-team"
            ><UiHoverInfo
              v-for="racerId in game.teams[id] || []"
              :key="racerId"
              class="athlete-team-member"
              :title="cardName(racerId) + ' · ' + name(id)"
              :show-help="false"
              tabindex="0"
              ><div>
                <AthleteArt
                  :src="athleteArt(racerId)"
                  :alt="cardName(racerId)"
                  :width="96"
                  :height="70"
                /> </div
              ><template #info
                ><p>{{ cards[racerId]?.summary }}</p
                ><p>{{ cards[racerId]?.notes }}</p></template
              ></UiHoverInfo
            ></div
          >
          <p v-if="!game.teams[id]?.length">{{ picking ? '等待招募角色' : '全部角色已出賽' }}</p>
          <span v-if="choosing">{{
            game.selectedIds.includes(id) ? '已鎖定' : '選角中'
          }}</span></div
        ></div
      >
      <UiNotice
        v-if="actions.notice || actions.canRetry"
        :message="actions.notice"
        :persistent="actions.canRetry"
        density="compact"
        ><UiButton v-if="actions.canRetry" label="重試同一操作" @click="actions.retrySame()"
      /></UiNotice>
    </UiPanel>
    <UiPanel v-if="game.racers?.length" title="本場角色與能力">
      <template #actions
        ><UiButton
          :label="racersOpen ? '收合本場角色與能力' : '展開本場角色與能力'"
          :caption="racersOpen ? '收合' : '展開'"
          :aria-expanded="racersOpen"
          aria-controls="athlete-racer-details"
          @click="racersOpen = !racersOpen"
      /></template>
      <div id="athlete-racer-details" v-show="racersOpen"
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
        ></div
      ></UiPanel
    >
    <UiPanel v-if="rolloff" title="擲骰決定先手">
      <template #title-after
        ><UiHoverInfo title="先手擲骰規則" help-only
          ><template #info
            ><p>最高不重複點數先行；沒有單獨點數時全員重擲。</p></template
          ></UiHoverInfo
        ></template
      >
      <div class="athlete-rolloff"
        ><div v-for="id in game.players" :key="id" class="athlete-roll-player">
          <AthletePlayerAvatar :player-id="id" /><UiBadge
            :label="game.rolls?.[id] ? String(game.rolls[id]) : '等待擲骰'"
          />
          <div class="athlete-roll-button"
            ><UiButton
              v-if="id === me"
              variant="primary"
              label="擲骰"
              :disabled="!athlete.ready || !!game.rolls?.[me]"
              @click="athlete.act('roll')"
          /></div> </div
      ></div>
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
      <template v-if="picking" #title-after
        ><AthleteTurnOrder :players="turnPlayers" :active="game.turnId" snake
      /></template>
      <div class="athlete-card-grid"
        ><UiHoverInfo
          v-for="id in offered"
          :key="id"
          :title="cardName(id) + (ownerName(id) ? ' · ' + ownerName(id) : '')"
          :disabled="!canPick"
          :show-help="false"
          ><UiChoiceCard
            :label="cardName(id)"
            :disabled="!canPick"
            readable-disabled
            image-only
            :selected="game.ownSelection === id"
            @click="pick(id)"
            ><AthleteArt
              class="athlete-draft-art"
              trim-card
              :src="athleteArt(id, 'card')"
              :alt="cardName(id) + ' 英文原版角色卡'"
              :width="272"
              :height="380" /></UiChoiceCard
          ><template #info
            ><p>{{ cards[id]?.summary }}</p
            ><p>{{ cards[id]?.notes }}</p></template
          ></UiHoverInfo
        ></div
      >
    </UiPanel>
    <template v-if="game.racers?.length">
      <UiPanel :title="game.trackId === 'twisty-twirl' ? '曲折賽道' : '漩渦賽道'">
        <template #title-after
          ><AthleteTurnOrder
            :players="turnPlayers"
            :active="game.phase === 'racing' ? game.pending?.playerId || game.turnId : null"
        /></template>
        <template #actions
          ><UiButton
            :label="
              track === 'whirly-world'
                ? '查看漩渦規則'
                : twistCount
                  ? '查看已觸發twist'
                  : '尚未觸發twist'
            "
            @click="twistDialog?.open()"
        /></template>
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
              <div
                v-if="cell.racers.length || game.coins?.includes(cell.position)"
                class="athlete-track-cell"
                :style="trackPoint(cell.position, game.direction)"
                :aria-label="`${cell.position} 格：${cell.racers.map((r) => cardName(r.racerId) + ' · ' + name(r.playerId)).join('、')}`"
              >
                <div class="athlete-track-pieces">
                  <UiHoverInfo
                    v-if="cell.racers.length > 2"
                    class="athlete-stack-trigger"
                    :title="`第${cell.position}格（${cell.racers.length}位）`"
                    :show-help="false"
                    interactive
                    ><UiButton
                      :label="`查看同格 ${cell.racers.length} 位角色`"
                      :caption="String(cell.racers.length)"
                    />
                    <template #info
                      ><div class="athlete-stack-grid">
                        <UiHoverInfo
                          v-for="r in cell.racers"
                          :key="r.id"
                          :title="`${cardName(r.racerId)} · ${name(r.playerId)}${r.tripped ? ' · 絆倒' : ''}`"
                          :show-help="false"
                        >
                          <UiChoiceCard
                            :label="`查看 ${cardName(r.racerId)} · ${name(r.playerId)}`"
                            image-only
                            action
                          >
                            <AthleteArt
                              :class="{ 'athlete-tripped': r.tripped }"
                              :src="athleteArt(r.transformed ? 'weremouth' : r.racerId)"
                              :alt="cardName(r.racerId)"
                              :width="96"
                              :height="70"
                              eager
                            />
                          </UiChoiceCard>
                          <template #info
                            ><p>{{ cards[r.racerId]?.summary }}</p
                            ><p>{{ cards[r.racerId]?.notes }}</p></template
                          >
                        </UiHoverInfo>
                      </div></template
                    >
                  </UiHoverInfo>
                  <template v-else>
                    <UiHoverInfo
                      v-for="r in cell.racers"
                      :key="r.id"
                      class="athlete-piece"
                      :title="`${cardName(r.racerId)} · ${name(r.playerId)}${r.tripped ? ' · 絆倒' : ''}`"
                      :show-help="false"
                      tabindex="0"
                    >
                      <div>
                        <AthleteArt
                          :class="{ 'athlete-tripped': r.tripped }"
                          :src="athleteArt(r.transformed ? 'weremouth' : r.racerId)"
                          :alt="cardName(r.racerId)"
                          :width="96"
                          :height="70"
                          eager
                        />
                      </div>
                      <template #info
                        ><p>{{ cards[r.racerId]?.summary }}</p
                        ><p>{{ cards[r.racerId]?.notes }}</p></template
                      >
                    </UiHoverInfo>
                  </template>
                </div>
                <UiBadge v-if="game.coins?.includes(cell.position)" label="金幣" tone="primary" />
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
    <!-- Whirly World never triggers a Twist, so its dialog only explains the vortexes. -->
    <UiDialog ref="twistDialog" :title="track === 'whirly-world' ? '漩渦規則' : '本場 Twist'">
      <template v-if="track === 'twisty-twirl'"
        ><p>本場第一次跨越中央 Twist 圖示時觸發一張 Twist 卡；後續經過不再觸發。</p
        ><p>觸發進度：14 格。</p></template
      >
      <template v-else
        ><p>停在漩渦入口時，依賽道配對傳送至另一端；不是僅經過就觸發。</p
        ><p
          >目前漩渦配對：{{
            [4, 8, 11, 17, 20, 24]
              .map((n) => (game.direction === -1 ? 30 - n : n))
              .map((n) => `${n} ↔ ${portal(n)}`)
              .join('、')
          }}。</p
        ></template
      >
      <p
        >{{
          game.direction === -1 ? '目前為 Mirror World 逆向競速。' : '目前為順向競速。'
        }}手機可左右捲動查看完整賽道。</p
      >
      <template v-if="track !== 'whirly-world'"
        ><UiHeading :level="3">已觸發的 Twist</UiHeading>
        <div v-if="game.twistCards?.length" class="athlete-twists"
          ><div v-for="card in game.twistCards" :key="card.id"
            ><p>{{ card.summary }}</p
            ><AthleteArt
              :src="athleteArt(card.id, 'twist')"
              alt="本場已觸發的原版 Twist 卡"
              :width="428"
              :height="236" /></div></div
        ><p v-else>尚未觸發 Twist。</p></template
      >
    </UiDialog>
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
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: var(--stitch-gap-controls);
}
.athlete-player-group,
.athlete-roll-player {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: var(--stitch-gap-label);
  min-width: 0;
}
.athlete-score-owner {
  display: flex;
  align-items: center;
  gap: var(--stitch-gap-label);
}
.athlete-rolloff {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: var(--stitch-gap-controls);
}
.athlete-roll-button {
  min-height: var(--stitch-control-height);
}
.athlete-awards {
  width: 100%;
  text-align: center;
}
.athlete-awards th,
.athlete-awards td {
  padding: var(--stitch-space-8);
}
.athlete-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: var(--stitch-gap-controls);
}
.athlete-card-grid > .ui-hover-info {
  width: min(100%, 12rem);
  justify-self: center;
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
  display: grid;
  grid-template-columns: repeat(2, 5rem);
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
.athlete-stack-trigger {
  min-width: var(--stitch-control-height);
  width: max-content;
}
.athlete-stack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4rem, 1fr));
  gap: var(--stitch-gap-label);
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
