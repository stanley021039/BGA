<script setup lang="ts">
import { computed, useId } from 'vue';
import { playerRoomRole, type RoomPlayer, type RoomSnapshot } from '../contracts/room';
import PlayerName from './PlayerName.vue';
import PlayerAvatar from './PlayerAvatar.vue';
import '../styles/room.scss';
const props = withDefaults(defineProps<{ snapshot: RoomSnapshot | null; maxPlayers?: number; status: (player: RoomPlayer) => string; actorId?: string | null; loading?: boolean; showMetric?: boolean }>(), { loading: false, showMetric: true });
const players = computed(() => (props.snapshot?.players || []).filter(player => !player.kicked));
const heading = useId();
// The domain owns its status text; badges only supplement facts it has not named.
const rows = computed(() => players.value.map(player => {
  const status = props.status(player), waiting = props.snapshot?.phase === 'waiting';
  return { player, status,
    host: waiting && !!props.snapshot && (playerRoomRole(player, props.snapshot) === 'host' || props.snapshot.host === player.id) && !status.includes('房主'),
    ready: waiting && player.ready === true && !/已就緒|已準備|準備完成/.test(status),
  };
}));
</script>
<template>
  <section class="vue-room-roster vue-stitch-roster" data-ping-anchor="players" :aria-labelledby="heading">
    <header><h2 :id="heading">這桌的朋友</h2><span class="vue-roster-count">{{ players.length }}{{ maxPlayers ? ' / ' + maxPlayers : '' }} 位</span></header>
    <ul class="vue-roster-list" :aria-busy="loading" aria-label="已入座玩家，可捲動查看" tabindex="0">
      <li v-if="!players.length" class="vue-roster-empty">{{ loading ? '正在讀取名單…' : '尚無玩家入座。' }}</li>
      <li v-for="{ player, status: playerStatus, host, ready } in rows" :key="player.id" class="vue-room-player" :data-no-metric="!showMetric" :data-player-id="player.id" :data-ping-player="player.id" :data-self="player.id === snapshot?.me" :data-actor="player.id === actorId">
        <PlayerAvatar :name="player.name" :avatar="player.avatar" :bot="player.bot" />
        <div class="vue-room-player-copy">
          <div class="vue-room-player-name"><PlayerName :name="player.name" /><span v-if="player.id === snapshot?.me" class="vue-player-self">你</span></div>
          <p class="vue-room-player-status" tabindex="0"><span v-if="host" class="vue-player-role">房主</span><span v-if="ready" class="vue-player-ready">已就緒</span>{{ playerStatus }}</p>
        </div>
        <div v-if="showMetric" class="vue-room-player-metric"><slot name="metric" :player="player"><strong>{{ typeof player.score === 'number' ? player.score : typeof player.stack === 'number' ? player.stack : 0 }}</strong><span>{{ typeof player.stack === 'number' ? '籌碼' : '分數' }}</span></slot></div>
        <div v-if="$slots.feedback" class="vue-room-player-feedback"><slot name="feedback" :player="player" /></div>
      </li>
    </ul>
    <footer><slot name="actions" /></footer>
  </section>
</template>
