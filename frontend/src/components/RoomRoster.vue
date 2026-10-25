<script setup lang="ts">
import { computed, useId } from 'vue';
import { playerRoomRole, type RoomPlayer, type RoomSnapshot } from '../contracts/room';
import RoomPlayerCard from './RoomPlayerCard.vue';
import { submissionProgress } from '../contracts/submission';
import UiBadge from './UiBadge.vue';
import '../styles/room.scss';
const props = withDefaults(
  defineProps<{
    snapshot: RoomSnapshot | null;
    title?: string;
    countLabel?: string;
    maxPlayers?: number;
    status: (player: RoomPlayer) => string;
    actorId?: string | null;
    loading?: boolean;
    showMetric?: boolean;
    scoreLabel?: string;
  }>(),
  { loading: false, showMetric: true, title: '這桌的朋友', scoreLabel: '分' },
);
const players = computed(() => (props.snapshot?.players || []).filter((player) => !player.kicked));
const waiting = computed(() => props.snapshot?.phase === 'waiting');
const heading = useId();
const actor = computed(
  () =>
    props.actorId ??
    ['actor', 'presenterId', 'thinkerId', 'djId', 'leaderId']
      .map((key) => props.snapshot?.[key])
      .find((value) => typeof value === 'string'),
);
const roleLabels: Record<string, string> = {
  draw: '畫家',
  minimal: '畫家',
  majority: '出題人',
  musicquiz: '本輪 DJ',
  bluff: '想想',
  trpg: '領隊',
  poker: '輪到下注',
};
const rows = computed(() =>
  players.value.map((player) => {
    const status = props
      .status(player)
      .replace(/(?:^| · )在線(?: · |$)/g, '')
      .replace(/^ · | · $/g, '');
    const snapshot = props.snapshot;
    const submission = snapshot ? submissionProgress(snapshot, player) : null;
    const finished = snapshot?.phase === 'finished' && !snapshot.interrupted;
    const complete =
      finished ||
      (/已完成|本階段完成|已交卷|已作答|已提交|已送出|已鎖定|已說明|說明完畢|已選擇|已就緒|已準備|準備完成|本局結束/.test(
        status,
      ) &&
        !/未鎖定|未完成|尚未|未作答/.test(status));
    const score =
      !waiting.value && props.showMetric
        ? typeof player.score === 'number'
          ? player.score
          : typeof player.stack === 'number'
            ? player.stack
            : undefined
        : undefined;
    return {
      player,
      status,
      score,
      host:
        !!props.snapshot &&
        (playerRoomRole(player, props.snapshot) === 'host' || props.snapshot.host === player.id),
      complete: submission ? submission.complete : complete,
      progressLabel: submission?.label || '',
    };
  }),
);
</script>
<template>
  <section
    class="vue-room-roster vue-stitch-roster"
    data-ping-anchor="players"
    :data-capacity="players.length > 8 ? 'extended' : 'standard'"
    :aria-labelledby="heading"
  >
    <header
      ><h2 :id="heading">{{ title }}</h2
      ><UiBadge counter class="vue-roster-count">{{
        countLabel ?? players.length + (maxPlayers ? ' / ' + maxPlayers : '') + ' 位'
      }}</UiBadge></header
    >
    <ul
      class="vue-roster-list"
      :aria-busy="loading"
      aria-label="已入座玩家，可捲動查看"
      tabindex="0"
    >
      <li v-if="!players.length" class="vue-roster-empty">{{
        loading ? '正在讀取名單…' : '尚無玩家入座。'
      }}</li>
      <li v-for="row in rows" :key="row.player.id" class="vue-room-player">
        <RoomPlayerCard
          :player="row.player"
          :host="row.host"
          :self="row.player.id === snapshot?.me"
          :actor="row.player.id === actor"
          :actor-label="roleLabels[snapshot?.type || ''] || '目前行動'"
          :status="row.status"
          :progress-label="row.progressLabel"
          :progress="row.complete ? 'complete' : 'pending'"
          :score="row.score"
          :score-label="scoreLabel"
        >
          <template v-if="$slots.avatar" #avatar
            ><slot name="avatar" :player="row.player"
          /></template>
          <template v-if="$slots.identity" #identity
            ><slot
              name="identity"
              :player="row.player"
              :host="row.host"
              :self="row.player.id === snapshot?.me"
          /></template>
          <template v-if="!waiting && showMetric && typeof row.player.stack === 'number'" #score
            >{{ row.player.stack }} 籌碼</template
          >
          <template v-if="!waiting && ((showMetric && $slots.metric) || $slots.feedback)" #details>
            <div v-if="showMetric && $slots.metric" class="vue-room-player-metric"
              ><slot name="metric" :player="row.player"
            /></div>
            <div v-if="$slots.feedback" class="vue-room-player-feedback"
              ><slot name="feedback" :player="row.player"
            /></div>
          </template>
        </RoomPlayerCard>
      </li>
    </ul>
    <footer v-if="$slots.actions"><slot name="actions" /></footer>
  </section>
</template>
