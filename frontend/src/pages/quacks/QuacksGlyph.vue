<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { ingredientNames } from '../../contracts/quacks';
import type { Ingredient } from '../../contracts/quacks';
const props = withDefaults(
    defineProps<{
      hint?: string;
      chip?: Ingredient;
      resource?: string;
      patient?: string;
      size?: number;
      showValue?: boolean;
    }>(),
    { size: 40, showValue: true },
  ),
  host = ref<HTMLElement | null>(null);
const game = useQuacksStore();
const description = computed(() => {
  if (props.hint) return props.hint;
  if (props.chip) {
    const book = game.state?.books.find((b) => b.color === props.chip?.color);
    return (
      (ingredientNames[props.chip.color] || props.chip.color) +
      ' ' +
      props.chip.value +
      '：' +
      (book?.effect ||
        (props.chip.color === 'white'
          ? '依數值前進；白色總數值超過爆炸門檻時爆炸。'
          : '依數值前進。'))
    );
  }
  if (props.patient) {
    const patient = game.state?.patients.find((p) => p.id === props.patient);
    return patient ? patient.name + '：' + patient.text : '';
  }
  return '';
});
function render() {
  if (!host.value) return;
  const art = window.QuacksArt,
    node = props.chip
      ? art?.token(props.chip, { size: props.size, decorative: true, showValue: props.showValue })
      : props.patient
        ? art?.patientPortrait(props.patient)
        : art?.resource(props.resource || 'bag', { size: props.size, decorative: true });
  // The host owns the complete effect hint; SVG titles would add a second native tooltip.
  if (node && description.value) node.querySelectorAll('title').forEach((title) => title.remove());
  host.value.replaceChildren(...(node ? [node] : []));
}
onMounted(render);
watch(
  () => JSON.stringify([props.chip, props.resource, props.patient, props.size, props.showValue]),
  render,
);
</script>
<template>
  <span
    ref="host"
    class="vue-quacks-glyph"
    :style="{ width: size + 'px', height: size + 'px' }"
    :aria-hidden="description ? undefined : true"
    :aria-label="description || undefined"
    :title="description || undefined"
    :data-ui-hint="description ? '' : undefined"
    :tabindex="description ? 0 : undefined"
  />
</template>
