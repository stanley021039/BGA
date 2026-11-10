<script setup lang="ts">
import { attackArtworkKind, isDefensiveAttack } from '../../services/attack-variants.js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LobbyAttack, LobbySnapshot } from '../../contracts/lobby';
import { usePreferencesStore } from '../../stores/preferences';
import { createAttackStage } from '../../services/attack-artwork';
import { attackColor, attackOptions } from '../../services/attack-placement';
import { sizedImage } from '../../services/image-size';
import { playHeroFlight } from '../../services/scene-hero-flight.js';
import SceneEquation from '../../components/SceneEquation.vue';
import { homingScale } from '../../services/attack-homing.js';
const props = withDefaults(
  defineProps<{
    snapshot: LobbySnapshot | null;
    connected: boolean;
    roomCode?: string;
    puzzleEnabled?: boolean;
    arena?: boolean;
    readCamera?: () => { x: number; y: number };
  }>(),
  { puzzleEnabled: true },
);
// Every live attack draws on this one canvas (#322); up to three play at once.
const layer = ref<HTMLElement | null>(null),
  surface = ref<HTMLCanvasElement | null>(null),
  active = ref<LobbyAttack[]>([]);
const prefs = usePreferencesStore(),
  still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const coverImpacts = computed(() => {
  const snapshot = props.snapshot;
  return (snapshot?.attacks || [])
    .flatMap((event) =>
      (event.hits || []).flatMap((hit) => {
        const age = (snapshot?.serverNow || 0) - event.at - (hit.delayMs || 0);
        return hit.coverImpact && age >= 0 && age < 700
          ? [{ ...hit.coverImpact, key: event.id + ':' + hit.toId + ':' + hit.phase }]
          : [];
      }),
    )
    .slice(-12);
});
const equation = computed(() => {
  if (!props.connected || !props.puzzleEnabled) return;
  const scene = props.snapshot;
  return scene?.visitors.find((actor) => actor.id === scene.selfId)?.equation;
});
const blackoutSeconds = ref(0);
watch(
  () => {
    const scene = props.snapshot;
    return props.connected
      ? scene?.visitors.find((actor) => actor.id === scene.selfId)?.blackoutUntil
      : undefined;
  },
  (until, _, onCleanup) => {
    const ms = until === undefined ? 0 : until - (props.snapshot?.serverNow ?? until);
    blackoutSeconds.value = 0;
    if (ms <= 0) return;
    const deadline = performance.now() + ms;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const remaining = deadline - performance.now();
      blackoutSeconds.value = Math.max(0, Math.ceil(remaining / 1000));
      if (blackoutSeconds.value)
        timer = setTimeout(tick, Math.ceil(remaining - (blackoutSeconds.value - 1) * 1000));
    };
    onCleanup(() => clearTimeout(timer));
    tick();
  },
  { immediate: true },
);
const heads = computed(() =>
  (props.snapshot?.attacks || []).filter(
    (e) =>
      e.head &&
      (!e.head.cancelled || e.head.exploded) &&
      (still.value || !active.value.some((a) => a.id === e.id)),
  ),
);
const seen = new Set<string>(),
  flights = new Map<string, () => void>(),
  timers = new Set<ReturnType<typeof setTimeout>>();
let identity = '',
  initialized = false,
  stage: ReturnType<typeof createAttackStage> | null = null;
