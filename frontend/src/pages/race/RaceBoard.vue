<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import type {
  RaceSnapshot,
  RaceVisual,
  RaceRoute,
  RacePoint,
  RaceAnnotation,
} from '../../contracts/race';
import RaceVehicle from './RaceVehicle.vue';
import { terrain, hazardSymbols, sizes } from './race-meta';
const props = defineProps<{
  state: RaceSnapshot;
  visual: RaceVisual;
  routes: Map<string, RaceRoute>;
  enabled: boolean;
  preview: RaceRoute | null;
  goal?: RacePoint | null;
  annotations?: RaceAnnotation[];
}>();
const emit = defineEmits<{
    point: [point: RacePoint];
    car: [id: string];
    preview: [point: RacePoint | null];
  }>(),
  svg = ref<SVGSVGElement | null>(null);
defineExpose({ svg });
const grainId = 'race-grain-' + useId();
const pos = (x: number, y: number) => ({
    x: 48 + (y - props.visual.min) * 44 + (x % 2) * 22,
    y: 81 + x * 44,
  }),
  key = (x: number, y: number) => `${x}:${y}`;
const cells = computed(() =>
  props.visual.tiles.flatMap((t) =>
    t.cells.flatMap((row, x) =>
      row.map((cell, j) => {
        const y = t.start + j,
          info = terrain(cell),
          kind = cell.hazard?.face
            ? (
                {
                  mud: 'M',
                  road: 'R',
                  oil: 'R',
                  glass: 'V',
                  ramp: 'J',
                  fire: 'F',
                  pit: 'X',
                } as Record<string, string>
              )[cell.hazard.kind] || cell.kind
            : cell.kind,
          occupied =
            props.state.cars.some((c) => !c.dead && c.x === x && c.y === y) ||
            props.state.players.some((p) => p.chopper?.x === x && p.chopper.y === y),
          route = props.routes.get(key(x, y)),
          legal =
            props.enabled &&
            (props.state.phase === 'move'
              ? !!route
              : props.state.phase === 'airplace' &&
                info !== undefined &&
                cell.kind !== 'X' &&
                !cell.hazard &&
                !occupied);
        return {
          x,
          y,
          cell,
          info,
          kind,
          route,
          legal,
          adjacent: props.state.legalMoves.some((p) => p.x === x && p.y === y),
          px: pos(x, y).x,
          py: pos(x, y).y,
        };
      }),
    ),
  ),
);
const pathPoints = computed(() => {
  const route = props.preview,
    c = props.state.cars.find((c) => c.id === props.state.active?.car);
  if (!route || !c) return [];
  return [
    c.x === null ? { x: route.path[0]?.x || 0, y: -1 } : { x: c.x, y: c.y },
    ...route.path,
  ].map((p) => pos(p.x, p.y));
});
const beyond = computed(() =>
  [...props.routes.values()].filter((r) => r.y >= props.visual.min + 24),
);
const visibleCars = computed(() =>
  props.visual.cars.filter((c) => (!c.dead || c.motionGhost) && c.x !== null),
);
const owner = (id: string | null) => props.state.players.find((p) => p.id === id);
function activate(event: KeyboardEvent, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}
function boundary(start: number) {
  const b = 48 + (start - props.visual.min) * 44 - 22;
  return (
    `M ${b} 53 ` +
    Array.from(
      { length: 6 },
      (_, lane) =>
        `L ${b + (lane % 2) * 22} ${67 + lane * 44} L ${b + (lane % 2) * 22} ${95 + lane * 44}`,
    ).join(' ')
  );
}
</script>
<template>
  <div id="track" class="vue-race-board" @pointerleave="emit('preview', null)"
    ><svg
      ref="svg"
      viewBox="0 0 1180 398"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="向右前進的六線賽道；亮框格子可移動"
    >
      <defs>
        <pattern :id="grainId" width="11" height="13" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r=".8" fill="#201b1240" />
          <circle cx="9" cy="11" r=".6" fill="#e7ca8130" />
        </pattern>
      </defs>
      <g class="race-world">
        <g v-for="(tile, i) in visual.tiles" :key="tile.start">
          <text :x="44 + (tile.start - visual.min) * 44" y="24" class="map-label">
            {{ String(Math.floor(tile.start / 8) + 1).padStart(2, '0') }} / {{ tile.name }}
          </text>
          <text :x="44 + (tile.start - visual.min) * 44" y="43" class="map-index">
            {{ ['後段', '中段', '前段'][i] || '新路段' }}
          </text>
        </g>
        <g
          v-for="c in cells"
          :key="key(c.x, c.y)"
          :transform="`translate(${c.px},${c.py})`"
          :data-x="c.x"
          :data-y="c.y"
          :tabindex="c.legal ? 0 : undefined"
          :role="c.legal ? 'button' : undefined"
          :aria-label="`${c.y + 1} 段 ${c.x + 1} 車道 ${c.info.name}：${c.info.help}${c.legal ? ' 可前往' : ''}${c.route ? '，消耗 ' + c.route.cost + ' 點' : ''}${c.cell.hazard ? (c.cell.hazard.face ? ' · 危險：' + c.cell.hazard.kind : ' · 未揭露危險，抵達後才揭示') : ''}`"
          @click="c.legal && emit('point', { x: c.x, y: c.y })"
          @keydown="activate($event, () => c.legal && emit('point', { x: c.x, y: c.y }))"
          @pointerenter="emit('preview', { x: c.x, y: c.y })"
          @focus="emit('preview', { x: c.x, y: c.y })"
          class="cell-interactive"
        >
          <title v-if="!c.route">
            {{ c.info.name }}：{{ c.info.help
            }}{{
              c.cell.hazard
                ? c.cell.hazard.face
                  ? ' · 危險：' + c.cell.hazard.kind
                  : ' · 未揭露危險，抵達後才揭示'
                : ''
            }}
          </title>
          <polygon
            class="hex"
            :class="{ legal: c.legal, 'multi-legal': c.legal && !c.adjacent }"
            points="-22,-14 0,-28 22,-14 22,14 0,28 -22,14"
            :fill="c.info.color"
          />
          <g
            pointer-events="none"
            aria-hidden="true"
            class="race-terrain-art"
            :data-race-terrain="c.kind"
          >
            <polygon points="-22,-14 0,-28 22,-14 22,14 0,28 -22,14" :fill="`url(#${grainId})`" />
            <path
              v-if="c.kind === 'R'"
              d="M-17,-18L-7,-22M8,22L17,18"
              stroke="#e4d2a750"
              stroke-width="1"
            />
            <template v-if="c.kind === 'X'">
              <path
                d="M-16,11L-12,-10L2,-19L17,-6L12,15L-5,20Z"
                fill="#493f35"
                stroke="#c0a25d"
                stroke-width="2"
              />
              <path d="M2,-19L0,5L12,15M0,5L-16,11" stroke="#88715a" fill="none" />
            </template>
            <path
              v-if="c.kind === 'M'"
              d="M-14,-7Q0,-16 12,-3M-12,6Q0,17 13,6"
              stroke="#96704b70"
              stroke-width="3"
              fill="none"
            />
            <text
              v-if="['G', 'V', 'J', 'F', 'S'].includes(c.kind)"
              class="cell-symbol terrain-symbol"
              style="fill: #fff2ce"
              y="1"
            >
              {{ c.info.symbol }}
            </text>
            <text
              v-if="c.cell.hazard"
              class="cell-symbol"
              :style="{ fill: c.cell.hazard.face ? '#edcb8b' : '#ffcf77' }"
              y="1"
            >
              {{ c.cell.hazard.face ? hazardSymbols[c.cell.hazard.kind] || '!' : '⚠' }}
            </text>
          </g>
        </g>
        <path
          v-for="tile in visual.tiles.slice(1)"
          :key="'b' + tile.start"
          class="road-boundary"
          :d="boundary(tile.start)"
        />
        <g
          v-if="state.finishAt !== null"
          :transform="`translate(${48 + (state.finishAt - visual.min) * 44 + 16},0)`"
        >
          <rect y="55" width="33" height="280" fill="#e8dfb5" />
          <path
            d="M0,55h16v16h17v16H16v16H0v16h16v16h17v16H16v16H0v16h16v16h17v16H16v16H0v16h16v16h17v16H16v16H0v16h16v16h17v16H16v16H0Z"
            fill="#263d30"
          />
          <text y="358" class="map-index">終點</text>
        </g>
        <g
          v-for="r in beyond"
          :key="'r' + key(r.x, r.y)"
          :data-x="r.x"
          :data-y="r.y"
          :transform="`translate(${pos(r.x, r.y).x},${pos(r.x, r.y).y})`"
          tabindex="0"
          role="button"
          aria-label="前進到新路段"
          @click="emit('point', r)"
          @keydown="activate($event, () => emit('point', r))"
          @focus="emit('preview', r)"
        >
          <rect
            x="-20"
            y="-20"
            width="40"
            height="40"
            rx="5"
            fill="#776943"
            stroke="#ffe68c"
            stroke-width="3"
          />
          <text y="5" text-anchor="middle" fill="#fff">→</text>
        </g>
        <g v-if="pathPoints.length" pointer-events="none">
          <polyline
            class="race-route-line"
            :points="pathPoints.map((p) => p.x + ',' + p.y).join(' ')"
          />
          <g v-for="(p, i) in pathPoints.slice(1)" :key="i">
            <circle :cx="p.x" :cy="p.y - 17" r="9" class="race-route-dot" />
            <text :x="p.x" :y="p.y - 13" class="race-route-number">{{ i + 1 }}</text>
          </g>
        </g>
        <g
          v-for="car in visibleCars"
          :key="car.id"
          :data-car="car.id"
          :transform="`translate(${pos(car.x!, car.y).x},${pos(car.x!, car.y).y})`"
          class="map-car"
          :class="{
            'disabled-car': car.damage.length >= 2,
            'active-car': car.id === state.active?.car,
            target: state.targets.includes(car.id),
          }"
          tabindex="0"
          role="button"
          :aria-label="`${owner(car.owner)?.name || '殘骸'} ${sizes[car.size]} ${car.damage.length} 損傷`"
          @click="emit('car', car.id)"
          @keydown="activate($event, () => emit('car', car.id))"
          @pointerenter="emit('preview', { x: car.x!, y: car.y })"
          @focus="emit('preview', { x: car.x!, y: car.y })"
        >
          <title v-if="!routes.has(key(car.x!, car.y))">
            {{ owner(car.owner)?.name || '殘骸' }} · {{ sizes[car.size] }} ·
            {{ car.damage.length }} 損傷
          </title>
          <g class="race-car-motion">
            <g>
              <RaceVehicle
                :size="car.size"
                :color="owner(car.owner)?.color || '#605d52'"
                :disabled="car.damage.length >= 2"
              />
            </g>
            <circle v-if="car.id === state.active?.car" r="23" class="race-active-ring" />
            <circle v-if="state.targets.includes(car.id)" r="23" class="race-target-ring" />
            <text y="25" class="car-label">
              {{ car.wreck ? '' : sizes[car.size] }}{{ car.burning ? ' ♨' : ''
              }}{{ ' ×'.repeat(car.damage.length) }}
            </text>
          </g>
        </g>
        <g
          v-for="player in visual.players.filter((p) => p.chopper)"
          :key="player.id"
          class="map-chopper"
          :data-player="player.id"
          :transform="`translate(${pos(player.chopper!.x, player.chopper!.y).x},${pos(player.chopper!.x, player.chopper!.y).y})`"
        >
          <g class="race-car-motion">
            <ellipse rx="17" ry="10" :fill="player.color" stroke="#17251b" stroke-width="2" />
            <path d="M-25,-16H25M0,-20V16M-25,0H-13" stroke="#f8edcf" stroke-width="3" />
          </g>
        </g>
        <g
          v-for="(a, i) in annotations || []"
          :key="i"
          pointer-events="none"
          :transform="`translate(${pos(a.x, a.y).x},${pos(a.x, a.y).y})`"
        >
          <circle r="27" fill="none" :stroke="a.color || '#ffe68c'" stroke-width="3" />
          <rect x="-58" y="-51" width="116" height="22" rx="6" fill="#17251b" />
          <text y="-36" class="race-annotation">{{ a.label }}</text>
        </g>
        <g
          v-if="goal"
          pointer-events="none"
          :transform="`translate(${pos(goal.x, goal.y).x},${pos(goal.x, goal.y).y})`"
        >
          <circle r="27" fill="none" stroke="#ffe68c" stroke-width="3" />
          <text y="-32" class="race-annotation">⚑ 目標</text>
        </g>
      </g>
      <text x="32" y="379" class="map-index">RUN. GUN. SURVIVE. → 向右前進</text>
    </svg></div
  >
</template>
