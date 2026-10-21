<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useMediaStore } from '../stores/media';
import { usePreferencesStore } from '../stores/preferences';
import { useMediaWindow } from '../composables/media-window';
import { formatMediaTime, mediaCurrentKey, mediaPlaybackKey } from '../contracts/media';
import type { MediaOrderIntent, MediaPlayer, MediaPlayerView } from '../contracts/media';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
import FramePicker from './FramePicker.vue';
import OverflowText from './OverflowText.vue';
import UiTabs from './UiTabs.vue';
import UiIcon from './UiIcon.vue';
import '../styles/room-media.scss';
import '../../../public/shared/media-player.js';
const props = withDefaults(defineProps<{ connected?: boolean }>(), { connected: true });
const media = useMediaStore(),
  prefs = usePreferencesStore(),
  id = useId();
const opener = ref<HTMLElement | null>(null),
  dialog = ref<HTMLDialogElement | null>(null),
  audioHost = ref<HTMLElement | null>(null),
  videoHost = ref<HTMLElement | null>(null),
  frameArt = ref<HTMLElement | null>(null),
  queueArea = ref<HTMLElement | null>(null);
const consent = ref<InstanceType<typeof UiDialog> | null>(null),
  picker = ref<InstanceType<typeof FramePicker> | null>(null);
const opened = ref(false),
  mode = ref<'full' | 'compact' | 'bar'>('full'),
  playbackStatus = ref(''),
  track = ref(''),
  url = ref(''),
  sharedClock = ref(0),
  publishing = ref(false),
  targetId = ref('');
const activeTab = ref('player');
const view = ref<MediaPlayerView>({
  videoWanted: false,
  ready: false,
  nativeVideo: false,
  videoFallback: false,
  loading: false,
  publishReason: '目前沒有可同步的媒體。',
});
const geometry = useMediaWindow(dialog, opened, mode),
  frameSurface = ref<Record<string, string>>({});
const style = computed(() => ({ ...geometry.style.value, ...frameSurface.value }));
const item = computed(() => media.snapshot?.current),
  videoActive = computed(
    () => !!item.value && item.value.type === 'video' && view.value.videoWanted && opened.value,
  );
const playing = computed(() => media.snapshot?.playback.state === 'playing');
const tabs = computed(() => [
  { id: 'player', label: '播放中' },
  { id: 'queue', label: '播放清單', count: String(media.snapshot?.queue.length || 0) },
  { id: 'request', label: '點播' },
]);
const syncLabel = computed(() =>
  !props.connected || !media.connected
    ? '連線恢復中'
    : media.loading || publishing.value
      ? '同步中…'
      : view.value.nativeVideo
        ? '原生播放（本機）'
        : !item.value
          ? '尚未播放'
          : playing.value
            ? '全桌播放中'
            : '全桌暫停',
);
const musicEnabled = computed(() => prefs.audio?.music.enabled === true),
  volume = computed(() => Math.round((prefs.audio?.music.volume || 0) * 100));
const consentKey = computed(() =>
  media.snapshot ? `${media.snapshot.roomInstanceId}:${media.snapshot.myPlayerId}` : '',
);
const consents = new Map<string, boolean>();
try {
  const rows = JSON.parse(localStorage.getItem('bga.media.consents.v1') || '[]');
  if (Array.isArray(rows))
    for (const row of rows.slice(-64))
      if (
        Array.isArray(row) &&
        typeof row[0] === 'string' &&
        row[0].length <= 200 &&
        typeof row[1] === 'boolean'
      )
        consents.set(row[0], row[1]);
} catch {
  /* Personal consent can remain in memory. */
}
let player: MediaPlayer | null = null,
  mounted = false,
  disposed = false,
  wantsVideo = false,
  prompt = '',
  lastConsent = '',
  lastItem = '',
  timer: ReturnType<typeof setInterval> | null = null,
  observer: MutationObserver | null = null;