function clear() {
  for (const stop of flights.values()) stop();
  flights.clear();
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  active.value = [];
  stage?.clear();
}
// Subtract each wall's shadow from the cast canvas. This also clips side
// rays independently, without shortening rays that have a clear line.
function wallClips(event: LobbyAttack, width: number, height: number) {
  const arena = props.snapshot?.arena;
  if (
    event.slot === 'r' ||
    arena?.match?.phase !== 'running' ||
    !arena.match.players.some((p) => p.id === event.fromId && !p.forfeited) ||
    !arena.coveredEffects.includes(attackArtworkKind(event.effect))
  )
    return [];
  const x = (event.fromX * width) / 100;
  const y = (event.fromY * height) / 100;
  const reach = Math.hypot(width, height) * 2;
  const paths: Path2D[] = [];
  for (const wall of arena.covers) {
    const l = (wall.x * width) / 100,
      r = ((wall.x + wall.width) * width) / 100;
    const t = (wall.y * height) / 100,
      b = ((wall.y + wall.height) * height) / 100;
    if (x >= l && x <= r && y >= t && y <= b) return [new Path2D()];
    const cut = (ax: number, ay: number, bx: number, by: number, distance: number) => {
      const k = 1 + reach / distance;
      const path = new Path2D();
      path.rect(0, 0, width, height);
      path.moveTo(ax, ay);
      path.lineTo(bx, by);
      path.lineTo(x + (bx - x) * k, y + (by - y) * k);
      path.lineTo(x + (ax - x) * k, y + (ay - y) * k);
      path.closePath();
      paths.push(path);
    };
    if (x < l) cut(l, t, l, b, l - x);
    else if (x > r) cut(r, t, r, b, x - r);
    if (y < t) cut(l, t, r, t, t - y);
    else if (y > b) cut(l, b, r, b, y - b);
  }
  return paths;
}
function play(event: LobbyAttack) {
  if (still.value || document.hidden || !layer.value || !surface.value) return;
  const { width, height } = layer.value.getBoundingClientRect();
  if (!width || !height) return;
  const expanded = props.snapshot?.arena?.expanded;
  stage ||= createAttackStage(surface.value, { readCamera: props.readCamera });
  const placement = {
    ...event,
    from: { x: event.fromX, y: event.fromY },
    to: { x: event.toX, y: event.toY },
    casterImage: sizedImage(
      props.snapshot?.visitors.find((v) => v.id === event.fromId)?.image || '',
      expanded ? 256 : 128,
    ),
  };
  const options = attackOptions(
    placement,
    width,
    height,
    () => active.value.find((item) => item.id === event.id)?.hits,
    () => active.value.find((item) => item.id === event.id) || {},
    undefined,
    () =>
      props.snapshot?.visitors.find((visitor) => visitor.id === event.toId && visitor.health !== 0),
  );
  const avatar = [
    ...(layer.value
      .closest('.lobby-backdrop')
      ?.querySelectorAll<HTMLElement>('[data-ping-player]') || []),
  ].find((node) => node.dataset.pingPlayer === event.fromId);
  const readCaster = () => {
    const visitor = props.snapshot?.visitors.find((v) => v.id === event.fromId);
    if (!layer.value || !avatar?.isConnected || !visitor || visitor.health === 0) return null;
    const origin = layer.value.getBoundingClientRect();
    const box = (avatar.querySelector('.scene-avatar-portrait') || avatar).getBoundingClientRect();
    return { x: box.left - origin.left + box.width / 2, y: box.top - origin.top + box.height / 2 };
  };
  const added = stage.add(event.id, {
    ...options,
    coverClips: wallClips(event, width, height),
    readCaster,
    ...(isDefensiveAttack(event.effect) &&
      attackArtworkKind(event.effect) !== 'crystal_reflection' && { readAnchor: readCaster }),
  });
  if (added && event.effect.replace(/_alt$/, '') === 'gate_of_heroes') {
    const node = [
      ...(layer.value
        .closest('.lobby-backdrop')
        ?.querySelectorAll<HTMLElement>('[data-ping-player]') || []),
    ].find((item) => item.dataset.pingPlayer === event.fromId);
    flights.set(event.id, playHeroFlight(node, event));
  }
}
function visibility() {
  if (document.hidden) {
    clear();
    initialized = false;
  }
}
watch(
  [() => props.snapshot, () => props.connected],
  ([snapshot, connected]) => {
    if (!snapshot || !connected || document.hidden) {
      clear();
      initialized = false;
      return;
    }
    if (identity !== snapshot.selfId) {
      identity = snapshot.selfId;
      initialized = false;
      seen.clear();
      clear();
    }
    const baseline = !initialized;
    initialized = true;
    const eventsById = new Map(snapshot.attacks.map((event) => [event.id, event]));
    for (const old of active.value) {
      if (old.head && !eventsById.has(old.id)) stage?.remove(old.id);
    }
    active.value = active.value.flatMap((item) => {
      const event = eventsById.get(item.id);
      if (!event) return item.head ? [] : [item];
      if (event.cancelled) {
        flights.get(event.id)?.();
        flights.delete(event.id);
      }
      return [{ ...event, ageMs: item.ageMs }];
    });
    for (const event of snapshot.attacks) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (baseline || snapshot.serverNow - event.at > 1200 || event.at > snapshot.serverNow + 1000)
        continue;
      const next = { ...event, ageMs: Math.max(0, snapshot.serverNow - event.at) };
      const arena = snapshot.arena?.match?.phase === 'running';
      const limit = arena ? 6 : 3;
      if (active.value.length >= limit) {
        const ordinary = active.value.find((item) => item.slot !== 'r');
        const dropped = ordinary || (event.slot === 'r' ? active.value[0] : undefined);
        if (!dropped) continue;
        stage?.remove(dropped.id);
        flights.get(dropped.id)?.();
        flights.delete(dropped.id);
        active.value = active.value.filter((item) => item.id !== dropped.id);
      }
      active.value = [...active.value, next];
      play(next);
      const timer = setTimeout(() => {
        active.value = active.value.filter((item) => item.id !== event.id);
        stage?.remove(event.id);
        flights.get(event.id)?.();
        flights.delete(event.id);
        timers.delete(timer);
      }, 4300);
      timers.add(timer);
    }
    if (seen.size > 256) {
      const last = [...seen].slice(-128);
      seen.clear();
      last.forEach((id) => seen.add(id));
    }
  },
  { immediate: true, flush: 'post' },
);
watch(still, (value) => {
  if (value) {
    stage?.clear();
    for (const stop of flights.values()) stop();
    flights.clear();
  }
});
onMounted(() => document.addEventListener('visibilitychange', visibility));
onBeforeUnmount(() => {
  clear();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <SceneEquation
    v-if="equation"
    :key="equation.id"
    :puzzle="equation"
    :room-code="roomCode"
    :arena="arena"
  />
  <Teleport to="body">
    <div v-if="blackoutSeconds" class="coffin-blackout">
      <p class="coffin-blackout-message" role="status">墮入無盡的黑暗深淵吧</p>
      <p class="coffin-blackout-countdown">{{ blackoutSeconds }} 秒</p>
    </div>
  </Teleport>
  <div ref="layer" class="lobby-attack-layer" aria-hidden="true">
    <canvas ref="surface" :class="{ 'is-camera-canvas': readCamera }"></canvas>
    <span
      v-for="impact in coverImpacts"
      :key="impact.key"
      class="cover-impact"
      :style="{ left: impact.x + '%', top: impact.y + '%' }"
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle class="cover-impact-ring" cx="32" cy="32" r="18" />
        <path
          d="M32 3v13M32 48v13M3 32h13M48 32h13M10 10l11 11M43 43l11 11M54 10L43 21M21 43L10 54"
        />
        <path class="cover-impact-core" d="M32 19l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
      </svg>
    </span>
    <div
      v-for="event in heads"
      :key="'head-' + event.id"
      class="tracking-entity"
      :class="{ 'has-bitten': event.head!.finished, 'is-biting': event.head!.contactAt > 0 }"
      :style="{
        left: event.head!.x + '%',
        top: 'calc(' + event.head!.y + '% - 42px)',
        '--head-growth': homingScale(event.head!.at),
      }"
    >
      <svg v-if="event.head!.exploded" class="tracking-burst" viewBox="0 0 64 64">
        <path d="M32 2l6 18 17-8-7 17 14 6-18 6 6 16-17-8-9 13-4-18-17 2 11-14L4 18l18 3z" />
      </svg>
      <img
        v-else
        class="tracking-head"
        alt=""
        decoding="async"
        :src="
          event.head!.contactAt
            ? '/assets/attacks/shaohua-open.webp'
            : '/assets/attacks/shaohua-closed.webp'
        "
      />
      <span
        v-if="event.head!.finished && event.damage"
        class="tracking-damage"
        :class="{ 'is-weak': event.weakened }"
        >{{ event.damage.toLocaleString() + (event.weakened ? ' (WEAK)' : '') }}</span
      >
    </div>
    <template v-if="still">
      <span
        v-for="event in active"
        :key="event.id"
        class="attack-static-hit"
        :style="{
          left: (isDefensiveAttack(event.effect) ? event.fromX : event.toX) + '%',
          top: 'calc(' + (isDefensiveAttack(event.effect) ? event.fromY : event.toY) + '% - 42px)',
          borderColor: attackColor(event.effect),
        }"
      ></span>
    </template>
  </div>
