<script setup lang="ts">
import UiNotice from './UiNotice.vue';
withDefaults(
  defineProps<{
    message?: string;
    error?: boolean;
    id?: string;
    noticeKey?: string | number;
    active?: boolean;
    persistent?: boolean;
    duration?: number;
    tone?: 'info' | 'success' | 'warning' | 'danger';
  }>(),
  { message: '', error: false, active: true, persistent: false, duration: 4000 },
);
</script>
<template>
  <UiNotice
    :id="id"
    class="form-message frontend-status"
    density="compact"
    :message="message"
    :error="error"
    :notice-key="noticeKey"
    :active="active"
    :persistent="persistent"
    :duration="duration"
    :tone="tone"
  />
</template>
