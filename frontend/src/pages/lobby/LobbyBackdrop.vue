<script setup lang="ts">
import ExpressionSounds from '../../engines/expression-sounds.js';
import MotionPolicy from '../../engines/motion-policy.js';

import { sizedImage } from '../../services/image-size';
import { focusFromPointer } from '../../services/pointer-focus';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { useLobbyBackgroundStore } from '../../stores/lobby-background';
import UiDialog from '../../components/UiDialog.vue';
import UiButton from '../../components/UiButton.vue';
import UiChoiceCard from '../../components/UiChoiceCard.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import LobbyVisitor from './LobbyVisitor.vue';
import LobbyAttackLayer from './LobbyAttackLayer.vue';
import LobbyBackgroundArt from '../../components/LobbyBackgroundArt.vue';
import LobbyBarrage from './LobbyBarrage.vue';
import type { BarrageController, BarrageEvent } from '../../contracts/social';
// Visitors live behind the page. A click that lands on the page's empty floor
// (not on any UI) walks the own character there; clicking the own character
// opens its expressions. UI keeps every pointer interaction it covers: controls,
// the site header, painted surfaces (background, border, shadow) and text.
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, dialog, [role="button"], [contenteditable], .game-tile, [data-site-header]';
const expressionNoticeKey = ref(0);
const lobby = useLobbyStore(),
  stage = ref<HTMLElement | null>(null),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  chat = ref<InstanceType<typeof UiDialog> | null>(null),
  opened = ref(false),
  selfHover = ref(false),
  arrivals = ref(new Set<string>());
const background = useLobbyBackgroundStore();
const sounds = ExpressionSounds?.create();
let disposed = false,
  controller: BarrageController | null = null,
  known: Set<string> | null = null,
  hoverFrame = 0;
