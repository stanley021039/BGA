<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import UiButton from './UiButton.vue';
import '../styles/scene-view.scss';
const hidden = ref(false);
const suppressed = new Map<HTMLElement, boolean>();
let previous: HTMLElement | null = null;
function set(value: boolean) {
  if (value === hidden.value) return;
  if (value) {
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document
      .querySelectorAll<HTMLElement>(
        '[data-site-header],.vue-lobby,.vue-game-workspace > :not(.vue-game-grid),.vue-game-grid > :not(.vue-room-background),.vue-room-side-panel,.vue-lobby-presence',
      )
      .forEach((el) => {
        suppressed.set(el, el.inert);
        el.inert = true;
      });
  } else {
    for (const [el, inert] of suppressed) el.inert = inert;
    suppressed.clear();
  }
  hidden.value = value;
  document.body.classList.toggle('scene-ui-hidden', value);
  if (value)
    document
      .querySelector<HTMLElement>('.vue-room-background,.lobby-backdrop')
      ?.focus({ preventScroll: true });
  else if (previous?.isConnected) previous.focus({ preventScroll: true });
}
function key(event: KeyboardEvent) {
  // An open dialog or popover takes Escape first; the next press restores the UI.
  if (
    !event.defaultPrevented &&
    event.key === 'Escape' &&
    hidden.value &&
    !document.querySelector('dialog:modal, :popover-open')
  ) {
    event.preventDefault();
    set(false);
  }
}
document.addEventListener('keydown', key);
onBeforeUnmount(() => {
  document.removeEventListener('keydown', key);
  set(false);
});
</script>
<template>
  <UiButton
    icon="landscape"
    icon-only
    label="背景：只顯示背景與角色"
    :aria-pressed="hidden"
    @click="set(true)"
  />
  <Teleport to="body"
    ><div v-if="hidden" class="scene-view-restore"
      ><UiButton label="恢復介面（Esc）" icon="close" @click="set(false)" /></div
  ></Teleport>
</template>
