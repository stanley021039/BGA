<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import type { QuacksPatient, QuacksCalculation } from '../../contracts/quacks';
import UiDialog from '../../components/UiDialog.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import QuacksEssenceReward from './QuacksEssenceReward.vue';
const props = defineProps<{
  patient: QuacksPatient;
  calculation?: QuacksCalculation | null;
  value: number;
  max?: number;
  selecting?: boolean;
  final?: boolean;
  tone?: string;
}>();
const game = useQuacksStore();
const apparatus = ref<HTMLElement | null>(null);
const rules = ref<InstanceType<typeof UiDialog> | null>(null);
const calculationRows = computed(() =>
  props.calculation
    ? [
        { label: '藥材顏色', value: props.calculation.colors },
        { label: '白色剛好 7', value: props.calculation.exactSeven },
        { label: '鄰座爆鍋', value: props.calculation.explosions },
        { label: '愚人草加成', value: props.calculation.locoweed },
        { label: '占卜加成', value: props.calculation.fortune },
      ].filter((row) => row.value !== 0)
    : [],
);
let flow: Animation | undefined;
const current = computed(() => Math.max(0, Math.min(10, props.value)));
const liquid = computed(() => {
  const y = 88 - current.value * 3.8,
    inset = (90 - y) * 0.5;
  return `M${10 + inset} ${y} Q40 ${y - 4} ${70 - inset} ${y} L70 90 H10Z`;
});
const inspected = ref<number | null>(null);
const shown = computed(() => inspected.value ?? current.value);
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
const selected = computed(() => slots.value[shown.value]!);
function hint(n: number) {
  return `${props.patient.name} · 第 ${n} 格：${props.final ? n + ' 分（最後一輪，不領病患獎勵）' : slots.value[n]!.reward.text}`;
}
function canChoose(n: number) {
  return !!props.selecting && game.available && n <= (props.max ?? 0);
}
function choose(n: number) {
  inspected.value = n;
  if (canChoose(n)) void game.command('essence', { position: n });
}
watch(
  () => [props.value, props.patient.id, props.selecting, props.final],
  () => {
    inspected.value = null;
  },
);
watch(
  () => [props.value, props.patient.id] as const,
  ([value, id], [previous, oldId]) => {
    flow?.cancel();
    if (
      id !== oldId ||
      value === previous ||
      document.hidden ||
      !window.MotionPolicy?.allowsMotion()
    )
      return;
    const pipe = apparatus.value?.querySelector(
      '.quacks-distillery-pipes .is-current .quacks-pipe-liquid',
    );
    flow = pipe?.animate(
      [
        { strokeDasharray: '8 12', strokeDashoffset: '40' },
        { strokeDasharray: '8 12', strokeDashoffset: '0' },
      ],
      { duration: 700, easing: 'ease-out' },
    );
  },
  { flush: 'post' },
);
onBeforeUnmount(() => flow?.cancel());
</script>
<template>
  <div class="quacks-distillery" :style="{ '--brew-liquid': tone || '#f5cf70' }">
    <div ref="apparatus" class="quacks-distillery-apparatus">
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
          @click="choose(slot.n)"
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
            @click="choose(slot.n)"
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
    <header class="quacks-distillery-status">
      <div
        ><span>目前精華</span><strong>{{ current }}<small> / 10</small></strong></div
      >
      <div class="quacks-distillery-preview"
        ><span>第 {{ shown }} 格{{ final ? '換分' : '獎勵' }}</span
        ><QuacksEssenceReward :reward="selected.reward" :final="final"
      /></div>
      <span v-if="selecting" title="確認後不能修改">點選可達格確認</span>
      <button
        type="button"
        class="quacks-distillery-help"
        aria-label="開啟調製規則"
        title="精華計算、獎勵選擇與病患能力"
        @click="rules?.open()"
        >調製規則</button
      >
    </header>
  </div>
  <UiDialog ref="rules" title="調製規則" compact>
    <div class="quacks-distillery-rules">
      <section
        ><h3>1 · 計算精華</h3>
        <p>每種非白色藥材 +1；白色合計剛好 7 再 +1；每位爆鍋的鄰座 +1。</p>
        <p>另加愚人草與占卜加成，最多 10 格。自己爆鍋也能調製。</p>
        <dl v-if="calculation"
          ><template v-for="row in calculationRows" :key="row.label"
            ><dt>{{ row.label }}</dt
            ><dd>+{{ row.value }}</dd></template
          ><dt class="is-total">本輪可達</dt
          ><dd class="is-total"
            >{{
              max ??
              Math.min(
                10,
                calculationRows.reduce((sum, row) => sum + row.value, 0),
              )
            }}
            格</dd
          ></dl
        >
      </section>
      <section
        ><h3>2 · 選一格獎勵</h3>
        <p v-if="final">第 9 輪只按所選格數得分，不再領病患獎勵。</p>
        <p v-else>可選 0 到本輪可達格，只領所選那格的獎勵，不累加前面的格子。</p>
        <p>點格子即確認，確認後不能修改。</p>
      </section>
      <section
        ><h3>{{ patient.name }} · 病患能力</h3><p>{{ patient.text }}</p></section
      >
    </div>
  </UiDialog>
