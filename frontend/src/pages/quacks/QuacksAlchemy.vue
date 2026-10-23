<script setup lang="ts">
import QuacksRuleVisual from './QuacksRuleVisual.vue';
import QuacksFlask from './QuacksFlask.vue';
import QuacksPatientBoard from './QuacksPatientBoard.vue';
import { computed, ref } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import type { QuacksPatient } from '../../contracts/quacks';
const preview = ref<QuacksPatient | null>(null),
  previewDialog = ref<InstanceType<typeof UiDialog> | null>(null);
function showPatient(patient: QuacksPatient) {
  preview.value = patient;
  void previewDialog.value?.open();
}
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
      ><div class="vue-quacks-patients"
        ><article v-for="p in game.state.patients" :key="p.id"
          ><header
            ><QuacksRuleVisual :text="p.text" :patient="p.id" /><h3>{{ p.name }}</h3></header
          ><UiButton icon="book" label="查看獎勵軌道" @click="showPatient(p)" /><UiButton
            icon="check"
            :label="a?.patientId === p.id ? '已選擇' : '治療' + p.name"
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
        ><h3 class="ui-sr-only">只有你看得到的預抽藥材</h3
        ><div class="vue-quacks-tabs"
          ><QuacksGlyph
            v-for="c in a.pool"
            :key="c.id"
            :chip="c"
            :size="48" /></div></div></template
  ></section>
  <UiDialog
    class="quacks-patient-dialog"
    ref="previewDialog"
    :title="(preview?.name || '病患') + ' · 獎勵軌道與說明'"
  >
    <template v-if="preview">
      <p class="quacks-patient-description">{{ preview.text }}</p>
      <QuacksPatientBoard :patient="preview" />
    </template>
  </UiDialog>
</template>
<style scoped>
.vue-quacks-patients > article {
  align-content: start;
  grid-template-rows: auto 1fr auto;
}
.quacks-patient-description {
  margin: 0 0 20px;
  line-height: 1.7;
}
.quacks-patient-dialog {
  width: min(1240px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
}
</style>
