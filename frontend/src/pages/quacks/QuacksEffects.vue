<script setup lang="ts">
import QuacksFx from '../../engines/quacks-fx.js';
import GameSounds from '../../engines/game-sounds.js';

import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useQuacksStore } from '../../stores/quacks';
import type { QuacksLeafOwner } from '../../contracts/quacks';
import { createQuacksMotion } from './quacks-motion';
import '../../styles/quacks-pot.scss';
const room = useRoomStore(),
  quacks = useQuacksStore(),
  fxHost = ref<HTMLElement | null>(null),
  burstHost = ref<HTMLElement | null>(null),
  motionHost = ref<HTMLElement | null>(null);
let fx: QuacksLeafOwner | undefined,
  burst: (QuacksLeafOwner & { show(events: { id: string; name: string }[]): void }) | undefined,
  audio: QuacksLeafOwner | undefined,
  sounds = GameSounds?.create();
let motion: ReturnType<typeof createQuacksMotion> | undefined,
  generation = 0,
  disposed = false,
  liveSounds = false;
const seen = new Set<string>();
function clear() {
  generation++;
  liveSounds = false;
  motion?.clear();
  fx?.clear();
  burst?.clear();
  audio?.clear();
  sounds?.disconnect();
}
function update() {
  const s = quacks.state;
  if (!s) return;
  const live = sounds?.update(s, { connected: room.connected && !document.hidden }) || false;
  liveSounds = live;
  // The fortune card flips in place (QuacksFortuneCard); the overlay only rolls dice.
  fx?.update({ ...s, fortuneRevealId: null }, live);
  audio?.update(s, live);
  const epoch = generation;
  void nextTick(() => {
    if (!disposed && epoch === generation && s === quacks.state) motion?.update(s, live);
  });
  for (const e of s.rollEvents) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (live) sounds?.play('dice-roll', 'quacks-dice:' + e.id, { live });
  }
  while (seen.size > 128) seen.delete(seen.values().next().value!);
}
onMounted(() => {
  motion = createQuacksMotion(
    () => motionHost.value,
    (cue, key) => sounds?.play(cue, key, { live: liveSounds }),
  );
  if (fxHost.value && burstHost.value) {
    fx = QuacksFx?.create(fxHost.value);
    burst = QuacksFx?.createExplosion(burstHost.value);
    audio = QuacksFx?.createAudio(sounds, {
      onClear: () => burst?.clear(),
      onExplosion: (events) => {
        fx?.clear();
        sounds?.stop();
        burst?.show(events);
        motion?.burst(events);
      },
    });
    update();
  }
});
watch(() => quacks.state, update);
watch(
  () => quacks.selectedPot,
  () => motion?.cancelVisuals(),
);
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
  disposed = true;
  clear();
  fx?.destroy();
  burst?.destroy();
  audio?.destroy();
  sounds?.destroy();
  motion?.destroy();
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
  <Teleport to="body"
    ><div
      ref="motionHost"
      class="vue-quacks-motion-layer"
      data-game-focus-overlay
      aria-hidden="true"
  /></Teleport>
</template>
