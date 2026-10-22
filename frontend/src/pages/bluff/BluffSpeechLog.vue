<script setup lang="ts">
import { computed } from 'vue';
import type { BluffSnapshot } from '../../contracts/bluff';
const props = defineProps<{ state: BluffSnapshot; interim: string }>();
// Others' unfinished lines; finished ones are already in the log.
const live = computed(() =>
  props.state.captions.filter((c) => !c.final && c.playerId !== props.state.me),
);
</script>
<template>
  <section class="vue-bluff-speech" aria-labelledby="bluffSpeechHeading"
    ><h3 id="bluffSpeechHeading">錄音字幕</h3
    ><ol class="vue-bluff-speech-log" role="log" aria-live="polite"
      ><li v-for="line in state.transcript" :key="line.id">{{ line.text }}</li
      ><li v-for="line in live" :key="'live-' + line.playerId" class="is-live">{{ line.text }}…</li
      ><li v-if="interim" class="is-live">{{ interim }}…</li
      ><li v-if="!state.transcript.length && !live.length && !interim" class="is-empty"
        >還沒有字幕。按「講話」開始，說的話會出現在這裡。</li
      ></ol
    ></section
  >
</template>
