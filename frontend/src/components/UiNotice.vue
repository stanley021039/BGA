<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import '../styles/ui-patterns.scss';
const props = withDefaults(
  defineProps<{
    message?: string;
    error?: boolean;
    tone?: 'info' | 'success' | 'warning' | 'danger';
    duration?: number;
    noticeKey?: string | number;
    active?: boolean;
    persistent?: boolean;
    density?: 'regular' | 'compact' | 'action';
  }>(),
  {
    message: '',
    error: false,
    duration: 4000,
    active: true,
    persistent: false,
    density: 'regular',
  },
);
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
function clearTimer() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}
function dismiss() {
  clearTimer();
  visible.value = false;
}
function restart() {
  clearTimer();
  visible.value = props.active && !!props.message;
  if (visible.value && !props.persistent) {
    const delay = Number.isFinite(props.duration) && props.duration > 0 ? props.duration : 4000;
    timer = setTimeout(dismiss, delay);
  }
}
watch(
  () => [
    props.message,
    props.error,
    props.tone,
    props.noticeKey,
    props.active,
    props.persistent,
    props.duration,
  ],
  restart,
  { immediate: true },
);
onBeforeUnmount(clearTimer);
defineExpose({ dismiss, restart });
</script>
<template>
  <div class="ui-notice-slot" :data-density="density" :data-visible="visible || undefined">
    <component
      :is="$slots.actions ? 'div' : 'p'"
      class="ui-notice"
      :data-tone="error ? 'danger' : tone || 'info'"
      :hidden="!visible"
      :role="error ? 'alert' : 'status'"
      :aria-live="error ? 'assertive' : 'polite'"
      aria-atomic="true"
      tabindex="0"
      ><template v-if="$slots.actions"
        ><span class="ui-notice-message" :tabindex="visible ? 0 : undefined">{{
          visible ? message : ''
        }}</span
        ><div class="ui-notice-actions"><slot v-if="visible" name="actions" /></div></template
      ><template v-else>{{ visible ? message : '' }}</template></component
    >
  </div>
</template>
