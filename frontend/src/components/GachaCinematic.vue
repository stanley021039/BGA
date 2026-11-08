<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue';
import {
  gachaChart,
  gachaChartRandom,
  gachaTimeline,
  type GachaEnding,
  type GachaSound,
} from '../services/gacha-cinematic';
import { motionAllowed, watchMotionCancellation } from '../services/motion-lifetime.js';
import UiBadge from './UiBadge.vue';
const props = defineProps<{
  name: string;
  ending?: GachaEnding;
  chartId?: string;
  elapsedMs?: number;
  spectator?: boolean;
  image?: string;
  fullViewport?: boolean;
}>();
const emit = defineEmits<{
  complete: [cancelled: boolean];
  sound: [cue: GachaSound];
  settle: [];
}>();
const phase = ref<'cash' | 'order' | 'sync' | 'trading' | 'settled'>('cash');
const traderReady = ref(false);
const indexFormatter = new Intl.NumberFormat('zh-TW');
const chart = computed(() =>
  gachaChart(props.ending ?? 'flat', props.chartId ? gachaChartRandom(props.chartId) : undefined),
);
const marketCandles = computed(() =>
  chart.value.candles.map((candle) => {
    // Keep a legible body for near-flat prices while keeping its center on the actual move.
    const height = Math.max(8, candle.height);
    return { ...candle, height, y: candle.y + (candle.height - height) / 2 };
  }),
);
const elapsed = props.elapsedMs ?? 0;
const tradingElapsed = Math.max(0, elapsed - gachaTimeline.trading);
const liveQuote = ref({ value: chart.value.opening, direction: '' });
let lastQuoteIndex = -1;
const chartClip = useId();
const settled = computed(() => !!props.ending && phase.value === 'settled');
const chartVisible = computed(() => phase.value === 'trading' || settled.value);
const barDelay = (i: number) => `${i * gachaTimeline.candleInterval - tradingElapsed}ms`;
function showQuote(value: number, index: number) {
  if (settled.value || index <= lastQuoteIndex) return;
  lastQuoteIndex = index;
  const previous = liveQuote.value.value;
  liveQuote.value = {
    value,
    direction: value === previous ? '' : value > previous ? 'up' : 'down',
  };
}
const trendClass = computed(() =>
  props.ending === 'rise' ? 'stock-up' : props.ending === 'fall' ? 'stock-down' : 'stock-neutral',
);
const cashNotes = Array.from({ length: 18 }, (_, i) => ({
  '--cash-x': `${5 + ((i * 29) % 87)}%`,
  '--cash-y': `${5 + ((i * 37) % 76)}%`,
  '--cash-tilt': `${((i * 57) % 124) - 62}deg`,
  '--cash-delay': `${(i % 6) * 32}ms`,
}));
const jobs: ReturnType<typeof setTimeout>[] = [];
let stop: (() => void) | undefined,
  finished = false;
