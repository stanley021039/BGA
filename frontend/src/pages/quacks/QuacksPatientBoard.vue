<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue';
import type { QuacksPatient, QuacksCalculation } from '../../contracts/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import QuacksEssenceReward from './QuacksEssenceReward.vue';
import UiPopover from '../../components/UiPopover.vue';
import QuacksAlchemyRules from './QuacksAlchemyRules.vue';
const props = defineProps<{
  patient: QuacksPatient;
  value?: number;
  max?: number;
  selecting?: boolean;
  available?: boolean;
  final?: boolean;
  calculation?: QuacksCalculation | null;
  tone?: string;
}>();
const emit = defineEmits<{ choose: [position: number] }>();
const current = computed(() => Math.max(0, Math.min(10, props.value ?? 0)));
const rules = ref<InstanceType<typeof QuacksAlchemyRules> | null>(null);
const inspected = ref<number | null>(null);
const shown = computed(() => inspected.value ?? current.value);
const canChoose = (n: number) =>
  !!props.selecting && !!props.available && n >= 0 && n <= (props.max ?? 0);
const detail = ref<InstanceType<typeof UiPopover> | null>(null),
  detailId = useId(),
  detailPosition = ref(0);
async function choose(n: number, event: MouseEvent) {
  if (canChoose(n)) {
    emit('choose', n);
    return;
  }
  const trigger = event.currentTarget as HTMLElement;
  detail.value?.close(false);
  detailPosition.value = n;
  inspected.value = n;
  await nextTick();
  await detail.value?.open(trigger);
}
function hint(n: number) {
  return `${props.patient.name} · 第 ${n} 格：${props.final ? n + ' 分（最後一輪，不領病患獎勵）' : props.patient.track[n]?.text || '保留特效藥，沒有額外獎勵'}`;
}
const liquid = computed(() => {
  const y = 88 - current.value * 3.8,
    inset = (90 - y) * 0.5;
  return `M${10 + inset} ${y} Q40 ${y - 4} ${70 - inset} ${y} L70 90 H10Z`;
});
// Routes are laid out individually, like the reference's separated glass pipes.
// No shared elbow or generated fan crosses the left-hand tracks.
const positions = [
  { x: 165, y: 425, rx: 8, ry: 80, pipe: '' },
  { x: 185, y: 330, rx: 8, ry: 80, pipe: 'M212 350 L292 428 H350' },
  { x: 200, y: 235, rx: 12, ry: 51, pipe: 'M228 256 L302 347 H350' },
  { x: 190, y: 140, rx: 8, ry: 18, pipe: 'M218 160 L310 267 H350' },
  { x: 280, y: 60, rx: 28, ry: 28, pipe: 'M280 92 L290 125 L473 185 V220' },
  { x: 400, y: 66, rx: 38, ry: 68, pipe: 'M400 98 L405 128 L517 189 V220' },
  { x: 510, y: 72, rx: 48, ry: 28, pipe: 'M510 104 L512 137 L561 193 V220' },
  { x: 620, y: 78, rx: 58, ry: 68, pipe: 'M620 110 V151 L605 197 V220' },
  { x: 730, y: 87, rx: 68, ry: 28, pipe: 'M730 119 V153 L649 201 V220' },
  { x: 820, y: 133, rx: 78, ry: 68, pipe: 'M806 161 L790 181 L693 207 V220' },
  { x: 850, y: 225, rx: 88, ry: 28, pipe: 'M823 244 L807 267 H790' },
];
const slots = computed(() =>
  positions.map((point, n) => ({
    n,
    ...point,
    reward: props.patient.track[n] || { position: n, text: '保留特效藥，沒有額外獎勵' },
  })),
);
</script>
<template>
  <div
    class="quacks-patient-board-scroll"
    tabindex="0"
    aria-label="病患原始板，可左右捲動查看完整軌道"
  >
    <div class="quacks-distillery" :style="{ '--brew-liquid': tone || '#f5cf70' }">
      <div class="quacks-distillery-apparatus">
        <button
          type="button"
          class="quacks-patient-board-help"
          aria-label="開啟調製規則"
          @click="rules?.open()"
          >調製規則</button
        >
        <svg class="quacks-distillery-pipes" viewBox="0 0 900 500" aria-hidden="true">
          <path
            class="quacks-reservoir"
            d="M45 210 L82 188 L126 260 C143 289 220 286 258 347 C285 397 274 476 220 486 H65 C12 472 8 404 41 351 C61 320 87 303 79 279Z"
          />
          <path
            class="quacks-glass-outer"
            d="M165 425 C128 346 166 230 190 140 Q202 54 280 60 L730 87 Q850 94 850 225 L850 314"
          />
          <path
            class="quacks-glass-inner"
            d="M165 425 C128 346 166 230 190 140 Q202 54 280 60 L730 87 Q850 94 850 225 L850 314"
          />
          <g v-for="slot in slots" :key="slot.n" :class="{ 'is-current': slot.n === current }">
            <path class="quacks-pipe-outline" :d="slot.pipe" />
            <path class="quacks-pipe-liquid" :d="slot.pipe" />
          </g>
        </svg>
        <div
          tabindex="0"
          class="quacks-distillery-patient"
          data-ui-hint
          :aria-label="patient.name + '：' + patient.text"
          :title="patient.name + '：' + patient.text"
          ><span aria-hidden="true" inert><QuacksGlyph :patient="patient.id" :size="88" /></span
        ></div>
        <div class="quacks-distillery-track" role="group" aria-label="特效藥精華軌道，0至10格">
          <button
            v-for="slot in slots"
            :key="slot.n"
            type="button"
            class="quacks-essence-node"
            :class="{
              'is-current': slot.n === current,
              'is-reached': slot.n <= current,
              'is-available': canChoose(slot.n),
            }"
            :style="{ '--node-x': slot.x / 9 + '%', '--node-y': slot.y / 5 + '%' }"
            :aria-label="hint(slot.n) + (canChoose(slot.n) ? '；點選確認此格' : '')"
            :aria-current="slot.n === current ? 'step' : undefined"
            :data-essence="slot.n"
            data-ui-hint
            :title="hint(slot.n)"
            @click="choose(slot.n, $event)"
            @mouseenter="inspected = slot.n"
            @mouseleave="inspected = null"
            @focus="inspected = slot.n"
            @blur="inspected = null"
          >
            {{ slot.n
            }}<span v-if="slot.n === current" class="quacks-essence-marker" aria-hidden="true"
              >◆</span
            >
          </button>
        </div>
        <section class="quacks-distillery-board" :aria-label="patient.name + '獎勵面板'">
          <svg
            class="quacks-panel-pipes"
            viewBox="0 0 440 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              v-for="slot in slots.slice(1)"
              :key="slot.n"
              :d="
                slot.n <= 3
                  ? `M0 ${slot.ry * 2.6} H${slot.rx * 4.4 - 20}`
                  : slot.n === 10
                    ? 'M440 47 H410'
                    : `M${slot.rx * 4.4} 0 V${slot.ry * 2.6 - 30}`
              "
            />
          </svg>
          <div class="quacks-distillery-rewards" role="group" aria-label="各格獎勵，僅領取所選一格">
            <button
              v-for="slot in slots.slice(1)"
              :key="slot.n"
              type="button"
              class="quacks-reward-vial"
              :style="{ '--reward-x': slot.rx + '%', '--reward-y': slot.ry + '%' }"
              :class="{
                'is-current': slot.n === current,
                'is-inspected': slot.n === shown,
                'is-available': canChoose(slot.n),
              }"
              :aria-label="hint(slot.n) + (canChoose(slot.n) ? '；點選確認此格' : '')"
              :aria-current="slot.n === current ? 'step' : undefined"
              data-ui-hint
              :title="hint(slot.n)"
              @click="choose(slot.n, $event)"
              @mouseenter="inspected = slot.n"
              @mouseleave="inspected = null"
              @focus="inspected = slot.n"
              @blur="inspected = null"
            >
              <span class="quacks-reward-vial-neck" aria-hidden="true" />
              <span class="quacks-reward-position"
                >{{ slot.n }}<span v-if="slot.n === current"> ◆</span></span
              >
              <QuacksEssenceReward :reward="slot.reward" :final="final" decorative />
            </button>
          </div>
        </section>
        <div class="quacks-distillery-bottle" :data-filled="current > 0"
          ><svg
            viewBox="0 0 80 100"
            role="img"
            :aria-label="'特效藥瓶：' + current + ' 格'"
            width="48"
            height="60"
          >
            <path
              d="M25 8h30v12h-7v28l23 37q7 11-5 11H14Q2 96 9 85l23-37V20h-7Z"
              fill="#d6eee226"
              stroke="#e1e8c7"
              stroke-width="3"
            />
            <path v-if="current" :d="liquid" fill="var(--brew-liquid)" opacity=".9" />
            <path
              d="M28 31v15L16 70"
              fill="none"
              stroke="#fff9"
              stroke-width="3"
              stroke-linecap="round"
            />
            <path d="M25 9h30" stroke="#b79862" stroke-width="9" stroke-linecap="round" /></svg
          ><span>{{ current > 0 ? '已注入' : '待調製' }}</span></div
        >
      </div>
    </div></div
  >
  <UiPopover
    ref="detail"
    :id="detailId"
    :title="patient.name + ' · 第 ' + detailPosition + ' 格'"
    compact
  >
    <p>{{ slots[detailPosition]!.reward.text }}</p>
  </UiPopover>
  <QuacksAlchemyRules
    ref="rules"
    :patient="patient"
    :calculation="calculation"
    :max="max"
    :final="final"
  />
  <p v-if="selecting" class="quacks-essence-instruction">在 0～{{ max ?? 0 }} 格間選一格</p>
