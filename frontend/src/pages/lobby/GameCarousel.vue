<script setup lang="ts">
import { warmGamePage } from '../../services/game-assets';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { gameCards } from './catalog';
import { usePreferencesStore } from '../../stores/preferences';
import UiButton from '../../components/UiButton.vue';
import loungeSmall from '../../assets/lounge/lounge-360.webp';
import loungeLarge from '../../assets/lounge/lounge-720.webp';
import quacksArt from '../../assets/quacks/game-quacks.svg';
import minimalArt from '../minimal/minimal-waiting.svg';
import constructionArt from '../../assets/lobby/construction-800.webp?no-inline';
import constructionThumb from '../../assets/lobby/construction-400.webp?no-inline';
// Written out in full so the build can add each file's content version (#316).
const gameArt: Record<string, string> = {
  bluff: '/assets/playful/game-bluff.svg',
  draw: '/assets/playful/game-draw.svg',
  gift: '/assets/playful/game-gift.svg',
  majority: '/assets/playful/game-majority.svg',
  market: '/assets/playful/game-market.svg',
  musicquiz: '/assets/playful/game-musicquiz.svg',
  poker: '/assets/playful/game-poker.svg',
  telephone: '/assets/playful/game-telephone.svg',
  thunder: '/assets/playful/game-thunder.svg',
  trpg: '/assets/playful/game-trpg.svg',
};
const props = defineProps<{ modelValue: string }>(),
  emit = defineEmits<{ 'update:modelValue': [value: string]; create: []; join: [] }>();
const root = ref<HTMLElement | null>(null),
  width = ref(1000),
  cardWidth = ref(300),
  drag = ref(0),
  dragging = ref(false),
  prefs = usePreferencesStore();
const index = computed(() =>
    Math.max(
      0,
      gameCards.findIndex((card) => card.id === props.modelValue),
    ),
  ),
  chosen = computed(() => gameCards[index.value]);
const visibleCount = computed(() =>
  Math.min(gameCards.length, width.value >= 700 ? 5 : width.value >= 340 ? 3 : 1),
);
// Outer cards shrink faster so five cards still leave side gutters for characters.
const cardScale = (distance: number) => [1, 0.8, 0.56][distance] ?? 0.56;
const radius = computed(() => Math.floor(visibleCount.value / 2)),
  step = computed(() =>
    // Five cards: half a card apart, so each side card shows clearly past the one in front.
    radius.value === 2
      ? Math.min(
          cardWidth.value * 0.5,
          (width.value / 2 - (cardWidth.value * cardScale(2)) / 2) / 2,
        )
      : radius.value
        ? Math.min(
            260,
            Math.max(
              50,
              (width.value / 2 - (cardWidth.value * cardScale(radius.value)) / 2 - 40) /
                radius.value,
            ),
          )
        : 0,
  );
const still = computed(() => prefs.motion?.enabled === false || prefs.motion?.reduced === true);
let observer: ResizeObserver | null = null,
  gesture: { id: number; x: number; y: number; horizontal: boolean } | null = null,
  suppressUntil = 0;