watch(
  () => props.ending,
  (ending) => {
    if (props.spectator && ending) phase.value = 'settled';
  },
);
function clear() {
  jobs.splice(0).forEach(clearTimeout);
  const release = stop;
  stop = undefined;
  release?.();
}
function finish(cancelled = false) {
  if (finished) return;
  finished = true;
  clear();
  emit('complete', cancelled);
}
onMounted(() => {
  if (!motionAllowed() && !props.spectator) return finish(true);
  if (props.spectator) {
    if (props.ending) {
      phase.value = 'settled';
      return;
    }
    if (!motionAllowed()) {
      phase.value = 'trading';
      return;
    }
    const at = (time: number, fn: () => void) => {
      if (elapsed >= time) fn();
      else jobs.push(setTimeout(fn, time - elapsed));
    };
    at(gachaTimeline.order, () => (phase.value = 'order'));
    at(gachaTimeline.sync, () => (phase.value = 'sync'));
    at(gachaTimeline.trading, () => (phase.value = 'trading'));
    at(gachaTimeline.settlement, () => {
      if (props.ending) phase.value = 'settled';
    });
    stop = watchMotionCancellation(() => {
      clear();
      phase.value = props.ending ? 'settled' : 'trading';
    });
    return;
  }
  emit('sound', 'gacha-rush');
  jobs.push(setTimeout(() => (phase.value = 'order'), gachaTimeline.order));
  jobs.push(setTimeout(() => (phase.value = 'sync'), gachaTimeline.sync));
  jobs.push(
    setTimeout(() => {
      phase.value = 'trading';
      emit('sound', 'gacha-shuffle');
    }, gachaTimeline.trading),
  );
  jobs.push(
    setTimeout(() => {
      phase.value = 'settled';
      emit('settle');
      const closingSound = {
        rise: 'gacha-success',
        fall: 'gacha-scream',
        flat: 'gacha-flat',
      } as const;
      if (props.ending) emit('sound', closingSound[props.ending]);
    }, gachaTimeline.settlement),
  );
  jobs.push(setTimeout(() => finish(), gachaTimeline.complete));
  stop = watchMotionCancellation(() => finish(true));
  if (finished) clear();
});
onBeforeUnmount(() => {
  finished = true;
  clear();
});
</script>
<template>
  <div
    class="stock-cinematic"
    :class="{ 'stock-cinematic-full': fullViewport }"
    :data-ending="settled ? ending : undefined"
    :data-phase="phase"
  >
    <div class="stock-stage">
      <div v-if="phase === 'cash'" class="stock-cash-rain" aria-hidden="true">
        <svg
          v-for="(note, i) in cashNotes"
          :key="i"
          viewBox="0 0 64 34"
          class="stock-cash-note"
          :style="note"
        >
          <rect x="2" y="2" width="60" height="30" rx="4" />
          <path d="M9 9H18M46 25H55M9 25H15M49 9H55" />
          <circle cx="32" cy="17" r="9" />
          <path d="M32 10V24M36 13H30Q27 13 27 16Q27 18 31 18H33Q37 18 37 20Q37 22 33 22H28" />
        </svg>
      </div>
      <div class="stock-person">
        <div class="stock-name" :title="name"
          ><UiBadge tone="primary">{{ name }}</UiBadge></div
        >
        <!-- Original scene artwork, not an interface icon. Finite transform/opacity motion only. -->
        <svg class="stock-trader" viewBox="0 0 280 300" aria-hidden="true">
          <ellipse cx="132" cy="281" rx="112" ry="10" class="stock-shadow" />
          <path
            d="M53 150 Q34 142 34 174 L38 235 Q42 248 60 246 L116 245 L120 154Z"
            class="stock-chair"
          />
          <path d="M72 247V280 M48 282H106" class="stock-chair-line" />
          <g v-if="image" class="stock-body">
            <image
              :href="image"
              x="6"
              y="17"
              width="207"
              height="252"
              preserveAspectRatio="xMidYMax meet"
              class="stock-player"
              :visibility="traderReady ? 'visible' : 'hidden'"
              @load="traderReady = true"
              @error="traderReady = false"
            />
          </g>
          <g v-if="!traderReady" class="stock-body stock-fallback">
            <path
              d="M74 216L72 261L105 261L116 224L138 226L159 267L185 261L160 205Z"
              class="stock-trousers"
            />
            <path
              d="M70 255L64 275Q73 282 110 276L107 260 M159 263L164 279L200 279Q203 268 178 261"
              class="stock-hair"
            />
            <path d="M66 143Q92 128 115 139L133 212Q111 233 66 214Z" class="stock-jacket" />
            <path d="M81 137L96 162L112 139" class="stock-shirt" />
            <path d="M89 118L87 141Q98 155 109 139L105 117" class="stock-skin" />
            <path
              d="M63 76Q64 48 91 48Q131 46 130 80L124 107Q116 132 97 132Q72 131 66 108Z"
              class="stock-skin"
            />
            <path
              d="M63 97Q48 67 70 48Q109 26 132 60L131 87L115 79L111 61Q90 84 64 79Z"
              class="stock-hair"
            />
            <path d="M78 92L88 89 M105 89L116 92" class="stock-face-line" />
            <circle cx="84" cy="99" r="3" class="stock-hair" />
            <circle cx="111" cy="99" r="3" class="stock-hair" />
            <path d="M87 116Q98 123 109 113" class="stock-face-line" />
            <path d="M59 91V77Q61 41 94 41Q128 39 135 79V99" class="stock-headphones" />
            <rect x="53" y="82" width="13" height="25" rx="5" class="stock-jacket" />
            <rect x="125" y="83" width="13" height="25" rx="5" class="stock-jacket" />
            <g class="stock-arm">
              <path
                d="M109 148Q124 143 137 163L165 174L183 164L195 179L164 197L130 182L112 173Z"
                class="stock-jacket"
              />
              <path d="M175 169L190 161Q202 155 211 166L218 178L190 183Z" class="stock-skin" />
            </g>
            <path d="M76 153Q58 151 63 178L93 198L129 195L130 181L99 178Z" class="stock-jacket" />
            <path d="M122 181L146 181L155 193L124 197Z" class="stock-skin" />
          </g>
          <path d="M129 195L259 195L273 207L121 207Z" class="stock-desk" />
          <path d="M142 208V278 M255 207V278" class="stock-chair-line" />
          <path d="M156 183L210 183L225 194L150 194Z" class="stock-keyboard" />
          <rect x="215" y="162" width="38" height="22" rx="5" class="stock-order-button" />
          <path d="M230 168L237 172L230 176" class="stock-face-line" />
          <text
            v-if="phase === 'order' || phase === 'sync'"
            x="232"
            y="147"
            text-anchor="middle"
            class="stock-launch-caption"
          >
            發射!
          </text>
        </svg>
      </div>
      <div class="stock-terminal" role="group" aria-label="呆丸大盤指數">
        <svg viewBox="0 0 560 360" class="stock-monitor" aria-hidden="true">
          <rect x="5" y="10" width="550" height="300" rx="16" class="stock-monitor-frame" />
          <rect x="19" y="26" width="522" height="267" rx="6" class="stock-screen" />
          <text x="280" y="55" text-anchor="middle" class="stock-index-title">呆丸大盤指數</text>
          <defs>
            <clipPath :id="chartClip"><rect x="20" y="66" width="520" height="226" /></clipPath>
          </defs>
          <g v-if="chartVisible" class="stock-grid">
            <path v-for="y in [90, 150, 210, 270]" :key="y" :d="`M30 ${y}H530`" />
            <path v-for="x in [40, 140, 240, 340, 440, 520]" :key="x" :d="`M${x} 65V280`" />
          </g>
          <g v-if="chartVisible" :clip-path="`url(#${chartClip})`">
            <g
              class="stock-camera"
              :style="{
                '--stock-market-y': `${chart.marketOffset}px`,
                '--stock-market-scale': chart.marketScale,
                ...(settled
                  ? {
                      '--stock-camera-y': `${chart.cameraY}px`,
                      '--stock-camera-scale': chart.cameraScale,
                    }
                  : {}),
              }"
            >
              <path :d="`M20 ${chart.baselineY}H530`" class="stock-zero" />
              <path
                v-if="settled && ending !== 'flat'"
                class="stock-limit"
                :class="trendClass"
                :d="`M24 ${chart.limitY}H530`"
              />
              <g
                class="stock-series"
                :style="{
                  '--stock-pan-x': `-${chart.panX}px`,
                  '--stock-pan-delay': `${gachaTimeline.panDelay - tradingElapsed}ms`,
                  '--stock-pan-duration': `${gachaTimeline.panDuration}ms`,
                  '--stock-tick-duration': `${gachaTimeline.candleInterval}ms`,
                }"
              >
                <g class="stock-market">
                  <path
                    v-for="(segment, i) in chart.market"
                    :key="i"
                    :d="segment.path"
                    :class="segment.up ? 'stock-up' : 'stock-down'"
                    :style="{ '--segment-delay': barDelay(i + 1) }"
                    @animationstart.self="showQuote(segment.quote, i)"
                  />
                </g>
                <g class="stock-candles">
                  <g
                    v-for="(c, i) in marketCandles"
                    :key="c.x"
                    class="stock-candle"
                    :class="c.up ? 'stock-up' : 'stock-down'"
                    :style="{ '--candle-delay': barDelay(i) }"
                  >
                    <path :d="`M${c.x} ${c.y - 8}V${c.y + c.height + 8}`" />
                    <rect :x="c.x - 6" :y="c.y" width="12" :height="c.height" rx="1" />
                  </g>
                </g>
                <g
                  v-if="settled"
                  class="stock-final"
                  :class="{ 'stock-final-trend': ending !== 'flat' }"
                >
                  <g class="stock-final-candles">
                    <g
                      class="stock-candle stock-final-candle"
                      :class="chart.closingCandle.up ? 'stock-up' : 'stock-down'"
                    >
                      <path
                        :d="`M${chart.closingCandle.x} ${chart.closingCandle.y - 3}V${chart.closingCandle.y + chart.closingCandle.height + 3}`"
                      />
                      <rect
                        :x="chart.closingCandle.x - 10"
                        :y="chart.closingCandle.y"
                        width="20"
                        :height="chart.closingCandle.height"
                        rx="2"
                      />
                    </g>
                  </g>
                  <g
                    class="stock-close-segment"
                    :class="chart.closing.up ? 'stock-up' : 'stock-down'"
                  >
                    <path :d="chart.closing.path" class="stock-trail" />
                    <path :d="chart.closing.path" />
                  </g>
                </g>
              </g>
            </g>
            <g
              v-if="settled"
              :class="trendClass"
              :transform="`translate(${chart.last.x - chart.panX} ${chart.finishY})`"
            >
              <g v-if="ending !== 'flat'" class="stock-breakout">
                <ellipse rx="46" ry="22" class="stock-impact-ring" />
                <path
                  :d="
                    ending === 'rise'
                      ? 'M-153 74L-49 19 M-114 69L-18 9 M-67 -5L-50 -16 M-30 -9L-13 -28 M-27 21L7 -12'
                      : 'M-153 -72L-42 -12 M-105 -56L-18 -9 M-141 7L-93 0L-67 11L-43 1L-8 6 M-87 15L-67 11 M-36 13L-19 4 M-11 -3L7 13'
                  "
                  class="stock-impact-rays"
                />
              </g>
              <circle r="7" class="stock-close-dot" />
            </g>
          </g>
          <g v-if="phase === 'order'" class="stock-charge">
            <circle cx="280" cy="163" r="39" />
            <path d="M270 162H290 M280 152V172 M107 163H205 M355 163H453" />
          </g>
          <g v-if="phase === 'sync'" class="stock-order">
            <path d="M43 246L251 91 M228 96L254 88L246 114" />
            <path d="M89 252L150 207 M72 225L127 185" class="stock-order-trail" />
          </g>
          <path d="M251 311L242 337H320L311 311" class="stock-monitor-frame" />
          <rect x="208" y="337" width="145" height="9" rx="4" class="stock-monitor-frame" />
        </svg>
        <div class="stock-screen-label">
          <template v-if="chartVisible">
            <span class="stock-index-opening"
              >基準 {{ indexFormatter.format(chart.opening) }} 點</span
            >
            <strong v-if="settled" class="stock-index-ending">
              收盤 {{ indexFormatter.format(chart.settlement) }} 點
            </strong>
            <strong v-else class="stock-index-live" :data-direction="liveQuote.direction">
              盤中 {{ indexFormatter.format(liveQuote.value) }} 點
            </strong>
          </template>
          <span v-else>{{ phase === 'sync' ? '等待交易訊號' : '準備下單' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.stock-cinematic {
  display: grid;
  gap: var(--stitch-space-16);
}
.stock-stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(8rem, 0.8fr) minmax(0, 1.8fr);
  align-items: center;
  padding: var(--stitch-space-16);
  gap: var(--stitch-space-8);
  overflow: hidden;
  border-radius: var(--stitch-radius-panel);
  background: var(--stitch-artwork-preview-bg);
}
.stock-cinematic-full {
  min-block-size: 0;
  grid-template-rows: minmax(0, 1fr);
}
.stock-cinematic-full .stock-stage {
  container-type: size;
  align-content: center;
  justify-items: center;
}
.stock-cinematic-full .stock-person {
  inline-size: min(100%, 72cqh);
  align-self: center;
}
.stock-cinematic-full .stock-terminal {
  inline-size: min(100%, 145cqh);
}
.stock-cash-rain {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.stock-cash-note {
  position: absolute;
  inset-inline-start: var(--cash-x);
  inset-block-start: var(--cash-y);
  inline-size: clamp(1.75rem, 7vw, 4.25rem);
  color: var(--stitch-primary);
  fill: var(--stitch-artwork-preview-bg);
  stroke: currentColor;
  stroke-width: 2.5;
  animation: stock-cash-flight 980ms ease-out var(--cash-delay) both;
}
.stock-cash-note:nth-child(3n) {
  color: var(--stitch-gacha-down);
}
@keyframes stock-cash-flight {
  0% {
    opacity: 0;
    transform: translateY(3.5rem) rotate(-30deg) scale(0.35);
  }
  25%,
  72% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-1.75rem) rotate(var(--cash-tilt)) scale(1.1);
  }
}
.stock-person {
  min-inline-size: 0;
  display: grid;
  align-self: end;
}
.stock-name {
  text-align: center;
  block-size: var(--stitch-space-32);
  overflow: hidden;
}
.stock-name :deep(.ui-stitch-badge) {
  max-inline-size: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}
