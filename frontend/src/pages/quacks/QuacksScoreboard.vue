<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import UiDialog from '../../components/UiDialog.vue';
const game = useQuacksStore(),
  room = useRoomStore(),
  host = ref<HTMLElement | null>(null),
  legend = ref<HTMLElement | null>(null),
  zoomHost = ref<HTMLElement | null>(null),
  zoomLegend = ref<HTMLElement | null>(null),
  zoom = ref<InstanceType<typeof UiDialog> | null>(null);
let owner: ReturnType<NonNullable<Window['QuacksFx']>['createScoreboard']> | undefined,
  zoomOwner: typeof owner,
  initialized = false,
  disposed = false;
function cancelAnimations(node: HTMLElement | null) {
  node?.querySelectorAll('*').forEach((n) => n.getAnimations?.().forEach((a) => a.cancel()));
}
function update() {
  if (!game.state || disposed) return;
  owner?.update(game.state, initialized && room.connected && !document.hidden);
  zoomOwner?.update(game.state, false);
  initialized = true;
}
async function openZoom() {
  if (!game.state || document.hidden || disposed) return;
  await zoom.value?.open();
  if (disposed || !zoomHost.value || !zoomLegend.value || !game.state) return;
  zoomOwner = window.QuacksFx?.createScoreboard(zoomHost.value, zoomLegend.value);
  zoomOwner?.update(game.state, false);
}
function closed() {
  cancelAnimations(zoomHost.value);
  zoomOwner = undefined;
}
function visibility() {
  if (document.hidden) {
    initialized = false;
    cancelAnimations(host.value);
    cancelAnimations(zoomHost.value);
  }
}
onMounted(() => {
  if (host.value && legend.value)
    owner = window.QuacksFx?.createScoreboard(host.value, legend.value);
  update();
  document.addEventListener('visibilitychange', visibility);
});
watch(() => game.state, update);
watch(
  () => room.connected,
  () => {
    initialized = false;
  },
);
watch(
  () => room.scope,
  () => {
    initialized = false;
    zoom.value?.close();
  },
);
onBeforeUnmount(() => {
  disposed = true;
  cancelAnimations(host.value);
  cancelAnimations(zoomHost.value);
  owner = undefined;
  zoomOwner = undefined;
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <section class="vue-quacks-scoreboard vue-quacks-scoreboard-rq">
    <div
      ref="host"
      class="vue-quacks-score-art"
      role="button"
      tabindex="0"
      aria-label="放大環形記分板"
      @click="openZoom"
      @keydown.enter.prevent="openZoom"
      @keydown.space.prevent="openZoom"
    />
    <div ref="legend" class="vue-quacks-score-legend" />
    <p>鼠尾巴在偶數分格；超過 50 分仍繼續累計。點選記分板可放大。</p>
  </section>
  <UiDialog
    ref="zoom"
    stitch
    class="vue-quacks-score-zoom-dialog"
    title="放大環形記分板"
    @closed="closed"
    ><section class="vue-quacks-scoreboard vue-quacks-scoreboard-rq is-zoomed"
      ><div ref="zoomHost" class="vue-quacks-score-art" /><div
        ref="zoomLegend"
        class="vue-quacks-score-legend"
      /><p>分數依伺服器即時更新；超過 50 分仍繼續累計。</p></section
    ></UiDialog
  >
</template>
