<script setup lang="ts">
import type { Section } from './history-board';
import HistoryCanvas from './HistoryCanvas.vue';
defineProps<{ section: Section }>();
</script>
<template>
  <article class="history-section" :style="section.color ? { '--crew': section.color } : undefined"
    ><h4 v-if="section.title">{{ section.title }}</h4
    ><div v-if="section.cards?.length" class="history-cards"
      ><span
        v-for="(card, index) in section.cards"
        :key="index"
        class="card"
        :class="{ red: card.red }"
        >{{ card.text }}</span
      ></div
    ><template v-for="(piece, index) in section.pieces" :key="index"
      ><HistoryCanvas v-if="piece.canvas" v-bind="piece.canvas" /><p v-else-if="piece.text">{{
        piece.text
      }}</p></template
    ></article
  >
</template>
