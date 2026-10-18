<script setup lang="ts">
import { computed } from 'vue';
import { historyBoard, raceBoard } from './history-board';
import HistorySection from './HistorySection.vue';
const props = defineProps<{ type: string; state: Record<string, unknown> }>();
const view = computed(() => historyBoard(props.type, props.state));
const race = computed(() => props.type === 'thunder' ? raceBoard(props.state) : null);
</script>
<template>
  <div id="board" class="history-board"><h3 id="phase">{{ view.title }}</h3>
    <div v-if="view.cards.length" class="history-cards"><span v-for="(card, index) in view.cards" :key="index" class="card" :class="{ red: card.red }">{{ card.text }}</span></div>
    <svg v-if="race" viewBox="0 0 835 280" role="img" aria-label="歷史賽道"><text v-for="(tile, index) in race.tiles" :key="'tile-' + index" :x="tile.x" y="20" fill="#ffe1a0" font-size="14">{{ tile.title }}</text><g v-for="(cell, index) in race.cells" :key="'cell-' + index" :transform="`translate(${cell.x} ${cell.y})`"><polygon points="-16,-10 0,-20 16,-10 16,10 0,20 -16,10" :fill="cell.fill" stroke="#c3b985" stroke-width=".6" /><text v-if="cell.symbol" text-anchor="middle" y="4" fill="#fff" font-size="14">{{ cell.symbol }}</text><title>{{ cell.title }}</title></g><g v-for="(car, index) in race.cars" :key="'car-' + index" :transform="`translate(${car.x} ${car.y})`"><rect x="-12" y="-7" width="24" height="14" rx="3" :fill="car.color" stroke="#111" /><text text-anchor="middle" y="5" font-size="14" fill="#101b15">{{ car.text }}</text><title>{{ car.title }}</title></g><text v-for="(chopper, index) in race.choppers" :key="'chopper-' + index" :x="chopper.x" :y="chopper.y" :fill="chopper.color" font-size="24" text-anchor="middle">✣<title>{{ chopper.title }}</title></text><text v-if="race.finish" x="795" y="130" fill="#ffdb83" font-size="14">終點</text></svg>
    <HistorySection v-for="(section, index) in view.sections" :key="index" :section="section" />
  </div>
  <div id="players" class="history-players"><HistorySection v-for="(section, index) in view.players" :key="index" :section="section" /></div>
</template>