</template>
<style scoped>
.coffin-blackout {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--stitch-gap-controls);
  padding: var(--stitch-space-24);
  pointer-events: none;
  background: var(--stitch-artwork-preview-bg);
  color: var(--stitch-scene-dark-ink);
  text-align: center;
}
.coffin-blackout p {
  margin: 0;
}
.coffin-blackout-message {
  font-size: var(--stitch-text-data);
  font-weight: 900;
}
.coffin-blackout-countdown {
  font-size: var(--stitch-text-section);
  font-variant-numeric: tabular-nums;
}
.lobby-attack-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 5;
}
.lobby-attack-layer canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.lobby-attack-layer canvas.is-camera-canvas {
  position: absolute;
  inset: 0 auto auto 0;
  width: 50%;
  height: 50%;
}
.cover-impact {
  position: absolute;
  width: 72px;
  height: 72px;
  transform: translate(-50%, -50%);
  color: var(--stitch-artwork-swatch-fbbf24);
  filter: drop-shadow(0 0 5px currentColor);
}
.cover-impact svg {
  width: 100%;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  fill: none;
}
.cover-impact-ring {
  stroke-width: 2;
  opacity: 0.65;
}
.cover-impact-core {
  fill: var(--stitch-scene-dark-ink);
  stroke-width: 1.5;
}
@media (prefers-reduced-motion: no-preference) {
  .cover-impact {
    animation: arena-cover-spark 650ms ease-out both;
  }
}
@keyframes arena-cover-spark {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.65);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.45);
  }
}
.attack-static-hit {
  position: absolute;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border: 3px solid;
  border-radius: 50%;
}
.tracking-entity {
  position: absolute;
  width: clamp(52px, 8vw, 136px);
  transform: translate(-50%, -50%);
}
.tracking-head {
  width: 100%;
  height: auto;
  object-fit: contain;
  transform: scale(var(--head-growth));
}
.tracking-burst {
  display: block;
  width: 100%;
  fill: var(--stitch-danger-bg);
  stroke: var(--stitch-danger-ink);
  stroke-width: 3;
  stroke-linejoin: round;
}
.tracking-entity.is-biting {
  width: clamp(72px, 11vw, 190px);
}
.tracking-entity.has-bitten .tracking-head {
  opacity: 0;
}
.tracking-damage.is-weak {
  color: var(--stitch-artwork-swatch-8edcff, lightblue);
}
.tracking-damage {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  color: var(--stitch-primary);
  font-size: var(--stitch-text-section);
  font-weight: 700;
}
</style>
