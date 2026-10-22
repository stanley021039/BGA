<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { apparate } from '../pages/lobby/apparition';
import type { EntranceEffectId } from '../services/entrance-effects';
import { usePreferencesStore } from '../stores/preferences';
// Plays the chosen entrance effect on the player's own character.
const props = defineProps<{ effect: EntranceEffectId; image: string; name: string }>();
const prefs = usePreferencesStore(),
  stage = ref<HTMLElement | null>(null);
let stop: (() => void) | null = null;
function play() {
  const actor = stage.value?.querySelector<HTMLElement>('.entrance-preview-actor');
  stop?.();
  stop = null;
  if (
    !stage.value ||
    !actor ||
    prefs.motion?.enabled === false ||
    prefs.motion?.reduced === true ||
    !window.MotionPolicy?.allowsMotion()
  )
    return;
  stop = apparate(actor, stage.value, props.effect);
}
watch(() => props.effect, play);
onMounted(play);
onBeforeUnmount(() => stop?.());
defineExpose({ play });
</script>
<template>
  <button type="button" class="entrance-preview" aria-label="重播進場特效" @click="play"
    ><span ref="stage" class="entrance-stage" aria-hidden="true"
      ><span class="entrance-preview-actor"
        ><img :src="image" alt="" draggable="false" /><span>{{ name }}</span></span
      ></span
    ><span class="entrance-preview-hint">點一下重播</span></button
  >
</template>
<style lang="scss">
// ui-primitives.css forces a pill border/radius on every button.
.entrance-preview {
  display: grid;
  gap: 4px;
  inline-size: 100%;
  padding: 0;
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.entrance-preview-hint {
  font-size: 12px;
  color: var(--stitch-muted, inherit);
}
</style>
