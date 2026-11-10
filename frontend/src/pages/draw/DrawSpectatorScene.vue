<script setup lang="ts">
import { computed } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import type { SpectatorSnapshot } from '../../contracts/spectator';
import RoomCountdown from '../../components/RoomCountdown.vue';
import SpectatorCanvas from '../../components/SpectatorCanvas.vue';
import DrawScene from './DrawScene.vue';
import DrawGuessPanel from './DrawGuessPanel.vue';
import DrawOracle from './DrawOracle.vue';
import '../../styles/draw-approved.scss';

const props = defineProps<{
  snapshot: DrawSnapshot;
  drawing: SpectatorSnapshot['drawing'];
  duration: number;
  offset: number;
  now: number;
  following: string;
  hint?: string;
}>();
const artist = computed(() =>
  props.snapshot.players.find((player) => player.id === props.snapshot.presenterId),
);
</script>

<template>
  <DrawOracle v-if="snapshot.oracle" :snapshot="snapshot" observer :following="following" />
  <div v-else class="vue-draw-approved">
    <section class="vue-draw-board-panel">
      <header
        v-if="['choosing', 'drawing'].includes(snapshot.phase)"
        class="vue-draw-board-heading vue-draw-approved-hud"
      >
        <div class="vue-draw-hud-prompt">
          <small>{{ snapshot.phase === 'choosing' ? '畫者選題中' : '未公開的題目' }}</small>
          <h1
            >{{ artist?.name || '畫者'
            }}{{ snapshot.phase === 'choosing' ? ' 正在選題' : ' 正在作畫' }}</h1
          >
          <span v-if="hint && snapshot.phase === 'drawing'">{{ hint }}</span>
        </div>
        <RoomCountdown
          :deadline="snapshot.deadline"
          :epoch="snapshot.canvasEpoch + ':' + snapshot.phase"
          :duration="duration"
          :offset="offset"
          :now="now"
          :urgent="snapshot.phase === 'drawing'"
          :caption="snapshot.phase === 'choosing' ? '選題剩餘' : '作畫剩餘'"
        />
      </header>
      <SpectatorCanvas
        v-if="snapshot.phase === 'drawing' && drawing"
        :key="drawing.epoch"
        :epoch="drawing.epoch"
        :strokes="drawing.strokes"
        label="本輪公開畫布"
        live
      />
      <DrawScene v-else :snapshot="snapshot" :observer-drawing="drawing" />
    </section>
    <DrawGuessPanel
      v-if="['drawing', 'reveal'].includes(snapshot.phase)"
      :snapshot="snapshot"
      observer
    />
  </div>
</template>
