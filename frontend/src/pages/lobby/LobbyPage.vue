<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { useSessionStore } from '../../stores/session';
import { isGameType, type GameType } from '../../contracts/room';
import { gameCards, gameTitle } from './catalog';
import GameCarousel from './GameCarousel.vue';
import LobbyBackdrop from './LobbyBackdrop.vue';
import RoomPings from '../../components/RoomPings.vue';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import '../../styles/lobby-create.scss';
const lobby = useLobbyStore(),
  session = useSessionStore();
const params = new URLSearchParams(location.search),
  requested = params.get('game') || 'thunder';
const selected = ref(gameCards.some((card) => card.id === requested) ? requested : 'thunder'),
  chosen = computed(() => gameCards.find((card) => card.id === selected.value)!);
const create = ref<InstanceType<typeof UiDialog> | null>(null),
  join = ref<InstanceType<typeof UiDialog> | null>(null),
  codeInput = ref<HTMLInputElement | null>(null),
  roomName = ref(''),
  code = ref(params.get('room') || ''),
  // ?join=1 opens the join dialog with the room code focused.
  joinRequested = params.get('join') === '1',
  seconds = ref(60),
  rounds = ref(8),
  opened = ref(false);
const scene = ref<HTMLElement | null>(null),
  entrance: Animation[] = [];
let disposed = false,
  entrancePlayed = false;
