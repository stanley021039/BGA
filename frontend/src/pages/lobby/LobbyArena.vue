<script setup lang="ts">
import { playActionFeedback } from '../../services/action-sounds';
import {
  arenaZonePoints,
  type ArenaCover,
  type ArenaZoneShape,
  archetypeOptions,
  archetypeNames,
} from '../../contracts/lobby-arena';
import sceneRules from '../../../../public/shared/scene-rules.json';
import AttackChoices from '../../components/AttackChoices.vue';
import UiField from '../../components/UiField.vue';
import SceneHazards from '../../components/SceneHazards.vue';
import AudioSettings from '../../engines/audio-settings.js';
import GameSounds from '../../engines/game-sounds.js';
import { warmArenaCountdown } from '../../services/game-assets';
import type { GameSoundOwner } from '../../contracts/sounds';
import { pickupIcons, pickupLabels, type PickupKind } from '../../contracts/lobby-pickups';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useAttackLoadoutStore } from '../../stores/attack-loadout';
import { useLobbyStore } from '../../stores/lobby';
import { useGameFocus } from '../../composables/game-focus';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import ArenaRoomPicker from './ArenaRoomPicker.vue';
import LobbyArenaPractice from './LobbyArenaPractice.vue';
import LobbyBackdrop from './LobbyBackdrop.vue';
import UiLink from '../../components/UiLink.vue';
import UiHoverInfo from '../../components/UiHoverInfo.vue';
import UiIcon from '../../components/UiIcon.vue';
import '../../styles/lobby-arena.scss';
const lobby = useLobbyStore();
const loadout = useAttackLoadoutStore();
const showBattleStats = ref(false);
const createRoomDialog = ref<InstanceType<typeof UiDialog> | null>(null);
const roomName = ref('');
const createAttempted = ref(false);
function openCreateRoom() {
  roomName.value = '';
  createAttempted.value = false;
  void createRoomDialog.value?.open();
}
function createRoom() {
  createAttempted.value = true;
  void command('create', { roomName: roomName.value.trim() });
}
const roomDialog = ref<InstanceType<typeof UiDialog> | null>(null);
const invitedId = new URLSearchParams(location.search).get('room');
const roomDirectory = computed(() => lobby.snapshot?.arenaRoom);
const roomId = computed(() => roomDirectory.value?.currentId);
const roomList = computed(() => {
  const rooms = roomDirectory.value?.rooms || [];
  return invitedId
    ? [...rooms].sort((a, b) => Number(b.id === invitedId) - Number(a.id === invitedId))
    : rooms;
});
const currentRoom = computed(() => roomList.value.find((room) => room.id === roomId.value));
watch(roomId, () => {
  clean.value = false;
  showBattleStats.value = false;
  inviteStatus.value = '';
  createRoomDialog.value?.close();
  roomDialog.value?.close();
});
const terrainGuide = [
  { kind: 'bush', name: '草叢', effect: '遮蔽視野。進入後最多隱身 1 秒，攻擊會現身。' },
  { kind: 'mud', name: '泥沼', effect: '移動速度降低 50%。' },
  { kind: 'embers', name: '餘燼', effect: '每 0.5 秒扣約 5% 最大血量，離開後 2 秒內再扣約 2%。' },
  { kind: 'portal', name: '蟲洞', effect: '走進圓環會傳送到另一區，部分入口有多個落點。' },
] as const;
const bushPreview = arenaZonePoints('bushGrove', 'bush')
  .map((point) => point.join(','))
  .join(' ');
const pickupGuide: { kind: PickupKind; effect: string }[] = [
  { kind: 'health', effect: '回復 25% 最大血量' },
  { kind: 'speed', effect: '移速 +50%' },
  { kind: 'shield', effect: '承傷 −30%' },
  { kind: 'sword', effect: '傷害 +20%，攻擊型合計 +35%' },
  { kind: 'energy', effect: '大招能量 +25' },
];
const duration = ref(60);
const selectedMap = ref(1);
watch(duration, (seconds) => {
  if (seconds === 60 && selectedMap.value > 2) selectedMap.value = 1;
});
const countdownSounds: GameSoundOwner | undefined = GameSounds?.create();
warmArenaCountdown();
const battleTracks = ['arena-ost.mp3', 'arena-ost-2.mp3', 'arena-ost-3.mp3'];
let track = Math.floor(Math.random() * battleTracks.length);
const battleMusic = new Audio('/assets/game-sounds/' + battleTracks[track]);
battleMusic.preload = 'none';
const loadoutDialog = ref<InstanceType<typeof UiDialog> | null>(null),
  loadoutOpen = ref(false),
  clean = ref(false);
