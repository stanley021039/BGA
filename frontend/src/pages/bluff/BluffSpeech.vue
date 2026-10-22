<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useSpeechCaptions } from '../../composables/speech-captions';
import type { BluffSnapshot } from '../../contracts/bluff';
import UiButton from '../../components/UiButton.vue';
const props = defineProps<{ state: BluffSnapshot; blocked: boolean }>();
const room = useRoomStore();
// Only this round's discussion accepts subtitles; anything later is dropped.
const speech = useSpeechCaptions((line) => {
  const roundId = props.state.roundId;
  if (!roundId || props.state.phase !== 'discussion' || !room.connected) return;
  return room.request('bluff/caption', { roundId, ...line }, { affectsConnection: false });
});
const names = computed(
    () => new Map(props.state.players.map((p) => [p.id, p.name] as [string, string])),
  ),
  // Others' unfinished lines; finished ones already show in the log below.
  live = computed(() =>
    props.state.captions.filter((c) => !c.final && c.playerId !== props.state.me),
  ),
  status = computed(() =>
    !speech.supported
      ? '這個瀏覽器不支援語音辨識，請改用 Chrome、Edge 或 Safari。'
      : speech.error.value ||
        (speech.listening.value
          ? '正在聽你說話，再按一次停止。'
          : '按「講話」後才會收音，說的話會轉成字幕給同桌看。'),
  );
watch(
  [() => props.state.roundId, () => props.state.phase, () => room.connected],
  ([roundId, phase, connected], [oldRound]) => {
    if (roundId !== oldRound || phase !== 'discussion' || !connected) speech.stop(true);
  },
);
function visibility() {
  if (document.hidden) speech.stop();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility));
function toggle() {
  if (speech.listening.value) speech.stop();
  else speech.start();
}
</script>
<template>
  <section class="vue-bluff-speech" aria-label="語音字幕"
    ><div class="vue-bluff-speech-control"
      ><UiButton
        stitch
        :variant="speech.listening.value ? 'primary' : 'secondary'"
        :icon="speech.listening.value ? 'stop' : 'sound'"
        :caption="speech.listening.value ? '停止講話' : '講話'"
        :label="speech.listening.value ? '停止講話並結束字幕' : '開始講話並轉成字幕'"
        :aria-pressed="speech.listening.value"
        :disabled="!speech.supported || (blocked && !speech.listening.value)"
        @click="toggle"
      /><p
        class="vue-bluff-speech-status"
        :class="{ 'is-error': !!speech.error.value || !speech.supported }"
        role="status"
        >{{ status }}</p
      ></div
    ><p v-if="speech.interim.value" class="vue-bluff-speech-mine">你：{{ speech.interim.value }}</p
    ><ol class="vue-bluff-speech-log" role="log" aria-live="polite" aria-label="本輪發言字幕"
      ><li v-for="line in state.transcript" :key="line.id"
        ><strong>{{ line.name }}</strong
        ><span>{{ line.text }}</span></li
      ><li v-for="line in live" :key="'live-' + line.playerId" class="is-live"
        ><strong>{{ names.get(line.playerId) || '玩家' }}</strong
        ><span>{{ line.text }}…</span></li
      ><li v-if="!state.transcript.length && !live.length" class="is-empty"
        >還沒有字幕。按「講話」開始，說的話會出現在這裡。</li
      ></ol
    ></section
  >
</template>