const feedback = computed(() =>
  lobby.entryPending
    ? '正在確認房間座位…'
    : lobby.entryStatus ||
      (params.has('closedRoom') ? '房間已結束或你已離開，請重新開桌或加入房間。' : ''),
);
const drawingCreate = computed(() => selected.value === 'draw');
const pairCreate = computed(() => ['telephone', 'majority', 'draw'].includes(selected.value));
const roomCreate = computed(() => ['quacks', 'thunder', 'bluff'].includes(selected.value));
const resumes = computed(() => lobby.rooms.filter((room) => room.seated));
function open() {
  if (selected.value === 'market') return;
  lobby.entryStatus = '';
  opened.value = true;
  void create.value?.open();
}
// 找一桌加入 lives in its own dialog, opened from beside 開一桌.
async function openJoin(focusCode = false) {
  void lobby.refreshRooms();
  await join.value?.open();
  if (focusCode) focusCodeAfterIntro();
}
// The entrance intro may start just after the dialog opens and restores its own
// saved focus when it ends, so focus the code now and again once it finishes.
function focusCodeAfterIntro() {
  const root = document.documentElement,
    focus = () => requestAnimationFrame(() => codeInput.value?.focus());
  focus();
  let introSeen = root.classList.contains('entry-intro-active');
  const observer = new MutationObserver(() => {
    if (root.classList.contains('entry-intro-active')) introSeen = true;
    else if (introSeen) {
      observer.disconnect();
      focus();
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  setTimeout(() => observer.disconnect(), 10000);
}
async function submit() {
  if (isGameType(selected.value))
    await lobby.enter({
      type: selected.value as GameType,
      roomName: roomName.value,
    });
}
async function entranceOnce() {
  if (entrancePlayed || !lobby.snapshot || !scene.value) return;
  entrancePlayed = true;
  await nextTick();
  if (disposed || !window.MotionPolicy?.allowsMotion()) return;
  [...scene.value.querySelectorAll('.library-heading,.game-tile.selected .tile-image')]
    .filter((node) => {
      const box = node.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    })
    .forEach((node, i) => {
      const animation = window.MotionPolicy?.animate(
        node,
        [
          { opacity: 0.72, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 420, delay: Math.min(i * 55, 165), easing: 'cubic-bezier(.22,.7,.25,1)' },
      );
      if (animation) entrance.push(animation);
    });
}
watch(() => lobby.snapshot, entranceOnce);
onMounted(() => {
  // Invite links, ?join=1 and a closed-room redirect all land on the join dialog.
  if (joinRequested || params.has('room') || params.has('closedRoom')) void openJoin(joinRequested);
  void entranceOnce();
});
onBeforeUnmount(() => {
  disposed = true;
  for (const animation of entrance) animation.cancel();
});
</script>
<template>
  <div ref="scene" class="vue-lobby">
    <div class="vue-lobby-floor" aria-hidden="true"></div>
    <div class="library-heading"
      ><div
        ><div class="kicker">YOUR TABLE. YOUR PEOPLE.</div><h1>今晚，玩哪一桌？</h1
        ><p>選個遊戲，開好房間，等朋友入座。</p></div
      ><div class="library-count"
        ><strong>{{ gameCards.length }}</strong
        ><span>款遊戲<br />隨時開桌</span></div
      ></div
    >
    <GameCarousel v-model="selected" @create="open" @join="openJoin()" />
    <LobbyBackdrop />
    <div class="vue-lobby-resume" aria-label="已入座的房間"
      ><span v-if="!resumes.length">{{
        lobby.roomsStatus ? '正在確認先前的房間。' : '挑選遊戲，開啟今晚第一桌。'
      }}</span
      ><UiButton
        v-for="room in resumes"
        :key="room.code"
        icon="replay"
        :label="'返回' + gameTitle(room.type) + ' ' + room.code"
        :caption="'返回' + gameTitle(room.type)"
        :disabled="lobby.entryPending || lobby.roomsLoading"
        @click="lobby.resume(room)" /><StatusSlot :message="feedback" :error="!!lobby.entryStatus"
    /></div>
    <UiDialog ref="join" class="vue-lobby-join-dialog" title="找一桌加入"
      ><div class="vue-lobby-join"
        ><section class="vue-lobby-room-browser" data-ping-anchor="room-list" aria-label="目前房間"
          ><header
            ><p>看看現在有哪些房間，再選擇要加入的遊戲。</p
            ><div class="vue-lobby-room-tools"
              ><span>{{ lobby.rooms.length }} 間房間</span
              ><UiButton
                icon="refresh"
                icon-only
                label="重新整理房間列表"
                :pending="lobby.roomsLoading"
                @click="lobby.refreshRooms()" /></div></header
          ><StatusSlot
            :message="lobby.roomsLoading ? '正在更新房間列表…' : lobby.roomsStatus"
            :error="!!lobby.roomsStatus && !lobby.roomsLoading" />
          <div
            class="vue-lobby-room-list"
            :aria-busy="lobby.roomsLoading"
            tabindex="0"
            aria-label="目前房間"
            ><p v-if="!lobby.rooms.length">{{
              lobby.roomsStatus || '目前還沒有房間。選擇上方遊戲，開一桌邀請朋友吧！'
            }}</p
            ><article v-for="room in lobby.rooms" :key="room.code" class="vue-lobby-room"
              ><div
                ><span>{{ gameTitle(room.type) }}</span
                ><h3>{{ room.name }}</h3
                ><p>房號 {{ room.code }} · {{ room.playerCount }}／{{ room.maxPlayers }} 席</p></div
              ><div class="vue-lobby-room-actions"
                ><span>{{
                  room.seated
                    ? '已入座'
                    : room.kicked
                      ? '無法加入'
                      : room.phase === 'waiting'
                        ? '等待玩家'
                        : ['showdown', 'finished'].includes(room.phase)
                          ? '本局結束'
                          : '遊戲進行中'
                }}</span
                ><UiButton
                  :icon="room.seated ? 'replay' : 'add'"
                  :label="
                    (room.seated
                      ? '返回房間 '
                      : room.joinable
                        ? '加入房間 '
                        : room.kicked
                          ? '無法加入 '
                          : room.playerCount >= room.maxPlayers
                            ? '人數已滿 '
                            : '已開始 ') + room.code
                  "
                  :caption="
                    room.seated
                      ? '返回房間'
                      : room.joinable
                        ? '加入房間'
                        : room.kicked
                          ? '無法加入'
                          : room.playerCount >= room.maxPlayers
                            ? '人數已滿'
                            : '已開始'
                  "
                  :disabled="!room.joinable || lobby.entryPending"
                  @click="lobby.enter({ code: room.code })" /></div></article></div></section
        ><section class="vue-lobby-code"
          ><h2>朋友已經開桌？</h2
          ><form @submit.prevent="lobby.enter({ code })"
            ><label for="lobbyCode">輸入 6 碼房間代碼</label
            ><div class="vue-lobby-code-entry"
              ><input
                id="lobbyCode"
                ref="codeInput"
                v-model="code"
                maxlength="6"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                pattern="[a-fA-F0-9]{6}"
                required
                :disabled="lobby.entryPending"
                aria-describedby="lobbyCodeHelp" /><p id="lobbyCodeHelp"
                >英文字母 A–F 與數字 0–9。</p
              ><UiButton
                icon="add"
                type="submit"
                icon-only
                caption="加入"
                label="加入房間"
                :pending="lobby.entryPending"
                :disabled="!session.user" /><UiButton
                icon="refresh"
                icon-only
                caption="重填"
                label="重新輸入"
                :disabled="lobby.entryPending"
                @click="
                  code = '';
                  lobby.entryStatus = '';
                  codeInput?.focus();
                " /></div></form
          ><StatusSlot :message="feedback" :error="!!lobby.entryStatus" /></section></div
    ></UiDialog>
    <p class="version-note"><a href="/credits">素材來源與授權</a> · 德州撲克：純娛樂籌碼</p>
    <UiDialog
      ref="create"
      :compact="drawingCreate || pairCreate"
      :class="{
        'vue-lobby-create-d06': drawingCreate || pairCreate,
        'vue-lobby-create-room': roomCreate,
        'vue-lobby-create-pair': pairCreate,
      }"
      :title="'開一桌' + chosen.title"
      :dismissible="!lobby.entryPending"
      @closing="opened = false"
      @closed="opened = false"
      ><p v-if="!drawingCreate && !pairCreate">使用帳號暱稱入座，遊戲條件可在房間內調整。</p
      ><form class="vue-lobby-create" @submit.prevent="submit"
        ><label
          >挑選遊戲<select v-model="selected" :disabled="lobby.entryPending"
            ><option
              v-for="card in gameCards.filter((card) => card.id !== 'market')"
              :key="card.id"
              :value="card.id"
              >{{ card.title }}</option
            ></select
          ></label
        ><label
          >房間名稱<input
            v-model="roomName"
            maxlength="24"
            placeholder="好友局"
            :disabled="lobby.entryPending" /></label
        ><div class="vue-lobby-create-options"><p>進入房間後，由房主調整本桌設定。</p></div
        ><StatusSlot :message="feedback" :error="!!lobby.entryStatus" /><UiButton
          :variant="drawingCreate || roomCreate || pairCreate ? 'primary' : 'secondary'"
          :icon="pairCreate ? undefined : drawingCreate ? 'next' : 'add'"
          type="submit"
          :label="'建立' + chosen.title + '房間'"
          :caption="drawingCreate || pairCreate ? '建立並進入房間' : undefined"
          :pending="lobby.entryPending"
          :disabled="!session.user" /></form
    ></UiDialog>
    <RoomPings />
  </div>
</template>
