<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import RoomSceneLayout from './RoomSceneLayout.vue';
import { warmGame } from '../services/game-assets';
import type { GameType, RoomPlayer, RoomSnapshot } from '../contracts/room';
import { useRoomPage } from '../composables/room-page';
import RoomFullscreenToggle from './RoomFullscreenToggle.vue';
import RoomRoster from './RoomRoster.vue';
import GameSettingsPanel from './GameSettingsPanel.vue';
import RoomChat from './RoomChat.vue';
import RoomEffects from './RoomEffects.vue';
import RoomActionFeedback from './RoomActionFeedback.vue';
import RoomMedia from './RoomMedia.vue';
import RoomPings from './RoomPings.vue';
import RoomManager from './RoomManager.vue';
import RoomHeader from './RoomHeader.vue';
import RoomLeaveButton from './RoomLeaveButton.vue';
import UiButton from './UiButton.vue';
import UiLink from './UiLink.vue';
import { gamePath } from '../contracts/room';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/game-room.scss';
import '../styles/game-entry.scss';
import '../styles/room-space.scss';
const props = withDefaults(
  defineProps<{
    type: GameType;
    title: string;
    description: string;
    reader: (value: unknown) => RoomSnapshot;
    phase: string;
    round?: string;
    maxPlayers: number;
    actorId?: string | null;
    status: (player: RoomPlayer) => string;
    setup: boolean;
    canStart: boolean;
    startLabel?: string;
    startIcon?: string;
    setupTarget?: string;
    pollMs?: number;
    showMetrics?: boolean;
    scoreLabel?: string;
    panelsOpen?: boolean;
    mediaStage?: string;
    // Without a match, the phase row is dropped and notices float over the main area (#277).
    phaseRow?: boolean;
  }>(),
  { showMetrics: true, scoreLabel: '分', phaseRow: true },
);
const emit = defineEmits<{ start: [] }>(),
  page = useRoomPage(props.type, props.reader, props.pollMs),
  { room, session, entryCode, entryBusy, entryError, connected } = page,
  focused = ref(false);
const waiting = computed(() => room.snapshot?.phase === 'waiting'),
  finished = computed(() => room.snapshot?.phase === 'finished'),
  settingsTarget = computed(() =>
    waiting.value ? '#room-waiting-settings-' + props.type : props.setupTarget,
  );
const help = ref<InstanceType<typeof UiDialog> | null>(null),
  headerIntegrated = ref(false);
