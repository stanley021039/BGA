<script setup lang="ts">
import UiButton from './UiButton.vue';
withDefaults(
  defineProps<{
    loading?: boolean;
    error?: string;
    empty?: boolean;
    emptyLabel?: string;
    contentId?: string;
  }>(),
  {
    loading: false,
    error: '',
    empty: false,
    emptyLabel: '目前沒有符合的內容。',
  },
);
defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="resource-panel vue-stitch-panel">
    <header class="resource-panel-heading"><slot name="heading" /></header>
    <div class="resource-panel-filters"><slot name="filters" /></div>
    <div class="resource-panel-summary" role="status" aria-live="polite" aria-atomic="true"
      ><slot name="summary"
    /></div>
    <div :id="contentId" class="resource-panel-content" :aria-busy="loading">
      <p v-if="loading && !$slots.loading" class="resource-notice">正在載入…</p>
      <slot v-else-if="loading" name="loading" />
      <p v-else-if="error" class="resource-notice resource-error" role="alert">{{ error }}</p>
      <p v-else-if="empty" class="resource-notice">{{ emptyLabel }}</p>
      <slot v-else />
    </div>
    <footer class="resource-panel-actions">
      <UiButton
        v-if="error"
        variant="secondary"
        icon="refresh"
        label="重新載入"
        @click="$emit('retry')"
      />
      <slot v-else name="actions" />
    </footer>
  </section>
</template>
