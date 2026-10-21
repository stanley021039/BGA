<script setup lang="ts">
import type { RaceSnapshot } from '../../contracts/race';
import type { RoomPlayer } from '../../contracts/room';
import RoomRoster from '../../components/RoomRoster.vue';
import RaceCrewDice from './RaceCrewDice.vue';
const props = defineProps<{ state: RaceSnapshot }>();
const crew = (player: RoomPlayer) => props.state.players.find((entry) => entry.id === player.id);
function status(player: RoomPlayer) {
  return crew(player)?.out ? '出局' : props.state.actor === player.id ? '目前行動' : '準備比賽';
}
</script>
<template>
  <aside class="vue-race-lesson-roster" aria-label="教學車隊">
    <RoomRoster
      :snapshot="state"
      title="車隊玩家"
      :count-label="state.players.length + ' 車隊'"
      :actor-id="state.actor"
      :status="status"
    >
      <template #avatar="{ player }">
        <span
          class="vue-race-lesson-initial"
          :style="{ '--crew-color': crew(player)?.color }"
          aria-hidden="true"
          >{{ [...player.name][0] || '？' }}</span
        >
      </template>
      <template #identity><span class="vue-race-lesson-local">本機教學</span></template>
      <template #metric="{ player }"
        ><RaceCrewDice
          v-if="crew(player)"
          :player="crew(player)!"
          :variant="state.players.findIndex((entry) => entry.id === player.id)"
      /></template>
    </RoomRoster>
  </aside>
</template>
