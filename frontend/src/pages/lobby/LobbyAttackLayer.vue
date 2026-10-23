<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { LobbyAttack, LobbySnapshot } from '../../contracts/lobby';
import AttackArtwork from '../../components/AttackArtwork.vue';
const props = defineProps<{ snapshot: LobbySnapshot | null; connected: boolean }>();
const active = ref<LobbyAttack[]>([]),
  announcement = ref('');
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
      active.value = [...active.value.slice(-2), event];
      announcement.value = event.fromName + ' 向 ' + event.toName + ' 發射特效';
      const timer = setTimeout(() => {
        active.value = active.value.filter((item) => item.id !== event.id);
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
  { immediate: true },
);
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  clear();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div class="lobby-attack-layer" aria-hidden="true">
    <div
      v-for="event in active"
      :key="event.id"
      class="lobby-attack"
      :data-attack-id="event.id"
      :data-effect="event.effect"
      :data-slot="event.slot"
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
      <AttackArtwork
        :effect="event.effect"
        :play-key="event.id"
        :from="{ x: event.fromX, y: event.fromY }"
        :to="{ x: event.toX, y: event.toY }"
      />
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
</style>
