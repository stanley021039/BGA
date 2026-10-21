<script setup lang="ts">
import { useId } from 'vue';
import type { RoomPlayer } from '../contracts/room';
import PlayerAvatar from './PlayerAvatar.vue';
import PlayerName from './PlayerName.vue';
import UiIcon from './UiIcon.vue';
import '../styles/room-player-card.scss';
withDefaults(
  defineProps<{
    player: Pick<RoomPlayer, 'id' | 'name' | 'avatar' | 'bot'>;
    host?: boolean;
    self?: boolean;
    actor?: boolean;
    actorLabel?: string;
    status?: string;
    progress?: 'complete' | 'pending';
    score?: number | string;
    scoreLabel?: string;
    highInfo?: boolean;
  }>(),
  { actorLabel: '目前行動', status: '', scoreLabel: '分' },
);
const hint = useId();
</script>
<template>
  <div
    class="vue-player-card"
    tabindex="0"
    :aria-label="player.name"
    :aria-describedby="status ? hint : undefined"
    :data-progress="progress"
    :data-high-info="highInfo"
    :data-actor="actor"
    :data-self="self"
    :data-player-id="player.id"
    :data-ping-player="player.id"
  >
    <div class="vue-player-card-heading">
      <div class="vue-player-card-avatar"
        ><slot name="avatar"
          ><PlayerAvatar :name="player.name" :avatar="player.avatar" :bot="player.bot" /></slot
      ></div>
      <div class="vue-player-card-copy">
        <PlayerName :name="player.name" />
        <div v-if="score !== undefined || $slots.score" class="vue-player-card-score"
          ><slot name="score"
            >{{ score }} <span>{{ scoreLabel }}</span></slot
          ></div
        >
        <div class="vue-player-card-roles">
          <span v-if="host" class="vue-player-role" tabindex="0" role="img" aria-label="房主"
            ><UiIcon name="crown" /><span role="tooltip">房主</span></span
          >
          <span
            v-if="actor"
            class="vue-player-role"
            tabindex="0"
            role="img"
            :aria-label="actorLabel"
            ><UiIcon name="edit" /><span role="tooltip">{{ actorLabel }}</span></span
          >
          <slot name="identity" />
        </div>
      </div>
      <div v-if="$slots.action" class="vue-player-card-action"><slot name="action" /></div>
    </div>
    <div v-if="$slots.details" class="vue-player-card-details"><slot name="details" /></div>
    <span v-if="status" :id="hint" class="vue-player-card-status" role="tooltip"
      ><span>{{ status }}</span></span
    >
  </div>
</template>
