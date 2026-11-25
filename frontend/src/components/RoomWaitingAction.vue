<script setup lang="ts">
import UiLink from './UiLink.vue';
defineProps<{ action?: { href: string; label: string } }>();
</script>
<template>
  <div v-if="action" class="vue-waiting-action">
    <UiLink :href="action.href" :label="action.label" />
  </div>
</template>
<style scoped>
.vue-waiting-action {
  display: none;
}
@media (max-width: 1180px) {
  .vue-waiting-action {
    display: flex;
    justify-content: flex-start;
    grid-column: 1 / -1;
    position: sticky;
    inset-block-start: var(--stitch-space-8);
    z-index: 2;
  }
}
</style>
<style>
@media (max-width: 1180px) {
  :root body[data-visual-theme] [id^='room-waiting-start-'],
  :root body[data-visual-theme] #draw-waiting-ready,
  :root body[data-visual-theme] #quacks-waiting-books {
    scroll-margin-block-start: calc(44px + var(--stitch-space-16));
  }
}
</style>