const botAllowed = computed(
  () =>
    props.setup &&
    room.host &&
    (room.snapshot?.players.filter((player) => !player.kicked).length || 0) < props.maxPlayers &&
    (props.type === 'thunder' ||
      !room.snapshot?.botSupport ||
      (room.snapshot.botSupport as Record<string, unknown>).canAdd !== false),
);
const entryArt = computed(() =>
  props.type === 'bluff'
    ? '/assets/playful/game-bluff.svg'
    : props.type === 'thunder'
      ? '/assets/playful/game-thunder.svg'
      : props.type === 'telephone'
        ? '/assets/playful/game-telephone.svg'
        : props.type === 'majority'
          ? '/assets/playful/game-majority.svg'
          : '',
);
const connection = computed(() =>
  room.terminal
    ? room.error
    : room.connecting
      ? '正在恢復房間座位…'
      : room.disconnected
        ? room.error || '房間連線中斷，正在重試…'
        : !room.snapshot
          ? '正在讀取房間…'
          : '',
);
watch(
  waiting,
  (now) => {
    if (now) warmGame(props.type);
  },
  { immediate: true },
);
onMounted(() => {
  if (new URLSearchParams(location.search).has('learn')) void help.value?.open();
});
</script>
<template>
  <section
    v-if="!room.seat"
    class="vue-game-entry"
    :class="{ 'vue-game-entry-approved': !!entryArt }"
    ><div
      ><img
        v-if="entryArt"
        class="vue-game-entry-art"
        :src="entryArt"
        alt=""
        width="640"
        height="440" /><div class="vue-game-entry-copy"
        ><small>YOUR TABLE. YOUR PEOPLE.</small><h1>{{ title }}</h1
        ><p>{{ description }}</p
        ><p>{{
          session.user ? '以「' + session.user.displayName + '」入座' : '使用帳號設定的暱稱入座'
        }}</p
        ><p v-if="entryCode">房間 {{ entryCode }}</p
        ><div class="vue-game-entry-actions"
          ><UiButton
            :variant="entryArt ? 'primary' : 'secondary'"
            icon="play"
            :label="entryCode ? '加入這一桌' : '開一桌' + title"
            :pending="entryBusy || room.connecting"
            :disabled="['kicked', 'closed'].includes(room.terminal || '')"
            @click="page.enter()"
          /><UiLink
            v-if="entryCode"
            href="?watch=1"
            icon="play"
            label="以觀戰身分觀看這一桌"
          /><UiLink
            :href="'/' + gamePath(type) + '?learn=1'"
            label="試玩教學"
            icon="play"
          /><UiButton icon="help" label="遊戲說明" @click="help?.open()" /><slot
            name="entry-actions"
          /><a href="/">返回大廳</a></div
        ><StatusSlot
          persistent
          :message="entryError || room.error"
          :error="!!entryError || !!room.error" /></div></div
  ></section>
  <div
    v-else
    class="vue-game-workspace vue-room-shell has-room-space"
    :data-room-kind="type"
    :data-room-phase="room.snapshot?.phase"
    :class="{ 'is-header-integrated': headerIntegrated }"
    ><RoomHeader :title="title" :focused="focused" @integrated="headerIntegrated = $event"
      ><template v-if="$slots.toolbar" #game-actions><slot name="toolbar" /></template
      ><UiLink
        :href="'/' + gamePath(type) + '?learn=1&amp;from=game&amp;room=' + room.code"
        label="試玩教學"
        icon="play"
        variant="ghost" /><UiButton
        variant="ghost"
        icon="help"
        icon-only
        label="遊戲說明"
        @click="help?.open()" /><RoomFullscreenToggle
        @update:focused="
          focused = $event
        " /><RoomActionFeedback /><RoomManager /><RoomLeaveButton /></RoomHeader
    ><div class="vue-game-room-feedback vue-room-status-row" :class="{ 'is-overlay': !phaseRow }"
      ><div v-if="phaseRow" class="vue-room-phase-slot"
        ><slot name="round-progress" /><span class="vue-room-phase">{{ phase }}</span
        ><span class="vue-room-round">{{ round || '等待開桌' }}</span></div
      ><StatusSlot
        :persistent="!!connection || room.busy"
        :message="connection || room.message"
        :error="!!room.terminal || room.disconnected || room.failed"
    /></div>
    <RoomSceneLayout :connected="connected" :focused="focused" :panels-open="panelsOpen">
      <template #roster
        ><slot name="roster" :bot-allowed="botAllowed"
          ><RoomRoster
            :snapshot="room.snapshot"
            :actor-id="actorId"
            :loading="!room.snapshot"
            :max-players="maxPlayers"
            :status="status"
            :score-label="scoreLabel"
            :show-metric="!waiting && showMetrics !== false"
            ><template v-if="$slots['player-metric']" #metric="{ player }"
              ><slot name="player-metric" :player="player" /></template
            ><template #actions
              ><UiButton
                v-if="room.host && setup"
                variant="secondary"
                icon="add"
                label="加入電腦玩家"
                :disabled="room.busy || !botAllowed"
                @click="room.command('bot', {})" /></template></RoomRoster></slot
      ></template>
      <slot />
      <template #side="{ chatVisible }"
        ><Teleport
          v-if="setup"
          :key="settingsTarget"
          :to="settingsTarget || 'body'"
          :disabled="!settingsTarget"
          defer
        >
          <GameSettingsPanel
            :heading="waiting ? '' : '房間設定'"
            :in-stage="!!settingsTarget"
            :waiting="waiting"
          >
            <slot name="settings" /><p v-if="!room.gameManager">等待房主或管理者開始。</p>
            <template v-if="waiting && $slots['waiting-before-start']" #before-start
              ><slot name="waiting-before-start"
            /></template>
            <template #start
              ><UiButton
                v-if="room.gameManager"
                variant="primary"
                :icon="finished ? 'replay' : startIcon || (startLabel ? 'replay' : 'play')"
                :label="finished ? '再玩一局' : startLabel || '開始遊戲'"
                :pending="room.busy"
                :disabled="!setup || (!finished && !canStart)"
                @click="finished ? room.command('rematch', {}) : emit('start')"
              /><span v-else>由房主或管理者開始遊戲</span></template
            >
          </GameSettingsPanel>
        </Teleport>
        <slot name="side-actions" /><RoomChat :panel-visible="chatVisible"
          ><template #tools
            ><RoomMedia :connected="room.connected" :stage="mediaStage" /></template></RoomChat
      ></template> </RoomSceneLayout
    ><RoomEffects :connected="connected" /><RoomPings /> </div
  ><UiDialog ref="help" :title="title + '玩法'"
    ><slot name="help" /><a :href="'/?game=' + type">回大廳開一桌</a></UiDialog
  >
</template>
