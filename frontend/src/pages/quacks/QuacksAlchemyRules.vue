<script setup lang="ts">
import { computed, ref } from 'vue';
import type { QuacksPatient, QuacksCalculation } from '../../contracts/quacks';
import UiDialog from '../../components/UiDialog.vue';
const props = defineProps<{
  patient: QuacksPatient;
  calculation?: QuacksCalculation | null;
  max?: number;
  final?: boolean;
}>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const calculationRows = computed(() =>
  props.calculation
    ? [
        { label: '藥材顏色', value: props.calculation.colors },
        { label: '白色剛好 7', value: props.calculation.exactSeven },
        { label: '鄰座爆鍋', value: props.calculation.explosions },
        { label: '愚人草加成', value: props.calculation.locoweed },
        { label: '占卜加成', value: props.calculation.fortune },
      ].filter((row) => row.value !== 0)
    : [],
);
defineExpose({ open: () => dialog.value?.open() });
</script>
<template>
  <UiDialog ref="dialog" title="調製規則" compact>
    <div class="quacks-distillery-rules">
      <section
        ><h3>1 · 計算精華</h3>
        <p>每種非白色藥材 +1；白色合計剛好 7 再 +1；每位爆鍋的鄰座 +1。</p>
        <p>另加愚人草與占卜加成，最多 10 格。自己爆鍋也能調製。</p>
        <dl v-if="calculation"
          ><template v-for="row in calculationRows" :key="row.label"
            ><dt>{{ row.label }}</dt
            ><dd>+{{ row.value }}</dd></template
          ><dt class="is-total">本輪可達</dt
          ><dd class="is-total"
            >{{
              max ??
              Math.min(
                10,
                calculationRows.reduce((sum, row) => sum + row.value, 0),
              )
            }}
            格</dd
          ></dl
        >
      </section>
      <section
        ><h3>2 · 選一格獎勵</h3>
        <p v-if="final">第 9 輪只按所選格數得分，不再領病患獎勵。</p>
        <p v-else>可選 0 到本輪可達格，只領所選那格的獎勵，不累加前面的格子。</p>
        <p>點格子即確認，確認後不能修改。</p>
      </section>
      <section
        ><h3>{{ patient.name }} · 病患能力</h3><p>{{ patient.text }}</p></section
      >
    </div>
  </UiDialog>
</template>
<style scoped>
.quacks-distillery-rules {
  display: grid;
  gap: 20px;
  line-height: 1.7;
}
.quacks-distillery-rules section {
  display: grid;
  gap: 8px;
}
.quacks-distillery-rules :is(h3, p) {
  margin: 0;
}
.quacks-distillery-rules h3 {
  font-size: 1.125rem;
}
.quacks-distillery-rules dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 20px;
  margin: 4px 0 0;
  padding: 12px;
  border: 1px solid var(--stitch-line);
  border-radius: 10px;
}
.quacks-distillery-rules dd {
  margin: 0;
  font-weight: 700;
  text-align: end;
}
.quacks-distillery-rules .is-total {
  border-top: 1px solid var(--stitch-line);
  padding-top: 8px;
  font-weight: 800;
}
</style>
