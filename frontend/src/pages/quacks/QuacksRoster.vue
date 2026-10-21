<script setup lang="ts">
import { computed, useId } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import { ingredientNames, type QuacksChip, type WitchColor } from '../../contracts/quacks';
import PlayerAvatar from '../../components/PlayerAvatar.vue';
import PlayerName from '../../components/PlayerName.vue';
import UiButton from '../../components/UiButton.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import '../../styles/quacks-roster.scss';

const game = useQuacksStore(),
  room = useRoomStore(),
  heading = useId();
const coins: WitchColor[] = ['gold', 'copper', 'silver'];
const coinNames = { gold: '金女巫幣', copper: '銅女巫幣', silver: '銀女巫幣' };
const rows = computed(() => {
  const state = game.state;
  if (!state) return [];
  return state.recipes.flatMap((recipe) => {
    const player = state.players.find((person) => person.id === recipe.id);
    if (player?.kicked) return [];
    const visible = !recipe.hidden;
    const white = visible ? recipe.white : null;
    const threshold = visible ? recipe.threshold : null;
    const risk =
      white !== null && threshold !== null && threshold > 0
        ? Math.min(100, (white / threshold) * 100)
        : 0;
    const status =
      player?.online === false
        ? '暫時離線'
        : state.phase === 'finished'
          ? '本局結束'
          : recipe.exploded
            ? '已爆炸'
            : recipe.stopped
              ? '已停止'
              : recipe.chosen
                ? '已選擇'
                : state.phase === 'waiting'
                  ? '已入座'
                  : '準備抽藥';
    // Consume only the public recipe projection. Hidden recipes must never use
    // mine, cached pots, inferred thresholds, or a previous round's tray.
    const pot = visible ? recipe.pot || [] : [];
    return [
      {
        recipe,
        player,
        white,
        threshold,
        risk,
        status,
        tray: pot.slice(-8),
        omitted: Math.max(0, pot.length - 8),
        danger: white !== null && threshold !== null && white >= threshold - 1,
        viewed: game.viewed?.id === recipe.id,
        potColor: state.potColors[recipe.potColor]?.liquid[0] || 'var(--stitch-line)',
      },
    ];
  });
});
function chipLabel(chip: QuacksChip) {
  return (
    ingredientNames[chip.color] +
    ' ' +
    chip.value +
    (chip.effectColor && chip.effectColor !== chip.color
      ? '，本次模仿' + ingredientNames[chip.effectColor] + ' ' + (chip.effectValue ?? chip.value)
      : '')
  );
}
function coinLabel(color: WitchColor, value: boolean | undefined) {
  const witch = game.state?.witches[color];
  return (
    coinNames[color] +
    (value === true ? '尚未使用' : value === false ? '已使用' : '尚未公開') +
    (witch ? '；' + witch.name + '：' + witch.text : '')
  );
}
function view(id: string) {
  const recipe = game.state?.recipes.find((item) => item.id === id);
  if (recipe && !recipe.hidden && !room.terminal) game.selectedPot = id;
}
</script>

