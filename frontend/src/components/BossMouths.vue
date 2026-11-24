<script setup lang="ts">
import { computed, useId } from 'vue';
import { ghidorahMouthsFor, ghidorahMouthPaint as paint } from '../services/boss-mouths.js';
const props = defineProps<{ src: string; openings: number[]; energy: string; phase?: number }>();
const id = 'boss-mouth-' + useId().replace(/[^a-z0-9-]/gi, '');
const mouths = computed(() =>
  ghidorahMouthsFor(props.phase)
    .map((m, i) => ({ ...m, index: i, amount: Math.max(0, Math.min(1, props.openings[i] || 0)) }))
    .filter((m) => m.amount > 0.01),
);
</script>
<template>
  <g>
    <defs v-if="mouths.length">
      <mask :id="id" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <rect width="256" height="256" fill="white" />
        <path v-for="m in mouths" :key="m.index" :d="m.jaw" fill="black" />
      </mask>
      <clipPath
        v-for="m in mouths"
        :id="id + '-jaw-' + m.index"
        :key="m.index"
        clipPathUnits="userSpaceOnUse"
      >
        <path :d="m.jaw" />
      </clipPath>
    </defs>
    <image
      :href="src"
      width="256"
      height="256"
      :mask="mouths.length ? 'url(#' + id + ')' : undefined"
    />
    <g v-for="m in mouths" :key="m.index" :data-mouth-head="m.index" :data-mouth-open="m.amount">
      <ellipse
        :cx="m.x"
        :cy="m.y + 1.4 * m.amount"
        :rx="m.rx + 0.8 * m.amount"
        :ry="0.8 + 2.5 * m.amount"
        :fill="paint.cavity"
      />
      <g :transform="'translate(0,' + 2.7 * m.amount + ')'">
        <image
          :href="src"
          width="256"
          height="256"
          :clip-path="'url(#' + id + '-jaw-' + m.index + ')'"
        />
      </g>
      <path
        :d="'M' + (m.x - m.rx * 0.65) + ',' + m.y + 'q' + m.rx * 0.65 + ',1 ' + m.rx * 1.3 + ',0'"
        fill="none"
        :stroke="paint.teeth"
        stroke-width="0.8"
      />
      <ellipse
        :cx="m.x"
        :cy="m.y + 0.8 * m.amount"
        :rx="1.5 * m.amount"
        :ry="1.1 * m.amount"
        :fill="energy"
        :opacity="m.amount * 0.75"
      />
    </g>
  </g>
</template>
