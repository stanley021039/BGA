<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  useId,
  watch,
  type Ref,
} from 'vue';
import UiPopover from './UiPopover.vue';
import UiButton from './UiButton.vue';
const props = withDefaults(
  defineProps<{
    title: string;
    disabled?: boolean;
    showHelp?: boolean;
    interactive?: boolean;
    helpOnly?: boolean;
  }>(),
  { showHelp: true, interactive: false, helpOnly: false },
);
const ancestorManual = inject<Ref<boolean>>('ui-hover-manual', ref(false));
const manualTree = computed(() => props.interactive || ancestorManual.value);
provide('ui-hover-manual', manualTree);
const id = useId(),
  root = ref<HTMLElement | null>(null),
  panel = ref<InstanceType<typeof UiPopover> | null>(null);
const shown = ref(false),
  pinned = ref(false),
  autofocus = ref(false);
let suppressEnter = false;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
function hold() {
  clearTimeout(leaveTimer);
}
function closed() {
  hold();
  shown.value = pinned.value = false;
  document.removeEventListener('keydown', key, true);
  document.removeEventListener('pointerdown', outside);
}
function close() {
  panel.value?.close(false);
  closed();
}
function contains(target: EventTarget | null) {
  return (
    target instanceof Element &&
    (!!root.value?.contains(target) || !!document.getElementById(id)?.contains(target))
  );
}
function outside(event: PointerEvent) {
  if (props.interactive && !contains(event.target)) {
    close();
    suppressEnter = true;
  }
}
function leave(event?: Event) {
  if (pinned.value) return;
  if (props.interactive) {
    if (event?.type === 'focusout' && contains((event as FocusEvent).relatedTarget)) return;
    if (contains(document.activeElement)) return;
    hold();
    leaveTimer = setTimeout(close, 200);
  } else close();
}
function sourceLeave(event: Event) {
  suppressEnter = false;
  leave(event);
}
function sourceBlur(event: FocusEvent) {
  if (!contains(event.relatedTarget)) suppressEnter = false;
  leave(event);
}
function enterPanel(event: Event) {
  if (props.interactive) hold();
  else leave(event);
}
function move(event: PointerEvent) {
  suppressEnter = false;
  if (!shown.value) void show(event);
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
  if (!explicit && suppressEnter && ['pointerenter', 'focusin'].includes(event?.type || '')) return;
  if (event instanceof PointerEvent && event.pointerType === 'touch' && !explicit) return;
  hold();
  if (explicit) {
    panel.value?.close(false);
    pinned.value = !props.interactive;
  }
  if (shown.value && !explicit) return;
  autofocus.value = explicit;
  shown.value = true;
  document.addEventListener('keydown', key, true);
  if (props.interactive) document.addEventListener('pointerdown', outside);
  const target =
    explicit && event?.currentTarget instanceof HTMLElement ? event.currentTarget : root.value;
  await nextTick();
  if (!shown.value) return;
  await panel.value?.open(target || undefined);
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape' && shown.value) {
    event.preventDefault();
    event.stopPropagation();
    close();
    suppressEnter = true;
  }
}
watch(() => props.title, close);
onBeforeUnmount(close);
</script>
<template>
  <div
    ref="root"
    class="ui-hover-info"
    :data-help-only="helpOnly || undefined"
    :data-preview-disabled="disabled || undefined"
    role="group"
    :tabindex="disabled ? 0 : undefined"
    :aria-label="title"
    :aria-describedby="shown ? id : undefined"
    @pointerenter="show($event)"
    @pointermove="move"
    @pointerleave="sourceLeave($event)"
    @focusin="show($event)"
    @focusout="sourceBlur($event)"
    @click="interactive && show($event, true)"
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
      avoid-anchor
      :manual="manualTree"
      :show-close="showHelp && !helpOnly"
      :autofocus="autofocus"
      @pointerenter="enterPanel($event)"
      @pointerleave="leave($event)"
      @focusin="interactive && hold()"
      @focusout="leave($event)"
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
.ui-hover-info[data-help-only] {
  flex: none;
  width: var(--stitch-control-height);
  height: var(--stitch-control-height);
}
.ui-hover-info[data-help-only] > .ui-hover-info-help-slot {
  position: static;
  display: block;
}
</style>