</template>
<style scoped>
.quacks-distillery-rules {
  display: grid;
  gap: 20px;
  line-height: 1.7;
}
.quacks-distillery-rules section {
  display: grid;
  gap: 8px;
}
.quacks-distillery-rules :is(h3, p) {
  margin: 0;
}
.quacks-distillery-rules h3 {
  font-size: 1.125rem;
}
.quacks-distillery-rules dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 20px;
  margin: 4px 0 0;
  padding: 12px;
  border: 1px solid var(--play-line);
  border-radius: 10px;
}
.quacks-distillery-rules dd {
  margin: 0;
  font-weight: 700;
  text-align: end;
}
.quacks-distillery-rules .is-total {
  border-top: 1px solid var(--play-line);
  padding-top: 8px;
  font-weight: 800;
}
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
.quacks-distillery-status {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-top: 8px;
  padding: 4px 8px;
  border: 1px solid var(--play-line);
  border-radius: 12px;
  color: var(--play-ink);
  text-align: center;
}
.quacks-distillery-status > div {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.quacks-distillery-status span {
  font-size: 0.875rem;
}
.quacks-distillery-status strong {
  font-size: 1.5rem;
  line-height: 1.1;
}
.quacks-distillery-status small {
  font-size: 1rem;
}
.quacks-distillery .quacks-distillery-help {
  min-height: 36px;
  padding: 4px 10px;
  border: 1px solid var(--play-line);
  border-radius: 8px;
  color: var(--play-ink);
  background: var(--play-paper);
}
@container (max-width: 680px) {
  .quacks-distillery-apparatus {
    aspect-ratio: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px;
  }
  .quacks-distillery .quacks-distillery-patient {
    position: static;
    width: 64px;
    height: 64px;
    grid-column: 1;
    grid-row: 1;
  }
  .quacks-distillery-patient :deep(.vue-quacks-glyph) {
    width: 64px !important;
    height: 64px !important;
  }
  .quacks-distillery-pipes,
  .quacks-panel-pipes {
    display: none;
  }
  .quacks-distillery-track {
    position: static;
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 8px;
    padding-bottom: 24px;
    border-bottom: 4px double #bcaf6e66;
  }
  .quacks-distillery .quacks-essence-node {
    position: relative;
    left: auto;
    top: auto;
    transform: none;
    width: 48px;
    height: 48px;
  }
  .quacks-distillery-board {
    position: relative;
    grid-column: 1 / -1;
    inset: auto;
    padding: 12px;
    margin-top: 16px;
  }
  .quacks-distillery-rewards {
    position: static;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
    gap: 12px 8px;
  }
  .quacks-distillery .quacks-reward-vial {
    position: relative;
    left: auto;
    top: auto;
    transform: none;
    width: auto;
    min-height: 76px;
  }
  .quacks-distillery-bottle {
    position: static;
    grid-column: 1 / -1;
    margin-top: 12px;
  }
}
@container (max-width: 340px) {
  .quacks-distillery-apparatus {
    padding: 12px 8px;
  }
  .quacks-distillery-board {
    padding: 8px;
    border-width: 3px;
  }
}
@container (min-width: 480px) and (max-width: 680px) {
  .quacks-distillery-apparatus {
    padding: 8px;
  }
  .quacks-distillery-track {
    gap: 4px;
    padding-bottom: 8px;
  }
  .quacks-distillery .quacks-essence-node {
    width: 44px;
    height: 44px;
  }
  .quacks-distillery-board {
    padding: 8px;
    margin-top: 8px;
    border-width: 3px;
  }
  .quacks-distillery-rewards {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }
  .quacks-distillery .quacks-reward-vial {
    min-height: 64px;
    padding: 16px 3px 2px;
  }
  .quacks-distillery-bottle {
    display: none;
  }
  .quacks-distillery-status {
    margin-top: 2px;
    padding: 0;
    gap: 4px 12px;
  }
}
</style>
