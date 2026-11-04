<script setup lang="ts">
defineProps<{ label: string; value: string | number; suffix?: string }>();
</script>
<template>
  <dl class="ui-statistic"
    ><dt>{{ label }}</dt
    ><dd
      ><strong>{{ value }}</strong
      ><span v-if="suffix">{{ suffix }}</span></dd
    ></dl
  >
</template>
<style scoped>
.ui-statistic {
  display: grid;
  gap: var(--stitch-space-8);
  margin: 0;
  min-width: 0;
  color: var(--stitch-ink);
}
.ui-statistic dt {
  font-size: var(--stitch-text-hint);
}
.ui-statistic dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--stitch-space-4);
  margin: 0;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.ui-statistic strong {
  font-size: var(--stitch-text-data);
  line-height: var(--stitch-line-height-body);
}
.ui-statistic dd span {
  font-size: var(--stitch-text-hint);
}
</style>
