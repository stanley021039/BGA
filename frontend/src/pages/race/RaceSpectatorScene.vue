<script setup lang="ts">
import { computed } from 'vue';
import type { RaceDomain, RacePhase, RaceSnapshot } from '../../contracts/race';
import type { SpectatorSnapshot } from '../../contracts/spectator';
import RaceScene from './RaceScene.vue';
import RaceWaiting from './RaceWaiting.vue';
import '../../styles/race.scss';

const props = defineProps<{
  snapshot: SpectatorSnapshot;
  followed: string;
  now: number;
  offset: number;
}>();

const state = computed<RaceSnapshot>(() => {
  const { snapshot, followed } = props;
  const board = snapshot.raceBoard;
  const players = snapshot.players.map((player) => {
    const team = board?.players.find((entry) => entry.id === player.id);
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      bot: player.bot,
      online: player.online,
      kicked: false,
      roomRole: null,
      color: team?.color || '',
      chopper: team?.chopper ?? null,
      dice: team?.dice || [],
      commandUsed: team?.commandUsed ?? false,
      turns: 0,
      out: false,
    };
  });
  const activeCar = board?.state.active?.car;
  const tiles = board?.visual.tiles || [];
  return {
    type: 'thunder',
    code: snapshot.code,
    me: followed,
    host: false,
    phase: snapshot.phase as RacePhase,
    version: snapshot.version,
    gameRevision: snapshot.gameRevision,
    serverNow: snapshot.serverNow,
    round: snapshot.round,
    players,
    options: { devilsRun: snapshot.raceDevilsRun },
    turn: -1,
    first: -1,
    roadDie: board?.roadDie ?? null,
    deadline: snapshot.deadline,
    actor: board?.actorId ?? null,
    active: activeCar
      ? {
          car: activeCar,
          remaining: board?.activeRemaining ?? 0,
          coast: false,
          roadEligible: false,
          bonusUsed: false,
          drift: false,
          driftUsed: false,
          stopped: false,
        }
      : null,
    pending: null,
    diceCheck: null,
    finishAt: board?.state.finishAt ?? null,
    tileCount: tiles.length,
    winner: board?.winner ?? null,
    cars: board?.state.cars || [],
    tiles,
    legalMoves: [],
    targets: [],
    available: [],
    events: [],
    motions: [],
    log: [],
  };
});

const model: RaceDomain = {
  get state() {
    return state.value;
  },
  get spectatorDiceTitle() {
    return props.snapshot.raceBoard?.diceTitle || '';
  },
  get now() {
    return props.now;
  },
  get offset() {
    return props.offset;
  },
  spectator: true,
  lesson: false,
  connected: true,
  canAct: false,
  busy: false,
  notice: '',
  failed: false,
  async run() {
    return false;
  },
};
</script>

<template>
  <RaceWaiting v-if="state.phase === 'waiting'" :model="model" />
  <RaceScene v-else :model="model" />
</template>
