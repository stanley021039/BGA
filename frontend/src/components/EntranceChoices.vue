<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { requestJson } from '../services/http';
import { sizedImage } from '../services/image-size';
import requirements from '../../../public/shared/entrance-requirements.json';
import { apparate } from '../pages/lobby/apparition';
import {
  entranceEffect,
  entranceEffects,
  setEntranceEffect,
  type EntranceEffectId,
} from '../services/entrance-effects';
import { usePreferencesStore } from '../stores/preferences';
import UiChoiceCard from './UiChoiceCard.vue';
const prefs = usePreferencesStore();
const unlocked = ref<string[]>([]),
  conditions = ref<Record<string, string>>({});
const allowed = (id: string) => !id.startsWith('stitch-') || unlocked.value.includes(id);
const condition = (id: string) =>
  conditions.value[requirements.find((item) => item.id === id)?.achievementId || ''] ||
  '完成對應成就解鎖；詳見成就頁';
onMounted(async () => {
  try {
    const data = (await requestJson('/api/achievements')) as {
      bonusRewards: { entrances: string[] };
      achievements: { id: string; description: string }[];
    };
    unlocked.value = data.bonusRewards.entrances;
    conditions.value = Object.fromEntries(
      data.achievements.map((item) => [item.id, item.description]),
    );
    if (!allowed(entranceEffect.value)) setEntranceEffect('classic');
  } catch {
    /* Server also verifies reward ownership. */
  }
});
const stages = new Map<EntranceEffectId, HTMLElement>(),
  stops = new Map<EntranceEffectId, () => void>();
const still = () =>
  prefs.motion?.enabled === false ||
  prefs.motion?.reduced === true ||
  !window.MotionPolicy?.allowsMotion();
function play(id: EntranceEffectId) {
  const stage = stages.get(id),
    actor = stage?.querySelector<HTMLElement>('.entrance-preview-actor');
  for (const stop of stops.values()) stop();
  stops.clear();
  if (!stage || !actor || still()) return;
  stops.set(id, apparate(actor, stage, id));
}
function choose(id: EntranceEffectId) {
  if (!allowed(id)) {
    play(id);
    return;
  }
  setEntranceEffect(id);
  play(id);
}
onBeforeUnmount(() => {
  for (const stop of stops.values()) stop();
});
</script>
<template>
  <div class="entrance-grid" role="group" aria-label="可用進場特效">
    <UiChoiceCard
      v-for="effect in entranceEffects"
      :key="effect.id"
      class="entrance-choice"
      :label="effect.label"
      :aria-label="effect.label + '進場特效'"
      :selected="entranceEffect === effect.id"
      :unavailable="!allowed(effect.id)"
      @click="choose(effect.id)"
      @mouseenter="play(effect.id)"
      @focus="play(effect.id)"
      ><span
        :ref="(node) => node && stages.set(effect.id, node as HTMLElement)"
        class="entrance-stage"
        aria-hidden="true"
        ><span class="entrance-preview-actor"
          ><img
            :src="sizedImage('/assets/characters/traveler-neutral.png', 128)"
            alt=""
            draggable="false"
          /><span>小雨</span></span
        ></span
      ><strong class="ui-choice-label">{{ effect.label }}</strong
      ><span class="entrance-description">{{ effect.description }}</span
      ><template #label></template
      ><template #selection
        ><span class="entrance-selection ui-choice-state">{{
          !allowed(effect.id)
            ? '🔒 ' + condition(effect.id)
            : entranceEffect === effect.id
              ? '✓ 使用中'
              : '套用特效'
        }}</span></template
      ></UiChoiceCard
    >
  </div>
</template>
<style lang="scss">
.entrance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  align-items: stretch;
  gap: var(--stitch-gap-controls);
  padding: var(--stitch-space-8);
}
.entrance-stage {
  position: relative;
  display: block;
  inline-size: 100%;
  block-size: 160px;
  overflow: hidden;
  border-radius: var(--stitch-radius-control);
  background: var(--stitch-surface);
}
.entrance-preview-actor {
  position: absolute;
  left: 50%;
  bottom: var(--stitch-space-20);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--stitch-space-2);
  transform: translateX(-50%);
  img {
    inline-size: 72px;
    block-size: 78px;
    object-fit: contain;
  }
  > span {
    padding: 0 var(--stitch-space-8);
    border: var(--stitch-border);
    border-radius: var(--stitch-radius-pill);
    background: var(--stitch-primary);
    color: var(--stitch-on-primary);
    font-size: var(--stitch-text-hint);
  }
}
.entrance-description {
  min-block-size: 3em;
  font-size: var(--stitch-text-hint);
  line-height: var(--stitch-line-height-body);
}
.entrance-selection {
  min-block-size: 3em;
  font-size: var(--stitch-text-hint);
  font-weight: var(--stitch-weight-title);
}
</style>
