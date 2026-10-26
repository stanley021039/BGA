<script setup lang="ts">
import { computed } from 'vue';
import type { PokerSnapshot } from '../../contracts/poker';
import PokerCard from './PokerCard.vue';
import PlayerAvatar from '../../components/PlayerAvatar.vue';
import PlayerName from '../../components/PlayerName.vue';
const props = defineProps<{ state: PokerSnapshot }>();
const layouts: Record<number, readonly number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 5, 6, 7],
  8: [0, 1, 2, 3, 4, 5, 6, 7],
};
const seats = computed(() => {
  const s = props.state,
    mine = Math.max(
      0,
      s.players.findIndex((p) => p.id === s.me),
    );
  return (layouts[s.players.length] || []).map((slot, index) => {
    const playerIndex = (mine + index) % s.players.length;
    return {
      slot,
      player: s.players[playerIndex]!,
      dealer: playerIndex === s.button,
      acting: !['waiting', 'showdown'].includes(s.phase) && playerIndex === s.turn,
    };
  });
});
</script>
<template>
  <div class="vue-poker-seats" data-poker-seats :data-seat-count="state.players.length">
    <div class="vue-poker-felt" aria-hidden="true"></div>
    <div class="vue-poker-table-center"><slot /></div>
    <article
      v-for="seat in seats"
      :key="seat.player.id"
      class="vue-poker-seat"
      :class="{
        'is-acting': seat.acting,
        'is-folded': seat.player.folded,
        'is-own': seat.player.id === state.me,
      }"
      :data-poker-seat="seat.player.id"
      :data-seat-slot="seat.slot"
      :data-private="seat.player.id === state.me ? '' : undefined"
      :aria-label="seat.player.name + (seat.acting ? '，目前行動' : '')"
    >
      <div
        class="vue-poker-seat-cards"
        :aria-label="seat.player.id === state.me ? '你的私人底牌' : seat.player.name + '的底牌'"
      >
        <PokerCard v-for="(card, index) in seat.player.cards" :key="index" :card="card" />
        <span v-if="!seat.player.cards.length" class="vue-poker-seat-no-hand">本手未入局</span>
      </div>
      <div class="vue-poker-seat-info">
        <span v-if="seat.dealer" class="vue-poker-dealer" aria-label="莊家">D</span>
        <PlayerAvatar
          :name="seat.player.name"
          :avatar="seat.player.avatar"
          :bot="seat.player.bot"
        />
        <div class="vue-poker-seat-identity"
          ><PlayerName :name="seat.player.name" /><strong
            >{{ seat.player.stack.toLocaleString() }}<small> 籌碼</small></strong
          ></div
        >
      </div>
      <p class="vue-poker-seat-action"
        ><span
          >{{ seat.acting ? '目前行動 · ' : ''
          }}{{
            seat.player.kicked
              ? '電腦接手'
              : seat.player.folded
                ? '棄牌'
                : seat.player.stack === 0
                  ? 'ALL IN'
                  : seat.player.action || (seat.player.id === state.me ? '你' : '')
          }}</span
        ><b v-if="seat.player.bet">本街 {{ seat.player.bet.toLocaleString() }}</b></p
      >
    </article>
  </div>
</template>
