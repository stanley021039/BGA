<script setup lang="ts">
withDefaults(defineProps<{ message?: string; error?: boolean; id?: string }>(), {
  message: '', error: false,
});
</script>

<template>
  <p :id="id" class="form-message frontend-status" :data-status="error ? 'error' : 'info'"
     role="status" aria-live="polite" aria-atomic="true">{{ message }}</p>
</template>
