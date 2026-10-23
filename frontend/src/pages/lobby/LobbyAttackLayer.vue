<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { LobbyAttack, LobbySnapshot } from '../../contracts/lobby';
import { usePreferencesStore } from '../../stores/preferences';
const props = defineProps<{ snapshot: LobbySnapshot | null; connected: boolean }>();
const prefs = usePreferencesStore(),
  active = ref<LobbyAttack[]>([]),
  announcement = ref('');
const still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
const seen = new Set<string>(),
  timers = new Set<ReturnType<typeof setTimeout>>();
let identity = '',
  initialized = false;
function clear() {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  active.value = [];
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
    for (const event of snapshot.attacks) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (baseline || snapshot.serverNow - event.at > 1200 || event.at > snapshot.serverNow + 1000)
        continue;
      active.value = [...active.value.slice(-11), event];
      announcement.value = event.fromName + ' 向 ' + event.toName + ' 發射特效';
      const timer = setTimeout(() => {
        active.value = active.value.filter((item) => item.id !== event.id);
        timers.delete(timer);
      }, 1000);
      timers.add(timer);
    }
    if (seen.size > 256) {
      const last = [...seen].slice(-128);
      seen.clear();
      last.forEach((id) => seen.add(id));
    }
  },
  { immediate: true },
);
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  clear();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div class="lobby-attack-layer" :class="{ 'is-still': still }" aria-hidden="true">
    <div
      v-for="event in active"
      :key="event.id"
      class="lobby-attack"
      :data-attack-id="event.id"
      :data-from-id="event.fromId"
      :data-to-id="event.toId"
      :style="{
        '--from-x': event.fromX + 'vw',
        '--from-y': event.fromY + 'vh',
        '--to-x': event.toX + 'vw',
        '--to-y': event.toY + 'vh',
        '--dx': event.toX - event.fromX + 'vw',
        '--dy': event.toY - event.fromY + 'vh',
      }"
    >
      <span class="lobby-attack-bolt"></span><span class="lobby-attack-hit"></span>
      <span class="lobby-attack-caption">{{ event.fromName }} → {{ event.toName }}</span>
    </div>
  </div>
  <span class="ui-sr-only" role="status">{{ announcement }}</span>
</template>
<style scoped>
.lobby-attack-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 5;
}
.lobby-attack-bolt {
  position: absolute;
  left: var(--from-x);
  top: calc(var(--from-y) - 42px);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 18%, #a5f3fc 30%, #06b6d4 60%, transparent 72%);
  box-shadow:
    0 0 14px #22d3ee,
    0 0 32px #0891b2;
  animation: lobby-bolt 550ms ease-out both;
}
.lobby-attack-hit {
  position: absolute;
  left: calc(var(--to-x) - 16px);
  top: calc(var(--to-y) - 48px);
  width: 48px;
  height: 48px;
  border: 3px solid #fbbf24;
  border-radius: 50%;
  box-shadow: 0 0 20px #f59e0b;
  animation: lobby-hit 450ms 450ms ease-out both;
}
.lobby-attack-caption {
  position: absolute;
  left: var(--to-x);
  top: calc(var(--to-y) + 8px);
  transform: translateX(-50%);
  max-width: 180px;
  padding: 3px 8px;
  border-radius: 8px;
  background: #111827;
  color: #fef3c7;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.is-still .lobby-attack-bolt {
  display: none;
}
.is-still .lobby-attack-hit {
  animation: none;
  box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  .lobby-attack-bolt {
    display: none;
  }
  .lobby-attack-hit {
    animation: none;
    box-shadow: none;
  }
}
@keyframes lobby-bolt {
  0% {
    transform: translate(0, 0) scale(0.6);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) scale(1.3);
    opacity: 0;
  }
}
@keyframes lobby-hit {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
</style>
