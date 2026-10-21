<script setup lang="ts">
defineProps<{ heading?: string; inStage?: boolean; waiting?: boolean }>();
</script>
<template>
  <section
    class="vue-game-settings-panel"
    :class="{ 'is-in-stage': inStage, 'is-waiting': waiting }"
    ><h2 v-if="heading">{{ heading }}</h2
    ><div v-if="waiting" class="vue-game-settings-body"><slot /></div><slot v-else /><div
      v-if="waiting && $slots['before-start']"
      class="vue-game-before-start"
      ><slot name="before-start" /></div
    ><slot v-else name="before-start" /><div class="vue-game-start-slot"><slot name="start" /></div
  ></section>
</template>