</template>
<style scoped>
.quacks-distillery {
  container-type: inline-size;
  width: 100%;
  min-width: 0;
  max-width: 900px;
  margin-inline: auto;
  --brew-ink: #fff4d5;
}
.quacks-distillery-apparatus {
  position: relative;
  min-width: 0;
  aspect-ratio: 900 / 500;
  color: var(--brew-ink);
  border: 1px solid #796443;
  border-radius: 16px;
  background:
    repeating-linear-gradient(3deg, #f2d8aa06 0 2px, transparent 2px 12px),
    linear-gradient(120deg, #4a3524, #2c231b 65%, #4f3926);
}
.quacks-distillery-pipes {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.quacks-reservoir {
  fill: var(--brew-liquid);
  fill-opacity: 0.2;
  stroke: #d6e4ce99;
  stroke-width: 4;
}
.quacks-glass-outer {
  stroke: #cde6dd55;
  stroke-width: 46;
}
.quacks-glass-inner {
  stroke: var(--brew-liquid);
  stroke-opacity: 0.32;
  stroke-width: 17;
}
.quacks-pipe-outline {
  stroke: #d9e3d577;
  stroke-width: 7;
}
.quacks-pipe-liquid {
  stroke: var(--brew-liquid);
  stroke-width: 2;
  opacity: 0.08;
}
.is-current .quacks-pipe-liquid {
  stroke-width: 4;
  opacity: 1;
}
.quacks-distillery-track {
  position: absolute;
  inset: 0;
}
.quacks-distillery button {
  font: inherit;
  color: inherit;
  cursor: help;
}
.quacks-distillery .quacks-essence-node {
  position: absolute;
  left: var(--node-x);
  top: var(--node-y);
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: clamp(44px, 7cqi, 64px);
  height: clamp(44px, 7cqi, 64px);
  padding: 0;
  border: 2px solid #b0bda38c;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 22%, #efffff66, #73877833 35%, #132b28d9 90%);
  font-size: clamp(20px, 3cqi, 28px);
  font-weight: 800;
  box-shadow: inset 0 2px 5px #fff4;
}
.quacks-distillery .quacks-essence-node.is-reached {
  border-color: #c7ac6d;
  background: radial-gradient(circle at 30% 22%, #fff5bb99, #a7782566 40%, #333b24dd 90%);
}
.quacks-distillery .quacks-essence-node.is-current {
  border: 3px solid #fff3c5;
  background: radial-gradient(circle at 35% 25%, #fff4ba, #e7b745 60%, #916229);
  color: #2a2517;
  box-shadow:
    0 0 18px #f4cf7080,
    inset 0 0 8px #fff9;
}
.quacks-essence-marker {
  position: absolute;
  bottom: -18px;
  font-size: 16px;
  color: #ffe6a1;
}
.quacks-distillery-board {
  position: absolute;
  left: 38.89%;
  right: 12.22%;
  top: 44%;
  bottom: 4%;
  padding: 0;
  border: 6px ridge #9b7549;
  border-radius: 8px;
  box-shadow:
    0 4px 15px #0008,
    inset 0 0 24px #0005;
  background: radial-gradient(ellipse at top, #a37d53, #694b35);
}
.quacks-panel-pipes {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: #e3eddd80;
  stroke-width: 5;
  pointer-events: none;
}
.quacks-distillery-rewards {
  position: absolute;
  inset: 0;
}
.quacks-distillery .quacks-reward-vial {
  position: absolute;
  left: var(--reward-x);
  top: var(--reward-y);
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: clamp(64px, 7.6cqi, 76px);
  min-width: 0;
  min-height: 72px;
  padding: 18px 3px 4px;
  border: 1px solid #d4d8b966;
  border-radius: 28px 28px 22px 22px;
  background: radial-gradient(ellipse at 30% 20%, #efffff4d, #29372e80);
}
.quacks-reward-vial-neck {
  position: absolute;
  width: 16px;
  height: 6px;
  top: -7px;
  left: calc(50% - 8px);
  border: 1px solid #c3c9a8aa;
  background: #8d7347;
  border-radius: 2px;
}
.quacks-reward-position {
  position: absolute;
  top: 4px;
  inset-inline: 0;
  text-align: center;
  font-size: 0.875rem;
  color: #fff2d3;
}
.quacks-distillery .quacks-reward-vial.is-current {
  border: 2px solid #ffe6a1;
  background: linear-gradient(#c99a3459, #89692744);
  box-shadow:
    inset 0 -8px 12px #edbd4726,
    0 0 10px #d1ad4d55;
}
.quacks-distillery .quacks-reward-vial.is-inspected {
  outline: 1px solid #fff0c6;
  outline-offset: 2px;
}
.quacks-distillery button.is-available {
  cursor: pointer;
}
.quacks-distillery button.is-available:hover {
  box-shadow: 0 0 15px #ffe09d80;
}
.quacks-distillery button:focus-visible {
  outline: 3px solid #fff1bd;
  outline-offset: 4px;
}
.quacks-distillery .quacks-distillery-patient {
  position: absolute;
  left: 3%;
  top: 4%;
  z-index: 1;
  width: 96px;
  height: 96px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  box-shadow: none;
}
.quacks-reward-vial :deep(.quacks-essence-reward) {
  width: 100%;
  font-size: 0.875rem;
  text-align: center;
  gap: 2px;
}
.quacks-reward-vial :deep(.quacks-essence-reward > span) {
  white-space: nowrap;
}
.quacks-distillery-bottle {
  position: absolute;
  right: 0.5%;
  bottom: 2%;
  display: grid;
  justify-items: center;
  color: #fff4d5;
  font-size: 0.875rem;
  filter: saturate(0.4);
}
.quacks-distillery-bottle[data-filled='true'] {
  filter: none;
}
.quacks-distillery-bottle > svg {
  width: 72px;
  height: 90px;
}
.quacks-patient-board-scroll {
  overflow-x: auto;
  scrollbar-gutter: stable;
  padding: 4px;
}
.quacks-patient-board-help {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  width: 96px;
  min-height: 44px;
  padding: 8px;
  border: 1px solid #e9ce83;
  border-radius: 8px;
  background: #233d33;
  color: #fff4d5;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}
.quacks-patient-board-scroll .quacks-distillery {
  min-width: 720px;
  max-width: 1120px;
}
.quacks-distillery :is(.quacks-essence-node, .quacks-reward-vial).is-available {
  border-color: #ffe28a !important;
  outline: 3px solid #ffe28a;
  outline-offset: 2px;
  background: radial-gradient(circle at 30% 22%, #c4b66a, #42634a 80%);
  cursor: pointer;
}
.quacks-essence-instruction {
  order: -1;
  margin: 0;
  text-align: center;
  font-size: 1.25rem;
  font-weight: 700;
}
</style>
