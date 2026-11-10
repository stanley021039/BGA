<script setup lang="ts">
import sceneRules from '../../../../public/shared/scene-rules.json';
import { arenaPortalLabels, arenaZonePoints, type ArenaCover } from '../../contracts/lobby-arena';
const bushOutline = (bush: ArenaCover) =>
  arenaZonePoints(bush.shape, 'bush')
    .map(([x, y]) => x * 1.2 + ',' + y * 0.7)
    .join(' ');
const bushClip = (bush: ArenaCover) =>
  'polygon(' +
  arenaZonePoints(bush.shape, 'bush')
    .map(([x, y]) => x + '% ' + y + '%')
    .join(',') +
  ')';
import SceneHazards from '../../components/SceneHazards.vue';
import MobileSceneControls from '../../components/MobileSceneControls.vue';
import { sceneDirections, useSceneControls } from '../../services/scene-controls';
import ScenePickups from '../../components/ScenePickups.vue';
import SceneCovers from '../../components/SceneCovers.vue';
import SceneFragments from '../../components/SceneFragments.vue';
import ExpressionSounds from '../../engines/expression-sounds.js';
import MotionPolicy from '../../engines/motion-policy.js';

import { sizedImage } from '../../services/image-size';
import { focusFromPointer } from '../../services/pointer-focus';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { visibleSummons } from '../../services/attack-placement';
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
const props = defineProps<{ arenaPage?: boolean; arenaWarmup?: boolean }>();
const expressionNoticeKey = ref(0);
const lobby = useLobbyStore(),
  stage = ref<HTMLElement | null>(null),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  chat = ref<InstanceType<typeof UiDialog> | null>(null),
  opened = ref(false),
  selfHover = ref(false),
  arrivals = ref(new Set<string>());