<template>
  <section class="vue-quacks-roster" data-ping-anchor="players" :aria-labelledby="heading">
    <header>
      <h2 :id="heading">這桌的藥師</h2>
      <span>{{ rows.length }} / {{ game.state?.maxPlayers || 8 }} 位</span>
    </header>
    <div class="vue-quacks-roster-list" aria-label="藥師與公開資源，可捲動查看" tabindex="0">
      <p v-if="!rows.length" class="vue-quacks-roster-empty">正在讀取藥師名單…</p>
      <article
        v-for="row in rows"
        :key="row.recipe.id"
        class="vue-quacks-player"
        :data-quacks-player="row.recipe.id"
        :data-player-id="row.recipe.id"
        :data-ping-player="row.recipe.id"
        :data-self="row.recipe.id === game.state?.me"
        :data-viewed="row.viewed"
        :data-exploded="row.recipe.exploded"
        :style="{ '--quacks-roster-pot': row.potColor }"
      >
        <header class="vue-quacks-player-heading">
          <PlayerAvatar
            :name="row.recipe.name"
            :avatar="row.player?.avatar"
            :bot="row.player?.bot"
          />
          <div class="vue-quacks-player-copy">
            <div class="vue-quacks-player-name"
              ><PlayerName :name="row.recipe.name" /><small v-if="row.recipe.id === game.state?.me"
                >你</small
              ></div
            >
            <p :title="row.recipe.potName">{{ row.recipe.potName }}</p>
          </div>
        </header>
        <div class="vue-quacks-player-summary">
          <p
            class="vue-quacks-player-score"
            :data-quacks-score="row.recipe.id"
            :aria-label="row.recipe.score + ' 分'"
            ><strong>{{ row.recipe.score }}</strong
            ><span>分</span></p
          >
          <UiButton
            stitch
            variant="ghost"
            icon="next"
            icon-only
            :label="
              row.recipe.hidden
                ? row.recipe.name + '的大釜尚未公開'
                : '查看' + row.recipe.name + '的大釜'
            "
            :aria-pressed="row.viewed"
            :disabled="row.recipe.hidden || !!room.terminal"
            @click="view(row.recipe.id)"
          />
        </div>
        <div class="vue-quacks-player-resources" aria-label="公開資源">
          <span
            :aria-label="'藥袋剩餘 ' + row.recipe.bagCount + ' 片'"
            :title="'藥袋剩餘 ' + row.recipe.bagCount + ' 片'"
            ><QuacksGlyph resource="bag" :size="22" /><strong>{{
              row.recipe.bagCount
            }}</strong></span
          >
          <span
            :data-quacks-ruby="row.recipe.id"
            :aria-label="'紅寶石 ' + row.recipe.rubies + ' 顆'"
            :title="'紅寶石 ' + row.recipe.rubies + ' 顆'"
            ><QuacksGlyph resource="ruby" :size="22" /><strong>{{
              row.recipe.rubies
            }}</strong></span
          >
          <span
            :aria-label="'老鼠尾巴 ' + row.recipe.rat + ' 條'"
            :title="'本回合老鼠尾巴 ' + row.recipe.rat + ' 條'"
            ><QuacksGlyph resource="rat" :size="22" /><strong>{{ row.recipe.rat }}</strong></span
          >
          <span
            :aria-label="'永久水滴第 ' + row.recipe.droplet + ' 格'"
            :title="'永久水滴第 ' + row.recipe.droplet + ' 格'"
            ><QuacksGlyph resource="droplet" :size="22" /><strong>{{
              row.recipe.droplet
            }}</strong></span
          >
        </div>
        <div
          class="vue-quacks-player-risk"
          :data-danger="row.danger"
          :data-exploded="row.recipe.exploded"
        >
          <p
            ><span>{{
              row.recipe.hidden
                ? '大釜進度隱藏中'
                : row.white !== null && row.threshold !== null
                  ? '炸彈 ' + row.white + ' / ' + row.threshold
                  : '炸彈進度未提供'
            }}</span
            ><span>{{ row.status }}</span></p
          >
          <div
            v-if="!row.recipe.hidden && row.white !== null && row.threshold !== null"
            class="vue-quacks-player-risk-track"
            role="meter"
            aria-label="白色炸彈風險"
            :aria-valuemin="0"
            :aria-valuemax="row.threshold"
            :aria-valuenow="Math.min(row.white, row.threshold)"
            :aria-valuetext="'白色炸彈 ' + row.white + '，爆炸門檻 ' + row.threshold"
          >
            <span :style="{ inlineSize: row.risk + '%' }" />
          </div>
          <small v-if="!row.recipe.hidden && row.recipe.position !== null"
            >目前第 {{ row.recipe.position }} 格</small
          >
        </div>
        <div class="vue-quacks-player-tray" aria-label="已公開投入的藥材">
          <p v-if="row.recipe.hidden">投入藥材尚未公開</p>
          <template v-else-if="row.tray.length">
            <span
              v-if="row.omitted"
              class="vue-quacks-player-omitted"
              :aria-label="'另有 ' + row.omitted + ' 片較早投入的藥材'"
              >+{{ row.omitted }}</span
            >
            <span
              v-for="chip in row.tray"
              :key="chip.id"
              role="img"
              :aria-label="chipLabel(chip)"
              :title="chipLabel(chip)"
              ><QuacksGlyph :chip="chip" :size="26"
            /></span>
          </template>
          <p v-else>尚未投入藥材</p>
        </div>
        <div v-if="game.state?.options.witches" class="vue-quacks-player-coins" aria-label="女巫幣">
          <template v-if="row.recipe.coins">
            <span
              v-for="color in coins"
              :key="color"
              :data-used="row.recipe.coins[color] === false"
              role="img"
              :aria-label="coinLabel(color, row.recipe.coins[color])"
              :title="coinLabel(color, row.recipe.coins[color])"
            >
              <QuacksGlyph :resource="color" :size="26" />
            </span>
          </template>
          <span v-else>女巫幣尚未公開</span>
        </div>
      </article>
    </div>
  </section>
</template>
