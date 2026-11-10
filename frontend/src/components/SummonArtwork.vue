<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { summonAssets } from '../services/summon-assets';
import rules from '../../../public/shared/scene-rules.json';
import { watchMotionCancellation } from '../services/motion-lifetime.js';

const props = defineProps<{ effect: string; remainingMs: number; preview?: boolean }>();
const active = ref(false);
const assets = summonAssets(props.effect);
const offset = props.remainingMs - rules.susanoo.durationMs;
const bladePaths: Readonly<Record<string, string>> = {
  susanoo: 'M63 66 Q81 64 98 56',
  susanoo_orange: 'M31 62 Q17 76 2 97',
  susanoo_alt: 'M16 56 Q15 27 21 2',
  susanoo_blue: 'M25 61 Q14 72 5 94 M76 61 Q85 75 95 94',
  susanoo_cyan: 'M31 53 Q16 61 4 75 M72 57 Q86 67 96 83',
};
const bladePath = bladePaths[props.effect];
let stop: (() => void) | undefined;
onMounted(() => {
  active.value = true;
  stop = watchMotionCancellation(() => (active.value = false));
});
onBeforeUnmount(() => stop?.());
</script>

<template>
  <div
    v-if="active && assets"
    class="scene-summon"
    :class="{ 'is-preview': preview }"
    :style="{ animationDelay: offset + 'ms', animationDuration: rules.susanoo.durationMs + 'ms' }"
    aria-hidden="true"
  >
    <div class="scene-summon-gesture">
      <picture>
        <source v-if="!preview" media="(max-width: 640px)" :srcset="assets[0]" />
        <img :src="assets[1]" alt="" decoding="async" draggable="false" />
      </picture>
      <svg v-if="bladePath" class="scene-summon-edge" viewBox="0 0 100 100" fill="none">
        <path
          :d="bladePath"
          stroke="white"
          stroke-width="2.4"
          opacity="0.43"
          stroke-linecap="round"
        />
        <path :d="bladePath" stroke="white" stroke-width="0.75" stroke-linecap="round" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.scene-summon {
  position: absolute;
  left: 50%;
  bottom: -15%;
  width: 212px;
  transform: translateX(-50%);
  pointer-events: none;
  animation: summon-form linear both;
}
.scene-summon-gesture {
  position: relative;
  opacity: 0.82;
  transform-origin: 50% 73%;
  animation: summon-gesture linear both;
  animation-delay: inherit;
  animation-duration: inherit;
}
.scene-summon-gesture img {
  display: block;
  width: 100%;
  height: auto;
}
.scene-summon-edge {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  animation: summon-edge linear both;
  animation-delay: inherit;
  animation-duration: inherit;
}
.scene-summon.is-preview {
  width: min(78%, 380px, 70vh);
  bottom: 28%;
}
@media (max-width: 640px) {
  .scene-summon {
    width: 142px;
  }
}
/* Windup, hit and recovery follow the three shared combat sweeps at 1s, 2.45s and 3.9s. */
@keyframes summon-gesture {
  0%,
  15.3%,
  26%,
  44.3%,
  55%,
  73.3%,
  84%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  18%,
  76% {
    transform: translate(-8%, 3%) rotate(-20deg) scale(0.98);
  }
  20%,
  78% {
    transform: translate(10%, -5%) rotate(26deg) scale(1.08);
  }
  47% {
    transform: translate(8%, 3%) rotate(20deg) scale(0.98);
  }
  49% {
    transform: translate(-10%, -5%) rotate(-26deg) scale(1.08);
  }
}
@keyframes summon-edge {
  0%,
  17%,
  25%,
  46%,
  54%,
  75%,
  83%,
  100% {
    opacity: 0;
  }
  20%,
  49%,
  78% {
    opacity: 1;
  }
}
@keyframes summon-form {
  0% {
    opacity: 0;
    scale: 0.82;
  }
  8%,
  91% {
    opacity: 1;
    scale: 1;
  }
  100% {
    opacity: 0;
    scale: 1.05;
  }
}
</style>