const inMatch = computed(
  () =>
    lobby.snapshot?.arena?.match?.phase === 'running' &&
    lobby.snapshot.arena.match.players.some((p) => p.id === lobby.snapshot?.selfId && !p.forfeited),
);
const battlePlaying = computed(() => props.arenaPage && inMatch.value);
const expanded = computed(() => battlePlaying.value && !!lobby.snapshot?.arena?.expanded);
const world = ref<HTMLElement | null>(null);
const camera = { x: 0, y: 0 };
const readCamera = () => camera;
function moveCamera(x: number, y: number) {
  if (!expanded.value || !world.value) return;
  const offset = (value: number) => Math.max(0, Math.min(50, value - 25)) / 100;
  camera.x = offset(x);
  camera.y = offset(y);
  world.value.style.transform = `translate3d(${-camera.x * 100}%, ${-camera.y * 100}%, 0)`;
}
watch(
  [world, expanded],
  ([element, active]) => {
    if (!element) return;
    if (!active) {
      element.style.removeProperty('transform');
      return;
    }
    const me = lobby.snapshot?.visitors.find((visitor) => visitor.id === lobby.snapshot?.selfId);
    if (me) moveCamera(me.x, me.y);
  },
  { flush: 'post' },
);
const sceneEnabled = computed(() => lobby.connected && (!inMatch.value || props.arenaPage));
const sceneSnapshot = computed(() => {
  const snapshot = lobby.snapshot;
  if (!snapshot) return null;
  const match = snapshot.arena?.match;
  const contestants = new Set(
    match?.phase === 'running' ? match.players.filter((p) => !p.forfeited).map((p) => p.id) : [],
  );
  const visible = (id: string) =>
    id === snapshot.selfId || contestants.has(id) === !!props.arenaPage;
  return {
    ...snapshot,
    visitors: snapshot.visitors.filter((v) => visible(v.id)),
    attacks: snapshot.attacks.filter((a) => visible(a.fromId) && visible(a.toId)),
  };
});
const controls = useSceneControls({
  teleportCost: sceneRules.energy.lobbyTeleportCost,
  context: () => [lobby.snapshot?.selfId, lobby.snapshot?.arena?.match?.id].join(':'),
  enabled: () => sceneEnabled.value && !props.arenaWarmup,
  snapshot: () => lobby.snapshot,
  send: async (action, direction) => {
    if (action === 'q' || action === 'e' || action === 'r') return lobby.attack(action);
    if (action === 'c') {
      closeDialogs();
      return lobby.teleport();
    }
    const [dx, dy] = direction || sceneDirections[action];
    lobby.step(dx, dy);
    return true;
  },
});
const background = useLobbyBackgroundStore();
const summons = computed(() => visibleSummons(lobby.snapshot));
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
  if (!sceneEnabled.value || !rect?.width || !rect.height) return;
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
function keyName(event: KeyboardEvent) {
  return (
    (
      {
        KeyW: 'w',
        KeyA: 'a',
        KeyS: 's',
        KeyD: 'd',
        KeyQ: 'q',
        KeyE: 'e',
        KeyR: 'r',
        KeyC: 'c',
      } as Record<string, string>
    )[event.code] || event.key.toLowerCase()
  );
}
function release(event: KeyboardEvent) {
  held.delete(keyName(event));
}
function clearKeys() {
  held.clear();
}
function key(event: KeyboardEvent) {
  if (
    !sceneEnabled.value ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.isComposing && !event.code.startsWith('Key')) ||
    document.hidden ||
    (event.target instanceof Element &&
      event.target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
      )) ||
    document.querySelector('dialog[open]')
  )
    return;
  const name = keyName(event);
  if (name === 'q' || name === 'e' || name === 'r' || name === 'c') {
    if (event.repeat) return;
    event.preventDefault();
    held.clear();
    void controls.run(name);
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
  <MobileSceneControls
    :controls="controls"
    :enabled="sceneEnabled"
    :battle="battlePlaying"
    :locked-loadout="
      battlePlaying
        ? lobby.snapshot?.arena?.match?.players.find((p) => p.id === lobby.snapshot?.selfId)
            ?.loadout
        : undefined
    "
    :message="
      (lobby.attackStatus === '已向最近玩家發射特效' ? '' : lobby.attackStatus) ||
      lobby.presenceStatus
    "
  />
  <Teleport to="body"
    ><div
      ref="stage"
      class="lobby-backdrop"
      :data-background="background.visible ? background.selected : 'default'"
      :class="{ 'is-self-hover': selfHover, 'arena-expanded-stage': expanded }"
      tabindex="0"
      :aria-label="
        battlePlaying
          ? '戰鬥競技場：點地面或用方向鍵移動，C 瞬移'
          : `好友大廳：點擊空白處或用 WASD、方向鍵移動，點自己的角色發表情；C 瞬移（${sceneRules.energy.lobbyTeleportCost} 能量），Q、E 普通招式，能量滿後按 R 施放大招`
      "
      aria-keyshortcuts="Q E R C"
      data-ping-anchor="lobby-stage"
      :aria-busy="!lobby.connected"
      ><div ref="world" class="arena-camera-world" :class="{ 'is-expanded': expanded }">
        <LobbyAttackLayer
          :snapshot="sceneSnapshot"
          :arena="props.arenaPage"
          :read-camera="expanded ? readCamera : undefined"
          :connected="lobby.connected" /><LobbyBackgroundArt
          v-if="background.visible"
          :id="background.selected" /><div class="lobby-visitors"
          ><div v-if="expanded" class="arena-map-boundary" aria-hidden="true"></div>
          <div
            v-for="portal in lobby.snapshot?.arena?.portals || []"
            :key="portal.id"
            class="arena-wormhole"
            :data-pair="portal.id === 'east' || portal.id === 'west' ? 'lateral' : 'vertical'"
            :style="{
              left: portal.x + '%',
              top: portal.y + '%',
              width: 2 * (lobby.snapshot?.arena?.portalRadius || 2) + '%',
              height: 2 * (lobby.snapshot?.arena?.portalRadius || 2) + '%',
            }"
            :aria-label="arenaPortalLabels[portal.id] + '側蟲洞'"
          ></div>
          <div v-if="battlePlaying" class="arena-bushes" aria-label="可遮蔽敵方視野的草叢">
            <svg
              v-for="bush in lobby.snapshot?.arena?.bushes || []"
              :key="bush.id"
              class="arena-bush"
              viewBox="0 0 120 70"
              preserveAspectRatio="none"
              :style="{
                left: bush.x + '%',
                top: bush.y + '%',
                width: bush.width + '%',
                height: bush.height + '%',
                clipPath: bushClip(bush),
              }"
            >
              <ellipse class="arena-bush-shadow" cx="60" cy="56" rx="57" ry="12" />
              <polygon class="arena-bush-understory" :points="bushOutline(bush)" />
              <g
                v-for="leaf in 18"
                :key="leaf"
                :transform="
                  'translate(' +
                  (9 + ((leaf * 31) % 101)) +
                  ' ' +
                  (16 + ((leaf * 17) % 40)) +
                  ') rotate(' +
                  (((leaf * 37) % 110) - 55) +
                  ')'
                "
              >
                <path
                  class="arena-bush-leaf"
                  :class="{ 'is-light': leaf % 3 === 0 }"
                  d="M0 13Q-12 0 0-12Q12 0 0 13Z"
                />
                <path class="arena-bush-vein" d="M0 10V-7" />
              </g>
            </svg> </div
          ><SceneHazards
            v-if="battlePlaying"
            :zones="lobby.snapshot?.arena?.hazards || []" /><ScenePickups
            v-if="battlePlaying"
            :items="lobby.snapshot?.arena?.pickups || []" /><SceneCovers
            v-if="battlePlaying"
            :covers="lobby.snapshot?.arena?.covers || []" /><SceneFragments
            :visitors="sceneSnapshot?.visitors || []" /><LobbyVisitor
            v-for="visitor in sceneSnapshot?.visitors || []"
            :key="visitor.id"
            :visitor="visitor"
            :show-summon="summons.has(visitor.id)"
            :team="
              battlePlaying
                ? lobby.snapshot?.arena?.teams.find((p) => p.id === visitor.id)?.team
                : undefined
            "
            :message="lobby.speeches[visitor.id]"
            :self="visitor.id === lobby.snapshot?.selfId"
            :follow-camera="expanded && visitor.id === lobby.snapshot?.selfId"
            @position="moveCamera"
            :reset="lobby.positionReset"
            :open="opened"
            :connected="lobby.connected"
            :arrive="arrivals.has(visitor.id)"
            @select="open"
            @arrived="arrived(visitor.id)" /></div></div></div
    ><div v-if="lobby.presenceStatus && !props.arenaPage" class="vue-lobby-presence"
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
