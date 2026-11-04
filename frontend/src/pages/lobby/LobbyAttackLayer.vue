<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LobbyAttack, LobbySnapshot } from '../../contracts/lobby';
import { usePreferencesStore } from '../../stores/preferences';
import { createAttackStage } from '../../services/attack-artwork';
import { attackColor, attackOptions } from '../../services/attack-placement';
import { sizedImage } from '../../services/image-size';
import { playHeroFlight } from '../../services/scene-hero-flight.js';
import { homingScale } from '../../services/attack-homing.js';
const props = defineProps<{ snapshot: LobbySnapshot | null; connected: boolean }>();
// Every live attack draws on this one canvas (#322); up to three play at once.
const layer = ref<HTMLElement | null>(null),
  surface = ref<HTMLCanvasElement | null>(null),
  active = ref<LobbyAttack[]>([]);
const prefs = usePreferencesStore(),
  still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const heads = computed(() =>
  (props.snapshot?.attacks || []).filter(
    (e) => e.head && !e.head.cancelled && (still.value || !active.value.some((a) => a.id === e.id)),
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
function play(event: LobbyAttack) {
  if (still.value || document.hidden || !layer.value || !surface.value) return;
  const { width, height } = layer.value.getBoundingClientRect();
  if (!width || !height) return;
  stage ||= createAttackStage(surface.value);
  const placement = {
    ...event,
    from: { x: event.fromX, y: event.fromY },
    to: { x: event.toX, y: event.toY },
    casterImage: sizedImage(
      props.snapshot?.visitors.find((v) => v.id === event.fromId)?.image || '',
      128,
    ),
  };
  const added = stage.add(
    event.id,
    attackOptions(
      placement,
      width,
      height,
      () => active.value.find((item) => item.id === event.id)?.hits,
      () => active.value.find((item) => item.id === event.id) || {},
    ),
  );
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
    const present = new Set(snapshot.attacks.map((event) => event.id));
    for (const old of active.value) {
      if (old.head && !present.has(old.id)) stage?.remove(old.id);
    }
    active.value = active.value.filter((event) => !event.head || present.has(event.id));
    for (const event of snapshot.attacks) {
      if (seen.has(event.id)) {
        if (event.cancelled) {
          flights.get(event.id)?.();
          flights.delete(event.id);
        }
        active.value = active.value.map((item) =>
          item.id === event.id ? { ...event, ageMs: item.ageMs } : item,
        );
        continue;
      }
      seen.add(event.id);
      if (baseline || snapshot.serverNow - event.at > 1200 || event.at > snapshot.serverNow + 1000)
        continue;
      const next = { ...event, ageMs: Math.max(0, snapshot.serverNow - event.at) };
      for (const dropped of active.value.slice(0, -2)) {
        stage?.remove(dropped.id);
        flights.get(dropped.id)?.();
        flights.delete(dropped.id);
      }
      active.value = [...active.value.slice(-2), next];
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
  <div ref="layer" class="lobby-attack-layer" aria-hidden="true">
    <canvas ref="surface"></canvas>
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
      ><img
        class="tracking-head"
        alt=""
        decoding="async"
        :src="
          event.head!.contactAt
            ? '/assets/attacks/shaohua-open.webp'
            : '/assets/attacks/shaohua-closed.webp'
        "
      />
      <span v-if="event.head!.finished && event.damage" class="tracking-damage">{{
        event.damage.toLocaleString()
      }}</span>
    </div>
    <template v-if="still">
      <span
        v-for="event in active"
        :key="event.id"
        class="attack-static-hit"
        :style="{
          left: (['shield', 'sphere'].includes(event.effect) ? event.fromX : event.toX) + '%',
          top:
            'calc(' +
            (['shield', 'sphere'].includes(event.effect) ? event.fromY : event.toY) +
            '% - 42px)',
          borderColor: attackColor(event.effect),
        }"
      ></span>
    </template>
  </div>
</template>
<style scoped>
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
.tracking-entity.is-biting {
  width: clamp(72px, 11vw, 190px);
}
.tracking-entity.has-bitten .tracking-head {
  opacity: 0;
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
