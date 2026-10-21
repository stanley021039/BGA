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
  <section v-if="game.state?.options.alchemists" class="vue-quacks-alchemy"
    ><h2>煉金術士 · 特效藥</h2
    ><template v-if="game.state.phase === 'patients'"
      ><p>本場隨機三名病患，每人選一名，可與朋友選相同病患；全員完成後開始第一回合。</p
      ><div class="vue-quacks-patients"
        ><article v-for="p in game.state.patients" :key="p.id"
          ><header
            ><QuacksRuleVisual :text="p.text" :patient="p.id" /><h3>{{ p.name }}</h3></header
          ><QuacksFlask :patient="p" :value="0" /><UiButton
            icon="check"
            :label="a?.patientId === p.id ? '已選擇' : '選擇治療' + p.name"
            :disabled="!game.available || a?.patientId === p.id"
            @click="game.command('patient', { patientId: p.id })" /></article></div></template
    ><template v-else-if="patient && a"
      ><header
        ><QuacksRuleVisual :text="patient.text" :patient="patient.id" /><div
          ><h3>{{ patient.name }} · 特效藥 {{ a.essence }} 格</h3></div
        ></header
      ><QuacksFlask
        :patient="patient"
        :description="
          patient.text +
          '\n' +
          a.rewardText +
          (a.calculation
            ? '\n本輪特效藥：彩色 ' +
              a.calculation.colors +
              '＋白色恰好7 ' +
              a.calculation.exactSeven +
              '＋鄰座爆炸 ' +
              a.calculation.explosions +
              '＋愚人草 ' +
              a.calculation.locoweed +
              '＋占卜 ' +
              a.calculation.fortune +
              '＝最多 ' +
              a.max +
              ' 格'
            : '')
        "
        :value="selecting ? a.max : a.essence"
        :max="a.max"
        :selecting="selecting"
        :final="game.state.round === 9" /><p v-if="selecting"
        >可選任一已到達的格子；確認後不能修改。</p
      ><div v-if="a.pool.length" data-private
        ><h3>只有你看得到的預抽藥材</h3
        ><div class="vue-quacks-tabs"
          ><QuacksGlyph
            v-for="c in a.pool"
            :key="c.id"
            :chip="c"
            :size="48" /></div></div></template
  ></section>
</template>
