<script setup lang="ts">
withDefaults(defineProps<{ pending?: boolean; label: string }>(), { pending: false });
</script>

<template>
  <button
    class="page-button frontend-submit"
    type="submit"
    :disabled="pending"
    :aria-busy="pending"
  >
    <span class="frontend-submit-caption" :class="{ 'is-pending': pending }"
      >{{ label }} <span aria-hidden="true">↗</span></span
    >
    <span v-if="pending" class="frontend-submit-progress" aria-hidden="true">處理中…</span>
  </button>
</template>