watch(
  () => lobby.snapshot,
  (value) => {
    if (value) {
      // Existing visitors are already standing here; only arrivals apparate,
      // including our own character when we first walk in.
      const ids = value.visitors.map((visitor) => visitor.id),
        fresh = known
          ? ids.filter((id) => !known!.has(id))
          : ids.filter((id) => id === value.selfId);
      known = new Set(ids);
      if (fresh.length) arrivals.value = new Set([...arrivals.value, ...fresh]);
    }
    if (!value || !lobby.connected || document.hidden) {
      sounds?.reset();
      return;
    }
    sounds?.update({
      contextId: 'lobby:' + value.selfId,
      serverNow: value.serverNow,
      events: value.visitors.flatMap((visitor) =>
        visitor.emote
          ? [
              {
                id: visitor.emote.id,
                kind: 'expression' as const,
                at: visitor.emote.at,
                sound: visitor.emote.sound,
              },
            ]
          : [],
      ),
    });
  },
);
// Lobby chat messages show as speech bubbles above their characters.
watch(
  [() => lobby.snapshot, () => lobby.connected],
  ([value]) => {
    if (!value) return;
    controller ??=
      MotionPolicy?.createBarrageController((item: BarrageEvent) => lobby.showSpeech(item)) || null;
    if (!lobby.connected) {
      controller?.disconnect();
      return;
    }
    controller?.update({
      ...value,
      code: 'lobby',
      type: 'majority',
      me: value.selfId,
      phase: 'lobby',
      host: false,
      players: [],
    } as never);
  },
  { flush: 'post' },
);
watch(
  () => lobby.connected,
  (value) => {
    if (!value) {
      sounds?.reset();
      closeDialogs();
    }
  },
);
function arrived(id: string) {
  const next = new Set(arrivals.value);
  next.delete(id);
  arrivals.value = next;
}
function closeDialogs() {
  dialog.value?.close();
  chat.value?.close();
}
function teleport() {
  closeDialogs();
  void lobby.teleport();
}
watch(
  () => lobby.emotePending,
  (pending, previous) => {
    if (previous && !pending) expressionNoticeKey.value++;
  },
  { flush: 'sync' },
);
async function open(trigger: HTMLElement) {
  if (!lobby.connected) return;
  void lobby.loadExpressions();
  opened.value = true;
  await dialog.value?.open(trigger);
}
async function use(expression: string) {
  if (await lobby.emote(expression)) {
    dialog.value?.close();
    await nextTick();
    if (!disposed) selfAvatar()?.focus({ preventScroll: true });
  }
}
function selfAvatar() {
  return stage.value?.querySelector<HTMLButtonElement>('.lobby-avatar.is-self') || null;
}
function paints(style: CSSStyleDeclaration) {
  return (
    !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(style.backgroundColor) ||
    style.backgroundImage !== 'none' ||
    style.boxShadow !== 'none' ||
    (['Top', 'Right', 'Bottom', 'Left'] as const).some(
      (side) =>
        parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none',
    )
  );
}
function overText(element: Element, x: number, y: number) {
  const range = document.createRange();
  return [...element.childNodes].some((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
    range.selectNodeContents(node);
    return [...range.getClientRects()].some(
      (rect) => x >= rect.left - 4 && x <= rect.right + 4 && y >= rect.top && y <= rect.bottom,
    );
  });
}
function onFloor(target: EventTarget | null, x: number, y: number) {
  if (target === document.documentElement) return true;
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) return false;
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element === document.body) return true;
    if (overText(element, x, y) || paints(getComputedStyle(element))) return false;
  }
  return true;
}
function overSelf(x: number, y: number) {
  const box = selfAvatar()?.getBoundingClientRect();
  return !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
function click(event: MouseEvent) {
  if (
    event.button !== 0 ||
    event.defaultPrevented ||
    !onFloor(event.target, event.clientX, event.clientY)
  )
    return;
  if (getSelection()?.toString()) return;
  const avatar = selfAvatar();
  if (avatar && overSelf(event.clientX, event.clientY)) {
    void open(avatar);
    return;
  }
  const visitors = stage.value?.querySelector<HTMLElement>('.lobby-visitors'),
    rect = visitors?.getBoundingClientRect();
  if (!lobby.connected || !rect?.width || !rect.height) return;
  focusFromPointer(stage.value);
  lobby.move({
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100,
  });
}
function hover(event: MouseEvent) {
  if (hoverFrame) return;
  const { clientX, clientY, target } = event;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0;
    selfHover.value = overSelf(clientX, clientY) && onFloor(target, clientX, clientY);
    document.body.classList.toggle('lobby-self-hover', selfHover.value);
  });
}
const held = new Set<string>();
const directions: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, -1],
  s: [0, 1],
};
function release(event: KeyboardEvent) {
  held.delete(event.key.toLowerCase());
}
function clearKeys() {
  held.clear();
}
function key(event: KeyboardEvent) {
  if (
    !lobby.connected ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    document.hidden ||
    (event.target instanceof Element &&
      event.target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
      )) ||
    document.querySelector('dialog[open]')
  )
    return;
  const name = event.key.toLowerCase();
  if (name === 'q' || name === 'e' || name === 'r') {
    if (event.repeat) return;
    event.preventDefault();
    if (name === 'q' || name === 'e') void lobby.attack(name);
    else {
      held.clear();
      teleport();
    }
    return;
  }
  if (
    ![stage.value, document.body, selfAvatar()].includes(event.target as HTMLElement) ||
    !directions[name]
  )
    return;
  event.preventDefault();
  held.add(name);
  let dx = 0,
    dy = 0;
  for (const key of held) {
    const d = directions[key];
    if (d) {
      dx += d[0];
      dy += d[1];
    }
  }
  if (dx || dy) lobby.step(Math.sign(dx), Math.sign(dy));
}

