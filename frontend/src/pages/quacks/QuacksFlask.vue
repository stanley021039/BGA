<script setup lang="ts">
import { useQuacksStore } from '../../stores/quacks';
import type { QuacksPatient, QuacksCalculation } from '../../contracts/quacks';
import QuacksPatientBoard from './QuacksPatientBoard.vue';
const props = defineProps<{
  patient: QuacksPatient;
  calculation?: QuacksCalculation | null;
  value: number;
  max?: number;
  selecting?: boolean;
  final?: boolean;
  tone?: string;
}>();
const game = useQuacksStore();
function choose(n: number) {
  if (props.selecting && game.available && Number.isInteger(n) && n >= 0 && n <= (props.max ?? 0))
    void game.command('essence', { position: n });
}
</script>
<template>
  <QuacksPatientBoard v-bind="props" :available="game.available" @choose="choose" />
</template>