const practice = ref<InstanceType<typeof LobbyArenaPractice> | null>(null);
const { focused, toggle } = useGameFocus('vue-lobby-arena-focus');
const arena = computed(() => lobby.snapshot?.arena);
const mapNotes: Record<number, string> = {
  1: '左上與右下各有三缺口環牆，蟲洞在牆外。',
  2: 'X 型掩體與交錯橫牆，外側有草叢與陷阱。',
  3: '四面可進庭院，外圍有轉角牆和較密的草叢。',
  4: '中央長牆分隔兩側，外圍是錯位屏障。',
  5: '外圍小掩體分散，陷阱較多。',
};
const mapPreview = computed(
  () => arena.value?.maps?.find((map) => map.id === selectedMap.value)?.preview,
);
function previewOutline(zone: ArenaCover, kind: ArenaZoneShape) {
  return arenaZonePoints(zone.shape, kind)
    .map(([x, y]) => `${zone.x + (x * zone.width) / 100},${zone.y + (y * zone.height) / 100}`)
    .join(' ');
}
const match = computed(() => arena.value?.match);
const self = computed(() => match.value?.players.find((p) => p.id === lobby.snapshot?.selfId));
const ownTeam = computed(
  () => arena.value?.teams.find((p) => p.id === lobby.snapshot?.selfId)?.team,
);
const playing = computed(
  () => match.value?.phase === 'running' && !!self.value && !self.value.forfeited,
);
const cleanView = computed(() => clean.value && !!self.value && !self.value.forfeited);
watch(
  playing,
  async (active) => {
    if (active) {
      clean.value = true;
      showBattleStats.value = false;
      loadoutDialog.value?.close();
      await nextTick();
      document.querySelector<HTMLElement>('.lobby-backdrop')?.focus({ preventScroll: true });
    }
  },
  { immediate: true },
);
watch(playing, (value) => document.body.classList.toggle('vue-lobby-battle', value), {
  immediate: true,
});
onBeforeUnmount(() => {
  document.body.classList.remove('vue-lobby-battle');
  countdownSounds?.destroy();
  battleMusic.pause();
  battleMusic.removeEventListener('ended', nextBattleTrack);
  stopMusicSettings?.();
  document.removeEventListener('visibilitychange', syncBattleMusic);
});
const profileValue = computed(() => arena.value?.ownArchetype || 'attack');
const damageFormat = new Intl.NumberFormat('zh-TW', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const formatDamage = (n: number | undefined) => damageFormat.format(n || 0);
const hp = computed(() =>
  ownVisitor.value?.maxHealth
    ? Math.round((100 * (ownVisitor.value.health || 0)) / ownVisitor.value.maxHealth)
    : 0,
);
async function returnLobby() {
  if (playing.value) {
    await lobby.arenaCommand({ action: 'leave', matchId: match.value?.id });
    if (playing.value) return;
  }
  if (roomId.value) {
    await command('leaveRoom');
    if (roomId.value) return;
  }
  location.assign('/');
}
function playAgain() {
  clean.value = false;
  showBattleStats.value = false;
  if (focused.value) toggle();
  void nextTick(() => document.querySelector<HTMLElement>('#arena-setup')?.focus());
}
async function editLoadout() {
  if (ownReady.value) await command('ready', { ready: false });
  loadoutOpen.value = true;
  await nextTick();
  void loadoutDialog.value?.open();
}
const tick = ref(Date.now()),
  receivedAt = ref(Date.now());
watch(
  () => lobby.snapshot,
  () => {
    tick.value = receivedAt.value = Date.now();
  },
);
const ownVisitor = computed(() =>
  lobby.snapshot?.visitors.find((v) => v.id === lobby.snapshot?.selfId),
);
const pickupNow = computed(() => (lobby.snapshot?.serverNow || 0) + tick.value - receivedAt.value);
const pickupMessage = computed(() => {
  const effects = ownVisitor.value?.pickupEffects;
  if (!effects) return '';
  const parts: string[] = [];
  if (effects.last && effects.last.until > pickupNow.value)
    parts.push('已拾取' + pickupLabels[effects.last.kind]);
  if (effects.speedUntil > pickupNow.value)
    parts.push(`加速 ${Math.ceil((effects.speedUntil - pickupNow.value) / 1000)} 秒`);
  if ((effects.attackUntil || 0) > pickupNow.value)
    parts.push(`劍 +20% · ${Math.ceil(((effects.attackUntil || 0) - pickupNow.value) / 1000)} 秒`);
  if (effects.shieldUntil > pickupNow.value)
    parts.push(`護盾 ${Math.ceil((effects.shieldUntil - pickupNow.value) / 1000)} 秒`);
  if (ownVisitor.value?.hazardKind === 'mud') parts.push('泥沼：移速減半');
  if (ownVisitor.value?.hazardKind === 'embers') parts.push('灼傷中');
  return parts.join(' · ');
});
const openingSeconds = computed(() =>
  playing.value
    ? Math.max(0, Math.ceil(((match.value?.startedAt || 0) - pickupNow.value) / 1000))
    : 0,
);
const seconds = computed(() =>
  Math.max(
    0,
    Math.ceil(
      Math.min(
        (match.value?.endsAt || 0) - pickupNow.value,
        (match.value?.endsAt || 0) - (match.value?.startedAt || 0),
      ) / 1000,
    ),
  ),
);
const finalCountdown = computed(() => playing.value && seconds.value > 0 && seconds.value <= 10);
watch(
  [() => match.value?.id, pickupNow, playing, () => lobby.connected],
  ([id, now, active, connected]) => {
    const round = match.value;
    if (!id || !round || !active || !connected || document.hidden || now >= round.endsAt) {
      countdownSounds?.disconnect();
      return;
    }
    const live = countdownSounds?.update(
      { code: id, version: lobby.snapshot?.serverNow || 0 },
      { connected },
    );
    if (!live) return;
    const opening = now < round.startedAt;
    const remaining = (opening ? round.startedAt : round.endsAt) - now;
    if (remaining > (opening ? 5000 : 10000) || remaining < 350) return;
    const second = Math.ceil(remaining / 1000);
    if (remaining - (second - 1) * 1000 < 350) return;
    countdownSounds?.play(
      second === 1 ? 'arena-countdown-bell' : 'arena-countdown',
      id + (opening ? ':opening:' : ':final:') + second,
      { live, retryIfUnavailable: true },
    );
  },
  { immediate: true },
);
const musicEnabled = ref(false);
function syncBattleMusic() {
  const music = AudioSettings?.get()?.music;
  musicEnabled.value = !!music?.enabled;
  const inBattle = playing.value && !openingSeconds.value && seconds.value > 0;
  if (!inBattle || document.hidden || !music?.enabled || !music.volume) {
    battleMusic.pause();
    if (!playing.value) battleMusic.currentTime = 0;
    return;
  }
  battleMusic.volume = music.volume * 0.24;
  if (battleMusic.paused) void battleMusic.play().catch(() => {});
}
function nextBattleTrack() {
  track = (track + 1) % battleTracks.length;
  battleMusic.src = '/assets/game-sounds/' + battleTracks[track];
  syncBattleMusic();
}
battleMusic.addEventListener('ended', nextBattleTrack);
const stopMusicSettings = AudioSettings?.subscribe(syncBattleMusic);
watch([playing, openingSeconds, seconds], syncBattleMusic);
document.addEventListener('visibilitychange', syncBattleMusic);
const clockNeeded = computed(() => {
  const effects = ownVisitor.value?.pickupEffects;
  return (
    match.value?.phase === 'running' ||
    (effects !== undefined &&
      Math.max(
        effects?.last?.until || 0,
        effects?.speedUntil || 0,
        effects?.attackUntil || 0,
        effects?.shieldUntil || 0,
      ) > pickupNow.value)
  );
});
watch(
  clockNeeded,
  (needed, _, cleanup) => {
    if (!needed) return;
    const refresh = () => {
      if (!document.hidden) tick.value = Date.now();
    };
    refresh();
    const timer = setInterval(refresh, 250);
    cleanup(() => clearInterval(timer));
  },
  { immediate: true },
);
const teamName = (team: string) => (team === 'red' ? '綠隊' : '藍隊');
const result = computed(() => {
  const m = match.value;
  if (!m || m.phase !== 'finished') return '';
  if (!m.winners.length) return '本局無勝者';
  const names = m.winners.map((id) =>
    m.mode === 'team' ? teamName(id) : m.players.find((p) => p.id === id)?.name || id,
  );
  return names.join('、') + (names.length > 1 ? ' 並列獲勝' : ' 獲勝');
});
const rankedPlayers = computed(() =>
  (match.value?.players || [])
    .filter((p) => !p.forfeited)
    .sort((a, b) => b.score - a.score || (b.damageDealt || 0) - (a.damageDealt || 0)),
);
const podium = computed(() =>
  [2, 0, 1].flatMap((index) => {
    const player = rankedPlayers.value[index];
    if (!player) return [];
    const image =
      lobby.snapshot?.visitors.find((v) => v.id === player.id)?.image ||
      '/characters/' + encodeURIComponent(player.id) + '?size=256';
    return [{ ...player, rank: index + 1, image }];
  }),
);
const brokenPortraits = ref(new Set<string>());
function alignPodiumPortrait(event: Event) {
  const image = event.currentTarget;
  if (!(image instanceof HTMLImageElement)) return;
  const figure = image.parentElement;
  const canvas = figure?.querySelector('canvas');
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  if (!figure || !canvas || !context) return;
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = width;
  canvas.height = height;
  try {
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    let bottom = height;
    while (bottom > 0) {
      const row = pixels.data.subarray((bottom - 1) * width * 4, bottom * width * 4);
      if (row.some((value, index) => index % 4 === 3 && value > 16)) break;
      bottom--;
    }
    if (!bottom || bottom === height) return;
    canvas.height = bottom;
    context.putImageData(pixels, 0, 0);
    figure.dataset.portraitAligned = '';
  } catch {
    // The original portrait remains visible if its pixels cannot be read.
  }
}
const blocked = computed(() =>
  lobby.snapshot?.attacks.some(
    (a) => a.fromId === lobby.snapshot?.selfId && a.hits?.some((h) => h.blocked),
  ),
);
const totals = computed(() => {
  const m = match.value;
  if (!m) return '';
  return m.mode === 'team'
    ? ['red', 'blue']
        .map(
          (t) =>
            `${teamName(t)} ${m.players.filter((p) => p.team === t && !p.forfeited).reduce((n, p) => n + p.score, 0)} 分`,
        )
        .join('／')
    : m.players.map((p) => `${p.name} ${p.score} 分${p.forfeited ? '（棄權）' : ''}`).join('／');
});
const roster = computed(
  () =>
    arena.value?.teams.map((p) => ({
      ...p,
      name:
        lobby.snapshot?.visitors.find((v) => v.id === p.id)?.name ||
        match.value?.players.find((v) => v.id === p.id)?.name ||
        '離線玩家',
    })) || [],
);
const allReady = computed(() => roster.value.length > 0 && roster.value.every((p) => p.ready));
const ownReady = computed(() =>
  roster.value.some((p) => p.id === lobby.snapshot?.selfId && p.ready),
);
watch(
  [roomId, allReady, ownReady],
  ([id, ready, selfReady], [previousId, previouslyReady, previousSelfReady]) => {
    if (!id || id !== previousId || !lobby.connected || playing.value) return;
    if (ready && !previouslyReady) playActionFeedback('ready');
    else if (selfReady && !previousSelfReady) playActionFeedback();
  },
);
const validInvitation = computed(
  () => lobby.connected && !!invitedId && roomList.value.some((room) => room.id === invitedId),
);
let invitationAnnounced = false;
watch(
  validInvitation,
  (available) => {
    if (!available || invitationAnnounced || roomId.value === invitedId) return;
    invitationAnnounced = true;
    AudioSettings?.playEffect?.('invitation');
  },
  { immediate: true },
);
const inviteStatus = ref('');
const inviteLink = computed(() => {
  const url = new URL('/arena', location.origin);
  if (roomId.value) url.searchParams.set('room', roomId.value);
  return url.href;
});
async function invitePlayers() {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    inviteStatus.value = '邀請連結已複製。傳給想一起玩的玩家。';
  } catch {
    inviteStatus.value = inviteLink.value;
  }
}
const command = (action: string, rest: Record<string, unknown> = {}) =>
  lobby.arenaCommand({ action, ...rest });
