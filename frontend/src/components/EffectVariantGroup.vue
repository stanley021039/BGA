<script setup lang="ts" generic="T extends EffectVersion">
import { computed, ref } from 'vue';
import type { EffectVersion } from '../services/effect-variants';
import UiField from './UiField.vue';

const props = defineProps<{
  original: T;
  versions: readonly T[];
  preferred: readonly string[];
  allowed: (id: string) => boolean;
}>();
const emit = defineEmits<{ preview: [id: string] }>();
defineSlots<{ default(props: { effect: T }): unknown }>();
const picked = ref('');
const selected = computed(() => {
  const find = (id: string) => props.versions.find((effect) => effect.id === id);
  return (
    find(picked.value) ??
    props.preferred.map(find).find((effect) => effect && props.allowed(effect.id)) ??
    props.versions.find((effect) => props.allowed(effect.id)) ??
    props.original
  );
});
function label(effect: T) {
  if (effect.id === props.original.id) return '原版';
  const suffix = effect.label.startsWith(props.original.label)
    ? effect.label.slice(props.original.label.length).match(/^（(.+)）$/)?.[1]
    : undefined;
  return suffix ?? effect.label;
}
function change(id: string | number | null | undefined) {
  if (typeof id !== 'string' || !props.versions.some((effect) => effect.id === id)) return;
  picked.value = id;
  emit('preview', id);
}
</script>

<template>
  <div class="effect-variant-group">
    <slot :effect="selected" />
    <UiField
      v-if="versions.length > 1"
      control="select"
      :label="original.label + '版本'"
      label-hidden
      :model-value="selected.id"
      @update:model-value="change"
    >
      <option v-for="effect in versions" :key="effect.id" :value="effect.id">
        {{ label(effect) + (allowed(effect.id) ? '' : '（未解鎖）') }}
      </option>
    </UiField>
  </div>
</template>

<style scoped>
.effect-variant-group {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--stitch-gap-label);
  min-inline-size: 0;
}
</style>
