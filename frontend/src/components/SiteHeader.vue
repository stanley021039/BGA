<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSessionStore } from '../stores/session';
import { usePreferencesStore } from '../stores/preferences';
import { useRoomStore } from '../stores/room';
import { gameTypes, sessionKey } from '../contracts/room';
import UiButton from './UiButton.vue';
import SceneViewToggle from './SceneViewToggle.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
import GamePreferences from './GamePreferences.vue';
import HeaderProfile from './HeaderProfile.vue';
import InvitationInbox from './InvitationInbox.vue';
import '../styles/site-header.scss';
import { useFloatingPanel } from '../composables/floating-panel';
// Rooms place the background toggle beside fullscreen in RoomFullscreenToggle.
const sceneAvailable = computed(() => location.pathname === '/');
const session = useSessionStore(),
  prefs = usePreferencesStore(),
  root = ref<HTMLElement | null>(null),
  account = ref<HTMLElement | null>(null),
  accountButton = ref<HTMLButtonElement | null>(null),
  moreButton = ref<HTMLElement | null>(null),
  preferences = ref<InstanceType<typeof UiDialog> | null>(null);
const accountOpen = ref(false),
  moreOpen = ref(false),
  profileExpanded = ref(false),
  message = ref(''),
  noticeKey = ref(0),
  avatarVersion = ref(Date.now()),
  avatarFailed = ref(false),
  loading = ref(true);
const loggingOut = ref(false);
const room = useRoomStore();
const dark = computed(() => prefs.color?.scheme === 'dark'),
  accountTitle = computed(() =>
    session.user ? `${session.user.displayName}（${session.user.username}）` : '帳號選單',
  );
const morePanel = ref<HTMLElement | null>(null),
  accountPosition = useFloatingPanel(accountButton, account, accountOpen, 360),
  morePosition = useFloatingPanel(moreButton, morePanel, moreOpen, 240, 'start');
let disposed = false,
  refresh: Promise<void> | null = null;