let queuePointer: {
  id: number;
  node: HTMLElement;
  intent: MediaOrderIntent;
  x: number;
  y: number;
  target: string;
  moved: boolean;
} | null = null;
function cancelQueue() {
  const active = queuePointer;
  queuePointer = null;
  targetId.value = '';
  if (active)
    try {
      active.node.releasePointerCapture(active.id);
    } catch {
      /* Capture may already be lost. */
    }
}
function closed() {
  if (dialog.value?.open || !opened.value) return;
  opened.value = false;
  geometry.cancel();
  cancelQueue();
  media.cancelSnapshot();
  wantsVideo = false;
  player?.setWindow(false);
  if (timer) clearInterval(timer);
  timer = null;
  opener.value?.querySelector<HTMLButtonElement>('button')?.focus();
}
function close() {
  if (dialog.value?.open) dialog.value.close();
  closed();
}
async function show(load = true) {
  if (!media.enabled || disposed) return;
  const fresh = !opened.value;
  opened.value = true;
  geometry.layout();
  await nextTick();
  if (disposed || !opened.value) return;
  if (!dialog.value?.open) dialog.value?.show();
  player?.setWindow(true, mode.value === 'bar');
  syncFrame();
  if (!timer)
    timer = setInterval(() => {
      sharedClock.value = media.position();
    }, 500);
  sharedClock.value = media.position();
  if (fresh && load) void media.library();
}
async function open() {
  mode.value = 'full';
  await show();
  const context = media.context;
  await media.load(true);
  if (context !== media.context || !opened.value) return;
  syncPlayback();
  dialog.value?.focus({ preventScroll: true });
}
async function minimize(value: 'compact' | 'bar' | 'full') {
  geometry.cancel();
  cancelQueue();
  mode.value = value;
  await show(false);
  player?.setWindow(true, value === 'bar');
}
function setTab(value: string) {
  if (!['player', 'queue', 'request'].includes(value)) return;
  cancelQueue();
  activeTab.value = value;
}
async function revealQueue() {
  setTab('queue');
  if (mode.value !== 'full') await minimize('full');
}
function syncPlayback() {
  const state = media.snapshot;
  if (!mounted || !state || !player || !props.connected || !media.connected) return;
  if (lastConsent !== consentKey.value) {
    lastConsent = consentKey.value;
    wantsVideo = consents.get(lastConsent) === true;
  }
  const key = mediaCurrentKey(state),
    changed = key !== lastItem;
  lastItem = key;
  player.setMarker(media.marker);
  player.update(state, media.marker, media.serverNow());
  sharedClock.value = media.position();
  if (
    changed &&
    state.current?.type === 'video' &&
    wantsVideo &&
    consents.get(consentKey.value) === true
  )
    void show().then(async () => {
      await nextTick();
      if (
        key === mediaCurrentKey(media.snapshot) &&
        wantsVideo &&
        opened.value &&
        !document.hidden &&
        !view.value.videoWanted
      )
        player?.joinVideo();
    });
  void maybeConsent();
}
async function maybeConsent() {
  if (
    !mounted ||
    !props.connected ||
    !media.connected ||
    !consentKey.value ||
    consents.has(consentKey.value) ||
    document.hidden ||
    prompt ||
    document.querySelector('dialog:modal')
  )
    return;
  prompt = consentKey.value;
  await consent.value?.open(opener.value || undefined);
}
async function chooseVideo(accept: boolean) {
  const key = prompt || consentKey.value;
  if (!key || key !== consentKey.value) return;
  consents.set(key, accept);
  while (consents.size > 64) consents.delete(consents.keys().next().value!);
  try {
    localStorage.setItem('bga.media.consents.v1', JSON.stringify([...consents]));
  } catch {
    /* Never infer acceptance from unavailable storage. */
  }
  prompt = '';
  consent.value?.close();
  wantsVideo = accept;
  if (accept && item.value?.type === 'video') {
    await show();
    await nextTick();
    if (key === consentKey.value && wantsVideo && opened.value) player?.joinVideo();
  } else if (!accept) player?.exitVideo('');
}
function consentClosed() {
  if (prompt && prompt === consentKey.value) void chooseVideo(false);
  prompt = '';
}
function exitVideo() {
  wantsVideo = false;
  player?.exitVideo();
}
function sound() {
  window.AudioSettings?.set('music', { enabled: !musicEnabled.value }, { gesture: true });
}
function setVolume(event: Event) {
  window.AudioSettings?.set(
    'music',
    { volume: Number((event.target as HTMLInputElement).value) / 100 },
    { gesture: true },
  );
}
function selectTrack() {
  if (track.value !== '__upload_music__') return;
  track.value = '';
  window.open('/collection?section=music', '_blank', 'noopener');
}
async function enqueueMusic() {
  if (track.value && track.value !== '__upload_music__')
    await media.command('enqueue', { type: 'music', trackId: track.value });
}
async function enqueueVideo() {
  const value = url.value.trim(),
    context = media.context;
  if (
    value &&
    (await media.command('enqueue', { type: 'video', url: value })) &&
    context === media.context &&
    value === url.value.trim()
  )
    url.value = '';
}
async function publish() {
  if (!player || !media.canControl || media.busy || publishing.value || !opened.value) return;
  const context = media.context,
    revision = media.snapshot?.revision,
    playback = mediaPlaybackKey(media.snapshot);
  publishing.value = true;
  try {
    const positionSec = await player.readPosition();
    if (
      positionSec !== null &&
      context === media.context &&
      revision === media.snapshot?.revision &&
      playback === mediaPlaybackKey(media.snapshot) &&
      media.canControl &&
      opened.value &&
      !document.hidden
    )
      await media.command('seek', { positionSec });
  } finally {
    publishing.value = false;
  }
}
function queueStart(event: PointerEvent, itemId: string) {
  if (
    event.button !== 0 ||
    event.isPrimary === false ||
    queuePointer ||
    !opened.value ||
    mode.value !== 'full'
  )
    return;
  const intent = media.orderIntent(itemId);
  if (!intent || media.busy) return;
  event.preventDefault();
  const node = event.currentTarget as HTMLElement;
  queuePointer = {
    id: event.pointerId,
    node,
    intent,
    x: event.clientX,
    y: event.clientY,
    target: itemId,
    moved: false,
  };
  node.setPointerCapture(event.pointerId);
}
function queueMove(event: PointerEvent) {
  const active = queuePointer;
  if (!active || active.id !== event.pointerId) return;
  if (!media.validOrder(active.intent)) {
    cancelQueue();
    return;
  }
  if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6) return;
  active.moved = true;
  const scroller = queueArea.value,
    box = scroller?.getBoundingClientRect();
  if (scroller && box) {
    if (event.clientY < box.top + 40) scroller.scrollTop -= 24;
    else if (event.clientY > box.bottom - 40) scroller.scrollTop += 24;
  }
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-media-item]');
  if (row && queueArea.value?.contains(row))
    active.target = targetId.value = row.dataset.mediaItem || '';
}
async function queueEnd(event: PointerEvent) {
  const active = queuePointer;
  if (!active || event.pointerId !== active.id) return;
  cancelQueue();
  if (active.moved) await media.reorder(active.intent, active.target);
}
function queueCancel(event: PointerEvent) {
  if (queuePointer?.id === event.pointerId) cancelQueue();
}
async function queueKey(event: KeyboardEvent, itemId: string) {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const intent = media.orderIntent(itemId);
  if (!intent) return;
  const index = intent.orderIds.indexOf(itemId),
    target = intent.orderIds[index + (event.key === 'ArrowUp' ? -1 : 1)];
  if (target) await media.reorder(intent, target);
  if (
    intent.scope === media.orderIntent(itemId)?.scope &&
    intent.roomInstanceId === media.snapshot?.roomInstanceId &&
    opened.value
  ) {
    await nextTick();
    queueArea.value
      ?.querySelector<HTMLElement>(`[data-media-item="${CSS.escape(itemId)}"] button`)
      ?.focus();
  }
}
function syncFrame() {
  const host = frameArt.value;
  if (!mounted || !host) return;
  host.replaceChildren();
  const selected = prefs.media;
  frameSurface.value = {};
  if (selected === 'default') return;
  window.BarrageFrames?.decorate(host, { kind: 'builtin', version: 1, id: selected }, '', '');
  host.querySelector('.barrage-frame-content')?.remove();
  void nextTick().then(() => {
    if (disposed || !opened.value || prefs.media !== selected) return;
    const view = getComputedStyle(host),
      opaque = (value: string) => {
        if (!value || value === 'transparent') return '';
        const rgb = value.match(/^rgba?\(([^)]+)\)$/);
        if (!rgb) return value;
        const channels = rgb[1]
          .split(/[,\s/]+/)
          .filter(Boolean)
          .map(Number);
        return channels.length > 3 && channels[3] === 0
          ? ''
          : `rgb(${channels.slice(0, 3).join(', ')})`;
      };
    const ink = view.getPropertyValue('--barrage-frame-text').trim() || view.color;
    let background = opaque(view.getPropertyValue('--barrage-frame-background').trim()),
      line = view.getPropertyValue('--barrage-frame-line').trim(),
      image = 'none',
      area = 0;
    if (host.classList.contains('barrage-frame-ornate'))
      for (const node of host.querySelectorAll<HTMLElement>('.barrage-frame-art div')) {
        const style = getComputedStyle(node),
          box = node.getBoundingClientRect(),
          size = box.width * box.height,
          fill = opaque(style.backgroundColor);
        if (
          size <= area ||
          parseFloat(style.borderTopWidth) <= 0 ||
          (!fill && style.backgroundImage === 'none')
        )
          continue;
        area = size;
        background = fill;
        image = style.backgroundImage;
        line = opaque(style.borderTopColor) || line;
      }
    const channels = /^#[a-f0-9]{6}$/i.test(ink)
        ? [1, 3, 5].map((index) => parseInt(ink.slice(index, index + 2), 16))
        : (ink.match(/[\d.]+/g) || []).slice(0, 3).map(Number),
      light =
        channels.length === 3 &&
        channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0) >
          140;
    frameSurface.value = {
      '--vue-media-background': background || (light ? '#14202b' : '#fffdf3'),
      '--vue-media-text': ink,
      '--vue-media-line': line || ink,
      '--vue-media-image': image,
    };
  });
}
function visibility() {
  if (document.hidden) {
    geometry.cancel();
    cancelQueue();
  } else void maybeConsent();
}
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !opened.value || document.querySelector('dialog:modal')) return;
  event.preventDefault();
  if (mode.value === 'full' && item.value?.type === 'video') void minimize('bar');
  else close();
}
watch(() => media.receipt, syncPlayback);
watch(
  () => media.marker,
  (value) => player?.setMarker(value),
);
watch(
  () => media.context,
  () => {
    prompt = '';
    consent.value?.close();
    close();
    player?.disconnect();
    lastConsent = lastItem = '';
    wantsVideo = false;
    activeTab.value = 'player';
    playbackStatus.value = track.value = url.value = '';
    void nextTick(() => {
      if (media.enabled && !disposed) void media.load();
    });
  },
);
watch(
  () => [media.snapshot?.revision, media.canManageQueue, media.busy],
  () => {
    if (queuePointer && !media.validOrder(queuePointer.intent)) cancelQueue();
  },
);
watch(() => prefs.media, syncFrame);
watch(
  () => [props.connected, media.connected],
  () => {
    if (!props.connected || !media.connected) {
      close();
      player?.disconnect();
      lastItem = '';
    } else syncPlayback();
  },
);
onMounted(() => {
  mounted = true;
  if (audioHost.value && videoHost.value && window.RoomMediaPlayer)
    player = window.RoomMediaPlayer.create({
      audioHost: audioHost.value,
      videoHost: videoHost.value,
      onStatus: (value) => {
        playbackStatus.value = value;
      },
      onChange: (value) => {
        view.value = value;
      },
      onReport: media.report,
    });
  else playbackStatus.value = '播放器尚未載入，請重新整理後再試。';
  syncPlayback();
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('keydown', escape);
  observer = new MutationObserver(() => {
    const modal = document.querySelector('dialog:modal');
    if (opened.value && modal && !modal.closest('.vue-room-media-scope')) close();
    void maybeConsent();
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
});
onBeforeUnmount(() => {
  disposed = true;
  mounted = false;
  observer?.disconnect();
  geometry.cancel();
  cancelQueue();
  if (timer) clearInterval(timer);
  player?.dispose();
  document.removeEventListener('visibilitychange', visibility);
  document.removeEventListener('keydown', escape);
  dialog.value?.close();
});
</script>

<template>
  <span ref="opener" tabindex="-1"
    ><UiButton
      stitch
      v-if="media.enabled"
      icon="video"
      variant="secondary"
      class="vue-social-tool-trigger"
      caption="媒體"
      label="開啟媒體播放器"
      aria-haspopup="dialog"
      :aria-expanded="opened"
      :aria-controls="id"
      @click="open"
  /></span>
  <Teleport to="body"
    ><div class="vue-room-media-scope vue-page vue-stitch-scope" data-ui-owner="vue">
      <dialog
        :id="id"
        ref="dialog"
        tabindex="-1"
        class="vue-room-media"
        :class="['vue-room-media-' + mode, { 'vue-room-media-themed': prefs.media !== 'default' }]"
        :style="style"
        :aria-labelledby="id + '-title'"
        @close="closed"
      >
        <div ref="frameArt" class="vue-media-frame-art barrage-frame-preview" aria-hidden="true" />
        <header
          class="vue-media-header"
          tabindex="0"
          :aria-describedby="id + '-move'"
          aria-label="移動媒體視窗"
          @pointerdown="geometry.start($event)"
          @pointermove="geometry.move"
          @pointerup="geometry.end"
          @pointercancel="geometry.cancelled"
          @lostpointercapture="geometry.cancelled"
          @keydown="geometry.keyboard($event)"
        >
          <h2 :id="id + '-title'" class="vue-media-window-title"
            ><UiIcon
              class="ui-icon"
              :name="item?.type === 'video' ? 'video' : 'sound'"
            />點播視窗</h2
          >
          <div class="vue-media-window-tools">
            <UiButton
              stitch
              variant="ghost"
              v-show="mode !== 'bar'"
              icon="frame"
              icon-only
              label="選擇自己的播放器外觀"
              @click="picker?.open($event.currentTarget as HTMLElement)"
            />
            <UiButton
              stitch
              variant="ghost"
              icon="cards"
              icon-only
              label="開啟播放清單"
              @click="revealQueue"
            />
            <UiButton
              stitch
              variant="ghost"
              v-show="mode !== 'bar'"
              icon="minimize"
              icon-only
              label="最小化為橫條，繼續播放聲音"
              @click="minimize('bar')"
            />
            <UiButton
              stitch
              variant="ghost"
              v-show="mode !== 'compact' && mode !== 'bar'"
              icon="video"
              icon-only
              label="縮小視窗，保留播放器畫面"
              @click="minimize('compact')"
            />
            <UiButton
              stitch
              variant="ghost"
              v-show="mode !== 'full'"
              icon="expand"
              icon-only
              label="展開媒體視窗"
              @click="minimize('full')"
            />
            <UiButton
              stitch
              variant="ghost"
              data-media-close
              icon="close"
              icon-only
              :label="
                item?.type === 'video' ? '停止自己的影片並關閉視窗' : '關閉媒體視窗，音樂續播'
              "
              @click="close"
            />
          </div>
        </header>
        <span :id="id + '-move'" class="ui-sr-only">拖曳頂端移動，方向鍵微調，Home 重設位置。</span>
        <div class="vue-media-content" :class="{ 'has-video': item?.type === 'video' }">
          <div v-show="item?.type === 'video'" class="vue-media-screen">
            <div v-show="videoActive" ref="videoHost" class="vue-media-video" />
            <div v-if="item?.type === 'video' && !videoActive" class="vue-media-consent"
              ><UiIcon class="ui-icon" name="video" /><p>接受後載入影片。</p
              ><UiButton
                stitch
                variant="primary"
                icon="play"
                :label="consents.get(consentKey) ? '重新加入觀看' : '接受並觀看影片'"
                @click="chooseVideo(true)"
            /></div>
          </div>
          <UiTabs
            class="vue-media-tabs"
            :items="tabs"
            :model-value="activeTab"
            label="媒體播放與點播"
            :id-prefix="id + '-tab'"
            :panel-prefix="id + '-panel'"
            @update:model-value="setTab"
          />
          <div class="vue-media-panels">
            <section
              v-show="activeTab === 'player' || mode === 'compact'"
              :id="id + '-panel-player'"
              class="vue-media-primary"
              role="tabpanel"
              :aria-labelledby="id + '-tab-player'"
            >
              <div class="vue-media-current" :class="{ 'is-music': item?.type === 'music' }"
                ><span v-if="item?.type !== 'video'" class="vue-media-track-icon" aria-hidden="true"
                  ><UiIcon class="ui-icon" name="sound" /></span
                ><div
                  ><h3><OverflowText :text="item?.title || '尚未播放'" /></h3
                  ><p>{{
                    item
                      ? (item.type === 'video' ? 'YouTube 影片' : '歌曲') +
                        ' · ' +
                        item.requestedByName +
                        ' 點播'
                      : '從共用曲庫或 YouTube 加入播放清單'
                  }}</p></div
                ><span class="vue-media-sync-badge">{{ syncLabel }}</span></div
              >
              <div v-show="item?.type === 'music'" ref="audioHost" class="vue-media-audio" />
              <div class="vue-media-controls-body">
                <div class="vue-media-sync"
                  ><p class="vue-media-clock"
                    ><span>全桌進度</span
                    ><output
                      >{{ formatMediaTime(sharedClock) }} /
                      {{
                        item?.durationSec ? formatMediaTime(item.durationSec) : '時長待確認'
                      }}</output
                    ></p
                  ><progress
                    class="vue-media-progress"
                    aria-label="全桌播放進度"
                    :max="item?.durationSec || 1"
                    :value="item?.durationSec ? Math.min(sharedClock, item.durationSec) : 0"
                /></div>
                <div class="vue-media-controls" role="group" aria-label="播放控制與個人音量">
                  <UiButton
                    stitch
                    :variant="playing ? 'secondary' : 'primary'"
                    :icon="playing ? 'pause' : 'play'"
                    icon-only
                    :label="playing ? '全桌暫停' : '全桌播放'"
                    :disabled="
                      !media.canControl || media.busy || (!item && !media.snapshot?.queue.length)
                    "
                    @click="media.command(playing ? 'pause' : 'play')"
                  />
                  <UiButton
                    stitch
                    variant="ghost"
                    icon="replay"
                    icon-only
                    label="全桌回到開頭，保留播放或暫停狀態"
                    :disabled="!media.canControl || media.busy || !item"
                    @click="media.command('seek', { positionSec: 0 })"
                  />
                  <UiButton
                    stitch
                    variant="ghost"
                    icon="next"
                    icon-only
                    label="切換全桌下一筆"
                    :disabled="
                      !media.canControl || media.busy || (!item && !media.snapshot?.queue.length)
                    "
                    @click="media.command('skip')"
                  />
                  <UiButton
                    stitch
                    variant="ghost"
                    icon="stop"
                    icon-only
                    label="停止全桌播放"
                    :disabled="!media.canControl || media.busy || !item"
                    @click="media.command('stop')"
                  />
                  <UiButton
                    stitch
                    variant="ghost"
                    icon="refresh"
                    icon-only
                    label="讓自己的播放器返回全桌進度"
                    :disabled="!item || (item.type === 'video' && !videoActive)"
                    @click="player?.align()"
                  />
                  <UiButton
                    stitch
                    variant="success"
                    icon="share"
                    icon-only
                    label="將自己的播放進度同步至全桌"
                    :disabled="
                      !media.canControl || media.busy || publishing || !!view.publishReason
                    "
                    :aria-describedby="id + '-publish'"
                    :pending="publishing"
                    @click="publish"
                  />
                  <div class="vue-media-volume" role="group" aria-label="個人媒體音量"
                    ><UiButton
                      stitch
                      variant="ghost"
                      :icon="musicEnabled ? 'sound' : 'muted'"
                      icon-only
                      :label="musicEnabled ? '靜音自己的媒體聲音' : '開啟自己的媒體聲音'"
                      :aria-pressed="musicEnabled"
                      @click="sound"
                    /><span class="ui-sr-only">個人媒體音量</span
                    ><input
                      aria-label="個人媒體音量"
                      type="range"
                      min="0"
                      max="100"
                      :value="volume"
                      @input="setVolume"
                    /><output>{{ volume }}%</output></div
                  >
                </div>
                <p :id="id + '-publish'" class="vue-media-publish-reason">{{
                  view.publishReason ||
                  (media.canControl
                    ? '可將自己的原生播放進度同步至全桌。'
                    : '全桌播放由房主或管理者控制；你仍可點播與調整個人音量。')
                }}</p>
                <details class="vue-media-local-options" :open="videoActive && view.videoFallback"
                  ><summary>本機播放與疑難排解</summary
                  ><div
                    ><UiButton
                      stitch
                      variant="secondary"
                      icon="play"
                      label="在自己的裝置播放"
                      :disabled="!item || (item.type === 'video' && !videoActive)"
                      @click="player?.resume()" /><UiButton
                      stitch
                      v-if="videoActive"
                      variant="secondary"
                      icon="close"
                      label="退出自己的影片"
                      @click="exitVideo" /><UiButton
                      stitch
                      v-if="videoActive && view.videoFallback && !view.nativeVideo"
                      variant="secondary"
                      icon="refresh"
                      label="重新載入自己的 YouTube 播放器"
                      @click="player?.joinVideo()" /><UiButton
                      stitch
                      v-if="videoActive && view.videoFallback && !view.nativeVideo"
                      variant="secondary"
                      icon="video"
                      label="使用原生影片播放器"
                      @click="player?.useNativeVideo()" /><UiButton
                      stitch
                      variant="ghost"
                      icon="refresh"
                      label="恢復視窗位置與大小"
                      @click="geometry.reset" /></div
                ></details>
                <div class="vue-media-shortcuts"
                  ><UiButton
                    stitch
                    variant="secondary"
                    icon="cards"
                    :label="'播放清單（' + (media.snapshot?.queue.length || 0) + '）'"
                    @click="setTab('queue')" /><UiButton
                    stitch
                    variant="secondary"
                    icon="add"
                    label="曲庫／YouTube 點播"
                    @click="setTab('request')"
                /></div>
              </div>
            </section>
            <section
              v-show="activeTab === 'queue'"
              :id="id + '-panel-queue'"
              class="vue-media-playlist"
              role="tabpanel"
              :aria-labelledby="id + '-tab-queue'"
            >
              <header class="vue-media-panel-heading"
                ><div
                  ><h3
                    >播放清單
                    <span class="vue-media-queue-count">{{
                      media.snapshot?.queue.length || 0
                    }}</span></h3
                  ><p>{{ item ? '正在播放：' + item.title : '目前尚未播放' }}</p></div
                ><UiButton
                  stitch
                  variant="primary"
                  icon="add"
                  label="點播"
                  @click="setTab('request')"
              /></header>
              <p class="vue-media-permission">{{
                media.canManageQueue
                  ? '從把手拖曳或按上下鍵排序。'
                  : '所有人都可點播；房主或管理者控制全桌播放與清單排序。'
              }}</p>
              <ol ref="queueArea" class="vue-media-queue" aria-label="待播媒體，可捲動查看"
                ><li
                  v-for="(entry, index) in media.snapshot?.queue || []"
                  :key="entry.id"
                  :data-media-item="entry.id"
                  :class="{ 'is-drop-target': targetId === entry.id }"
                  ><UiButton
                    stitch
                    variant="ghost"
                    icon="dragHandle"
                    icon-only
                    :label="'排序：' + entry.title + '；上下鍵移動'"
                    class="vue-media-queue-handle"
                    :disabled="!media.canManageQueue || media.busy"
                    @pointerdown="queueStart($event, entry.id)"
                    @pointermove="queueMove"
                    @pointerup="queueEnd"
                    @pointercancel="queueCancel"
                    @lostpointercapture="queueCancel"
                    @keydown="queueKey($event, entry.id)" /><div
                    ><strong
                      ><span class="vue-media-queue-number">{{ index + 1 }}.</span>
                      <OverflowText :text="entry.title" /></strong
                    ><span
                      ><OverflowText
                        :text="
                          (entry.type === 'video' ? '影片' : '歌曲') + ' · ' + entry.requestedByName
                        " /></span></div
                  ><UiButton
                    stitch
                    variant="ghost"
                    icon="remove"
                    icon-only
                    :label="'移除待播：' + entry.title"
                    :disabled="!media.canManageQueue || media.busy"
                    @click="media.command('remove', { itemId: entry.id })" /></li
                ><li v-if="!media.snapshot?.queue.length" class="vue-media-queue-empty"
                  ><UiIcon class="ui-icon" name="cards" /><p>播放清單目前是空的。</p
                  ><UiButton
                    stitch
                    variant="primary"
                    icon="add"
                    label="加入第一筆點播"
                    @click="setTab('request')" /></li
              ></ol>
            </section>
            <section
              v-show="activeTab === 'request'"
              :id="id + '-panel-request'"
              class="vue-media-request"
              role="tabpanel"
              :aria-labelledby="id + '-tab-request'"
            >
              <header class="vue-media-panel-heading"
                ><h3>點播媒體</h3
                ><UiButton
                  stitch
                  variant="secondary"
                  icon="cards"
                  label="查看播放清單"
                  @click="setTab('queue')"
              /></header>
              <form class="vue-media-entry" @submit.prevent="enqueueMusic"
                ><label :for="id + '-track'">共用音樂庫</label
                ><div
                  ><select
                    :id="id + '-track'"
                    v-model="track"
                    :disabled="media.busy"
                    @change="selectTrack"
                    ><option value="__upload_music__">上傳歌曲 ↗</option
                    ><option value="">選擇歌曲</option
                    ><option v-for="song in media.tracks" :key="song.id" :value="song.id"
                      >{{ song.title }} · {{ song.author }}</option
                    ></select
                  ><UiButton
                    stitch
                    variant="primary"
                    type="submit"
                    icon="add"
                    icon-only
                    label="加入歌曲至播放清單"
                    :disabled="!track || !media.snapshot || media.busy" /><UiButton
                    stitch
                    variant="ghost"
                    icon="refresh"
                    icon-only
                    label="更新共用音樂庫"
                    :pending="media.libraryLoading"
                    @click="media.library" /></div
              ></form>
              <form class="vue-media-entry" @submit.prevent="enqueueVideo"
                ><label :for="id + '-url'">YouTube 網址</label
                ><div
                  ><input
                    :id="id + '-url'"
                    v-model="url"
                    type="url"
                    required
                    placeholder="貼上 YouTube 影片網址"
                    :disabled="media.busy" /><UiButton
                    stitch
                    variant="primary"
                    type="submit"
                    icon="add"
                    icon-only
                    label="加入影片至播放清單"
                    :disabled="!url.trim() || !media.snapshot || media.busy" /></div
              ></form>
              <p class="vue-media-request-note"
                >所有房員都可以點播；影片只在每位玩家同意後載入。上傳歌曲會開啟你的收藏庫。</p
              >
              <a
                class="vue-media-library-link"
                href="/collection?section=music"
                target="_blank"
                rel="noopener"
                >前往音樂收藏庫／上傳歌曲 ↗</a
              >
            </section>
          </div>
          <footer class="vue-media-feedback"
            ><StatusSlot
              :message="
                media.loading
                  ? '正在同步媒體…'
                  : activeTab === 'request' && media.libraryLoading
                    ? '正在讀取曲庫…'
                    : activeTab === 'request' && media.libraryError
                      ? media.libraryError
                      : media.message
              "
              :error="
                media.failed || (activeTab === 'request' && !!media.libraryError)
              " /><StatusSlot :message="playbackStatus"
          /></footer>
        </div>
        <div
          v-for="[edge, label] in geometry.edges"
          v-show="mode === 'full'"
          :key="edge"
          :class="['vue-media-edge', 'vue-media-edge-' + edge]"
          tabindex="0"
          role="separator"
          :aria-label="'調整媒體視窗' + label"
          :aria-orientation="
            edge.length === 1 ? (['n', 's'].includes(edge) ? 'horizontal' : 'vertical') : undefined
          "
          :aria-valuetext="
            Math.round(geometry.box.value.width) +
            ' × ' +
            Math.round(geometry.box.value.height) +
            ' 像素'
          "
          @pointerdown="geometry.start($event, edge)"
          @pointermove="geometry.move"
          @pointerup="geometry.end"
          @pointercancel="geometry.cancelled"
          @lostpointercapture="geometry.cancelled"
          @keydown="geometry.keyboard($event, edge)"
        />
        <FramePicker ref="picker" kind="media" />
      </dialog>
      <UiDialog
        stitch
        ref="consent"
        class="vue-media-consent-dialog"
        title="接受這一桌的影片嗎？"
        compact
        @closed="consentClosed"
        ><p
          >接受後，這一桌點播的 YouTube
          影片會在你的媒體視窗顯示。瀏覽器仍可能需要你按播放器才能開始播放。</p
        ><p>略過就不載入 Google 播放器；之後可從「媒體」重新接受。</p
        ><p
          ><a href="https://policies.google.com/privacy" target="_blank" rel="noopener"
            >Google 隱私權政策</a
          ></p
        ><div class="vue-media-consent-actions"
          ><UiButton
            stitch
            variant="primary"
            label="同意播放（載入影片）"
            @click="chooseVideo(true)" /><UiButton
            stitch
            label="略過（本機不載入）"
            @click="chooseVideo(false)" /></div
      ></UiDialog> </div
  ></Teleport>
</template>
