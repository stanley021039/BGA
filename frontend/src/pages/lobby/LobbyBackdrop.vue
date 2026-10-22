<script setup lang="ts">
import { sizedImage } from '../../services/image-size';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { useLobbyBackgroundStore } from '../../stores/lobby-background';
import UiDialog from '../../components/UiDialog.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import LobbyVisitor from './LobbyVisitor.vue';
import LobbyBackgroundArt from '../../components/LobbyBackgroundArt.vue';
import LobbyBarrage from './LobbyBarrage.vue';
import type { BarrageController, BarrageEvent } from '../../contracts/social';
// Visitors live behind the page. A click that lands on the page's empty floor
// (not on any UI) walks the own character there; clicking the own character
// opens its expressions. UI keeps every pointer interaction it covers: controls,
// the site header, painted surfaces (background, border, shadow) and text.
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, dialog, [role="button"], [contenteditable], .game-tile, [data-site-header]';
const activity = ref<'chat' | 'expression'>('chat');
const lobby = useLobbyStore(),
  stage = ref<HTMLElement | null>(null),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  opened = ref(false),
  selfHover = ref(false),
  arrivals = ref(new Set<string>());
const background = useLobbyBackgroundStore();
const sounds = window.ExpressionSounds?.create();
let disposed = false,
  controller: BarrageController | null = null,
  known: Set<string> | null = null,
  hoverFrame = 0,
  keyboardTarget: { x: number; y: number } | null = null;
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
      window.MotionPolicy?.createBarrageController((item: BarrageEvent) =>
        lobby.showSpeech(item),
      ) || null;
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
      keyboardTarget = null;
    }
  },
);
watch(
  () => lobby.destination,
  (value) => {
    if (!value) keyboardTarget = null;
  },
);
function arrived(id: string) {
  const next = new Set(arrivals.value);
  next.delete(id);
  arrivals.value = next;
}
function closeDialogs() {
  dialog.value?.close();
}
function teleport() {
  closeDialogs();
  void lobby.teleport();
}
function chooseActivity(value: 'chat' | 'expression') {
  activity.value = value;
  if (value === 'expression') void lobby.loadExpressions();
}
async function open(trigger: HTMLElement) {
  if (!lobby.connected) return;
  activity.value = 'chat';
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
  keyboardTarget = null;
  stage.value?.focus({ preventScroll: true });
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
function key(event: KeyboardEvent) {
  if (
    !lobby.connected ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    ![stage.value, document.body, selfAvatar()].includes(event.target as HTMLElement)
  )
    return;
  if (event.key.toLowerCase() === 'r') {
    if (document.hidden || event.repeat) return;
    event.preventDefault();
    keyboardTarget = null;
    teleport();
    return;
  }
  const directions: Record<string, [number, number]> = {
      ArrowLeft: [-5, 0],
      ArrowRight: [5, 0],
      ArrowUp: [0, -5],
      ArrowDown: [0, 5],
      a: [-5, 0],
      d: [5, 0],
      w: [0, -5],
      s: [0, 5],
    },
    own = lobby.snapshot?.visitors.find((visitor) => visitor.id === lobby.snapshot?.selfId);
  const direction = directions[event.key.toLowerCase()] || directions[event.key];
  if (!own || !direction) return;
  event.preventDefault();
  const [x, y] = direction,
    base = keyboardTarget || own;
  keyboardTarget = {
    x: Math.max(6, Math.min(94, base.x + x)),
    y: Math.max(12, Math.min(97, base.y + y)),
  };
  lobby.move(keyboardTarget);
}
function visibility() {
  if (document.hidden) {
    sounds?.reset();
    closeDialogs();
  }
}
function profile() {
  closeDialogs();
}
onMounted(() => {
  document.addEventListener('click', click);
  document.addEventListener('keydown', key);
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
  document.removeEventListener('mousemove', hover);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('profile-updated', profile);
});
</script>
<template>
  <Teleport to="body"
    ><div
      ref="stage"
      class="lobby-backdrop"
      :data-background="background.selected"
      :class="{ 'is-self-hover': selfHover }"
      tabindex="0"
      aria-label="好友大廳：點擊頁面空白處移動角色，點自己的角色發表情，按對話輸入訊息；聚焦此處可用 WASD 或方向鍵移動，R 鍵隨機換位並播放進場特效"
      aria-keyshortcuts="R"
      data-ping-anchor="lobby-stage"
      :aria-busy="!lobby.connected"
      ><LobbyBackgroundArt :id="background.selected" /><div class="lobby-visitors"
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
        :error="!lobby.connected && !!lobby.snapshot" /><UiButton
        icon="refresh"
        icon-only
        label="重新連接大廳"
        :disabled="lobby.connected"
        @click="lobby.sync()" /></div
  ></Teleport>
  <UiDialog
    ref="dialog"
    stitch
    class="vue-approved-lobby-expressions"
    title="角色對話與表情"
    compact
    @closing="opened = false"
    @closed="opened = false"
    ><div class="vue-lobby-activity-tabs" role="tablist" aria-label="角色互動"
      ><button
        type="button"
        role="tab"
        :aria-selected="activity === 'chat'"
        @click="chooseActivity('chat')"
        >對話</button
      ><button
        type="button"
        role="tab"
        :aria-selected="activity === 'expression'"
        @click="chooseActivity('expression')"
        >表情</button
      ></div
    ><div v-if="activity === 'chat'" class="vue-lobby-activity-chat"
      ><LobbyBarrage @sent="dialog?.close()" /></div
    ><div v-else class="vue-lobby-expression-body"
      ><p class="vue-lobby-expression-intro">使用目前角色的表情；聲音依照你的音效設定播放。</p
      ><div class="vue-lobby-expressions" :aria-busy="lobby.expressionsLoading"
        ><p v-if="lobby.expressionsLoading">正在載入表情…</p
        ><p v-else-if="!lobby.expressions.length">{{
          lobby.expressionStatus || '這個角色尚無表情，可到「我的角色」新增。'
        }}</p
        ><button
          v-for="expression in lobby.expressions"
          :key="expression.expression"
          type="button"
          :aria-label="expression.label"
          :disabled="lobby.emotePending || !lobby.connected"
          @click="use(expression.expression)"
          ><img :src="sizedImage(expression.image, 128)" alt="" /><span>{{
            expression.label
          }}</span></button
        ></div
      ><StatusSlot
        :message="lobby.emotePending ? '正在送出表情…' : lobby.expressionStatus"
        :error="!!lobby.expressionStatus" /></div
  ></UiDialog>
</template>
<style scoped>
.vue-lobby-activity-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.vue-lobby-activity-tabs button {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--play-border, #8c805e);
  border-radius: 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.vue-lobby-activity-tabs button[aria-selected='true'] {
  background: var(--play-accent, #e8b441);
  color: #1a1a18;
  font-weight: 700;
}
</style>
