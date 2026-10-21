<script setup lang="ts">
import UiIcon from '../../components/UiIcon.vue';
defineProps<{ title: string; detail?: string }>();
</script>
<template>
  <section class="vue-quacks-waiting-message" role="status" aria-live="polite" aria-atomic="true">
    <UiIcon name="users" /><h2>{{ title }}</h2
    ><p v-if="detail">{{ detail }}</p>
  </section>
</template>
<style scoped>
.vue-quacks-waiting-message {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 16px;
  min-height: clamp(240px, 44vh, 460px);
  width: 100%;
  box-sizing: border-box;
  padding: 24px;
  text-align: center;
  color: var(--play-ink);
}
.vue-quacks-waiting-message > .ui-icon {
  width: 44px;
  height: 44px;
  color: var(--play-accent, #c89b36);
}
.vue-quacks-waiting-message h2 {
  margin: 0;
  max-width: 30ch;
  font-size: clamp(24px, 2.8vw, 38px);
  line-height: 1.5;
  text-wrap: balance;
}
.vue-quacks-waiting-message p {
  margin: 0;
  max-width: 42ch;
  font-size: clamp(18px, 1.7vw, 24px);
  line-height: 1.7;
  text-wrap: pretty;
}
</style>
