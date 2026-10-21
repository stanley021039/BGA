<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { GameType, RoomPlayer, RoomSnapshot } from '../contracts/room';
import { useRoomPage } from '../composables/room-page';
import { useGameFocus } from '../composables/game-focus';
import RoomRoster from './RoomRoster.vue';
import RoomChat from './RoomChat.vue';
import RoomEffects from './RoomEffects.vue';
import RoomMedia from './RoomMedia.vue';
import RoomPings from './RoomPings.vue';
import RoomManager from './RoomManager.vue';
import RoomHeader from './RoomHeader.vue';
import RoomLeaveButton from './RoomLeaveButton.vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/game-room.scss';
const props = withDefaults(
  defineProps<{
    type: GameType;
    title: string;
    description: string;
    reader: (value: unknown) => RoomSnapshot;
    phase: string;
    round?: string;
    maxPlayers: number;
    status: (player: RoomPlayer) => string;
    setup: boolean;
    canStart: boolean;
    startLabel?: string;
    pollMs?: number;
    showMetrics?: boolean;
  }>(),
  { showMetrics: true },
);
const emit = defineEmits<{ start: [] }>(),
  page = useRoomPage(props.type, props.reader, props.pollMs),
  { room, session, entryCode, entryBusy, entryError, connected } = page,
  { focused, toggle } = useGameFocus();
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
onMounted(() => {
  if (new URLSearchParams(location.search).has('learn')) void help.value?.open();
});
async function refreshManually() {
  if (await page.refresh()) {
    room.failed = false;
    room.message = '';
  }
}
defineExpose({ refresh: page.refresh });
</script>
<template>
  <section v-if="!room.seat" class="vue-game-entry"
    ><div
      ><small>YOUR TABLE. YOUR PEOPLE.</small><h1>{{ title }}</h1
      ><p>{{ description }}</p
      ><p>{{
        session.user ? '以「' + session.user.displayName + '」入座' : '使用帳號設定的暱稱入座'
      }}</p
      ><p v-if="entryCode">房間 {{ entryCode }}</p
      ><div class="vue-game-entry-actions"
        ><UiButton
          icon="play"
          :label="entryCode ? '加入這一桌' : '開一桌' + title"
          :pending="entryBusy || room.connecting"
          :disabled="['kicked', 'closed'].includes(room.terminal || '')"
          @click="page.enter()"
        /><UiButton icon="help" label="遊戲說明" @click="help?.open()" /><a href="/"
          >返回大廳</a
        ></div
      ><StatusSlot :message="entryError || room.error" :error="!!entryError || !!room.error" /></div
  ></section>
  <div
    v-else
    class="vue-game-workspace vue-room-shell"
    :data-room-kind="type"
    :data-room-phase="room.snapshot?.phase"
    :class="{ 'is-header-integrated': headerIntegrated }"
    ><RoomHeader
      :title="title"
      :max-players="maxPlayers"
      :focused="focused"
      @integrated="headerIntegrated = $event"
      ><slot name="toolbar" /><UiButton
        stitch
        variant="ghost"
        icon="help"
        icon-only
        label="遊戲說明"
        @click="help?.open()" /><UiButton
        stitch
        variant="ghost"
        icon="expand"
        icon-only
        :label="focused ? '退出專注全螢幕' : '專注全螢幕'"
        :aria-pressed="focused"
        @click="toggle" /><RoomManager stitch /><RoomLeaveButton stitch /></RoomHeader
    ><div class="vue-game-room-feedback vue-room-status-row"
      ><div class="vue-room-phase-slot"
        ><span class="vue-room-phase">{{ phase }}</span
        ><span class="vue-room-round">{{ round || '等待開桌' }}</span></div
      ><StatusSlot
        :message="connection || room.message"
        :error="!!room.terminal || room.disconnected || room.failed" /><UiButton
        stitch
        variant="ghost"
        icon="refresh"
        icon-only
        label="更新房間狀態"
        :disabled="!room.seat || room.busy"
        @click="refreshManually()"
    /></div>
    <div class="vue-game-grid"
      ><aside class="vue-game-roster-panel"
        ><slot name="roster" :bot-allowed="botAllowed"
          ><RoomRoster
            :snapshot="room.snapshot"
            :loading="!room.snapshot"
            :max-players="maxPlayers"
            :status="status"
            :show-metric="showMetrics !== false"
            ><template v-if="$slots['player-metric']" #metric="{ player }"
              ><slot name="player-metric" :player="player" /></template
            ><template #actions
              ><UiButton
                v-if="room.host && setup"
                icon="add"
                label="加入電腦玩家"
                :disabled="room.busy || !botAllowed"
                @click="room.command('bot', {})" /></template></RoomRoster></slot></aside
      ><main class="vue-game-main"><slot /></main
      ><aside class="vue-game-side"
        ><section v-if="setup" class="vue-game-settings-panel"
          ><h2>房間設定</h2><slot name="settings" /><p>{{
            room.host ? '邀請朋友入座，準備好就開始。' : '等待房主開始。'
          }}</p
          ><div class="vue-game-start-slot"
            ><UiButton
              v-if="room.host"
              :icon="startLabel ? 'replay' : 'play'"
              :label="startLabel || '開始遊戲'"
              :pending="room.busy"
              :disabled="!setup || !canStart"
              @click="emit('start')"
            /><span v-else>由房主開始遊戲</span></div
          ></section
        ><slot name="side-actions" /><RoomChat
          ><template #tools
            ><RoomMedia :connected="room.connected" /></template></RoomChat></aside></div
    ><RoomEffects :connected="connected" /><RoomPings /> </div
  ><UiDialog ref="help" :title="title + '玩法'"
    ><slot name="help" /><a :href="'/?game=' + type">回大廳開一桌</a></UiDialog
  >
</template>
