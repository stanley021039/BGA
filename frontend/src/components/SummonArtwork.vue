<script setup lang="ts">
import { onBeforeUnmount, onMounted, nextTick, ref, useId } from 'vue';
import { summonAssets, summonImage } from '../services/summon-assets';
import { summonRig, summonArmor } from '../services/summon-rig';
import rules from '../../../public/shared/scene-rules.json';
import effects from '../../../public/shared/attack-effects.json';
import { watchMotionCancellation } from '../services/motion-lifetime.js';

const props = defineProps<{ effect: string; remainingMs: number; preview?: boolean }>();
const active = ref(false);
const node = ref<HTMLElement | null>(null),
  image = ref<string>();
let observer: ResizeObserver | undefined,
  disposed = false;
const assets = summonAssets(props.effect);
const rig = summonRig(props.effect);
const armor = summonArmor(props.effect);
const maskId = 'summon-body-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
const offset = props.remainingMs - rules.susanoo.durationMs;
const bladePaths: Readonly<Record<string, string>> = {
  susanoo: 'M63 66 Q81 64 98 56',
  susanoo_orange: 'M31 62 Q17 76 2 97',
  susanoo_alt: 'M16 56 Q15 27 21 2',
  susanoo_blue: 'M25 61 Q14 72 5 94 M76 61 Q85 75 95 94',
  susanoo_cyan: 'M31 53 Q16 61 4 75 M72 57 Q86 67 96 83',
};
const bladePath = bladePaths[props.effect];
const bladeColor =
  effects.find((effect) => effect.id === props.effect)?.slashColor || 'currentColor';
let stop: (() => void) | undefined;
onMounted(async () => {
  active.value = true;
  stop = watchMotionCancellation(() => {
    active.value = false;
    observer?.disconnect();
  });
  await nextTick();
  if (disposed || !active.value || !node.value) return;
  const select = (width: number) => {
    if (active.value && !disposed) image.value = summonImage(props.effect, width);
  };
  select(node.value.clientWidth);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([entry]) => select(entry.contentRect.width));
    observer.observe(node.value);
  }
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  stop?.();
});
</script>

