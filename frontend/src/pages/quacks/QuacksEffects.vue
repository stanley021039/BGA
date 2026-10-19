<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useQuacksStore } from '../../stores/quacks';
import type { QuacksLeafOwner } from '../../contracts/quacks';
const room = useRoomStore(),
  quacks = useQuacksStore(),
  fxHost = ref<HTMLElement | null>(null),
  burstHost = ref<HTMLElement | null>(null);
let fx: QuacksLeafOwner | undefined,
  burst: (QuacksLeafOwner & { show(events: { id: string; name: string }[]): void }) | undefined,
  audio: QuacksLeafOwner | undefined,
  sounds = window.GameSounds?.create();
const seen = new Set<string>();
function clear() {
  fx?.clear();
  burst?.clear();
  audio?.clear();
  sounds?.disconnect();
}
function update() {
  const s = quacks.state;
  if (!s) return;
  const live = sounds?.update(s, { connected: room.connected && !document.hidden }) || false;
  fx?.update(s, live);
  audio?.update(s, live);
  for (const e of s.rollEvents) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (live) sounds?.play('dice-roll', 'quacks-dice:' + e.id, { live });
  }
  while (seen.size > 128) seen.delete(seen.values().next().value!);
}
onMounted(() => {
  if (fxHost.value && burstHost.value) {
    fx = window.QuacksFx?.create(fxHost.value);
    burst = window.QuacksFx?.createExplosion(burstHost.value);
    audio = window.QuacksFx?.createAudio(sounds, {
      onClear: () => burst?.clear(),
      onExplosion: (events) => {
        fx?.clear();
        sounds?.stop();
        burst?.show(events);
      },
    });
    update();
  }
});
watch(() => quacks.state, update);
watch(
  () => room.connected,
  (v) => {
    if (!v) clear();
  },
);
watch(
  () => room.scope,
  () => {
    clear();
    seen.clear();
  },
);
function visibility() {
  if (document.hidden) clear();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  clear();
  fx?.destroy();
  burst?.destroy();
  audio?.destroy();
  sounds?.destroy();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div ref="fxHost" class="quacks-fx" data-game-focus-overlay hidden /><div
    ref="burstHost"
    class="quacks-explosion"
    data-game-focus-overlay
    hidden
  />
</template>
