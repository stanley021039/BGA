<script setup lang="ts">
import { ref, shallowRef, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import type { LobbyVisitor } from '../contracts/lobby';
import BossPhaseDetails from './BossPhaseDetails.vue';
import BossMouths from './BossMouths.vue';
import abilities from '../../../public/shared/boss-abilities.json';
import { bossStageSpec, bossAttackPlan } from '../engines/boss-geometry.js';
import { ghidorahMouthOpenings } from '../services/boss-mouths.js';
import { createBossPuppet } from '../services/boss-puppet.js';
import { bossPhaseArt, bossPhaseImage } from '../services/boss-body-art';
import { warm } from '../services/preload';
import { sizedImage } from '../services/image-size';
const props = defineProps<{
  visitor: LobbyVisitor;
  src: string;
  active: boolean;
  serverNow: number;
}>();
const phase = computed(() => props.visitor.bossPhase || 1);
const imageSize = ref<128 | 256 | 512>(256);
const body = computed(() =>
  bossPhaseImage(props.visitor.bossId || '', phase.value, props.src, imageSize.value),
);
watch(
  () => [props.visitor.bossId, imageSize.value] as const,
  ([id, size]) => {
    if (id && bossPhaseArt[id])
      warm(Object.values(bossPhaseArt[id]).map((url) => sizedImage(url, size)));
  },
  { immediate: true },
);
const node = ref<HTMLElement | null>(null);
let sizeObserver: ResizeObserver | undefined;
onMounted(() => {
  if (!node.value || typeof ResizeObserver === 'undefined') return;
  sizeObserver = new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    imageSize.value = width <= 128 ? 128 : width <= 256 ? 256 : 512;
  });
  sizeObserver.observe(node.value);
});
const beamIntent = shallowRef<NonNullable<LobbyVisitor['bossIntent']> | null>(null);
watch(
  () => [props.visitor.bossIntent, props.visitor.bossId, props.visitor.health, props.active],
  () => {
    const intent = props.visitor.bossIntent;
    if (!props.active || !props.visitor.health || props.visitor.bossId !== 'ghidorah-turtle') {
      beamIntent.value = null;
    } else if (intent) {
      if (!['boss_ghidorah_turtle_q', 'boss_ghidorah_turtle_r'].includes(intent.effect))
        beamIntent.value = null;
      else if (
        beamIntent.value?.until !== intent.until ||
        beamIntent.value?.effect !== intent.effect
      )
        beamIntent.value = { ...intent };
    }
  },
  { immediate: true },
);
const beamPose = computed(() => {
  const intent = beamIntent.value;
  if (!intent) return null;
  const rate = intent.attackRate === 1.3 ? 1.3 : intent.attackRate === 1.15 ? 1.15 : 1;
  const spec = bossStageSpec(
    abilities.find((a) => a.id === intent.effect),
    rate === 1.3 ? 3 : rate === 1.15 ? 2 : 1,
  );
  if (!spec) return null;
  const plan = bossAttackPlan(spec, { x: 20, y: 65 }, { x: 55, y: 65 });
  const strikes = plan.map((s) => ({
    at: s.at,
    heads: s.spec.head !== undefined ? [s.spec.head] : s.zones.length >= 3 ? [0, 1, 2] : [1],
  }));
  const hold = spec.slot === 'q' && plan.length === 1 ? Math.min(700, spec.duration) : 350;
  const start = intent.until - spec.windup / rate;
  return {
    strikes,
    windup: spec.windup,
    rate,
    hold,
    start,
    energy: spec.accent,
    end: start + Math.min(4200, plan.at(-1)!.at + hold + 200) / rate,
  };
});
const mouthOpenings = computed(() =>
  beamPose.value
    ? ghidorahMouthOpenings(
        beamPose.value.strikes,
        (props.serverNow - beamPose.value.start) * beamPose.value.rate,
        beamPose.value.windup,
        beamPose.value.hold,
      )
    : [0, 0, 0],
);
let puppet: ReturnType<typeof createBossPuppet> = null;
function refresh() {
  if (beamPose.value && props.serverNow > beamPose.value.end) beamIntent.value = null;
  if (!node.value) return;
  if (
    !props.active ||
    !props.visitor.health ||
    (props.visitor.immobileUntil || 0) > props.serverNow
  ) {
    beamIntent.value = null;
    puppet?.dispose();
    puppet = null;
    return;
  }
  puppet ||= createBossPuppet(node.value, props.visitor.bossId || '');
  puppet?.update(
    {
      moving: props.visitor.moving,
      phase: props.visitor.bossPhase || 1,
      arrivalAt: props.visitor.bossArrivalAt,
      facing: props.visitor.facing,
      intent: props.visitor.bossIntent,
      health: props.visitor.health,
      connected: props.active,
    },
    props.serverNow,
  );
}
onMounted(refresh);
watch(() => [props.visitor, props.active, props.serverNow], refresh, { flush: 'post' });
function visibility() {
  if (document.hidden) beamIntent.value = null;
  puppet?.dispose();
  puppet = null;
  if (!document.hidden) refresh();
}
onMounted(() => document.addEventListener('visibilitychange', visibility));
onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  beamIntent.value = null;
  puppet?.dispose();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div
    ref="node"
    class="boss-puppet"
    :class="{ 'is-facing-left': visitor.facing === 'left' }"
    aria-hidden="true"
  >
    <svg class="boss-still" viewBox="0 0 256 256">
      <BossMouths
        v-if="visitor.bossId === 'ghidorah-turtle'"
        :src="body"
        :phase="phase"
        :openings="mouthOpenings"
        :energy="beamPose?.energy || ''"
      />
      <image v-else :href="body" width="256" height="256" />
    </svg>
    <div class="boss-action" data-boss-action>
      <div
        v-for="part in ['lower', 'torso', 'head']"
        :key="part"
        class="boss-part"
        :data-boss-part="part"
      >
        <svg viewBox="0 0 256 256">
          <BossMouths
            v-if="visitor.bossId === 'ghidorah-turtle' && part === 'head'"
            :src="body"
            :phase="phase"
            :openings="mouthOpenings"
            :energy="beamPose?.energy || ''"
          />
          <image v-else :href="body" width="256" height="256" />
        </svg>
      </div>
    </div>
    <BossPhaseDetails
      v-if="visitor.health && phase > 1 && !bossPhaseArt[visitor.bossId || '']"
      :boss="visitor.bossId || ''"
      :phase="visitor.bossPhase || 1"
      :src="src"
    />
  </div>
</template>
<style scoped>
.boss-puppet {
  display: inline-block;
  position: relative;
}
.boss-puppet svg {
  display: block;
  width: 100%;
  height: 100%;
}
.boss-puppet.is-facing-left svg {
  transform: scaleX(-1);
}
.boss-action,
.boss-part {
  position: absolute;
  inset: 0;
  transform-origin: 50% 85%;
}
.boss-action {
  visibility: hidden;
}
.boss-puppet[data-animated] .boss-still {
  visibility: hidden;
}
.boss-puppet[data-animated] .boss-action {
  visibility: visible;
}
.boss-part[data-boss-part='head'] {
  clip-path: inset(0 0 58% 0);
  transform-origin: 50% 44%;
}
.boss-part[data-boss-part='torso'] {
  clip-path: inset(36% 0 20% 0);
  transform-origin: 50% 76%;
}
.boss-part[data-boss-part='lower'] {
  clip-path: inset(74% 0 0 0);
}
.boss-puppet[data-animated] :deep(.boss-phase-energy) {
  animation: boss-phase-breathe 2.4s ease-in-out infinite alternate;
}
@keyframes boss-phase-breathe {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}
</style>