function visibility() {
  if (document.hidden) {
    sounds?.reset();
    held.clear();
    closeDialogs();
  }
}
function profile() {
  closeDialogs();
}
onMounted(() => {
  document.addEventListener('click', click);
  document.addEventListener('keydown', key);
  document.addEventListener('keyup', release);
  window.addEventListener('blur', clearKeys);
  document.addEventListener('mousemove', hover, { passive: true });
});
document.addEventListener('visibilitychange', visibility);
window.addEventListener('profile-updated', profile);
onBeforeUnmount(() => {
  disposed = true;
  controller?.dispose();
  sounds?.destroy();
  if (hoverFrame) cancelAnimationFrame(hoverFrame);
  document.body.classList.remove('lobby-self-hover');
  document.removeEventListener('click', click);
  document.removeEventListener('keydown', key);
  document.removeEventListener('keyup', release);
  window.removeEventListener('blur', clearKeys);
  document.removeEventListener('mousemove', hover);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('profile-updated', profile);
});
async function openChat() {
  if (lobby.connected) await chat.value?.open();
}
defineExpose({ openChat });
</script>
<template>
  <Teleport to="body"
    ><div
      ref="stage"
      class="lobby-backdrop"
      :data-background="background.selected"
      :class="{ 'is-self-hover': selfHover }"
      tabindex="0"
      aria-label="好友大廳：點擊頁面空白處移動角色，點自己的角色發表情，按對話按鈕輸入訊息；聚焦此處可用 WASD 或方向鍵移動，四邊可穿越，R 鍵隨機換位，Q、E 鍵向最近玩家發射不同特效"
      aria-keyshortcuts="R Q E"
      data-ping-anchor="lobby-stage"
      :aria-busy="!lobby.connected"
      ><LobbyAttackLayer
        :snapshot="lobby.snapshot"
        :connected="lobby.connected" /><LobbyBackgroundArt :id="background.selected" /><div
        class="lobby-visitors"
        ><LobbyVisitor
          v-for="visitor in lobby.snapshot?.visitors || []"
          :key="visitor.id"
          :visitor="visitor"
          :message="lobby.speeches[visitor.id]"
          :self="visitor.id === lobby.snapshot?.selfId"
          :reset="lobby.positionReset"
          :open="opened"
          :connected="lobby.connected"
          :arrive="arrivals.has(visitor.id)"
          @select="open"
          @arrived="arrived(visitor.id)" /></div></div
    ><div v-if="lobby.presenceStatus" class="vue-lobby-presence"
      ><StatusSlot
        :message="lobby.presenceStatus"
        persistent
        :error="!lobby.connected && !!lobby.snapshot" /><UiButton
        icon="refresh"
        icon-only
        label="重新連接大廳"
        :disabled="lobby.connected"
        @click="lobby.sync()" /></div
  ></Teleport>
  <!-- Background mode hides and inerts the lobby page, so the dialogs live on body. -->
  <Teleport to="body"
    ><UiDialog
      ref="dialog"
      class="vue-approved-lobby-expressions"
      title="角色表情"
      compact
      @closing="opened = false"
      @closed="opened = false"
      ><div class="vue-lobby-expression-body"
        ><p class="vue-lobby-expression-intro">使用目前角色的表情；聲音依照你的音效設定播放。</p
        ><div class="vue-lobby-expressions" :aria-busy="lobby.expressionsLoading"
          ><p v-if="lobby.expressionsLoading">正在載入表情…</p
          ><p v-else-if="!lobby.expressions.length">{{
            lobby.expressionStatus || '這個角色尚無表情，可到「我的角色」新增。'
          }}</p
          ><UiChoiceCard
            v-for="expression in lobby.expressions"
            :key="expression.expression"
            :label="expression.label"
            action
            :disabled="lobby.emotePending || !lobby.connected"
            @click="use(expression.expression)"
            ><img :src="sizedImage(expression.image, 128)" alt="" /></UiChoiceCard></div
        ><StatusSlot
          :message="lobby.emotePending ? '正在送出表情…' : lobby.expressionStatus"
          :notice-key="expressionNoticeKey"
          :persistent="lobby.emotePending"
          :error="!!lobby.expressionStatus" /></div
    ></UiDialog>
    <UiDialog ref="chat" title="對話" compact><LobbyBarrage @sent="chat?.close()" /></UiDialog
  ></Teleport>
</template>