.stock-trader,
.stock-monitor {
  display: block;
  inline-size: 100%;
}
[data-ending] .stock-trader {
  overflow: visible;
}
.stock-terminal {
  position: relative;
  min-inline-size: 0;
}
[data-ending] .stock-name,
[data-ending] .stock-terminal {
  position: relative;
  z-index: 1;
}
.stock-monitor {
  transition: transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}
[data-phase='trading'] .stock-monitor,
[data-phase='settled'] .stock-monitor {
  transform: scale(1.035);
}
[data-ending='rise'] .stock-monitor,
[data-ending='fall'] .stock-monitor {
  animation: stock-recoil 540ms ease-out 280ms both;
}
.stock-screen-label {
  position: absolute;
  inset-block-start: 12%;
  inset-inline: 8%;
  display: flex;
  justify-content: space-between;
  gap: var(--stitch-space-4);
  font-variant-numeric: tabular-nums;
  color: var(--stitch-artwork-preview-ink);
  font-size: var(--stitch-text-label);
}
.stock-index-ending {
  color: var(--stitch-primary);
}
.stock-launch-caption {
  fill: var(--stitch-primary);
  font-size: var(--stitch-text-page);
  font-weight: var(--stitch-weight-title);
}
.stock-index-title {
  fill: var(--stitch-artwork-preview-ink);
  font-size: var(--stitch-text-body);
  font-weight: var(--stitch-weight-title);
}
[data-ending='rise'] .stock-index-ending,
.stock-index-live[data-direction='up'] {
  color: var(--stitch-gacha-up);
}
[data-ending='fall'] .stock-index-ending,
.stock-index-live[data-direction='down'] {
  color: var(--stitch-gacha-down);
}
.stock-shadow {
  fill: var(--stitch-scene-light-ink);
  opacity: 0.4;
}
.stock-chair,
.stock-monitor-frame {
  fill: var(--stitch-scene-dark-hover);
  stroke: var(--stitch-scene-dark-ink);
  stroke-width: 2;
}
.stock-chair-line {
  fill: none;
  stroke: var(--stitch-scene-dark-ink);
  stroke-width: 7;
  stroke-linecap: round;
}
.stock-skin {
  fill: var(--stitch-artwork-swatch-fde68a);
}
.stock-hair {
  fill: var(--stitch-scene-light-ink);
}
.stock-jacket,
.stock-order-button {
  fill: var(--stitch-primary);
  stroke: var(--stitch-scene-light-ink);
  stroke-width: 2;
}
.stock-shirt {
  fill: var(--stitch-scene-dark-ink);
}
.stock-trousers {
  fill: var(--stitch-artwork-swatch-60a5fa);
}
.stock-face-line {
  fill: none;
  stroke: var(--stitch-scene-light-ink);
  stroke-width: 3;
  stroke-linecap: round;
}
.stock-headphones {
  fill: none;
  stroke: var(--stitch-artwork-swatch-60a5fa);
  stroke-width: 7;
}
.stock-desk,
.stock-keyboard {
  fill: var(--stitch-scene-dark-ink);
  stroke: var(--stitch-scene-light-ink);
  stroke-width: 2;
}
.stock-screen {
  fill: var(--stitch-artwork-preview-bg);
}
.stock-grid {
  fill: none;
  stroke: var(--stitch-scene-dark-ink);
  stroke-width: 1;
  opacity: 0.1;
}
.stock-zero {
  stroke: var(--stitch-scene-dark-ink);
  opacity: 0.58;
  stroke-dasharray: 5 6;
}
.stock-up {
  color: var(--stitch-gacha-up);
  fill: currentColor;
  stroke: currentColor;
}
.stock-down {
  color: var(--stitch-gacha-down);
  fill: currentColor;
  stroke: currentColor;
}
.stock-neutral {
  color: var(--stitch-primary);
  fill: currentColor;
  stroke: currentColor;
}
.stock-candle {
  transform-box: fill-box;
  transform-origin: center;
  animation: stock-tick var(--stock-tick-duration) ease-out var(--candle-delay) both;
}
.stock-candle path {
  stroke-width: 3;
}
.stock-final-candle rect {
  fill-opacity: 0.48;
  stroke-width: 2;
}
.stock-final-trend .stock-final-candle:last-child rect {
  fill-opacity: 0.8;
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  transform: scaleX(1.5);
}
.stock-final-candle {
  transform-origin: center top;
  animation: stock-candle-grow 280ms ease-out both;
}
.stock-final-candle.stock-up {
  transform-origin: center bottom;
}
.stock-series {
  animation: stock-chart-pan var(--stock-pan-duration) linear var(--stock-pan-delay) both;
}
.stock-camera {
  transform-origin: 0 0;
  transform: translateY(var(--stock-market-y)) scaleY(var(--stock-market-scale));
}
[data-ending='rise'] .stock-camera,
[data-ending='fall'] .stock-camera {
  animation: stock-chart-zoom 360ms ease-in-out both;
}
@keyframes stock-chart-zoom {
  from {
    transform: translateY(var(--stock-market-y)) scaleY(var(--stock-market-scale));
  }
  to {
    transform: translateY(var(--stock-camera-y)) scaleY(var(--stock-camera-scale));
  }
}
@keyframes stock-chart-pan {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--stock-pan-x));
  }
}
@keyframes stock-candle-grow {
  from {
    opacity: 0;
    transform: scaleY(0.1);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}
.stock-final-candle path {
  stroke-width: 3;
}
.stock-market path,
.stock-close-segment path {
  fill: none;
  stroke-linecap: round;
}
.stock-market path {
  stroke-width: 2.5;
}
.stock-market {
  opacity: 0.52;
}
.stock-close-segment path {
  stroke-width: 6;
  vector-effect: non-scaling-stroke;
}
.stock-close-segment .stock-trail {
  stroke-width: 16;
  opacity: 0.28;
}
.stock-final-trend .stock-close-segment:last-child path:not(.stock-trail) {
  stroke-width: 8;
}
.stock-market path,
.stock-close-segment {
  animation: stock-segment-in 220ms ease-out var(--segment-delay, 0ms) both;
}
.stock-close-dot {
  animation: stock-segment-in 240ms ease-out 360ms both;
}
.stock-limit {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 10 8;
  opacity: 0.48;
}
.stock-impact-ring,
.stock-impact-rays {
  fill: none;
  stroke-width: 6;
  transform-box: fill-box;
  transform-origin: center;
  animation: stock-breakout 690ms ease-out 340ms both;
}
.stock-arm {
  transform-box: fill-box;
  transform-origin: 20% 20%;
}
[data-phase='order'] .stock-arm {
  animation: stock-press 1200ms ease-in-out both;
}
.stock-player {
  transform-box: fill-box;
  transform-origin: bottom center;
}
[data-phase='order'] .stock-player {
  animation: stock-player-order 1200ms ease-in-out both;
}
.stock-body {
  transform-box: fill-box;
  transform-origin: bottom center;
}
[data-ending='rise'] .stock-body {
  animation: stock-trader-takeoff 950ms ease-out both;
}
[data-ending='fall'] .stock-body {
  animation: stock-trader-fall 900ms ease-in-out both;
}
.stock-charge,
.stock-order {
  fill: none;
  stroke: var(--stitch-primary);
  stroke-width: 8;
  stroke-linecap: round;
}
.stock-charge {
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: stock-charge 1200ms ease-in both;
}
.stock-order {
  animation: stock-launch 840ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.stock-order-trail {
  opacity: 0.45;
}
@keyframes stock-press {
  0%,
  100% {
    transform: rotate(0);
  }
  52% {
    transform: rotate(-15deg) translate(-8px, -6px);
  }
  84% {
    transform: rotate(20deg) translate(10px, 11px);
  }
}
@keyframes stock-player-order {
  0%,
  100% {
    transform: none;
  }
  45% {
    transform: rotate(-7deg) translateX(-5px);
  }
  83% {
    transform: rotate(11deg) translateX(12px);
  }
}
@keyframes stock-charge {
  from {
    opacity: 0.2;
    transform: scale(1.2);
  }
  to {
    opacity: 0.85;
    transform: scale(0.64);
  }
}
@keyframes stock-launch {
  0% {
    opacity: 0;
    transform: translate(-60px, 42px) scale(0.65);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(120px, -35px) scale(1.15);
  }
}
@keyframes stock-tick {
  from {
    opacity: 0;
  }
  45%,
  to {
    opacity: 1;
  }
}
@keyframes stock-segment-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes stock-breakout {
  from {
    opacity: 0;
    transform: scale(0.25);
  }
  23% {
    opacity: 1;
  }
  to {
    opacity: 0.32;
    transform: scale(1.25);
  }
}
@keyframes stock-recoil {
  0%,
  100% {
    transform: scale(1.035);
  }
  20% {
    transform: translate(3px, -2px) scale(1.045);
  }
  48% {
    transform: translate(-2px, 1px) scale(1.035);
  }
}
@keyframes stock-trader-takeoff {
  from {
    transform: translate(0, 0) rotate(0) scale(1);
  }
  15% {
    transform: translate(0, 8px) rotate(-5deg) scale(0.94, 0.9);
  }
  58% {
    transform: translate(43px, -88px) rotate(12deg) scale(1.06);
  }
  to {
    transform: translate(63px, -78px) rotate(7deg) scale(1);
  }
}
@keyframes stock-trader-fall {
  from {
    transform: translate(0, 0) rotate(0);
  }
  25% {
    transform: translate(5px, -7px) rotate(-12deg);
  }
  73% {
    transform: translate(29px, 59px) rotate(78deg);
  }
  to {
    transform: translate(32px, 52px) rotate(71deg);
  }
}
@media (max-width: 600px) {
  .stock-cinematic-full .stock-person {
    inline-size: min(100%, 45cqh);
  }
  .stock-cinematic-full .stock-trader {
    block-size: min(11rem, 33cqh);
  }
  .stock-cinematic-full .stock-terminal {
    inline-size: min(100%, 89cqh);
  }
  .stock-cinematic-full .stock-monitor {
    max-block-size: none;
  }
  .stock-stage {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--stitch-space-8);
    gap: 0;
  }
  .stock-person {
    inline-size: 10rem;
    justify-self: center;
  }
  .stock-trader {
    block-size: 8rem;
  }
  .stock-name {
    block-size: var(--stitch-space-24);
  }
  .stock-monitor {
    max-block-size: 13rem;
  }
  .stock-screen-label {
    font-size: var(--stitch-text-hint);
  }
  .stock-close-segment path {
    stroke-width: 3;
  }
  .stock-close-segment .stock-trail {
    stroke-width: 8;
  }
  .stock-final-trend .stock-close-segment:last-child path:not(.stock-trail) {
    stroke-width: 4.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stock-monitor,
  .stock-cash-note,
  .stock-candle,
  .stock-series,
  .stock-camera,
  .stock-market path,
  .stock-close-segment,
  .stock-close-dot,
  .stock-impact-ring,
  .stock-impact-rays,
  .stock-body,
  .stock-player,
  .stock-arm,
  .stock-charge,
  .stock-order {
    animation: none;
    transition: none;
  }
}
</style>
