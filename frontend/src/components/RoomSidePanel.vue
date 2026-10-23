<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import UiPanel from './UiPanel.vue';
import UiButton from './UiButton.vue';
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  enabled: boolean;
  open: boolean;
  mobile: boolean;
  focused: boolean;
  side: 'left' | 'right';
  title: string;
  unread?: number;
}>();
const emit = defineEmits<{ toggle: []; close: [] }>();
const root = ref<HTMLElement | null>(null),
  preferences = usePreferencesStore(),
  still = computed(
    () => preferences.motion?.enabled === false || preferences.motion?.reduced === true,
  ),
  id = useId(),
  tooltipVisible = ref(false),
  edgeOffset = ref(0);
let viewportObserver: ResizeObserver | undefined;
function measureEdge() {
  const viewport = document.documentElement.clientWidth;
  edgeOffset.value = props.mobile
    ? 0
    : Math.max(0, (viewport - (root.value?.parentElement?.clientWidth || viewport)) / 2);
}
onMounted(() => {
  if (!props.enabled) return;
  measureEdge();
  viewportObserver = new ResizeObserver(measureEdge);
  viewportObserver.observe(document.documentElement);
  if (root.value) viewportObserver.observe(root.value);
});
watch(() => props.mobile, measureEdge, { flush: 'post' });
onBeforeUnmount(() => viewportObserver?.disconnect());
let tooltipTimer: ReturnType<typeof setTimeout> | undefined;
function hideTooltip() {
  clearTimeout(tooltipTimer);
  tooltipTimer = undefined;
  tooltipVisible.value = false;
}
function showTooltip(event: Event) {
  if (event.type === 'pointerenter' && (event as PointerEvent).pointerType === 'touch') return;
  if (event.type === 'focusin' && !(event.target as HTMLElement).matches(':focus-visible')) return;
  hideTooltip();
  tooltipVisible.value = true;
  tooltipTimer = setTimeout(hideTooltip, 4000);
}
function toggle() {
  hideTooltip();
  emit('toggle');
}
watch(() => [props.open, props.focused, props.enabled, props.mobile], hideTooltip);
onBeforeUnmount(hideTooltip);
watch(
  () => props.open && props.mobile && !props.focused,
  async (active) => {
    if (active) {
      await nextTick();
      root.value?.querySelector<HTMLButtonElement>('.vue-room-panel-handle')?.focus();
    }
  },
);
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') hideTooltip();
  if (!props.enabled || !props.open || !props.mobile) return;
  if (event.key === 'Escape' && !document.querySelector('dialog[open], :popover-open')) {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
  }
  if (event.key !== 'Tab' || !root.value || document.querySelector('dialog[open], :popover-open'))
    return;
  const items = [
    ...root.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ].filter((node) => node.getClientRects().length && !node.closest('[inert]'));
  const first = items[0],
    last = items[items.length - 1];
  if (!first) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>
<template>
  <Teleport to="body" :disabled="!enabled || !mobile || focused">
    <aside
      v-bind="$attrs"
      ref="root"
      :class="{ 'vue-room-side-panel': enabled }"
      :data-panel-still="enabled ? still : undefined"
      :data-panel-side="enabled ? side : undefined"
      :style="enabled ? { '--room-edge-offset': edgeOffset + 'px' } : undefined"
      :data-panel-open="enabled ? open && !focused : undefined"
      :role="enabled && mobile && open && !focused ? 'dialog' : undefined"
      :aria-modal="enabled && mobile && open && !focused ? true : undefined"
      :aria-label="enabled ? title : undefined"
      @keydown="key"
    >
      <template v-if="enabled">
        <div class="vue-room-panel-viewport">
          <UiPanel
            as="div"
            tone="raised"
            density="compact"
            class="vue-room-panel-surface"
            @click.stop
          >
            <div
              :id="id"
              class="vue-room-panel-content"
              :inert="!open || focused"
              :aria-hidden="!open || focused"
              ><slot
            /></div>
          </UiPanel>
        </div>
        <label
          v-if="!focused"
          class="vue-room-panel-handle-slot"
          :data-tooltip-visible="tooltipVisible"
          @pointerenter="showTooltip"
          @pointerleave="hideTooltip"
          @pointerdown="hideTooltip"
          @focusin="showTooltip"
          @focusout="hideTooltip"
        >
          <UiButton
            class="vue-room-panel-handle"
            icon-only
            :icon="side === 'left' ? (open ? 'previous' : 'next') : open ? 'next' : 'previous'"
            :label="
              (open ? '收合' : '展開') + title + (!open && unread ? '，未讀 ' + unread + ' 則' : '')
            "
            title=""
            :aria-describedby="tooltipVisible ? id + '-hint' : undefined"
            :aria-expanded="open"
            :aria-controls="id"
            @click="toggle"
          />
          <span
            :id="id + '-hint'"
            class="vue-room-panel-tooltip"
            role="tooltip"
            :aria-hidden="!tooltipVisible"
            >{{ (open ? '收合' : '展開') + title }}</span
          >
          <span
            v-if="!open && unread"
            class="vue-room-panel-unread"
            role="status"
            :aria-label="'未讀 ' + unread + ' 則'"
            >{{ unread > 49 ? '49+' : unread }}</span
          >
        </label> </template
      ><slot v-else />
    </aside>
  </Teleport>
</template>
