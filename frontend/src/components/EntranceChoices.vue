<script setup lang="ts">
import MotionPolicy from '../engines/motion-policy.js';

import { onBeforeUnmount, onMounted, ref } from 'vue';
import { entranceEffectGroups } from '../services/effect-variants';
import { requestJson } from '../services/http';
import { sizedImage } from '../services/image-size';
import { apparate } from '../pages/lobby/apparition';
import {
  entranceEffect,
  entranceVariant,
  isFreeEntrance,
  setEntranceEffect,
  type EntranceEffectId,
} from '../services/entrance-effects';
import { usePreferencesStore } from '../stores/preferences';
import EffectVariantGroup from './EffectVariantGroup.vue';
import UiChoiceCard from './UiChoiceCard.vue';
const prefs = usePreferencesStore();
const unlocked = ref<string[]>([]);
const allowed = (id: string) => isFreeEntrance(id) || unlocked.value.includes(id);
const condition = (id: string) =>
  entranceVariant(id) ? '抽卡或碎片兌換解鎖' : '抽卡、碎片兌換或兌換碼解鎖';
onMounted(async () => {
  try {
    const data = (await requestJson('/api/achievements')) as {
      bonusRewards: { entrances: string[] };
      achievements: { id: string; description: string }[];
    };
    unlocked.value = data.bonusRewards.entrances;
    if (!allowed(entranceEffect.value)) setEntranceEffect('classic');
  } catch {
    /* Server also verifies reward ownership. */
  }
});
const stages = new Map<string, HTMLElement>();
let stop: (() => void) | undefined;
const still = () =>
  prefs.motion?.enabled === false ||
  prefs.motion?.reduced === true ||
  !MotionPolicy?.allowsMotion();
function play(groupId: string, id: EntranceEffectId) {
  const stage = stages.get(groupId),
    actor = stage?.querySelector<HTMLElement>('.entrance-preview-actor');
  stop?.();
  stop = undefined;
  if (!stage || !actor || still()) return;
  stop = apparate(actor, stage, id);
}
function choose(groupId: string, id: EntranceEffectId) {
  if (allowed(id)) setEntranceEffect(id);
  play(groupId, id);
}
onBeforeUnmount(() => stop?.());
</script>
<template>
  <div class="entrance-grid" role="group" aria-label="可用進場特效">
    <EffectVariantGroup
      v-for="group in entranceEffectGroups"
      :key="group.original.id"
      :original="group.original"
      :versions="group.versions"
      :preferred="[entranceEffect]"
      :allowed="allowed"
      @preview="play(group.original.id, $event)"
      v-slot="{ effect }"
      ><UiChoiceCard
        class="entrance-choice"
        :label="effect.label + (allowed(effect.id) ? '進場特效' : '進場特效預覽（未解鎖）')"
        :selected="entranceEffect === effect.id"
        @click="choose(group.original.id, effect.id)"
        @pointerenter="
          (event: PointerEvent) =>
            event.pointerType === 'mouse' && play(group.original.id, effect.id)
        "
        @focus="play(group.original.id, effect.id)"
        ><span
          :ref="(node) => node && stages.set(group.original.id, node as HTMLElement)"
          class="entrance-stage"
          aria-hidden="true"
          ><span class="entrance-preview-actor"
            ><img
              :src="sizedImage('/assets/characters/traveler-neutral.png', 128)"
              alt=""
              draggable="false"
            /><span>小雨</span></span
          ></span
        ><template #label
          ><strong class="ui-choice-label">{{ effect.label }}</strong
          ><span class="entrance-description">{{ effect.description }}</span></template
        ><template #selection
          ><span class="entrance-selection ui-choice-state">{{
            !allowed(effect.id)
              ? '🔒 ' + condition(effect.id)
              : entranceEffect === effect.id
                ? '✓ 使用中'
                : '套用特效'
          }}</span></template
        ></UiChoiceCard
      ></EffectVariantGroup
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
