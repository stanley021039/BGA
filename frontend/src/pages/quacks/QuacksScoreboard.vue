<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
const game = useQuacksStore(),
  room = useRoomStore(),
  host = ref<HTMLElement | null>(null),
  legend = ref<HTMLElement | null>(null);
let owner: ReturnType<NonNullable<Window['QuacksFx']>['createScoreboard']> | undefined,
  initialized = false;
function update() {
  if (game.state) {
    owner?.update(game.state, initialized && room.connected && !document.hidden);
    initialized = true;
  }
}
onMounted(() => {
  if (host.value && legend.value)
    owner = window.QuacksFx?.createScoreboard(host.value, legend.value);
  update();
});
watch(() => game.state, update);
onBeforeUnmount(() => {
  host.value?.querySelectorAll('*').forEach((n) => n.getAnimations?.().forEach((a) => a.cancel()));
  owner = undefined;
});
</script>
<template>
  <section class="vue-quacks-scoreboard"
    ><div ref="host" /><div ref="legend" class="vue-quacks-score-legend" /><p
      >鼠尾巴在偶數分格；超過 50 分仍繼續累計。</p
    ></section
  >
</template>
