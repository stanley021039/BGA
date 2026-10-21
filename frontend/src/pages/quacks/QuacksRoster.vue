<script setup lang="ts">
import { computed, useId } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import { playerRoomRole } from '../../contracts/room';
import type { WitchColor } from '../../contracts/quacks';
import RoomPlayerCard from '../../components/RoomPlayerCard.vue';
import UiButton from '../../components/UiButton.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import '../../styles/quacks-roster.scss';
const game = useQuacksStore(),
  room = useRoomStore(),
  heading = useId();
const coins: WitchColor[] = ['gold', 'copper', 'silver'];
const coinNames = { gold: '金女巫幣', copper: '銅女巫幣', silver: '銀女巫幣' };
const rows = computed(
  () =>
    game.state?.recipes.flatMap((recipe) => {
      const player = game.state?.players.find((person) => person.id === recipe.id);
      if (!player || player.kicked) return [];
      const status =
        player.online === false
          ? '暫時離線'
          : game.state?.phase === 'finished'
            ? '本局結束'
            : recipe.exploded
              ? '已爆炸'
              : recipe.stopped
                ? '已停止'
                : recipe.chosen
                  ? '已選擇'
                  : '準備抽藥';
      return [
        {
          recipe,
          player,
          status,
          viewed: game.viewed?.id === recipe.id,
          host: !!game.state && playerRoomRole(player, game.state) === 'host',
        },
      ];
    }) || [],
);
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
    <header
      ><h2 :id="heading">這桌的藥師</h2
      ><span>{{ rows.length }} / {{ game.state?.maxPlayers || 8 }} 位</span></header
    >
    <div class="vue-quacks-roster-list" aria-label="藥師與公開資源，可捲動查看" tabindex="0">
      <p v-if="!rows.length" class="vue-quacks-roster-empty">正在讀取藥師名單…</p>
      <RoomPlayerCard
        v-for="row in rows"
        :key="row.recipe.id"
        :player="row.player"
        :host="row.host"
        :self="row.recipe.id === game.state?.me"
        :score="row.recipe.score"
        :status="row.recipe.potName + '，' + row.status"
        high-info
        :progress="
          row.recipe.stopped || row.recipe.chosen || row.recipe.exploded ? 'complete' : 'pending'
        "
        :data-quacks-player="row.recipe.id"
        :data-viewed="row.viewed"
        :data-exploded="row.recipe.exploded"
      >
        <template #score
          ><span :data-quacks-score="row.recipe.id">{{ row.recipe.score }}</span
          ><span>分</span></template
        >
        <template #action
          ><UiButton
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
        /></template>
        <template #details>
          <div class="vue-quacks-player-resources" aria-label="公開資源">
            <span
              :aria-label="'紅寶石 ' + row.recipe.rubies + ' 顆'"
              :title="'紅寶石 ' + row.recipe.rubies + ' 顆'"
              :data-quacks-ruby="row.recipe.id"
              ><QuacksGlyph resource="ruby" :size="18" /><strong>{{
                row.recipe.rubies
              }}</strong></span
            >
            <span
              :aria-label="'本回合老鼠尾巴 ' + row.recipe.rat + ' 條'"
              :title="'本回合老鼠尾巴 ' + row.recipe.rat + ' 條'"
              ><QuacksGlyph resource="rat" :size="18" /><strong>{{ row.recipe.rat }}</strong></span
            >
            <span
              :aria-label="'藥袋剩餘 ' + row.recipe.bagCount + ' 片'"
              :title="'藥袋剩餘 ' + row.recipe.bagCount + ' 片'"
              ><QuacksGlyph resource="bag" :size="18" /><strong>{{
                row.recipe.bagCount
              }}</strong></span
            >
            <span
              :aria-label="'永久水滴第 ' + row.recipe.droplet + ' 格'"
              :title="'永久水滴第 ' + row.recipe.droplet + ' 格'"
              ><QuacksGlyph resource="droplet" :size="18" /><strong>{{
                row.recipe.droplet
              }}</strong></span
            >
            <span
              class="vue-quacks-player-risk"
              :data-danger="
                !row.recipe.hidden &&
                row.recipe.white !== null &&
                row.recipe.threshold !== null &&
                row.recipe.white >= row.recipe.threshold - 1
              "
              :aria-label="
                row.recipe.hidden
                  ? '大釜進度隱藏中'
                  : '白色炸彈 ' + row.recipe.white + '，爆炸門檻 ' + row.recipe.threshold
              "
              :title="
                row.recipe.hidden
                  ? '大釜進度隱藏中'
                  : '白色炸彈 ' + row.recipe.white + '，爆炸門檻 ' + row.recipe.threshold
              "
            >
              <QuacksGlyph :chip="{ color: 'white', value: 1 }" :size="18" /><strong
                v-if="
                  !row.recipe.hidden && row.recipe.white !== null && row.recipe.threshold !== null
                "
                >{{ row.recipe.white }}/{{ row.recipe.threshold }}</strong
              ><span v-else>—</span>
            </span>
            <div
              v-if="game.state?.options.witches"
              class="vue-quacks-player-coins"
              aria-label="女巫幣"
              ><template v-if="row.recipe.coins"
                ><span
                  v-for="color in coins"
                  :key="color"
                  :data-used="row.recipe.coins[color] === false"
                  role="img"
                  :aria-label="coinLabel(color, row.recipe.coins[color])"
                  :title="coinLabel(color, row.recipe.coins[color])"
                  ><QuacksGlyph :resource="color" :size="14" /></span></template
              ><span v-else aria-label="女巫幣尚未公開">—</span></div
            >
          </div>
        </template>
      </RoomPlayerCard>
    </div>
  </section>
</template>