function slot(value: number) {
  const half = Math.floor(gameCards.length / 2);
  return ((value - index.value + half + gameCards.length) % gameCards.length) - half;
}
function cardStyle(value: number) {
  const offset = slot(value),
    distance = Math.abs(offset);
  return {
    '--slot': offset,
    '--rotation': offset * 6 + 'deg',
    '--dip': distance * 18 + 'px',
    '--scale': cardScale(distance),
    '--card-z': 10 - distance,
    '--card-opacity': visible(value) ? 1 : 0,
    visibility: visible(value) ? ('visible' as const) : ('hidden' as const),
  };
}
function visible(value: number) {
  const offset = slot(value);
  return offset >= -radius.value && offset <= visibleCount.value - radius.value - 1;
}
async function select(value: number, focus = false) {
  emit('update:modelValue', gameCards[(value + gameCards.length) % gameCards.length].id);
  if (focus) {
    await nextTick();
    root.value?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }
}
function key(event: KeyboardEvent) {
  const destination: Record<string, number> = {
    ArrowLeft: index.value - 1,
    ArrowRight: index.value + 1,
    Home: 0,
    End: gameCards.length - 1,
  };
  if (event.key in destination) {
    event.preventDefault();
    void select(destination[event.key], true);
  }
}
function down(event: PointerEvent) {
  if (event.button === 0 && event.isPrimary !== false)
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
}
function move(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.id) return;
  const x = event.clientX - gesture.x,
    y = event.clientY - gesture.y;
  if (!gesture.horizontal && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.3) {
    gesture.horizontal = true;
    root.value?.setPointerCapture(event.pointerId);
    dragging.value = true;
  }
  if (gesture.horizontal) {
    event.preventDefault();
    drag.value = x * 0.22;
  }
}
function reset() {
  const id = gesture?.id;
  gesture = null;
  if (id !== undefined && root.value?.hasPointerCapture(id)) root.value.releasePointerCapture(id);
  drag.value = 0;
  dragging.value = false;
}
function up(event: PointerEvent, cancel = false) {
  if (!gesture || event.pointerId !== gesture.id) return;
  const x = event.clientX - gesture.x;
  if (gesture.horizontal) {
    suppressUntil = performance.now() + 350;
    if (!cancel && Math.abs(x) > 65) void select(index.value + (x < 0 ? 1 : -1));
  }
  reset();
}
function click(event: MouseEvent, value: number) {
  if (performance.now() < suppressUntil) {
    event.preventDefault();
    return;
  }
  void select(value);
}
function visibility() {
  if (document.hidden) reset();
}
onMounted(() => {
  observer = new ResizeObserver(() => {
    if (root.value) {
      width.value = root.value.clientWidth;
      const tile = root.value.querySelector<HTMLElement>('.game-tile');
      cardWidth.value = tile?.offsetWidth || 300;
    }
  });
  if (root.value) observer.observe(root.value);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', reset);
});
onBeforeUnmount(() => {
  reset();
  observer?.disconnect();
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('blur', reset);
});
</script>
<template>
  <section class="game-carousel-section" aria-label="挑選桌遊" data-ping-anchor="game-list">
    <div class="carousel-heading"><span class="carousel-stamp">今晚的遊戲提案</span></div>
    <div class="carousel-center">
      <div
        ref="root"
        class="game-library"
        :class="{ dragging, 'carousel-reduced': still }"
        data-card-carousel
        role="region"
        aria-roledescription="遊戲輪播"
        :aria-label="gameCards.length + ' 張卡片，使用左右方向鍵切換'"
        tabindex="0"
        :style="{ '--card-step': step + 'px', '--drag': drag + 'px' }"
        @keydown="key"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up($event)"
        @pointercancel="up($event, true)"
        @lostpointercapture="reset"
        @dragstart.prevent
      >
        <!-- ui-check-allow raw-control: 扇形輪播卡片以同一個按鈕承載選取、拖曳與鍵盤焦點，沿用既有 game-tile 外觀，UiButton 不支援圖文卡片結構 -->
        <button
          v-for="(card, i) in gameCards"
          :key="card.id"
          type="button"
          class="game-tile"
          :class="[card.id + '-tile', { selected: i === index }]"
          :data-game="card.id"
          :style="cardStyle(i)"
          :tabindex="i === index ? 0 : -1"
          :aria-pressed="i === index"
          :aria-hidden="!visible(i)"
          @click="click($event, i)"
          @pointerenter="warmGamePage(card.id)"
          @pointerdown="warmGamePage(card.id)"
          @focus="warmGamePage(card.id)"
        >
          <div class="tile-image"
            ><img
              :src="
                card.art === 'construction'
                  ? constructionArt
                  : card.id === 'lounge'
                    ? loungeSmall
                    : card.id === 'quacks'
                      ? quacksArt
                      : card.id === 'minimal'
                        ? minimalArt
                        : gameArt[card.art] || '/assets/playful/game-' + card.art + '.svg'
              "
              :srcset="
                card.art === 'construction'
                  ? constructionThumb + ' 400w, ' + constructionArt + ' 800w'
                  : card.id === 'lounge'
                    ? loungeSmall + ' 360w, ' + loungeLarge + ' 720w'
                    : undefined
              "
              sizes="(max-width: 650px) calc(100vw - 32px), 300px"
              decoding="async"
              :alt="card.art === 'construction' ? '施工中' : ''"
              draggable="false" /></div
          ><div class="tile-body"
            ><div class="kicker">{{ card.english }}</div
            ><h2>{{ card.title }}</h2
            ><p>{{ card.description }}</p
            ><div class="tile-bottom"
              ><span>{{ card.seats }}</span
              ><span>{{ card.category }}</span
              ><span class="select-label">{{ i === index ? '已選擇 ✓' : '選擇遊戲 ↗' }}</span></div
            ></div
          >
        </button>
      </div>
      <div class="carousel-footer"
        ><div class="carousel-controls"
          ><div class="carousel-navigation"
            ><UiButton
              icon="previous"
              icon-only
              label="上一款遊戲"
              @click="select(index - 1)" /><span
              class="vue-carousel-counter"
              role="status"
              aria-live="polite"
              :aria-label="
                chosen.title + '，第 ' + (index + 1) + ' 款，共 ' + gameCards.length + ' 款'
              "
              >{{ String(index + 1).padStart(2, '0') }} / {{ gameCards.length }}</span
            ><UiButton icon="next" icon-only label="下一款遊戲" @click="select(index + 1)" /></div
          ><slot name="scene-stats" /></div
      ></div>
      <p class="carousel-hint">拖曳卡片，或用左右方向鍵挑選</p>
    </div>
    <div class="carousel-actions"
      ><a v-if="chosen.guide" class="quiet carousel-guide" :href="chosen.guide"
        >{{ chosen.title }}玩法 ↗</a
      ><div class="carousel-create"
        ><UiButton
          variant="secondary"
          icon="users"
          label="找一桌加入"
          aria-haspopup="dialog"
          @click="emit('join')" /><slot name="lobby-action" /><a
          v-if="chosen.id === 'market'"
          class="button orange"
          href="/market"
          >進入股市冥燈 ↗</a
        ><UiButton
          v-else
          icon="add"
          :label="chosen.id === 'lounge' ? '開啟場外休憩區' : '開一桌' + chosen.title"
          @click="emit('create')" /><slot name="lobby-resume" /></div
    ></div>
  </section>
</template>

<style scoped>
.game-carousel-section .carousel-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
}
.carousel-navigation {
  display: flex;
  align-items: center;
  gap: var(--stitch-space-8);
}
@media (max-width: 900px) {
  .game-carousel-section .carousel-controls {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
