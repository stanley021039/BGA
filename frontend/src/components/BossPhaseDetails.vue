<script setup lang="ts">
import { computed, useId } from 'vue';
import abilities from '../../../public/shared/boss-abilities.json';
import { bossPhaseProfiles } from '../services/boss-phase-art.js';
const props = defineProps<{ boss: string; phase: number; src: string }>();
const maskId = 'boss-phase-' + useId().replace(/[^a-z0-9-]/gi, '');
const profile = computed(() => bossPhaseProfiles[props.boss as keyof typeof bossPhaseProfiles]);
const paint = computed(() => abilities.find((a) => a.boss === props.boss));
const paths = computed(() =>
  profile.value ? [...profile.value.paths, ...(props.phase === 3 ? profile.value.final : [])] : [],
);
const eyes = computed(() =>
  profile.value
    ? [...(profile.value.eyes || []), ...(props.phase === 3 ? profile.value.extraEyes || [] : [])]
    : [],
);
</script>
<template>
  <svg
    v-if="phase > 1 && profile && paint"
    class="boss-phase-details"
    :data-boss-stage="phase"
    viewBox="0 0 256 256"
    aria-hidden="true"
  >
    <defs>
      <mask :id="maskId" style="mask-type: alpha">
        <image :href="src" width="256" height="256" />
      </mask>
    </defs>
    <g :mask="'url(#' + maskId + ')'">
      <path
        v-for="(path, i) in paths"
        :key="'etch-' + i"
        :d="path"
        fill="none"
        :stroke="i % 2 ? paint.color : paint.accent"
        :stroke-width="phase === 3 ? 2.4 : 1.6"
        stroke-linecap="round"
        :opacity="phase === 3 ? 0.8 : 0.6"
      />
      <g v-if="profile.core" class="boss-phase-energy">
        <ellipse
          :cx="profile.core[0]"
          :cy="profile.core[1]"
          :rx="profile.core[2]"
          :ry="profile.core[2] * 0.75"
          :fill="paint.accent"
          :opacity="phase === 3 ? 0.22 : 0.12"
        />
        <ellipse
          :cx="profile.core[0]"
          :cy="profile.core[1]"
          :rx="profile.core[2] * (phase === 3 ? 1 : 0.8)"
          :ry="profile.core[2] * 0.75"
          fill="none"
          :stroke="paint.accent"
          stroke-width="1.5"
          opacity=".8"
        />
      </g>
      <g v-for="(eye, i) in eyes" :key="'eye-' + i" class="boss-phase-energy">
        <ellipse
          :cx="eye[0]"
          :cy="eye[1]"
          :rx="boss === 'thanos' ? 2 : 3.2"
          :ry="boss === 'thanos' ? 2 : 1.9"
          :fill="i % 2 ? paint.color : paint.accent"
          opacity=".9"
        />
      </g>
      <g
        v-if="profile.vents"
        :stroke="paint.accent"
        stroke-width="1.7"
        stroke-linecap="round"
        :opacity="phase === 3 ? 0.85 : 0.55"
      >
        <path
          v-for="(vent, i) in profile.vents"
          :key="i"
          :d="'M' + (vent[0] - 5) + ',' + vent[1] + 'l8,-4m-6,8l8,-4m-6,8l8,-4'"
        />
      </g>
    </g>
  </svg>
</template>
<style scoped>
.boss-phase-details {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
