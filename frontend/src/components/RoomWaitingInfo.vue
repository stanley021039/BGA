<script setup lang="ts">
import { computed, useId } from 'vue';
import '../styles/room-waiting.scss';
interface WaitingFact {
  label: string;
  value: string;
}
const props = withDefaults(
  defineProps<{
    title: string;
    description: string;
    facts: readonly WaitingFact[];
    notice: string;
    headingId?: string;
    modeLabel?: string;
  }>(),
  { modeLabel: '遊戲模式' },
);
const generatedId = useId(),
  titleId = computed(() => props.headingId || generatedId);
</script>
<template>
  <section class="vue-room-waiting-info" :aria-labelledby="titleId">
    <header class="vue-room-waiting-heading">
      <span class="vue-room-waiting-mode">{{ modeLabel }}</span>
      <h1 :id="titleId" class="vue-room-waiting-title">{{ title }}</h1>
      <p class="vue-room-waiting-description">{{ description }}</p>
    </header>
    <dl class="vue-room-waiting-facts" aria-label="目前遊戲資訊">
      <div v-for="fact in facts" :key="fact.label" class="vue-room-waiting-fact"
        ><dt>{{ fact.label }}</dt
        ><dd>{{ fact.value }}</dd></div
      >
    </dl>
    <footer class="vue-room-waiting-footer" :class="{ 'has-actions': !!$slots.actions }">
      <p>{{ notice }}</p
      ><div v-if="$slots.actions" class="vue-room-waiting-actions"><slot name="actions" /></div>
    </footer>
  </section>
</template>