<template>
  <div
    v-if="active && assets"
    class="scene-summon"
    ref="node"
    :data-summon="effect"
    :class="{ 'is-preview': preview }"
    :style="{ animationDelay: offset + 'ms', animationDuration: rules.susanoo.durationMs + 'ms' }"
    aria-hidden="true"
  >
    <div class="scene-summon-gesture">
      <svg class="scene-summon-definitions" width="0" height="0" aria-hidden="true">
        <defs>
          <mask :id="maskId" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill="white" />
            <path v-for="(part, index) in rig" :key="index" :d="part.path" fill="black" />
            <path v-for="(path, index) in armor" :key="'armor-' + index" :d="path" fill="white" />
          </mask>
          <mask
            v-for="(part, index) in rig"
            :key="index"
            :id="maskId + '-arm-' + index"
            maskUnits="objectBoundingBox"
            maskContentUnits="objectBoundingBox"
          >
            <path :d="part.path" fill="white" />
            <path v-for="(path, guard) in armor" :key="guard" :d="path" fill="black" />
          </mask>
        </defs>
      </svg>
      <picture>
        <img
          v-if="image"
          :src="image"
          :style="{ mask: `url(#${maskId})` }"
          alt=""
          decoding="async"
          draggable="false"
        />
      </picture>
      <div
        v-for="(part, index) in rig"
        :key="index"
        class="scene-summon-arm"
        :class="index === 0 ? 'is-left' : 'is-right'"
        :style="{ transformOrigin: part.origin }"
      >
        <img
          v-if="image"
          :src="image"
          :style="{ mask: `url(#${maskId}-arm-${index})` }"
          alt=""
          decoding="async"
          draggable="false"
        />
        <svg
          v-if="bladePath"
          class="scene-summon-edge"
          :style="{ mask: `url(#${maskId}-arm-${index})` }"
          viewBox="0 0 100 100"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            :d="bladePath"
            :stroke="bladeColor"
            stroke-width="2.4"
            opacity="0.43"
            stroke-linecap="round"
          />
          <path :d="bladePath" stroke="white" stroke-width="0.75" stroke-linecap="round" />
        </svg>
      </div>
      <svg
        v-if="effect === 'susanoo_blue'"
        class="scene-summon-engraving"
        viewBox="0 0 100 100"
        fill="none"
        :stroke="bladeColor"
        stroke-linejoin="round"
      >
        <path
          d="M46 16 48 11 50 3 52 11 54 16 M45 22 48 24 50 23 52 24 55 22 M48 26 50 29 52 26"
          stroke-width="0.55"
        />
        <path
          d="M40 30 50 38 60 30 59 40 50 47 41 40Z M45 33 50 36 55 33 M50 38V46"
          stroke-width="0.45"
        />
        <path
          v-for="i in 5"
          :key="'rib' + i"
          :d="`M${40 + i * 0.7} ${39 + i * 2.4} L50 ${45 + i * 2.1} L${60 - i * 0.7} ${39 + i * 2.4}`"
          stroke-width="0.35"
          opacity="0.7"
        />
        <g v-for="side in [-1, 1]" :key="side" :transform="`translate(50 0) scale(${side} 1)`">
          <path
            v-for="i in 4"
            :key="i"
            :d="`M${13 + i * 1.6} ${22 + i * 3.8} Q${23 + i * 1.6} ${20 + i * 3.8} ${32 + i * 1.5} ${29 + i * 3.8}`"
            stroke-width="0.5"
          />
          <path d="M8 31 13 34 10 40 7 36Z M11 48 14 51 11 54 8 51Z" stroke-width="0.4" />
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.scene-summon {
  position: absolute;
  left: 50%;
  bottom: -15%;
  width: 276px;
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
.scene-summon-definitions {
  position: absolute;
}
.scene-summon-arm,
.scene-summon-engraving {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.scene-summon-arm {
  animation: summon-arm-left linear both;
  animation-delay: inherit;
  animation-duration: inherit;
}
.scene-summon-arm.is-right {
  animation-name: summon-arm-right;
}
.scene-summon-arm img {
  height: 100%;
}
.scene-summon-engraving {
  opacity: 0.65;
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
.scene-summon[data-summon='susanoo_blue']:not(.is-preview) {
  width: 331px;
}
@media (max-width: 640px) {
  .scene-summon {
    width: 192px;
  }
  .scene-summon[data-summon='susanoo_blue']:not(.is-preview) {
    width: 230px;
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
    transform: translate(-3%, 2%) rotate(-7deg) scale(0.98);
  }
  20%,
  78% {
    transform: translate(4%, -2%) rotate(9deg) scale(1.04);
  }
  47% {
    transform: translate(3%, 2%) rotate(7deg) scale(0.98);
  }
  49% {
    transform: translate(-4%, -2%) rotate(-9deg) scale(1.04);
  }
}
@keyframes summon-arm-left {
  0%,
  12%,
  29%,
  41%,
  58%,
  70%,
  87%,
  100% {
    transform: rotate(0deg);
  }
  18%,
  76% {
    transform: rotate(110deg) translateY(-2%);
  }
  20%,
  78% {
    transform: rotate(15deg) translateY(1%);
  }
  22%,
  80% {
    transform: rotate(-3deg);
  }
  47% {
    transform: rotate(100deg) translateY(-2%);
  }
  49% {
    transform: rotate(5deg) translateY(1%);
  }
  51% {
    transform: rotate(-8deg);
  }
}
@keyframes summon-arm-right {
  0%,
  12%,
  29%,
  41%,
  58%,
  70%,
  87%,
  100% {
    transform: rotate(0deg);
  }
  18%,
  76% {
    transform: rotate(-110deg) translateY(-2%);
  }
  20%,
  78% {
    transform: rotate(-15deg) translateY(1%);
  }
  22%,
  80% {
    transform: rotate(3deg);
  }
  47% {
    transform: rotate(-100deg) translateY(-2%);
  }
  49% {
    transform: rotate(-5deg) translateY(1%);
  }
  51% {
    transform: rotate(8deg);
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
