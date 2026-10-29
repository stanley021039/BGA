<script setup lang="ts">
import UiField from './UiField.vue';
defineProps<{
  rows: {
    id: string;
    name: string;
    base: number;
    total: number;
    points: Record<string, number>;
    allowed: Record<string, boolean>;
  }[];
  readonly?: boolean;
  pending?: boolean;
}>();
const emit = defineEmits<{
  allocate: [kind: string, id: string, value: string | number | null | undefined];
}>();
const kinds = [
  { id: 'occupation', label: '職業' },
  { id: 'archetype', label: '原型' },
  { id: 'interest', label: '興趣' },
];
</script>
<template>
  <div class="coc-matrix-scroll" tabindex="0" role="region" aria-label="技能配點圖表，可捲動查看">
    <table class="coc-matrix">
      <caption class="ui-sr-only"
        >技能配點：基礎加上職業、原型及興趣點數；困難為總值的一半，極難為五分之一，皆無條件捨去。</caption
      >
      <colgroup
        ><col class="skill-name" /><col /><col
          v-for="kind in kinds"
          :key="kind.id"
          class="point-column" /><col /><col /><col
      /></colgroup>
      <thead
        ><tr
          ><th scope="col">技能</th><th scope="col">基礎</th
          ><th v-for="kind in kinds" :key="kind.id" scope="col">{{ kind.label }}</th
          ><th scope="col">總值</th><th scope="col">困難</th><th scope="col">極難</th></tr
        ></thead
      >
      <tbody
        ><tr v-for="skill in rows" :key="skill.id">
          <th scope="row">{{ skill.name }}</th
          ><td>{{ skill.base }}</td>
          <td v-for="kind in kinds" :key="kind.id">
            <span v-if="readonly">{{ skill.points[kind.id] || 0 }}</span>
            <UiField
              v-else
              :model-value="skill.points[kind.id]"
              @update:model-value="emit('allocate', kind.id, skill.id, $event)"
              :label="kind.label + '點數：' + skill.name"
              label-hidden
              type="number"
              min="0"
              max="1000"
              step="1"
              inputmode="numeric"
              :disabled="pending || !skill.allowed[kind.id]"
            /> </td
          ><td class="skill-total">{{ skill.total }}</td
          ><td>{{ Math.floor(skill.total / 2) }}</td
          ><td>{{ Math.floor(skill.total / 5) }}</td>
        </tr></tbody
      >
    </table>
  </div>
</template>
<style scoped>
.coc-matrix-scroll {
  block-size: 28rem;
  overflow: auto;
  scrollbar-gutter: stable;
  min-inline-size: 0;
  overscroll-behavior: contain;
}
.coc-matrix {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  inline-size: 100%;
  min-inline-size: 48rem;
  font-variant-numeric: tabular-nums;
}
.skill-name {
  inline-size: 10rem;
}
.point-column {
  inline-size: 6rem;
}
th,
td {
  padding: var(--stitch-space-8);
  border-block-end: var(--stitch-border);
  text-align: center;
  vertical-align: middle;
}
thead th {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  background: var(--stitch-surface-raised, var(--stitch-surface));
  block-size: 2.75rem;
}
tbody th,
thead th:first-child {
  position: sticky;
  inset-inline-start: 0;
  text-align: start;
  background: var(--stitch-surface);
}
tbody th {
  z-index: 1;
}
thead th:first-child {
  z-index: 3;
}
.skill-total {
  font-weight: 700;
  color: var(--stitch-ink);
}
.coc-matrix :deep(.ui-field) {
  min-inline-size: 0;
}
.coc-matrix :deep(input) {
  inline-size: 100%;
  min-inline-size: 0;
  min-block-size: 2.75rem;
  text-align: center;
  box-sizing: border-box;
  font-variant-numeric: tabular-nums;
}
.coc-matrix :deep(input:disabled) {
  opacity: 0.55;
}
@media (max-width: 760px) {
  .skill-name {
    inline-size: 8rem;
  }
  .coc-matrix-scroll {
    block-size: 26rem;
  }
}
</style>
