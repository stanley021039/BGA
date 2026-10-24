<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import UiPopover from './UiPopover.vue';
import UiButton from './UiButton.vue';
const props = withDefaults(
  defineProps<{ title: string; disabled?: boolean; showHelp?: boolean }>(),
  { showHelp: true },
);
const id = useId(),
  root = ref<HTMLElement | null>(null),
  panel = ref<InstanceType<typeof UiPopover> | null>(null);
const shown = ref(false),
  pinned = ref(false),
  autofocus = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let ignorePointerUntil = 0;
function cancel() {
  clearTimeout(timer);
}
function closed() {
  // A disappearing top-layer panel can expose the card under the cursor and
  // synthesize pointerenter. Do not immediately reopen an explicitly closed tip.
  ignorePointerUntil = Date.now() + 250;
  cancel();
  shown.value = pinned.value = false;
  document.removeEventListener('keydown', key);
}
function close() {
  panel.value?.close(false);
  closed();
}
function leave() {
  cancel();
  if (!pinned.value) timer = setTimeout(close, 180);
}
async function show(event?: Event, explicit = false) {
  if (
    !explicit &&
    event?.type === 'pointerenter' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(any-hover: hover)').matches
  )
    return;
  // The help control opens on activation. Opening on pointer-induced focus
  // would put a top-layer panel over an in-flight touch before its click.
  if (
    !explicit &&
    event?.type === 'focusin' &&
    event.target instanceof Element &&
    event.target.closest('.ui-hover-info-help')
  )
    return;
  if (!explicit && event?.type === 'pointerenter' && Date.now() < ignorePointerUntil) return;
  if (event instanceof PointerEvent && event.pointerType === 'touch' && !explicit) return;
  cancel();
  if (explicit) {
    panel.value?.close(false);
    pinned.value = true;
  }
  if (shown.value && !explicit) return;
  autofocus.value = explicit;
  shown.value = true;
  document.addEventListener('keydown', key);
  const target =
    explicit && event?.currentTarget instanceof HTMLElement ? event.currentTarget : root.value;
  await nextTick();
  await panel.value?.open(target || undefined);
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape' && shown.value) {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}
watch(() => props.title, close);
onBeforeUnmount(close);
</script>
<template>
  <div
    ref="root"
    class="ui-hover-info"
    :data-preview-disabled="disabled || undefined"
    role="group"
    :tabindex="disabled ? 0 : undefined"
    :aria-label="title"
    :aria-describedby="shown ? id : undefined"
    @pointerenter="show($event)"
    @pointerleave="leave"
    @focusin="show($event)"
    @focusout="leave"
    @keydown="key"
  >
    <slot />
    <span v-if="showHelp" class="ui-hover-info-help-slot"
      ><UiButton
        class="ui-hover-info-help"
        icon="help"
        icon-only
        :label="'查看' + title"
        @click.stop="show($event, true)"
    /></span>
    <UiPopover
      :id="id"
      ref="panel"
      :title="title"
      placement="right"
      content-sized
      :autofocus="autofocus"
      @pointerenter="cancel"
      @pointerleave="leave"
      @focusin="cancel"
      @focusout="leave"
      @closed="closed"
      ><slot name="info"
    /></UiPopover>
  </div>
</template>
<style scoped>
.ui-hover-info {
  position: relative;
  min-width: 0;
}
.ui-hover-info:focus-visible {
  outline: var(--stitch-focus-ring);
  outline-offset: var(--stitch-focus-offset);
}
.ui-hover-info > :first-child {
  width: 100%;
  height: 100%;
}
.ui-hover-info[data-preview-disabled] > :first-child {
  pointer-events: none;
}
.ui-hover-info-help-slot {
  position: absolute;
  right: var(--stitch-space-8);
  top: var(--stitch-space-8);
  z-index: 1;
}
</style>
