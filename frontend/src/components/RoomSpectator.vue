<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue';
import { requestJson, ApiError } from '../services/http';
import { gamePath, type RoomSnapshot } from '../contracts/room';
import { readSpectatorSnapshot, type SpectatorSnapshot } from '../contracts/spectator';
import { readChatMessages } from '../contracts/social';
import { record } from '../services/validation';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiLink from './UiLink.vue';
import UiPanel from './UiPanel.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';
import StatusSlot from './StatusSlot.vue';
import RoomCountdown from './RoomCountdown.vue';
import SpectatorCanvas from './SpectatorCanvas.vue';
import GameSongClip from './GameSongClip.vue';
import RoomFullscreenToggle from './RoomFullscreenToggle.vue';
import SpectatorRoomMusic from './SpectatorRoomMusic.vue';
import RoomHeader from './RoomHeader.vue';
import RoomSceneLayout from './RoomSceneLayout.vue';
import RoomRoster from './RoomRoster.vue';
import UiPopover from './UiPopover.vue';
import '../styles/game-room.scss';
import '../styles/room-social.scss';
import '../styles/spectator.scss';
const QuacksSpectatorScene = defineAsyncComponent(
  () => import('../pages/quacks/QuacksSpectatorScene.vue'),
);
const QuacksGlyph = defineAsyncComponent(() => import('../pages/quacks/QuacksGlyph.vue'));
const PokerScene = defineAsyncComponent(() => import('../pages/poker/PokerScene.vue'));
const MusicTimeline = defineAsyncComponent(() => import('../pages/musicquiz/MusicTimeline.vue'));
const CeoScene = defineAsyncComponent(() => import('../pages/ceo/CeoScene.vue'));
const CeoWaiting = defineAsyncComponent(() => import('../pages/ceo/CeoWaiting.vue'));
const AthleteScene = defineAsyncComponent(() => import('../pages/second-wind/AthleteScene.vue'));
const AthleteWaiting = defineAsyncComponent(
  () => import('../pages/second-wind/AthleteWaiting.vue'),
);
const LoungeStage = defineAsyncComponent(() => import('../pages/lounge/LoungeStage.vue'));
const MinimalScene = defineAsyncComponent(() => import('../pages/minimal/MinimalScene.vue'));
const MusicQuizScene = defineAsyncComponent(() => import('../pages/musicquiz/MusicQuizScene.vue'));
const BluffScene = defineAsyncComponent(() => import('../pages/bluff/BluffScene.vue'));
const DrawSpectatorScene = defineAsyncComponent(
  () => import('../pages/draw/DrawSpectatorScene.vue'),
);
const TournamentScene = defineAsyncComponent(() => import('../pages/majority/TournamentScene.vue'));
const MajorityScene = defineAsyncComponent(() => import('../pages/majority/MajorityScene.vue'));
const GiftScene = defineAsyncComponent(() => import('../pages/gift/GiftScene.vue'));
const DecryptoScene = defineAsyncComponent(() => import('../pages/decrypto/DecryptoScene.vue'));
const TelephoneScene = defineAsyncComponent(() => import('../pages/telephone/TelephoneScene.vue'));
const TrpgScene = defineAsyncComponent(() => import('../pages/trpg/TrpgScene.vue'));
const RaceCrewDice = defineAsyncComponent(() => import('../pages/race/RaceCrewDice.vue'));
const RaceSpectatorScene = defineAsyncComponent(
  () => import('../pages/race/RaceSpectatorScene.vue'),
);
const props = defineProps<{ code: string }>();
const state = ref<SpectatorSnapshot | null>(null),
  error = ref('正在連接觀戰畫面…'),
  now = ref(Date.now()),
  offset = ref(0),
  foreground = ref(!document.hidden),
  terminal = ref(false);
const following = ref('');
const focused = ref(false),
  headerIntegrated = ref(false);
