<script setup lang="ts">
import { computed } from 'vue';
import type { RaceDomain } from '../../contracts/race';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
const props = defineProps<{ model: RaceDomain }>();
const lessonHref = computed(
  () =>
    '/race?learn=1&from=game' +
    (props.model.state ? '&room=' + encodeURIComponent(props.model.state.code) : ''),
);
</script>
<template>
  <RoomWaitingTemplate
    type="thunder"
    title="雷霆之路"
    hero-title="引擎已熱，等你上路。"
    description="2–4 支車隊 · 每隊三輛車"
    art="/assets/playful/game-thunder.svg"
    :facts="[
      {
        label: '賽道模式',
        value: model.state?.options.devilsRun ? '惡魔賽道 · 地形／危險試玩' : '主遊戲 · 自製賽道',
      },
      {
        label: '入座車隊',
        value: (model.state?.players.filter((p) => !p.kicked).length || 0) + '／4 支',
      },
      { label: '戰車編制', value: '輕型、中型、重型' },
    ]"
    ><template #hero-actions><a :href="lessonHref">互動新手教學</a></template></RoomWaitingTemplate
  >
</template>