function start(mode: string) {
  void command('start', {
    mode,
    matchId: match.value?.id || null,
    durationSeconds: duration.value,
    mapId: selectedMap.value,
  });
}
</script>
<template>
  <LobbyBackdrop v-if="playing" arena-page :arena-warmup="openingSeconds > 0" />
  <section class="arena-page" aria-label="戰鬥競技場">
    <header v-if="!playing" class="arena-page-heading">
      <h1
        ><UiIcon name="shield" class="arena-heading-icon" />{{
          currentRoom?.name || '戰鬥競技場'
        }}</h1
      >
      <UiLink v-if="!cleanView" href="/" label="返回遊戲大廳" variant="ghost" />
    </header>
    <UiPanel v-if="!roomId" title="競技場房間">
      <ArenaRoomPicker
        :rooms="roomList"
        :invited-id="invitedId"
        :disabled="!lobby.connected || lobby.arenaPending"
        @create="openCreateRoom"
        @join="(roomId) => command('join', { roomId })"
      />
      <StatusSlot
        :message="lobby.arenaStatus || lobby.presenceStatus"
        :error="!!lobby.arenaStatus"
        persistent
      />
    </UiPanel>
    <div
      v-if="roomId && (!playing || showBattleStats)"
      class="lobby-arena-content"
      :class="{ 'arena-live-panel': playing, 'arena-setup-grid': !playing && !cleanView }"
    >
      <UiPanel
        v-if="!playing && !(cleanView && match?.phase === 'finished')"
        id="arena-setup"
        class="arena-setup-panel"
        tone="raised"
        tabindex="-1"
        title="開戰設定"
        description="設定角色類型、選隊與配裝。每招命中同一對手最多得 1 分。"
      >
        <UiField
          label="角色類型"
          control="select"
          :model-value="profileValue"
          :options="archetypeOptions"
          :disabled="!lobby.connected || playing || lobby.arenaPending"
          @update:model-value="(value) => command('archetype', { archetype: value })"
        />
        <div class="lobby-arena-actions">
          <UiButton
            label="加入綠隊"
            :aria-pressed="ownTeam === 'red'"
            :disabled="!lobby.connected || playing || lobby.arenaPending"
            @click="command('team', { team: 'red' })"
          />
          <UiButton
            label="加入藍隊"
            :aria-pressed="ownTeam === 'blue'"
            :disabled="!lobby.connected || playing || lobby.arenaPending"
            @click="command('team', { team: 'blue' })"
          />
          <UiButton
            label="隨機選隊"
            :disabled="!lobby.connected || playing || lobby.arenaPending"
            @click="command('team', { team: 'random' })"
          />
          <UiButton
            label="取消報名"
            :disabled="!lobby.connected || playing || !ownTeam || lobby.arenaPending"
            @click="command('team', { team: null })"
          />
        </div>
        <UiField
          label="對戰時間"
          control="select"
          v-model.number="duration"
          :disabled="lobby.arenaPending"
        >
          <option v-for="seconds in [60, 120, 180]" :key="seconds" :value="seconds"
            >{{ seconds }} 秒</option
          >
        </UiField>
        <UiField
          v-if="arena?.maps?.length"
          label="地圖"
          control="select"
          v-model.number="selectedMap"
          :disabled="lobby.arenaPending"
        >
          <option
            v-for="map in arena.maps.filter((map) => duration !== 60 || !map.wide)"
            :key="map.id"
            :value="map.id"
            >{{ map.name || '地圖 ' + map.id }} · {{ map.wide ? '大圖' : '小圖' }}</option
          >
        </UiField>
        <figure v-if="mapPreview" class="arena-map-preview">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="所選地圖的俯視預覽"
          >
            <rect
              v-for="wall in mapPreview.walls"
              :key="wall.id"
              data-terrain="wall"
              :x="wall.x"
              :y="wall.y"
              :width="wall.width"
              :height="wall.height"
            />
            <polygon
              v-for="zone in mapPreview.hazards"
              :key="zone.id"
              :data-terrain="zone.kind"
              :points="previewOutline(zone, zone.kind)"
            />
            <polygon
              v-for="zone in mapPreview.bushes"
              :key="zone.id"
              data-terrain="bush"
              :points="previewOutline(zone, 'bush')"
            />
            <circle
              v-for="portal in mapPreview.portals"
              :key="portal.x + ':' + portal.y"
              data-terrain="portal"
              :cx="portal.x"
              :cy="portal.y"
              r="2.7"
            />
          </svg>
          <p class="arena-map-note">{{ mapNotes[selectedMap] }}</p>
          <figcaption>
            <span data-terrain="wall">牆壁</span>
            <span data-terrain="bush">草叢</span>
            <span data-terrain="mud">泥沼</span>
            <span data-terrain="embers">餘燼</span>
            <span v-if="mapPreview.portals.length" data-terrain="portal">蟲洞</span>
          </figcaption>
        </figure>
        <UiButton label="設定招式" icon="settings" @click="editLoadout" />
        <div class="lobby-arena-actions">
          <UiButton label="邀請玩家" icon="users" @click="invitePlayers" />
          <UiButton label="切換房間" @click="roomDialog?.open()" />
        </div>
        <StatusSlot :message="inviteStatus" persistent />
        <UiList aria-label="報名玩家">
          <UiListRow v-for="p in roster" :key="p.id"
            ><UiBadge :tone="p.team === 'red' ? 'success' : 'info'">{{ teamName(p.team) }}</UiBadge>
            {{ p.name }} <UiBadge>{{ p.ready ? '已準備' : '未準備' }}</UiBadge></UiListRow
          >
          <UiListRow v-if="!roster.length">選隊加入對戰。</UiListRow>
        </UiList>
        <div class="lobby-arena-actions">
          <UiButton
            :label="ownReady ? '取消準備' : '準備'"
            :disabled="!ownTeam || !lobby.connected || lobby.arenaPending"
            @click="command('ready', { ready: !ownReady })"
          />
          <UiButton
            variant="primary"
            label="開始個人 PK"
            :disabled="
              !lobby.connected ||
              !ownTeam ||
              !allReady ||
              roster.length !== 2 ||
              match?.phase === 'running' ||
              lobby.arenaPending
            "
            @click="start('pk')"
          />
          <UiButton
            label="開始團隊戰"
            :disabled="
              !lobby.connected ||
              !ownTeam ||
              !allReady ||
              match?.phase === 'running' ||
              lobby.arenaPending
            "
            @click="start('team')"
          />
          <UiButton label="試玩教學" variant="ghost" @click="practice?.open()" />
        </div>
        <p class="arena-mode-note"
          >全員準備後可開戰。個人 PK 限 2 人。團隊戰每隊最多 8 人，無友傷。</p
        >
      </UiPanel>
      <UiPanel
        v-if="match && (playing || cleanView)"
        :title="match.phase === 'finished' ? '對戰結果' : '本局戰況'"
      >
        <div v-if="match.phase === 'finished'" class="arena-result-hero">
          <UiBadge tone="primary">{{ match.mode === 'pk' ? '個人 PK' : '團隊戰' }}</UiBadge>
          <h3>{{ result }}</h3>
        </div>
        <div
          v-if="match.phase === 'finished' && podium.length"
          class="arena-podium"
          aria-label="個人排名頒獎台"
        >
          <div
            v-for="player in podium"
            :key="player.id"
            class="arena-podium-place"
            :data-rank="player.rank"
          >
            <div class="arena-podium-identity">
              <strong class="arena-podium-name">{{ player.name }}</strong>
              <span>{{ player.score }} 分</span>
            </div>
            <div :key="player.image" class="arena-podium-figure">
              <canvas aria-hidden="true"></canvas>
              <img
                v-if="!brokenPortraits.has(player.id)"
                :src="player.image"
                alt=""
                @load="alignPodiumPortrait"
                @error="brokenPortraits.add(player.id)"
              />
              <UiIcon v-else name="users" />
            </div>
            <div class="arena-podium-step">
              <strong class="arena-podium-rank"
                ><span>第</span><span class="arena-podium-digit">{{ player.rank }}</span
                ><span>名</span></strong
              >
            </div>
          </div>
        </div>
        <p v-if="playing"
          >{{ match.mode === 'pk' ? '個人 PK' : '團隊戰' }} ·
          {{ match.phase === 'running' ? `剩餘 ${seconds} 秒` : result }}</p
        >
        <UiList v-if="playing"
          ><UiListRow v-for="p in match.players" :key="p.id"
            >{{ teamName(p.team) }} · {{ p.name }}：{{ p.score }} 分{{
              p.forfeited ? '（棄權）' : ''
            }}</UiListRow
          ></UiList
        >
        <UiPanel v-if="match.phase === 'finished'" title="對戰明細" density="compact"
          ><div class="lobby-arena-results"
            ><table aria-label="本局玩家總傷害與總承傷"
              ><thead
                ><tr
                  ><th scope="col">玩家</th><th scope="col">得分</th><th scope="col">總傷害</th
                  ><th scope="col">總承傷</th></tr
                ></thead
              ><tbody
                ><tr
                  v-for="p in [...rankedPlayers, ...match.players.filter((p) => p.forfeited)]"
                  :key="p.id"
                  :data-rank="p.forfeited ? undefined : rankedPlayers.indexOf(p) + 1"
                  ><th scope="row"
                    ><span v-if="!p.forfeited" class="arena-result-rank">{{
                      rankedPlayers.indexOf(p) + 1
                    }}</span
                    >{{ p.name
                    }}<span v-if="p.archetype"> · {{ archetypeNames[p.archetype] }}</span>
                    <UiBadge
                      v-if="match.mode === 'team'"
                      class="arena-result-team"
                      :tone="p.team === 'red' ? 'success' : 'info'"
                      nowrap
                      >{{ teamName(p.team) }}</UiBadge
                    ></th
                  ><td>{{ p.score }}</td>
                  <td>{{ formatDamage(p.damageDealt) }}</td>
                  <td>{{ formatDamage(p.damageTaken) }}</td></tr
                ><tr
                  v-if="match.mode === 'team'"
                  v-for="team in ['red', 'blue']"
                  :key="team"
                  class="arena-result-total"
                  :data-team="team"
                  ><th scope="row">{{ teamName(team) }}合計</th
                  ><td>{{
                    match.players
                      .filter((p) => p.team === team && !p.forfeited)
                      .reduce((sum, p) => sum + p.score, 0)
                  }}</td
                  ><td>{{
                    formatDamage(
                      match.players
                        .filter((p) => p.team === team)
                        .reduce((n, p) => n + (p.damageDealt || 0), 0),
                    )
                  }}</td
                  ><td>{{
                    formatDamage(
                      match.players
                        .filter((p) => p.team === team)
                        .reduce((n, p) => n + (p.damageTaken || 0), 0),
                    )
                  }}</td></tr
                ></tbody
              ></table
            ></div
          ><p>依實際扣血計算，承傷包含陷阱。</p></UiPanel
        >
        <p v-if="playing">{{ totals }}</p>
        <p v-if="playing && pickupMessage">{{ pickupMessage }}</p>
        <p v-if="playing && blocked">攻擊被掩體擋下。</p>
        <p v-if="match.phase === 'running' && seconds === 0">結算中…</p>
        <div class="lobby-arena-actions"
          ><UiButton
            v-if="cleanView && !playing"
            variant="primary"
            label="再玩一局"
            @click="playAgain" />
          <UiButton
            v-if="cleanView && !playing"
            label="切換房間"
            @click="roomDialog?.open()" /><UiButton
            v-if="cleanView && !playing"
            label="返回大廳"
            @click="returnLobby" /><UiButton
            v-else-if="playing"
            label="收起戰況"
            @click="showBattleStats = false" /><UiButton
            v-if="playing"
            variant="danger"
            label="本局棄權"
            :pending="lobby.arenaPending"
            @click="command('leave', { matchId: match.id })"
        /></div>
      </UiPanel>
      <UiPanel v-if="!cleanView" title="場地效果">
        <UiList>
          <UiListRow v-for="item in terrainGuide" :key="item.kind">
            <div class="arena-pickup-guide">
              <span class="arena-terrain-preview" aria-hidden="true">
                <svg v-if="item.kind === 'bush'" viewBox="0 0 100 100">
                  <polygon :points="bushPreview" class="arena-bush-understory" />
                  <path
                    class="arena-bush-leaf"
                    d="M25 67Q16 46 39 36Q47 53 25 67ZM45 70Q36 44 61 23Q77 48 45 70ZM66 68Q63 45 86 39Q89 59 66 68Z"
                  />
                </svg>
                <SceneHazards
                  v-else-if="item.kind === 'mud' || item.kind === 'embers'"
                  :zones="[{ id: item.kind, kind: item.kind, x: 0, y: 0, width: 100, height: 100 }]"
                />
                <span v-else class="arena-wormhole arena-terrain-portal"></span>
              </span>
              <div
                ><strong>{{ item.name }}</strong
                ><div>{{ item.effect }}</div></div
              >
            </div>
          </UiListRow>
        </UiList>
      </UiPanel>
      <UiPanel
        v-if="!cleanView"
        title="隨機道具"
        description="走近自動拾取。每 8～12 秒出現一個，最多同時 3 個。"
      >
        <UiList>
          <UiListRow v-for="item in pickupGuide" :key="item.kind">
            <div class="arena-pickup-guide">
              <img :src="pickupIcons[item.kind]" alt="" width="32" height="32" />
              <div
                ><strong>{{ pickupLabels[item.kind] }}</strong
                ><div>{{ item.effect }}</div></div
              >
            </div>
          </UiListRow>
        </UiList>
        <p>加速、護盾與劍持續 6 秒。重撿只刷新時間。道具 30 秒未撿會消失。</p>
      </UiPanel>
      <StatusSlot
        :message="lobby.arenaStatus || lobby.presenceStatus"
        :error="!!lobby.arenaStatus"
        persistent
      />
    </div>
  </section>
  <div v-if="playing || !cleanView" class="arena-field-guide">
    <UiHoverInfo title="場地與操作" interactive help-only>
      <template #info>
        <UiList>
          <UiListRow>草叢：進入後最多隱身 1 秒，攻擊會現身。</UiListRow>
          <UiListRow>蟲洞：走進發光圓環，傳送到另一端。</UiListRow>
          <UiListRow>泥沼：移動速度降低 50%。</UiListRow>
          <UiListRow>餘燼：停留 1 秒後，每秒扣 5% 最大血量。</UiListRow>
          <UiListRow
            >WASD／方向鍵移動 · Q／E 普通招式 · R 大招 · C 瞬移（{{
              sceneRules.energy.lobbyTeleportCost
            }}
            能量）</UiListRow
          >
        </UiList>
      </template>
    </UiHoverInfo>
  </div>
  <UiDialog ref="roomDialog" title="競技場房間">
    <ArenaRoomPicker
      :rooms="roomList"
      :current-id="roomId"
      :disabled="!lobby.connected || lobby.arenaPending"
      @create="openCreateRoom"
      @join="(roomId) => command('join', { roomId })"
    />
    <StatusSlot :message="lobby.arenaStatus" error persistent />
    <UiButton label="離開房間" :disabled="lobby.arenaPending" @click="command('leaveRoom')" />
  </UiDialog>
  <UiDialog
    ref="createRoomDialog"
    class="arena-create-dialog"
    title="開一間戰鬥競技場"
    compact
    :dismissible="!lobby.arenaPending"
  >
    <form class="arena-create-room" @submit.prevent="createRoom">
      <UiField
        v-model="roomName"
        label="房間名稱"
        maxlength="24"
        placeholder="好友局"
        :disabled="lobby.arenaPending"
      />
      <StatusSlot v-if="createAttempted" :message="lobby.arenaStatus" error persistent />
      <UiButton
        type="submit"
        variant="primary"
        icon="add"
        label="建立競技場房間"
        :disabled="!lobby.connected"
        :pending="lobby.arenaPending"
      />
    </form>
  </UiDialog>
  <LobbyArenaPractice ref="practice" />
  <UiDialog ref="loadoutDialog" title="開局招式配裝" @closed="loadoutOpen = false"
    ><AttackChoices v-if="loadoutOpen">
      <template #rules>
        <UiList aria-label="掩體判定">
          <UiListRow>
            <div class="arena-rule-row"
              ><strong>擋下</strong
              ><span>能量彈、直射光線、劍氣、浮游砲、電漿砲、飛彈與光子狙擊</span></div
            >
          </UiListRow>
          <UiListRow>
            <div class="arena-rule-row"><strong>減傷 25%</strong><span>其他攻擊</span></div>
          </UiListRow>
        </UiList>
      </template>
      <template #confirm>
        <UiButton
          variant="primary"
          label="確定配裝"
          :disabled="!loadout.ready || !!loadout.message"
          :pending="loadout.pending"
          @click="loadoutDialog?.close()"
        />
      </template>
    </AttackChoices>
  </UiDialog>
  <Teleport to="body">
    <div
      v-if="openingSeconds"
      class="arena-final-countdown arena-opening-countdown"
      role="timer"
      aria-label="開戰倒數"
      ><span>準備開戰</span>{{ openingSeconds }}</div
    >
    <div
      v-else-if="finalCountdown"
      class="arena-final-countdown"
      role="timer"
      aria-label="最後倒數"
      >{{ seconds }}</div
    >
    <UiPanel v-if="playing" class="lobby-arena-hud" density="compact" aria-label="競技場即時戰況">
      <UiButton label="切換房間" icon="users" icon-only @click="roomDialog?.open()" />
      <UiButton
        :label="musicEnabled ? '關閉背景音樂' : '開啟背景音樂'"
        :icon="musicEnabled ? 'sound' : 'muted'"
        icon-only
        :aria-pressed="musicEnabled"
        @click="AudioSettings?.set('music', { enabled: !musicEnabled }, { gesture: true })"
      />
      <p
        >{{ openingSeconds ? '準備中' : seconds + ' 秒' }} · {{ self?.score || 0 }} 分 · HP
        {{ hp }}%</p
      >
      <div class="lobby-arena-actions">
        <UiButton
          icon="leave"
          icon-only
          label="本局棄權並返回大廳"
          :pending="lobby.arenaPending"
          @click="returnLobby"
        />
        <UiButton
          icon="info"
          icon-only
          label="戰況"
          :aria-pressed="showBattleStats"
          @click="showBattleStats = !showBattleStats"
        />
        <UiButton
          icon="expand"
          icon-only
          :label="focused ? '退出專注全螢幕（Esc）' : '專注全螢幕'"
          :aria-pressed="focused"
          @click="toggle"
        />
      </div>
    </UiPanel>
  </Teleport>
</template>