const media = ref<InstanceType<typeof UiPopover> | null>(null);
const emoji = ref<InstanceType<typeof UiPopover> | null>(null);
const followed = computed(() => state.value?.players.find((p) => p.id === following.value));
const timeline = computed(() =>
  state.value?.musicTimelines.find((entry) => entry.playerId === following.value),
);
const roster = computed<RoomSnapshot | null>(() => {
  const s = state.value;
  if (!s) return null;
  return {
    code: s.code,
    type: s.type,
    phase: s.phase,
    serverNow: s.serverNow,
    me: following.value,
    host: false,
    hostId: s.players.find((p) => p.host)?.id,
    players: s.players.map((p) => ({ ...p, roomRole: null, kicked: false })),
  };
});
const raceTeams = computed(
  () =>
    new Map(
      (state.value?.raceBoard?.players || []).map((player, index) => [
        player.id,
        { player, index },
      ]),
    ),
);
const sharedScene = computed(() => {
  const s = state.value;
  return !!(
    s &&
    (s.pokerTable ||
      s.nativeGame ||
      s.trpgScene ||
      s.minimalScene ||
      s.telephoneScene ||
      s.decryptoScene ||
      s.giftScene ||
      s.majorityScene ||
      s.bluffScene ||
      s.musicScene ||
      s.drawScene ||
      s.type === 'lounge')
  );
});
const visibleSections = computed(() =>
  (sharedScene.value ? [] : state.value?.sections || []).filter(
    (section) => !section.playerId || (section.playerId === following.value && !timeline.value),
  ),
);
const visiblePots = computed(() =>
  (state.value?.pots || []).filter((pot) => !pot.playerId || pot.playerId === following.value),
);
const draft = ref('');
const sending = ref(false);
const chatError = ref('');
let chatRetry: { message: string; requestId: string } | null = null;
async function sendChat() {
  const message = draft.value.trim();
  const current = state.value;
  if (!current || !message || sending.value) return;
  if (chatRetry?.message !== message) chatRetry = { message, requestId: crypto.randomUUID() };
  sending.value = true;
  chatError.value = '';
  try {
    const reply = record(
      await requestJson('/api/watch/chat', {
        method: 'POST',
        body: { code: current.code, ...chatRetry },
      }),
    );
    if (state.value?.code === current.code) state.value.messages = readChatMessages(reply.messages);
    if (draft.value.trim() === message) draft.value = '';
    chatRetry = null;
  } catch (cause) {
    chatError.value = cause instanceof Error ? cause.message : '訊息未送出。';
  } finally {
    sending.value = false;
  }
}
const columns = computed(() => {
  const cells = state.value?.track?.cells || [];
  return {
    min: cells.length ? Math.min(...cells.map((c) => c.column)) : 0,
    max: cells.length ? Math.max(...cells.map((c) => c.column)) : 0,
  };
});
let timer: ReturnType<typeof setTimeout> | null = null,
  clock: ReturnType<typeof setInterval> | null = null,
  job: AbortController | null = null,
  presence: EventSource | null = null,
  disposed = false,
  generation = 0;
function leavePresence() {
  presence?.close();
  presence = null;
}
function stop() {
  generation++;
  if (timer) clearTimeout(timer);
  if (clock) clearInterval(clock);
  timer = clock = null;
  job?.abort();
  job = null;
}
function suspend() {
  stop();
  leavePresence();
}
async function refresh() {
  if (disposed || job || document.hidden || terminal.value) return;
  const controller = new AbortController(),
    token = generation;
  job = controller;
  const timeout = setTimeout(
    () => controller.abort(new DOMException('觀戰讀取逾時，正在重試。', 'TimeoutError')),
    10000,
  );
  try {
    const next = readSpectatorSnapshot(
      await requestJson('/api/watch?code=' + encodeURIComponent(props.code), {
        signal: controller.signal,
      }),
    );
    if (disposed || token !== generation || controller.signal.aborted) return;
    if (next.code !== props.code.toUpperCase()) throw Error('收到其他房間的觀戰資料。');
    if (
      state.value?.gameRevision !== next.gameRevision ||
      !next.players.some((p) => p.id === following.value)
    )
      following.value =
        (next.players.find((p) => p.status === '目前操作中') || next.players[0])?.id || '';
    presence ??= new EventSource('/api/watch/events?code=' + encodeURIComponent(next.code));
    state.value = next;
    now.value = Date.now();
    offset.value = now.value - next.serverNow;
    error.value = '';
    history.replaceState(null, '', '/' + gamePath(next.type) + '/' + next.code + '?watch=1');
  } catch (cause) {
    if (
      disposed ||
      token !== generation ||
      (cause instanceof DOMException && cause.name === 'AbortError')
    )
      return;
    error.value = cause instanceof Error ? cause.message : '觀戰連線中斷，正在重試。';
    // A revoked session or removed room must not keep displaying the last private room's result.
    if (cause instanceof ApiError && [401, 403, 404, 409].includes(cause.status)) {
      state.value = null;
      leavePresence();
      terminal.value = true;
      if (clock) clearInterval(clock);
      clock = null;
    }
  } finally {
    clearTimeout(timeout);
    if (job === controller) {
      job = null;
      if (!disposed && foreground.value && !terminal.value)
        timer = setTimeout(refresh, following.value || state.value?.type === 'draw' ? 1000 : 2500);
    }
  }
}
function visibility() {
  foreground.value = !document.hidden;
  stop();
  if (foreground.value && !disposed && !terminal.value) {
    clock = setInterval(() => (now.value = Date.now()), 250);
    void refresh();
  }
}
function retry() {
  terminal.value = false;
  visibility();
}
const card = (n: number | null) =>
  n === null
    ? '背面'
    : `${['♣', '♦', '♥', '♠'][Math.floor(n / 13)]}${['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'][n % 13]}`;
