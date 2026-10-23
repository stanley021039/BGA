<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue';
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
  handle = ref<InstanceType<typeof UiButton> | null>(null),
  id = useId();
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
      :data-panel-side="enabled ? side : undefined"
      :data-panel-open="enabled ? open && !focused : undefined"
      :role="enabled && mobile && open && !focused ? 'dialog' : undefined"
      :aria-modal="enabled && mobile && open && !focused ? true : undefined"
      :aria-label="enabled ? title : undefined"
      @keydown="key"
    >
      <template v-if="enabled">
        <div v-show="open && !focused" :id="id" class="vue-room-panel-content"><slot /></div>
        <div v-if="!focused" class="vue-room-panel-handle-slot">
          <UiButton
            ref="handle"
            class="vue-room-panel-handle"
            icon-only
            :icon="side === 'left' ? (open ? 'previous' : 'next') : open ? 'next' : 'previous'"
            :label="
              (open ? '收合' : '展開') + title + (!open && unread ? '，未讀 ' + unread + ' 則' : '')
            "
            :aria-expanded="open"
            :aria-controls="id"
            @click="emit('toggle')"
          />
          <span class="vue-room-panel-tooltip" role="tooltip">{{
            (open ? '收合' : '展開') + title
          }}</span>
          <span
            v-if="!open && unread"
            class="vue-room-panel-unread"
            role="status"
            :aria-label="'未讀 ' + unread + ' 則'"
            >{{ unread > 49 ? '49+' : unread }}</span
          >
        </div> </template
      ><slot v-else />
    </aside>
  </Teleport>
</template>
