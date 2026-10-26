<script setup lang="ts">
import GameSounds from '../../engines/game-sounds.js';

import { Teleport, computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useDrawResultsStore } from '../../stores/draw-results';
import { useRequests } from '../../composables/requests';
import { readDrawSnapshot } from '../../contracts/drawing';
import type { DrawSnapshot } from '../../contracts/drawing';
import { gamePath, readSeat } from '../../contracts/room';
import { record, text } from '../../services/validation';
import { requestJson } from '../../services/http';
import { drawPhases, drawPlayerStatus, drawWaitingSummary } from './presentation';
import { useDrawMotion } from './useDrawMotion';
import DrawingSurface from '../../components/DrawingSurface.vue';
import DrawGallery from '../../components/DrawGallery.vue';
import DrawScene from './DrawScene.vue';
import DrawSettings from './DrawSettings.vue';
import DrawGuessPanel from './DrawGuessPanel.vue';
import RoomSceneLayout from '../../components/RoomSceneLayout.vue';
import RoomRoster from '../../components/RoomRoster.vue';
import RoomChat from '../../components/RoomChat.vue';
import RoomEffects from '../../components/RoomEffects.vue';
import RoomActionFeedback from '../../components/RoomActionFeedback.vue';
import RoomMedia from '../../components/RoomMedia.vue';
import RoomPings from '../../components/RoomPings.vue';
import RoomManager from '../../components/RoomManager.vue';
import RoomLeaveButton from '../../components/RoomLeaveButton.vue';
import RoomHeader from '../../components/RoomHeader.vue';
import RoomFullscreenToggle from '../../components/RoomFullscreenToggle.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiDialog from '../../components/UiDialog.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import '../../styles/draw-page.scss';
import '../../styles/draw-approved.scss';

const room = useRoomStore(),
  results = useDrawResultsStore(),
  requests = useRequests();
const state = computed(() => room.snapshot as DrawSnapshot | null),
  setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase));
const routeCode =
  (location.pathname.match(/^\/draw\/([a-f0-9]{6})\/?$/i) || [])[1]?.toUpperCase() || '';
const entryCode = ref(routeCode);
const entryBusy = ref(false),
  entryError = ref(''),
  identity = ref(''),
  stream = ref(false),
  now = ref(Date.now()),
  preparing = ref(false),
  startNotice = ref(''),
  focus = ref(false);
const gallery = ref<InstanceType<typeof DrawGallery> | null>(null),
  settings = ref<InstanceType<typeof DrawSettings> | null>(null),
  settingsSection = ref<HTMLElement | null>(null),
  chat = ref<InstanceType<typeof RoomChat> | null>(null);
const help = ref<InstanceType<typeof UiDialog> | null>(null),
  hintDialog = ref<InstanceType<typeof UiDialog> | null>(null),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const headerIntegrated = ref(false);
const connected = computed(() => stream.value && !room.disconnected && !room.terminal);
const motionRoot = ref<HTMLElement | null>(null),
  motion = useDrawMotion(motionRoot, connected);
const { badges, locked } = motion;
const artist = computed(() => !!state.value && state.value.presenterId === state.value.me);
const boardTitle = computed(() =>
  !state.value
    ? '你畫我猜'
    : state.value.phase === 'drawing'
      ? artist.value
        ? state.value.question?.title || '本輪畫布'
        : '猜猜畫者畫什麼？'
      : state.value.phase === 'choosing'
        ? '第 ' + state.value.round + ' 輪，畫者正在選題'
        : state.value.phase === 'reveal'
          ? '本輪答案與畫作'
          : state.value.phase === 'finished'
            ? '本局成績'
            : '今晚的畫猜桌',
);
const hint = computed(() => {
  const value = state.value?.hint;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = record(value);
  return {
    length: typeof row.length === 'number' ? row.length : 0,
    category: text(row.category),
    topic: text(row.topicLabel, '綜合'),
  };
});
const canSkip = computed(() => state.value?.phase === 'drawing' && (artist.value || room.host));
const duration = computed(() =>
  state.value?.phase === 'choosing'
    ? 15000
    : state.value?.phase === 'reveal'
      ? 8000
      : Number(record(state.value?.options || {}).seconds || 90) * 1000,
);
const countdownCaption = computed(() =>
  state.value?.phase === 'choosing'
    ? '選題剩餘'
    : state.value?.phase === 'reveal'
      ? '下一輪'
      : '作畫剩餘',
);
const connectionNotice = computed(() =>
  room.terminal
    ? room.error
    : room.connecting
      ? '正在恢復房間座位…'
      : room.disconnected
        ? room.error || '房間連線中斷，正在重試…'
        : state.value && !stream.value
          ? '即時連線重新連接中，房間狀態持續更新。'
          : '',
);
const botAllowed = computed(() => {
  const value = state.value?.botSupport;
  return !value || typeof value !== 'object' || (value as Record<string, unknown>).canAdd !== false;
});
let disposed = false;
const sounds: import('../../contracts/sounds').GameSoundOwner | undefined = GameSounds?.create();
let lastSeconds: number | null = null,
  timerEpoch = '',
  soundBaseline = true;