onMounted(() => {
  visibility();
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', visibility);
  window.addEventListener('online', retry);
});
onBeforeUnmount(() => {
  disposed = true;
  suspend();
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('pagehide', suspend);
  window.removeEventListener('pageshow', visibility);
  window.removeEventListener('online', retry);
});
</script>
<template>
  <div
    class="vue-game-workspace vue-room-shell has-room-space vue-room-observer"
    :class="{ 'is-header-integrated': headerIntegrated }"
    :data-room-kind="state?.type"
    :data-room-phase="state?.phase"
  >
    <RoomHeader
      :title="state?.title || '房間觀戰'"
      :focused="focused"
      :observer-code="code"
      @integrated="headerIntegrated = $event"
    >
      <UiLink
        v-if="state"
        :href="'/' + gamePath(state.type) + '?learn=1&amp;from=game&amp;room=' + code"
        label="試玩教學"
        icon="play"
        variant="ghost"
      />
      <RoomFullscreenToggle @update:focused="focused = $event" />
      <UiLink href="/" icon="leave" label="離開觀戰" caption="離開" variant="danger" />
    </RoomHeader>
    <div class="vue-game-room-feedback vue-room-status-row">
      <div class="vue-room-phase-slot">
        <span class="vue-game-phase">{{ state?.phaseLabel || '連接中' }}</span>
        <span class="vue-game-round">{{
          state?.round ? '第 ' + state.round + ' 輪' : '等待開桌'
        }}</span>
        <span v-if="followed" class="ui-sr-only" role="status">{{ followed.name }}的視角</span>
      </div>
      <StatusSlot :message="error" persistent :error="!!error && error !== '正在連接觀戰畫面…'" />
      <UiButton v-if="terminal" icon="refresh" label="重新連接觀戰" @click="retry" />
    </div>
    <RoomSceneLayout v-if="state" :connected="!error" :focused="focused" observer>
      <template #roster>
        <RoomRoster
          :snapshot="roster"
          :followed-id="following"
          :max-players="state.type === 'thunder' ? 4 : state.type === 'poker' ? 8 : undefined"
          :actor-id="state.raceBoard?.actorId"
          :status="(player) => (typeof player.status === 'string' ? player.status : '')"
          @view="following = $event"
        >
          <template v-if="raceTeams.size" #metric="{ player }">
            <RaceCrewDice
              v-if="raceTeams.has(player.id)"
              :player="raceTeams.get(player.id)!.player"
              :variant="raceTeams.get(player.id)!.index"
            />
          </template>
        </RoomRoster>
      </template>
      <RoomCountdown
        v-if="state.deadline && state.type !== 'thunder' && !sharedScene"
        :deadline="state.deadline"
        :duration="state.duration"
        :offset="offset"
        :now="now"
        :epoch="state.type + ':' + state.gameRevision + ':' + state.deadline"
        caption="本階段剩餘"
      />
      <RaceSpectatorScene
        v-if="state.type === 'thunder'"
        :snapshot="state"
        :followed="following"
        :now="now"
        :offset="offset"
      />
      <PokerScene
        v-if="state.pokerTable"
        :observer="{ state: { ...state.pokerTable, me: following }, now, offset }"
      />
      <LoungeStage v-if="state.type === 'lounge'" :title="state.roomMusic?.title" />
      <MinimalScene
        v-if="state.minimalScene"
        :observer="state.minimalScene"
        :observer-clock-offset="offset"
        :observer-now="now"
      />
      <TelephoneScene
        v-if="state.telephoneScene"
        :observer="state.telephoneScene"
        :observer-clock-offset="offset"
        :observer-now="now"
      />
      <DecryptoScene
        v-if="state.decryptoScene"
        :observer="state.decryptoScene"
        :focus="following"
      />
      <GiftScene v-if="state.giftScene" :observer="state.giftScene" :following="following" />
      <TournamentScene
        v-if="state.majorityScene?.tournament && state.phase !== 'waiting'"
        :observer="state.majorityScene"
        :clips="state.clips"
        :observer-clock-offset="offset"
        :observer-now="now"
      />
      <MajorityScene
        v-else-if="state.majorityScene"
        :observer="state.majorityScene"
        :observer-clock-offset="offset"
        :observer-now="now"
      />
      <BluffScene
        v-if="state.bluffScene"
        :observer="state.bluffScene"
        :observer-clock-offset="offset"
        :observer-now="now"
      />
      <MusicQuizScene
        v-if="state.musicScene"
        :observer="state.musicScene"
        :following="following"
        :observer-clock-offset="offset"
      />
      <DrawSpectatorScene
        v-if="state.drawScene"
        :snapshot="state.drawScene"
        :drawing="state.drawing"
        :duration="state.duration"
        :offset="offset"
        :now="now"
        :following="following"
        :hint="state.sections.find((section) => section.title === '本輪題目')?.lines[1]"
      />
      <QuacksSpectatorScene
        v-if="state.quacksScene"
        :state="state.quacksScene"
        :following="following"
      />
      <TrpgScene v-if="state.trpgScene" :observer="{ ...state.trpgScene, me: following }" />
      <template v-if="state.nativeGame?.type === 'ceo'">
        <CeoWaiting v-if="state.nativeGame.phase === 'waiting'" />
        <CeoScene v-else :observer="{ ...state.nativeGame, me: following }" />
      </template>
      <template v-if="state.nativeGame?.type === 'second-wind'">
        <AthleteWaiting
          v-if="state.nativeGame.phase === 'waiting'"
          :roster="
            {
              base: '36 名初代角色',
              mixed: '72 名混合角色',
              'second-wind': '36 名 Second Wind 角色',
            }[state.nativeGame.options?.racerSet || 'second-wind']
          "
        />
        <AthleteScene
          v-else-if="state.nativeGame.game"
          :observer="{ ...state.nativeGame, me: following }"
        />
        <UiPanel v-else title="等待下一局"><p>等待房主開始下一局。</p></UiPanel>
      </template>
      <UiPanel
        v-if="timeline && followed && !state.musicScene"
        :title="followed.name + ' 的年代時間軸'"
      >
        <MusicTimeline :cards="timeline.cards" />
        <p v-if="!timeline.cards.length">還沒有公開的年代卡。</p>
      </UiPanel>
      <UiPanel
        v-if="followed && state.type !== 'thunder' && !sharedScene && !state.quacksScene"
        :title="followed.name + '的公開資訊'"
        density="compact"
      >
        <p
          >{{ followed.status }} · {{ followed.online ? '在線' : '暫時離線'
          }}<template v-if="followed.score !== null"> · {{ followed.score }} 分</template></p
        >
        <p v-for="(line, i) in followed.lines" :key="i">{{ line }}</p>
        <div v-if="followed.cards.length" class="vue-spectator-cards" aria-label="已公開的手牌">
          <span v-for="(value, i) in followed.cards" :key="i">{{ card(value) }}</span>
        </div>
      </UiPanel>
      <UiPanel v-if="state.type === 'poker' && !state.pokerTable" title="公共牌"
        ><div class="vue-spectator-cards"
          ><span v-for="(value, i) in state.cards" :key="i">{{ card(value) }}</span
          ><p v-if="!state.cards.length">尚未翻開公共牌</p></div
        ></UiPanel
      >
      <UiPanel v-if="state.drawing && !state.drawScene" title="本輪公開畫布"
        ><SpectatorCanvas
          :key="state.drawing.epoch"
          :epoch="state.drawing.epoch"
          :strokes="state.drawing.strokes"
          :live="state.phase === 'drawing'"
          label="目前公開畫布"
      /></UiPanel>
      <UiPanel
        v-if="state.track && state.type !== 'thunder' && !sharedScene"
        :title="state.track.title"
        ><div
          class="vue-spectator-track"
          :style="{
            gridTemplateColumns: `repeat(${columns.max - columns.min + 1}, minmax(6rem, 1fr))`,
          }"
          role="img"
          :aria-label="state.track.title + ' 的公開位置'"
          ><div
            v-for="cell in state.track.cells"
            :key="cell.row + ':' + cell.column"
            class="vue-spectator-cell"
            :style="{ gridColumn: cell.column - columns.min + 1, gridRow: cell.row + 1 }"
            ><small>{{ cell.label }} · {{ cell.column }}</small
            ><p v-for="(name, i) in cell.names" :key="i">{{ name }}</p></div
          ></div
        ></UiPanel
      >
      <section
        v-if="visiblePots.length && !state.quacksScene"
        class="vue-spectator-grid"
        aria-label="公開藥鍋"
        ><UiPanel v-for="(pot, i) in visiblePots" :key="i" :title="pot.name"
          ><p v-if="pot.hidden">本輪進度保密，結算後公開。</p
          ><template v-else
            ><p>位置 {{ pot.position }}</p
            ><ol class="vue-spectator-chips"
              ><li v-for="(chip, j) in pot.chips" :key="j"
                ><QuacksGlyph
                  :chip="chip"
                  :hint="chip.effect || (chip.label || chip.color) + ' ' + chip.value"
                  :size="40"
                /><template v-if="chip.position !== undefined">
                  · {{ chip.position }} 格</template
                ></li
              ></ol
            ><p v-if="!pot.chips.length">鍋中尚未放入藥材</p></template
          ></UiPanel
        ></section
      >
      <UiPanel
        v-for="(drawing, i) in state.minimalScene ? [] : state.drawings"
        :key="i"
        :title="drawing.title"
        ><svg
          viewBox="0 0 512 256"
          class="vue-spectator-shapes"
          role="img"
          :aria-label="drawing.title + ' 的公開畫作'"
        >
          <template v-for="(shape, j) in drawing.shapes" :key="j">
            <line
              v-if="shape.kind === 'line'"
              :x1="shape.x1"
              :y1="shape.y1"
              :x2="shape.x2"
              :y2="shape.y2"
            />
            <circle v-else :cx="shape.cx" :cy="shape.cy" :r="shape.r" />
          </template></svg
      ></UiPanel>
      <UiPanel
        v-for="(section, i) in visibleSections"
        :key="state.type + ':' + i"
        :title="section.title"
        ><p v-if="!section.lines.length && !section.items.length">尚無公開資料。</p
        ><UiList v-if="section.lines.length"
          ><UiListRow v-for="(line, j) in section.lines" :key="j">{{ line }}</UiListRow></UiList
        ><dl v-if="section.items.length" class="vue-spectator-items"
          ><div v-for="(item, j) in section.items" :key="j"
            ><dt>{{ item.label }}</dt
            ><dd v-if="item.detail">{{ item.detail }}</dd></div
          ></dl
        ></UiPanel
      >
      <section
        v-if="state.images.length && !state.majorityScene"
        class="vue-spectator-grid"
        aria-label="公開題目圖片"
        ><UiPanel v-for="image in state.images" :key="image.src" :title="image.alt"
          ><img
            class="vue-spectator-question-image"
            :src="image.src"
            :alt="image.alt"
            width="512"
            height="384"
            loading="lazy"
            decoding="async" /></UiPanel
      ></section>
      <UiPanel
        v-for="book in state.telephoneScene ? [] : state.books"
        :key="book.ownerId"
        :title="book.ownerName + ' 的傳遞簿'"
        ><ol class="vue-spectator-pages"
          ><li v-for="(page, i) in book.pages" :key="i"
            ><strong>{{ page.authorName }} · {{ page.kind === 'drawing' ? '畫圖' : '文字' }}</strong
            ><p v-if="page.skipped">本頁略過{{ page.timedOut ? ' · 逾時沒有已同步內容' : '' }}</p
            ><SpectatorCanvas
              v-else-if="page.kind === 'drawing'"
              :strokes="page.strokes"
              :epoch="state.gameRevision + ':' + book.ownerId + ':' + i"
              :label="book.ownerName + ' 第 ' + (i + 1) + ' 頁畫作'"
            /><p v-else>{{ page.text }}</p></li
          ></ol
        ></UiPanel
      >
      <template #side="{ chatVisible }">
        <section
          class="vue-room-chat vue-chat-c01"
          data-ping-anchor="chat"
          aria-label="房間彈幕與閒聊"
        >
          <header class="vue-chat-header">
            <div class="vue-chat-heading">
              <h2>房間彈幕與閒聊</h2>
              <span
                class="vue-chat-connection"
                role="img"
                :data-connected="!error"
                :aria-label="error ? '聊天室連線中斷' : '聊天室已連線'"
              />
            </div>
          </header>
          <div v-show="chatVisible" class="vue-room-chat-content vue-chat-c01-content">
            <ol class="vue-chat-messages" aria-label="聊天訊息" tabindex="0">
              <li v-for="message in state.messages" :key="message.id" class="vue-chat-message">
                <div class="vue-chat-message-copy">
                  <div class="vue-chat-message-meta"
                    ><strong>{{ message.name }}</strong></div
                  >
                  <p>{{ message.message }}</p>
                </div>
              </li>
            </ol>
            <div class="vue-chat-feedback"
              ><StatusSlot :message="chatError" :error="!!chatError"
            /></div>
            <form autocomplete="off" :aria-busy="sending" @submit.prevent="sendChat">
              <div class="vue-chat-tools" aria-label="房間社交工具">
                <UiButton
                  icon="video"
                  label="媒體"
                  aria-haspopup="dialog"
                  @click="media?.open($event.currentTarget as HTMLElement)"
                />
                <UiButton
                  icon="emoji"
                  label="表情"
                  aria-haspopup="dialog"
                  @click="emoji?.open($event.currentTarget as HTMLElement)"
                />
              </div>
              <div class="vue-chat-compose">
                <UiField
                  v-model="draft"
                  label="房間彈幕"
                  label-hidden
                  placeholder="輸入彈幕或閒聊…"
                  maxlength="160"
                  @keydown.enter="$event.isComposing && $event.preventDefault()"
                />
                <UiButton
                  variant="contrast"
                  type="submit"
                  class="vue-chat-send"
                  icon="send"
                  icon-only
                  label="發送房間彈幕"
                  :pending="sending"
                  :disabled="!draft.trim() || !!error"
                />
              </div>
            </form>
          </div>
        </section>
        <UiPopover id="observer-room-media" ref="media" title="房間媒體" keep-mounted>
          <SpectatorRoomMusic
            :music="state.roomMusic"
            :active="foreground && !error"
            :offset="offset"
          />
          <UiPanel v-for="clip in state.clips" :key="clip.key" :title="clip.label">
            <GameSongClip :playback="clip.playback" :active="foreground && !error" />
          </UiPanel>
          <p v-if="!state.roomMusic && !state.clips.length">目前沒有播放中的媒體。</p>
        </UiPopover>
        <UiPopover id="observer-room-emoji" ref="emoji" title="表情">
          <UiButton
            v-for="icon in ['👏', '😂', '🔥', '👍']"
            :key="icon"
            :label="'填入 ' + icon"
            :caption="icon"
            @click="
              draft += icon;
              emoji?.close();
            "
          />
        </UiPopover>
      </template>
    </RoomSceneLayout>
  </div>
</template>
