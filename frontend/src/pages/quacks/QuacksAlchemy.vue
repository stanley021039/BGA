<script setup lang="ts">
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
            ><QuacksGlyph :patient="p.id" :size="80" /><h3>{{ p.name }}</h3></header
          ><p>{{ p.text }}</p
          ><details
            ><summary>查看 0–10 格獎勵</summary
            ><ol start="0"
              ><li v-for="r in p.track" :key="r.position"
                >第 {{ r.position }} 格：{{ r.text }}</li
              ></ol
            ></details
          ><UiButton
            stitch
            variant="secondary"
            icon="check"
            :label="a?.patientId === p.id ? '已選擇' : '選擇治療' + p.name"
            :disabled="!game.available || a?.patientId === p.id"
            @click="game.command('patient', { patientId: p.id })" /></article></div></template
    ><template v-else-if="patient && a"
      ><header
        ><QuacksGlyph :patient="patient.id" :size="64" /><div
          ><h3>{{ patient.name }} · 特效藥 {{ a.essence }} 格</h3><p>{{ patient.text }}</p></div
        ></header
      ><p>{{ a.rewardText }}</p
      ><p v-if="a.calculation"
        >本輪固定計算：彩色 {{ a.calculation.colors }}＋白色恰好7
        {{ a.calculation.exactSeven }}＋鄰座爆炸 {{ a.calculation.explosions }}＋愚人草
        {{ a.calculation.locoweed }}＋占卜 {{ a.calculation.fortune }}＝最多 {{ a.max }} 格。</p
      ><p v-if="game.state.round === 9">第九輪只按選擇格數得分，不再領取其他病患獎勵。</p
      ><div class="vue-quacks-essence-track"
        ><button
          v-for="reward in patient.track"
          :key="reward.position"
          type="button"
          :aria-pressed="a.essence === reward.position"
          :disabled="!selecting || !game.available || reward.position > a.max"
          @click="game.command('essence', { position: reward.position })"
          ><strong>第 {{ reward.position }} 格</strong
          ><span>{{ game.state.round === 9 ? reward.position + ' 分' : reward.text }}</span></button
        ></div
      ><p v-if="selecting">可選任一已到達的格子；確認後不能修改。</p
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