let pendingHint: { scope: number; epoch: string } | null = null;
function tick() {
  now.value = Date.now();
  const value = state.value;
  if (!value || value.phase !== 'drawing' || !value.deadline) {
    lastSeconds = null;
    timerEpoch = '';
    return;
  }
  const seconds = Math.ceil(Math.max(0, value.deadline - now.value + room.clockOffset) / 1000);
  if (
    timerEpoch === value.canvasEpoch &&
    lastSeconds !== null &&
    lastSeconds > 15 &&
    seconds <= 15 &&
    seconds > 0
  )
    sounds?.play('countdown-warning', 'draw-countdown:' + value.canvasEpoch + ':15', {
      live: connected.value && now.value - room.lastReceivedAt <= 2500,
    });
  timerEpoch = value.canvasEpoch;
  lastSeconds = seconds;
  motion.tick(value, seconds);
}
watch(
  state,
  (value, previous) => {
    if (!value) return;
    document.body.dataset.drawPhase = value.phase;
    document.body.dataset.drawRole = value.presenterId === value.me ? 'artist' : 'guesser';
    document.body.dataset.drawHost = String(room.host);
    const live = sounds?.update(value, { connected: connected.value && !soundBaseline }) || false;
    soundBaseline = false;
    const me = value.players.find((player) => player.id === value.me),
      active = !!me && !me.kicked && !me.waitingForNextRound;
    if (value.phase === 'choosing' && value.presenterId === value.me)
      sounds?.play('turn', `draw:turn:${value.canvasEpoch}:${value.me}`, {
        live: live && active && !!previous && previous.canvasEpoch !== value.canvasEpoch,
        epoch: sounds.epoch(),
      });
    const own = value.guesses.find((guess) => guess.correct && guess.id === value.me);
    if (own) {
      const age = value.serverNow - own.at,
        fresh =
          active &&
          previous?.canvasEpoch === value.canvasEpoch &&
          previous.phase === 'drawing' &&
          ['drawing', 'reveal'].includes(value.phase) &&
          !previous.guessedIds.includes(value.me) &&
          value.participantIds.includes(value.me) &&
          value.guessedIds.includes(value.me) &&
          age >= 0 &&
          age <= 5000;
      sounds?.play('correct', `draw:correct:${value.canvasEpoch}:${value.me}`, {
        live: live && fresh,
        epoch: sounds.epoch(),
      });
    }
    tick();
  },
  { flush: 'sync' },
);
watch(connected, (value) => {
  if (!value) {
    soundBaseline = true;
    sounds?.disconnect();
  }
});
watch(canSkip, (value) => {
  if (!value) confirm.value?.cancel();
});
watch([() => room.scope, () => state.value?.canvasEpoch, () => state.value?.phase], () => {
  confirm.value?.cancel();
  hintDialog.value?.close();
  pendingHint = null;
});
async function enter() {
  if (entryBusy.value || disposed) return;
  entryBusy.value = true;
  entryError.value = '';
  try {
    const seat = readSeat(await requests.run((signal) => fetchSeat(signal)));
    if (seat.type !== 'draw') {
      location.assign('/' + gamePath(seat.type) + '/' + seat.code);
      return;
    }
    entryCode.value = seat.code;
    history.replaceState(null, '', '/draw/' + seat.code);
    stream.value = false;
    soundBaseline = true;
    await room.open(seat.code, 'draw', readDrawSnapshot);
  } catch (cause) {
    if (!disposed) entryError.value = cause instanceof Error ? cause.message : '加入失敗，請重試。';
  } finally {
    if (!disposed) entryBusy.value = false;
  }
}
async function fetchSeat(signal: AbortSignal) {
  const controller = new AbortController(),
    timeout = setTimeout(
      () =>
        controller.abort(
          new DOMException('加入結果尚未確認，請重新整理確認座位後再操作。', 'TimeoutError'),
        ),
      10000,
    );
  try {
    return await requestJson('/api/' + (entryCode.value ? 'join' : 'create'), {
      method: 'POST',
      body: { type: 'draw', ...(entryCode.value ? { code: entryCode.value } : {}) },
      signal: AbortSignal.any([signal, controller.signal]),
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function start() {
  if (!room.gameManager || !setup.value || preparing.value || room.busy) return;
  if (state.value?.phase === 'finished') {
    await room.command('rematch', {});
    return;
  }
  const scope = room.scope;
  preparing.value = true;
  startNotice.value = '';
  try {
    if (!(await settings.value?.flush())) {
      startNotice.value = settings.value?.error() || '請先完成房間設定儲存。';
      return;
    }
    if (scope === room.scope && room.gameManager && setup.value) await room.command('start', {});
  } finally {
    if (scope === room.scope) preparing.value = false;
  }
}
async function skip() {
  const value = state.value;
  if (!value || !canSkip.value || room.busy) return;
  const scope = room.scope,
    round = value.round,
    canvasEpoch = value.canvasEpoch;
  if (!(await confirm.value?.ask('本輪會立即揭曉，已取得的分數與畫作會保留。', '跳過這一題？')))
    return;
  if (
    scope === room.scope &&
    canSkip.value &&
    state.value?.round === round &&
    state.value.canvasEpoch === canvasEpoch
  )
    await room.command('action', { action: 'skip', round, canvasEpoch });
}
async function saveArtwork(id: string) {
  const scope = room.scope;
  const snapshot = await gallery.value?.open(id);
  if (snapshot && scope === room.scope && results.enabled) await results.save(id);
}
async function showSettings() {
  await nextTick();
  settingsSection.value?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  settingsSection.value?.focus();
}
function askHint() {
  if (!state.value || state.value.phase !== 'drawing') return;
  pendingHint = { scope: room.scope, epoch: state.value.canvasEpoch };
  hintDialog.value?.close();
}
function hintClosed() {
  const pending = pendingHint;
  pendingHint = null;
  if (
    pending &&
    pending.scope === room.scope &&
    pending.epoch === state.value?.canvasEpoch &&
    state.value.phase === 'drawing'
  )
    chat.value?.compose('🤔 求提示，請再加一筆！');
}
function visibility() {
  soundBaseline = true;
  tick();
}
onMounted(() => {
  document.addEventListener('visibilitychange', visibility);
  if (routeCode)
    void room.open(routeCode, 'draw', readDrawSnapshot).catch((cause) => {
      entryError.value = cause instanceof Error ? cause.message : '無法恢復座位。';
    });
  void requests
    .request('/api/auth/me')
    .then((value) => {
      identity.value = text(record(value).displayName);
    })
    .catch(() => {});
  if (new URLSearchParams(location.search).has('learn')) void help.value?.open();
});
onBeforeUnmount(() => {
  disposed = true;
  sounds?.destroy();
  document.removeEventListener('visibilitychange', visibility);
  delete document.body.dataset.drawPhase;
  delete document.body.dataset.drawRole;
  delete document.body.dataset.drawHost;
});
</script>

<template>
  <div v-if="!room.seat" class="vue-draw-entry"
    ><div
      ><small>DRAW TOGETHER</small><h1>畫一筆，讓朋友猜一猜。</h1
      ><p>{{ identity ? `以「${identity}」入座` : '將以你的角色名稱入座' }}</p
      ><p v-if="entryCode">房間 {{ entryCode }}</p
      ><p v-else>題目類別、時間與結算條件，可在建房後調整。</p
      ><UiButton
        icon="play"
        :label="entryCode ? '加入這一桌' : '開一桌你畫我猜'"
        :pending="entryBusy || room.connecting"
        :disabled="['kicked', 'closed'].includes(room.terminal || '')"
        @click="enter" /><UiLink
        v-if="entryCode"
        href="?watch=1"
        icon="play"
        label="以觀戰身分觀看這一桌" /><a href="/">返回大廳</a
      ><StatusSlot
        persistent
        :message="entryError || room.error"
        :error="!!entryError || !!room.error" /></div
  ></div>
  <div
    v-else
    ref="motionRoot"
    class="vue-draw-workspace vue-game-workspace vue-room-shell vue-draw-approved has-room-space"
    data-room-kind="draw"
    :class="{ 'is-header-integrated': headerIntegrated }"
  >
    <RoomHeader title="你畫我猜" :focused="focus" @integrated="headerIntegrated = $event"
      ><template #navigation><DrawGallery ref="gallery" /></template
      ><UiButton
        variant="ghost"
        icon="help"
        icon-only
        label="遊戲說明"
        @click="help?.open()" /><RoomFullscreenToggle
        focus-class="vue-draw-focus"
        @update:focused="focus = $event" /><RoomActionFeedback /><RoomManager /><RoomLeaveButton
    /></RoomHeader>
    <div class="vue-draw-room-feedback vue-room-status-row"
      ><div class="vue-room-phase-slot"
        ><span class="vue-room-phase">{{ state ? drawPhases[state.phase] : '讀取房間中' }}</span
        ><span class="vue-room-round">{{
          state?.round ? `第 ${state.round} / ${state.roundLimit} 輪` : '等待開桌'
        }}</span></div
      ><StatusSlot
        :persistent="!!connectionNotice || preparing || !!startNotice || room.busy"
        :message="
          connectionNotice ||
          (preparing ? '正在確認房間設定…' : startNotice || room.message || results.message)
        "
        :error="
          !!room.terminal || room.disconnected || !!startNotice || room.failed || results.failed
        " /><UiButton
        variant="ghost"
        v-if="room.terminal || room.disconnected"
        icon="refresh"
        icon-only
        label="重新確認房間座位"
        :pending="room.connecting"
        @click="room.reconnect()"
    /></div>
    <RoomSceneLayout
      :connected="connected"
      :focused="focus"
      roster-class="vue-draw-roster-panel"
      main-class="vue-draw-main"
      side-class="vue-draw-side"
      class="vue-draw-grid"
      :data-phase="state?.phase"
      :data-role="artist ? 'artist' : 'guesser'"
    >
      <template #roster
        ><RoomRoster
          :show-metric="state?.phase !== 'waiting'"
          :snapshot="state"
          :max-players="8"
          :actor-id="state?.presenterId"
          :loading="!state"
          :status="
            (player) => (state ? drawPlayerStatus(player, state, room.disconnected) : '正在讀取')
          "
          ><template #feedback="{ player }"
            ><span
              v-if="badges[player.id]"
              :key="badges[player.id].key"
              class="vue-draw-correct-badge"
              :data-correct-badge="player.id"
              >✓ +{{ badges[player.id].points }} 分</span
            ></template
          ><template #actions
            ><UiButton
              variant="ghost"
              v-if="room.host && setup"
              icon="add"
              label="加入電腦玩家"
              :disabled="room.busy || !setup || !botAllowed || (state?.players.length || 0) >= 8"
              @click="room.command('bot', {})" /></template></RoomRoster
      ></template>
      <template #default
        ><section class="vue-draw-board-panel"
          ><header
            v-if="state && ['choosing', 'drawing'].includes(state.phase)"
            class="vue-draw-board-heading vue-draw-approved-hud"
            ><div class="vue-draw-hud-prompt"
              ><small>{{
                state.phase === 'choosing'
                  ? '畫者選題中'
                  : artist
                    ? '你的專屬秘密題目'
                    : '未公開的題目'
              }}</small
              ><h1>{{
                state.phase === 'choosing'
                  ? artist
                    ? '輪到你挑題'
                    : '等待畫者挑選'
                  : artist
                    ? boardTitle
                    : '●'.repeat(Math.min(16, hint?.length || 3))
              }}</h1
              ><span v-if="hint && state.phase === 'drawing'"
                >{{ hint.length }} 字 · {{ hint.topic }}</span
              ><span v-if="artist && state.phase === 'drawing'" class="vue-draw-hud-rule"
                >禁止直接寫出答案</span
              ></div
            ><RoomCountdown
              :deadline="state.deadline"
              :epoch="state.canvasEpoch + ':' + state.phase"
              :duration="duration"
              :offset="room.clockOffset"
              :caption="countdownCaption"
              :urgent="state.phase === 'drawing'"
              :now="now" /><div class="vue-draw-round-tools"
              ><UiButton
                variant="ghost"
                icon="help"
                icon-only
                caption="提示"
                label="題庫提示"
                :disabled="state.phase !== 'drawing' || !hint"
                @click="hintDialog?.open()" /><UiButton
                variant="ghost"
                icon="next"
                icon-only
                caption="跳過"
                :label="artist ? '跳過此題' : '跳過此輪'"
                :disabled="!canSkip || room.busy"
                @click="skip" /></div></header
          ><DrawingSurface
            :code="room.code"
            :scope="room.scope"
            :seat="room.seat"
            :snapshot="state"
            :busy="room.busy"
            :request="room.request"
            @snapshot="room.accept"
            @tick="tick"
            @stream="stream = $event"
            @disconnected="room.lostConnection"
            ><DrawScene
              v-if="state"
              :snapshot="state"
              @start="start"
              @next="room.command('action', { action: 'next' })"
              @gallery="saveArtwork"
              @review="gallery?.open($event)"
              @settings="showSettings"
            /><p v-else>正在讀取房間與畫布…</p></DrawingSurface
          ><p class="vue-draw-board-footer">{{
            state?.phase === 'drawing' && artist
              ? '你正在作畫中。請發揮創意，禁止直接寫出答案。'
              : '看畫作猜答案；房間閒聊不會送成猜題。'
          }}</p></section
        ><DrawGuessPanel
          v-if="state && ['drawing', 'reveal'].includes(state.phase)"
          :snapshot="state"
      /></template>
      <template #side="{ chatVisible }"
        ><Teleport
          :to="state?.phase === 'waiting' ? '#room-waiting-settings-draw' : 'body'"
          :disabled="state?.phase !== 'waiting'"
          defer
          ><section
            v-if="state"
            v-show="setup"
            ref="settingsSection"
            tabindex="-1"
            class="vue-draw-settings-panel"
            ><DrawSettings ref="settings" :snapshot="state" /><UiButton
              variant="primary"
              v-if="room.gameManager"
              :icon="state.phase === 'finished' ? 'replay' : 'play'"
              :label="state.phase === 'finished' ? '再玩一局' : '開始遊戲'"
              :pending="preparing || room.busy"
              :disabled="state.phase !== 'finished' && state.players.length < 2"
              @click="start" /></section></Teleport
        ><RoomChat ref="chat" :panel-visible="chatVisible"
          ><template #tools><RoomMedia :connected="connected" /></template></RoomChat
      ></template> </RoomSceneLayout
    ><RoomEffects :connected="connected" /><RoomPings />
  </div>
  <UiDialog ref="help" title="你畫，我們猜。"
    ><ol class="vue-draw-help"
      ><li>2–8 位玩家輪流當畫者；房主可選題目類別、60／90／120 秒，以及固定題數或目標分數。</li
      ><li
        >畫者有 15
        秒從最多三題選一；只有畫者知道答案。可用畫筆、橡皮擦與形狀作畫，不能匯入照片或直接寫出答案。</li
      ><li
        >猜題請使用作答區，可重複猜；每輪只計第一次答對。越早猜中分數越高（30–100），每人猜中讓畫者另得
        15 分。</li
      ><li>時間到或全部猜中後揭曉；新加入的朋友從下一輪開始猜題。同分共同獲勝。</li
      ><li>最近畫作保留八輪，可投票、收藏、下載與分享；回看不會暫停全桌。</li></ol
    ><a href="/draw-words">前往共編題庫</a></UiDialog
  >
  <UiDialog ref="hintDialog" title="題庫提示" compact @closed="hintClosed"
    ><template v-if="hint"
      ><strong>{{ hint.length }} 字 · {{ hint.category }}</strong
      ><p>{{ hint.topic }}</p
      ><template v-if="artist"
        ><p>{{ state?.question?.title }}</p
        ><small>只有當輪畫者可見題目；請使用畫作表達。</small></template
      ><template v-else
        ><p>可依字數與類別思考，或請畫者再加一筆。</p
        ><UiButton
          icon="chat"
          label="要求加筆（填入聊天室）"
          @click="askHint" /></template></template
  ></UiDialog>
  <Teleport to="body"
    ><div
      v-if="locked"
      class="vue-draw-lock"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-game-focus-overlay
      ><small>題目已鎖定</small><strong>{{ locked }}</strong
      ><p>正在為你展開畫板與調色盤…</p></div
    ></Teleport
  ><ConfirmDialog ref="confirm" />
</template>
