<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { apparate } from '../pages/lobby/apparition';
import {
  entranceEffect,
  entranceEffects,
  setEntranceEffect,
  type EntranceEffectId,
} from '../services/entrance-effects';
import { usePreferencesStore } from '../stores/preferences';
const prefs = usePreferencesStore();
const stages = new Map<EntranceEffectId, HTMLElement>(),
  stops = new Map<EntranceEffectId, () => void>();
const still = () =>
  prefs.motion?.enabled === false ||
  prefs.motion?.reduced === true ||
  !window.MotionPolicy?.allowsMotion();
function play(id: EntranceEffectId) {
  const stage = stages.get(id),
    actor = stage?.querySelector<HTMLElement>('.entrance-preview-actor');
  stops.get(id)?.();
  if (!stage || !actor || still()) return;
  stops.set(id, apparate(actor, stage, id));
}
function choose(id: EntranceEffectId) {
  setEntranceEffect(id);
  play(id);
}
onBeforeUnmount(() => {
  for (const stop of stops.values()) stop();
});
</script>
<template>
  <div class="entrance-grid" role="group" aria-label="可用進場特效">
    <button
      v-for="effect in entranceEffects"
      :key="effect.id"
      type="button"
      class="entrance-choice"
      :aria-label="effect.label + '進場特效'"
      :aria-pressed="entranceEffect === effect.id"
      @click="choose(effect.id)"
      @mouseenter="play(effect.id)"
      ><span
        :ref="(node) => node && stages.set(effect.id, node as HTMLElement)"
        class="entrance-stage"
        aria-hidden="true"
        ><span class="entrance-preview-actor"
          ><img src="/assets/characters/traveler-neutral.png" alt="" draggable="false" /><span
            >小雨</span
          ></span
        ></span
      ><strong>{{ effect.label }}</strong
      ><span class="entrance-description">{{ effect.description }}</span
      ><span class="entrance-selection">{{
        entranceEffect === effect.id ? '✓ 使用中' : '套用特效'
      }}</span></button
    >
  </div>
</template>
<style lang="scss">
.entrance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 16px;
}
// ui-primitives.css forces a pill border/radius on every button.
.entrance-choice {
  display: grid;
  gap: 6px;
  justify-items: start;
  padding: 12px;
  border: 1px solid var(--play-line-strong, #8f8676) !important;
  border-radius: 12px !important;
  background: var(--play-paper, #fff);
  color: var(--play-ink, inherit);
  text-align: start;
  cursor: pointer;
}
.entrance-choice[aria-pressed='true'] {
  border-color: var(--play-ink, #292639) !important;
  box-shadow: 0 0 0 2px var(--play-yellow, #f6c453);
}
.entrance-stage {
  position: relative;
  display: block;
  width: 100%;
  height: 160px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--play-surface, #fff8ee);
}
.entrance-preview-actor {
  position: absolute;
  left: 50%;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transform: translateX(-50%);
  img {
    width: 72px;
    height: 78px;
    object-fit: contain;
  }
  > span {
    padding: 0 8px;
    border: 1px solid var(--play-ink, #292639);
    border-radius: 16px;
    background: var(--play-yellow, #f6c453);
    font-size: 11px;
  }
}
.entrance-description {
  font-size: 13px;
  line-height: 1.5;
}
.entrance-selection {
  font-size: 13px;
  font-weight: 700;
}
</style>
