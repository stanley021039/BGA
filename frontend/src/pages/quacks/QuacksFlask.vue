<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import type { QuacksPatient } from '../../contracts/quacks';
const props = defineProps<{
    patient: QuacksPatient;
    description?: string;
    value: number;
    max?: number;
    selecting?: boolean;
    final?: boolean;
  }>(),
  host = ref<HTMLElement | null>(null),
  game = useQuacksStore();
function render() {
  const svg = window.QuacksArt?.essenceFlask(props.value);
  if (!svg || !host.value) return;
  const vessel = svg.querySelector('.essence-vessel');
  vessel?.setAttribute('tabindex', '0');
  vessel?.setAttribute('title', props.description || props.patient.text);
  const tip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  tip.textContent = props.description || props.patient.text;
  vessel?.append(tip);
  for (const slot of svg.querySelectorAll<SVGElement>('[data-essence]')) {
    const n = Number(slot.dataset.essence),
      text =
        props.patient.name +
        ' · 第 ' +
        n +
        ' 格：' +
        (props.final ? n + ' 分' : props.patient.track[n]?.text || '');
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('role', props.selecting ? 'button' : 'img');
    slot.setAttribute('aria-label', text);
    slot.setAttribute(
      'aria-disabled',
      String(!props.selecting || !game.available || n > (props.max ?? 0)),
    );
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = text;
    slot.append(title);
    const choose = () => {
      if (props.selecting && game.available && n <= (props.max ?? 0))
        void game.command('essence', { position: n });
    };
    slot.addEventListener('click', choose);
    slot.addEventListener('keydown', (event) => {
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        choose();
      }
    });
  }
  host.value.replaceChildren(svg);
}
onMounted(render);
watch(
  () =>
    JSON.stringify([
      props.patient,
      props.description,
      props.value,
      props.max,
      props.selecting,
      props.final,
      game.available,
    ]),
  render,
);
</script>
<template><div ref="host" class="vue-quacks-legacy-flask" /></template>
<style>
.vue-quacks-legacy-flask {
  min-width: 0;
  width: 100%;
  max-width: 620px;
}
.vue-quacks-legacy-flask > svg {
  display: block;
  width: 100%;
  height: auto;
}
.vue-quacks-legacy-flask [data-essence] {
  cursor: help;
}
.vue-quacks-legacy-flask [data-essence][aria-disabled='false'] {
  cursor: pointer;
}
.vue-quacks-legacy-flask [data-essence]:focus-visible {
  outline: 2px solid #fff1bd;
}
</style>
