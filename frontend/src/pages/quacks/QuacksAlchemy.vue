<script setup lang="ts">
import QuacksRuleVisual from './QuacksRuleVisual.vue';
import QuacksFlask from './QuacksFlask.vue';
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
const game = useQuacksStore(),
  a = computed(() => game.mine?.alchemy),
  patient = computed(() => game.state?.patients.find((p) => p.id === a.value?.patientId)),
  selecting = computed(
    () =>
      game.state?.phase === 'settlement' &&
      game.state.stage === 'essence' &&
      !a.value?.confirmed &&
      !game.mine?.pending &&
      !game.mine?.waitingEffect,
  );
</script>
<template>
  <section
    v-if="game.state?.options.alchemists"
    class="vue-quacks-alchemy"
    :class="{ 'is-distilling': game.state.phase !== 'patients' }"
    aria-label="煉金術士特效藥"
    ><template v-if="game.state.phase === 'patients'"
      ><h2>選擇病患</h2
      ><p>本場隨機三名病患，每人選一名，可與朋友選相同病患；全員完成後開始第一回合。</p
      ><div class="vue-quacks-patients"
        ><article v-for="p in game.state.patients" :key="p.id"
          ><header
            ><QuacksRuleVisual :text="p.text" :patient="p.id" /><h3>{{ p.name }}</h3></header
          ><details class="quacks-patient-track"
            ><summary>獎勵軌道與說明</summary><QuacksFlask :patient="p" :value="0" /></details
          ><UiButton
            icon="check"
            :label="a?.patientId === p.id ? '已選擇' : '選擇治療' + p.name"
            :disabled="!game.available || a?.patientId === p.id"
            @click="game.command('patient', { patientId: p.id })" /></article></div></template
    ><template v-else-if="patient && a"
      ><QuacksFlask
        :patient="patient"
        :tone="game.state.potColors[game.own?.potColor || '']?.liquid[1]"
        :value="selecting ? a.max : a.essence"
        :max="a.max"
        :calculation="a.calculation"
        :selecting="selecting"
        :final="game.state.round === 9" /><div v-if="a.pool.length" data-private
        ><h3>只有你看得到的預抽藥材</h3
        ><div class="vue-quacks-tabs"
          ><QuacksGlyph
            v-for="c in a.pool"
            :key="c.id"
            :chip="c"
            :size="48" /></div></div></template
  ></section>
</template>