function close(returnFocus = false) {
  const focus = accountOpen.value
    ? accountButton.value
    : moreButton.value?.querySelector<HTMLButtonElement>('button');
  accountOpen.value = moreOpen.value = profileExpanded.value = false;
  if (returnFocus && focus?.isConnected) focus.focus();
}
async function toggleAccount() {
  const open = !accountOpen.value;
  close();
  accountOpen.value = open;
  if (open) {
    await nextTick();
    account.value?.focus({ preventScroll: true });
  }
}
function toggleMore() {
  const open = !moreOpen.value;
  close();
  moreOpen.value = open;
}
function theme() {
  prefs.setTheme(dark.value ? 'light' : 'dark');
}
function openPreferences() {
  close();
  void preferences.value?.open(accountButton.value || undefined);
}
async function loadIdentity() {
  if (disposed || document.hidden) return;
  if (refresh) return refresh;
  noticeKey.value++;
  const job = (async () => {
    try {
      await session.refresh();
      if (disposed) return;
      avatarVersion.value = Date.now();
      avatarFailed.value = false;
      message.value = '';
      if (session.user) window.dispatchEvent(new Event('site-header-ready'));
    } catch (cause) {
      if (!disposed && !(cause instanceof DOMException && cause.name === 'AbortError'))
        message.value = cause instanceof Error ? cause.message : '帳號資料暫時無法載入。';
    } finally {
      if (!disposed) loading.value = false;
    }
  })();
  refresh = job;
  try {
    await job;
  } finally {
    if (refresh === job) refresh = null;
  }
}
async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  noticeKey.value++;
  message.value = '';
  try {
    await session.logout();
    if (disposed) return;
    if (room.seat) room.invalidateIdentity('帳號已登出，正在返回登入頁。');
    try {
      for (const game of gameTypes) {
        const prefix = sessionKey(game);
        for (const key of Object.keys(localStorage))
          if (key === prefix || key.startsWith(prefix + ':')) localStorage.removeItem(key);
      }
      localStorage.setItem('ah-chat-logout', String(Date.now()));
    } catch {
      /* Logout still succeeds when storage is unavailable. */
    }
    location.assign('/login');
  } catch (cause) {
    if (!disposed) {
      loggingOut.value = false;
      message.value = cause instanceof Error ? cause.message : '登出失敗，請重試。';
    }
  }
}
function outside(event: MouseEvent) {
  if (!(event.target instanceof Node)) return;
  if (!root.value?.contains(event.target)) {
    close();
    return;
  }
  if (
    accountOpen.value &&
    !account.value?.contains(event.target) &&
    !accountButton.value?.contains(event.target)
  )
    accountOpen.value = false;
  if (moreOpen.value && !moreButton.value?.contains(event.target)) moreOpen.value = false;
}
function escape(event: KeyboardEvent) {
  if (
    !event.defaultPrevented &&
    event.key === 'Escape' &&
    !document.querySelector('dialog:modal') &&
    (accountOpen.value || moreOpen.value)
  ) {
    event.preventDefault();
    close(true);
  }
}
function focusout(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) close();
}
function visibility() {
  if (!document.hidden) void loadIdentity();
}
function storage(event: StorageEvent) {
  if (event.key !== 'ah-chat-logout' || !event.newValue) return;
  close();
  session.dispose();
  if (room.seat) room.invalidateIdentity('帳號已在其他分頁登出。');
  if (location.pathname !== '/login')
    location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
}
watch(
  () => session.user?.id,
  (value, previous) => {
    if (value !== previous) close();
    if (previous && value && value !== previous && !session.pending) {
      if (room.seat) room.invalidateIdentity('帳號已更新，正在重新載入。');
      location.reload();
      return;
    }
    if (
      !value &&
      previous &&
      !session.pending &&
      !loggingOut.value &&
      location.pathname !== '/login'
    )
      location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
  },
  { flush: 'sync' },
);
onMounted(() => {
  void loadIdentity();
  document.addEventListener('click', outside);
  document.addEventListener('keydown', escape);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('profile-updated', loadIdentity);
  window.addEventListener('focus', loadIdentity);
  window.addEventListener('storage', storage);
});
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('click', outside);
  document.removeEventListener('keydown', escape);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('profile-updated', loadIdentity);
  window.removeEventListener('focus', loadIdentity);
  window.removeEventListener('storage', storage);
});
</script>
<template>
  <div
    ref="root"
    class="vue-site-header-content vue-site-header-c03"
    data-site-header-variant="c03"
    @focusout="focusout"
  >
    <a class="site-title vue-site-brand" href="/" aria-label="302捉猶團，返回大廳"
      ><img
        class="vue-room-brand-image"
        src="/assets/stitch/room-brand.svg"
        width="26"
        height="26"
        alt=""
      />302捉猶團</a
    >
    <nav class="vue-site-nav" aria-label="主要導覽">
      <template v-if="session.user">
        <a class="vue-site-navigation-link" href="/community?tab=issues">留言板</a>
        <div ref="moreButton" class="vue-site-more">
          <UiButton
            variant="ghost"
            label="遊戲題庫"
            :aria-expanded="moreOpen"
            aria-controls="vue-site-library-menu"
            @click="toggleMore"
          />
          <div
            v-show="moreOpen"
            id="vue-site-library-menu"
            ref="morePanel"
            class="vue-site-popup"
            :style="morePosition.style.value"
          >
            <a href="/community?tab=questions">同頻俱樂部</a><a href="/gifts">送禮達人</a
            ><a href="/draw-words">你畫我猜</a>
          </div>
        </div>
      </template>
    </nav>
    <div id="vue-room-header-portal" class="vue-room-header-portal" :hidden="!room.seat" />
    <div class="vue-site-controls">
      <SceneViewToggle v-if="session.user && sceneAvailable" />
      <UiButton
        variant="ghost"
        :icon="dark ? 'sun' : 'moon'"
        icon-only
        :label="dark ? '切換為亮色模式' : '切換為深色模式'"
        :aria-pressed="dark"
        @click="theme"
      />
      <template v-if="session.user">
        <InvitationInbox />
        <button
          id="site-account-button"
          ref="accountButton"
          type="button"
          class="site-avatar-button"
          :aria-label="session.user.displayName + ' 的帳號選單'"
          :title="accountTitle"
          :aria-expanded="accountOpen"
          aria-controls="site-account-menu"
          aria-haspopup="dialog"
          @click="toggleAccount"
        >
          <img
            v-if="!avatarFailed"
            id="site-avatar"
            :src="'/api/profile/avatar?size=128&v=' + avatarVersion"
            alt="我的頭像"
            @error="avatarFailed = true"
          /><span v-else aria-hidden="true">{{ [...session.user.displayName][0] || '我' }}</span>
        </button>
        <div
          v-show="accountOpen"
          id="site-account-menu"
          ref="account"
          class="vue-site-popup vue-site-account-popup"
          :style="accountPosition.style.value"
          tabindex="-1"
          role="dialog"
          aria-label="帳號與個人設定"
        >
          <header class="vue-site-account-summary">
            <span class="vue-site-account-avatar"
              ><img
                v-if="!avatarFailed"
                :src="'/api/profile/avatar?size=128&v=' + avatarVersion"
                alt=""
                @error="avatarFailed = true"
              /><span v-else aria-hidden="true">{{
                [...session.user.displayName][0] || '我'
              }}</span></span
            >
            <div
              ><strong :title="session.user.displayName">{{ session.user.displayName }}</strong
              ><small>@{{ session.user.username }}</small></div
            >
            <span v-if="room.seat && room.host" class="vue-site-account-badge">房主</span>
          </header>
          <nav class="vue-site-account-actions" aria-label="帳號功能">
            <UiButton
              variant="secondary"
              icon="settings"
              label="個人遊戲設定"
              @click="openPreferences"
            />
            <a href="/settings">帳號與個人化設定</a><a href="/collection">收藏庫</a
            ><a href="/achievements">成就收藏冊</a>
            <a v-if="session.user.role === 'admin'" id="site-admin" href="/admin">管理</a>
            <UiButton
              id="site-logout"
              variant="danger"
              icon="leave"
              label="登出"
              :pending="loggingOut || session.pending"
              @click="logout"
            />
          </nav>
          <details
            class="vue-site-profile-details"
            :open="profileExpanded"
            @toggle="profileExpanded = ($event.currentTarget as HTMLDetailsElement).open"
          >
            <summary>快速編輯暱稱與遊戲角色</summary
            ><HeaderProfile :key="session.user.id" :open="accountOpen && profileExpanded" />
          </details>
        </div>
      </template>
      <span v-else-if="loading" class="vue-site-account-loading" aria-label="正在確認帳號" />
    </div>
    <div class="vue-site-header-feedback"
      ><StatusSlot
        :message="message"
        :error="!!message"
        :notice-key="noticeKey"
        :persistent="!!message" /><UiButton
        v-if="message"
        :pending="session.pending"
        variant="secondary"
        icon="refresh"
        label="重試讀取帳號"
        @click="loadIdentity"
    /></div>
    <UiDialog ref="preferences" class="vue-site-preferences-dialog" title="遊戲設定" compact
      ><GamePreferences
    /></UiDialog>
  </div>
</template>
