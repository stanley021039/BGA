<script setup lang="ts">
import { marketBuckets, marketWeekdays } from '../../contracts/market';
import UiButton from '../../components/UiButton.vue';
const props = defineProps<{
    buckets: string[];
    weekdays: number[];
    disabled?: boolean;
    filters?: boolean;
  }>(),
  emit = defineEmits<{
    'update:buckets': [value: string[]];
    'update:weekdays': [value: number[]];
  }>();
function bucket(id: string, checked: boolean) {
  emit(
    'update:buckets',
    checked ? [...props.buckets, id] : props.buckets.filter((value) => value !== id),
  );
}
function day(id: number, checked: boolean) {
  emit(
    'update:weekdays',
    checked ? [...props.weekdays, id] : props.weekdays.filter((value) => value !== id),
  );
}
const labels = window.MarketRules?.CONFIG.options || [];
</script>
<template>
  <div class="vue-market-rule-picks"
    ><fieldset :disabled="disabled"
      ><legend>{{ filters ? '篩選適用區間' : '適用區間（至少一項）' }}</legend
      ><label v-for="id in marketBuckets" :key="id"
        ><input
          type="checkbox"
          :checked="buckets.includes(id)"
          @change="bucket(id, ($event.target as HTMLInputElement).checked)"
        />{{ labels.find((o) => o.id === id)?.name || id }}</label
      ></fieldset
    ><fieldset :disabled="disabled"
      ><legend>{{ filters ? '篩選適用星期' : '適用星期（至少一天）' }}</legend
      ><label v-for="(label, id) in marketWeekdays" :key="id"
        ><input
          type="checkbox"
          :checked="weekdays.includes(id)"
          @change="day(id, ($event.target as HTMLInputElement).checked)"
        />{{ label }}</label
      ></fieldset
    ><div v-if="!filters" class="vue-market-actions"
      ><UiButton legacy
        label="全選星期"
        :disabled="disabled"
        @click="emit('update:weekdays', [0, 1, 2, 3, 4, 5, 6])" /><UiButton legacy
        label="清除星期"
        :disabled="disabled"
        @click="emit('update:weekdays', [])" /></div
  ></div>
</template>
