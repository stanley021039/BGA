<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RoomSidePanel from './RoomSidePanel.vue';
import RoomBackground from './RoomBackground.vue';
import { useChatStore } from '../stores/chat';
import { warmGame } from '../services/game-assets';
import type { GameType, RoomPlayer, RoomSnapshot } from '../contracts/room';
import { useRoomPage } from '../composables/room-page';
import { useGameFocus } from '../composables/game-focus';
import RoomRoster from './RoomRoster.vue';
import GameSettingsPanel from './GameSettingsPanel.vue';
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
  }>(),
  { showMetrics: true, scoreLabel: '分' },
);
const emit = defineEmits<{ start: [] }>(),
  page = useRoomPage(props.type, props.reader, props.pollMs),
  { room, session, entryCode, entryBusy, entryError, connected } = page,
  { focused, toggle } = useGameFocus();
const panelsEnabled = computed(() => props.type === 'quacks'),
  rosterOpen = ref(false),
  chatOpen = ref(false),
  chat = useChatStore(),
  narrow = window.matchMedia('(max-width: 1180px)'),
  mobile = ref(narrow.matches),
  drawerOpen = computed(
    () =>
      panelsEnabled.value && mobile.value && !focused.value && (rosterOpen.value || chatOpen.value),
  );
let previousTrigger: HTMLElement | null = null;
function togglePanel(side: 'left' | 'right') {
  previousTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (side === 'left') {
    rosterOpen.value = !rosterOpen.value;
    if (mobile.value && rosterOpen.value) chatOpen.value = false;
  } else {
    chatOpen.value = !chatOpen.value;
    if (mobile.value && chatOpen.value) rosterOpen.value = false;
  }
}
async function closePanels() {
  rosterOpen.value = chatOpen.value = false;
  await nextTick();
  if (previousTrigger?.isConnected) previousTrigger.focus({ preventScroll: true });
}
function breakpoint() {
  mobile.value = narrow.matches;
  if (mobile.value && rosterOpen.value && chatOpen.value) rosterOpen.value = false;
}
narrow.addEventListener('change', breakpoint);
onBeforeUnmount(() => narrow.removeEventListener('change', breakpoint));
watch(
  () => room.scope + ':' + room.code,
  () => {
    rosterOpen.value = chatOpen.value = false;
  },
);
const waiting = computed(() => room.snapshot?.phase === 'waiting'),
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
          /><UiButton icon="help" label="遊戲說明" @click="help?.open()" /><a href="/"
            >返回大廳</a
          ></div
        ><StatusSlot
          persistent
          :message="entryError || room.error"
          :error="!!entryError || !!room.error" /></div></div
  ></section>
  <div
    v-else
    class="vue-game-workspace vue-room-shell"
    :data-room-kind="type"
    :data-room-phase="room.snapshot?.phase"
    :class="{ 'is-header-integrated': headerIntegrated, 'has-room-space': panelsEnabled }"
    ><RoomHeader :title="title" :focused="focused" @integrated="headerIntegrated = $event"
      ><template v-if="$slots.toolbar" #game-actions><slot name="toolbar" /></template
      ><UiButton
        variant="ghost"
        icon="help"
        icon-only
        label="遊戲說明"
        @click="help?.open()" /><UiButton
        variant="ghost"
        icon="expand"
        icon-only
        :label="focused ? '退出專注全螢幕' : '專注全螢幕'"
        :aria-pressed="focused"
        @click="toggle" /><RoomManager /><RoomLeaveButton /></RoomHeader
    ><div class="vue-game-room-feedback vue-room-status-row"
      ><div class="vue-room-phase-slot"
        ><slot name="round-progress" /><span class="vue-room-phase">{{ phase }}</span
        ><span class="vue-room-round">{{ round || '等待開桌' }}</span></div
      ><StatusSlot
        :persistent="!!connection || room.busy"
        :message="connection || room.message"
        :error="!!room.terminal || room.disconnected || room.failed"
    /></div>
    <div class="vue-game-grid">
      <RoomBackground
        v-if="panelsEnabled"
        :connected="connected"
        :focused="focused"
        :inert="drawerOpen" />
      <Teleport to="body"
        ><div
          v-if="drawerOpen"
          role="presentation"
          aria-hidden="true"
          class="vue-room-drawer-backdrop"
          tabindex="-1"
          @click.stop="closePanels"
      /></Teleport>
      <RoomSidePanel
        class="vue-game-roster-panel"
        :enabled="panelsEnabled"
        side="left"
        title="玩家列表"
        :open="rosterOpen"
        :mobile="mobile"
        :focused="focused"
        @toggle="togglePanel('left')"
        @close="closePanels"
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
                @click="room.command('bot', {})" /></template></RoomRoster></slot></RoomSidePanel
      ><main class="vue-game-main" :inert="drawerOpen"><slot /></main
      ><RoomSidePanel
        class="vue-game-side"
        :enabled="panelsEnabled"
        side="right"
        title="聊天室"
        :open="chatOpen"
        :unread="chat.unread"
        :mobile="mobile"
        :focused="focused"
        @toggle="togglePanel('right')"
        @close="closePanels"
        ><Teleport v-if="setup" :to="settingsTarget || 'body'" :disabled="!settingsTarget" defer>
          <GameSettingsPanel
            :heading="waiting ? '' : '房間設定'"
            :in-stage="!!settingsTarget"
            :waiting="waiting"
          >
            <slot name="settings" /><p v-if="!room.host">等待房主開始。</p>
            <template v-if="waiting && $slots['waiting-before-start']" #before-start
              ><slot name="waiting-before-start"
            /></template>
            <template #start
              ><UiButton
                v-if="room.host"
                variant="primary"
                :icon="startIcon || (startLabel ? 'replay' : 'play')"
                :label="startLabel || '開始遊戲'"
                :pending="room.busy"
                :disabled="!setup || !canStart"
                @click="emit('start')"
              /><span v-else>由房主開始遊戲</span></template
            >
          </GameSettingsPanel>
        </Teleport>
        <slot name="side-actions" /><RoomChat
          :panel-visible="panelsEnabled ? chatOpen && !focused : undefined"
          ><template #tools
            ><RoomMedia :connected="room.connected" /></template></RoomChat></RoomSidePanel></div
    ><RoomEffects :connected="connected" /><RoomPings /> </div
  ><UiDialog ref="help" :title="title + '玩法'"
    ><slot name="help" /><a :href="'/?game=' + type">回大廳開一桌</a></UiDialog
  >
</template>
