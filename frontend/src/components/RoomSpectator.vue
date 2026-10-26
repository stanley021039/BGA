<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue';
import { requestJson, ApiError } from '../services/http';
import { gamePath } from '../contracts/room';
import { readSpectatorSnapshot, type SpectatorSnapshot } from '../contracts/spectator';
import UiButton from './UiButton.vue';
import UiLink from './UiLink.vue';
import UiPanel from './UiPanel.vue';
import StatusSlot from './StatusSlot.vue';
import RoomCountdown from './RoomCountdown.vue';
import SpectatorCanvas from './SpectatorCanvas.vue';
import GameSongClip from './GameSongClip.vue';
import RoomFullscreenToggle from './RoomFullscreenToggle.vue';
import '../styles/spectator.scss';
const QuacksGlyph = defineAsyncComponent(() => import('../pages/quacks/QuacksGlyph.vue'));
const props = defineProps<{ code: string }>();
const state = ref<SpectatorSnapshot | null>(null),
  error = ref('正在連接觀戰畫面…'),
  now = ref(Date.now()),
  offset = ref(0),
  foreground = ref(!document.hidden),
  terminal = ref(false);
const back = computed(() =>
  state.value ? '/' + gamePath(state.value.type) + '/' + props.code : location.pathname,
);
const columns = computed(() => {
  const cells = state.value?.track?.cells || [];
  return {
    min: cells.length ? Math.min(...cells.map((c) => c.column)) : 0,
    max: cells.length ? Math.max(...cells.map((c) => c.column)) : 0,
  };
});
let timer: ReturnType<typeof setTimeout> | null = null,
  clock: ReturnType<typeof setInterval> | null = null,
  job: AbortController | null = null,
  disposed = false,
  generation = 0;
function stop() {
  generation++;
  if (timer) clearTimeout(timer);
  if (clock) clearInterval(clock);
  timer = clock = null;
  job?.abort();
  job = null;
}
async function refresh() {
  if (disposed || job || document.hidden || terminal.value) return;
  const controller = new AbortController(),
    token = generation;
  job = controller;
  const timeout = setTimeout(
    () => controller.abort(new DOMException('觀戰讀取逾時，正在重試。', 'TimeoutError')),
    10000,
  );
  try {
    const next = readSpectatorSnapshot(
      await requestJson('/api/watch?code=' + encodeURIComponent(props.code), {
        signal: controller.signal,
      }),
    );
    if (disposed || token !== generation || controller.signal.aborted) return;
    if (next.code !== props.code.toUpperCase()) throw Error('收到其他房間的觀戰資料。');
    state.value = next;
    now.value = Date.now();
    offset.value = now.value - next.serverNow;
    error.value = '';
    history.replaceState(null, '', '/' + gamePath(next.type) + '/' + next.code + '?watch=1');
  } catch (cause) {
    if (
      disposed ||
      token !== generation ||
      (cause instanceof DOMException && cause.name === 'AbortError')
    )
      return;
    error.value = cause instanceof Error ? cause.message : '觀戰連線中斷，正在重試。';
    // A revoked session or removed room must not keep displaying the last private room's result.
    if (cause instanceof ApiError && [401, 403, 404, 409].includes(cause.status)) {
      state.value = null;
      terminal.value = true;
      if (clock) clearInterval(clock);
      clock = null;
    }
  } finally {
    clearTimeout(timeout);
    if (job === controller) {
      job = null;
      if (!disposed && foreground.value && !terminal.value)
        timer = setTimeout(refresh, state.value?.type === 'draw' ? 1000 : 2500);
    }
  }
}
function visibility() {
  foreground.value = !document.hidden;
  stop();
  if (foreground.value && !disposed && !terminal.value) {
    clock = setInterval(() => (now.value = Date.now()), 250);
    void refresh();
  }
}
function retry() {
  terminal.value = false;
  visibility();
}
const card = (n: number | null) =>
  n === null
    ? '背面'
    : `${['♣', '♦', '♥', '♠'][Math.floor(n / 13)]}${['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'][n % 13]}`;
onMounted(() => {
  visibility();
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('online', retry);
});
onBeforeUnmount(() => {
  disposed = true;
  stop();
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('online', retry);
});
</script>
<template>
  <main class="vue-room-spectator" aria-labelledby="room-spectator-title">
    <header class="vue-spectator-heading"
      ><div
        ><p>只讀模式 · 不占玩家席位</p
        ><h1 id="room-spectator-title">{{ state?.title || '房間' }}觀戰</h1
        ><p
          >房間 {{ code }} · {{ state?.phaseLabel || '連接中'
          }}<template v-if="state?.round">
            · 第 {{ state.round
            }}<template v-if="state.roundLimit">／{{ state.roundLimit }}</template
            >輪</template
          ></p
        ></div
      ><div class="vue-spectator-actions"
        ><RoomFullscreenToggle focus-class="vue-spectator-focus" /><UiLink
          :href="back"
          icon="leave"
          label="離開觀戰" /></div
    ></header>
    <StatusSlot :message="error" persistent :error="!!error && error !== '正在連接觀戰畫面…'" />
    <UiButton v-if="terminal" icon="refresh" label="重新連接觀戰" @click="retry" />
    <template v-if="state">
      <RoomCountdown
        v-if="state.deadline"
        :deadline="state.deadline"
        :duration="state.duration"
        :offset="offset"
        :now="now"
        :epoch="state.type + ':' + state.gameRevision + ':' + state.deadline"
        caption="本階段剩餘"
      />
      <section class="vue-spectator-roster" aria-label="本桌玩家"
        ><UiPanel
          v-for="p in state.players"
          :key="p.id"
          :title="p.name + (p.bot ? '（AI）' : '')"
          density="compact"
          ><p
            >{{ p.status }} · {{ p.online ? '在線' : '暫時離線'
            }}<template v-if="p.score !== null"> · {{ p.score }} 分</template></p
          ><p v-for="(line, i) in p.lines" :key="i">{{ line }}</p
          ><div v-if="p.cards.length" class="vue-spectator-cards" :aria-label="p.name + ' 的底牌'"
            ><span v-for="(value, i) in p.cards" :key="i">{{ card(value) }}</span></div
          ></UiPanel
        ></section
      >
      <UiPanel v-if="state.type === 'poker'" title="公共牌"
        ><div class="vue-spectator-cards"
          ><span v-for="(value, i) in state.cards" :key="i">{{ card(value) }}</span
          ><p v-if="!state.cards.length">尚未翻開公共牌</p></div
        ></UiPanel
      >
      <UiPanel v-if="state.drawing" title="本輪公開畫布"
        ><SpectatorCanvas
          :key="state.drawing.epoch"
          :epoch="state.drawing.epoch"
          :strokes="state.drawing.strokes"
          :live="state.phase === 'drawing'"
          label="目前公開畫布"
      /></UiPanel>
      <UiPanel v-if="state.track" :title="state.track.title"
        ><div
          class="vue-spectator-track"
          :style="{
            gridTemplateColumns: `repeat(${columns.max - columns.min + 1}, minmax(6rem, 1fr))`,
          }"
          role="img"
          :aria-label="state.track.title + ' 的公開位置'"
          ><div
            v-for="cell in state.track.cells"
            :key="cell.row + ':' + cell.column"
            class="vue-spectator-cell"
            :style="{ gridColumn: cell.column - columns.min + 1, gridRow: cell.row + 1 }"
            ><small>{{ cell.label }} · {{ cell.column }}</small
            ><p v-for="(name, i) in cell.names" :key="i">{{ name }}</p></div
          ></div
        ></UiPanel
      >
      <section v-if="state.pots.length" class="vue-spectator-grid" aria-label="公開藥鍋"
        ><UiPanel v-for="(pot, i) in state.pots" :key="i" :title="pot.name"
          ><p v-if="pot.hidden">本輪進度保密，結算後公開。</p
          ><template v-else
            ><p>位置 {{ pot.position }}</p
            ><ol class="vue-spectator-chips"
              ><li v-for="(chip, j) in pot.chips" :key="j"
                ><QuacksGlyph
                  :chip="chip"
                  :hint="chip.effect || (chip.label || chip.color) + ' ' + chip.value"
                  :size="40"
                /><template v-if="chip.position !== undefined">
                  · {{ chip.position }} 格</template
                ></li
              ></ol
            ><p v-if="!pot.chips.length">鍋中尚未放入藥材</p></template
          ></UiPanel
        ></section
      >
      <UiPanel v-for="(drawing, i) in state.drawings" :key="i" :title="drawing.title"
        ><svg
          viewBox="0 0 512 256"
          class="vue-spectator-shapes"
          role="img"
          :aria-label="drawing.title + ' 的公開畫作'"
        >
          <template v-for="(shape, j) in drawing.shapes" :key="j">
            <line
              v-if="shape.kind === 'line'"
              :x1="shape.x1"
              :y1="shape.y1"
              :x2="shape.x2"
              :y2="shape.y2"
            />
            <circle v-else :cx="shape.cx" :cy="shape.cy" :r="shape.r" />
          </template></svg
      ></UiPanel>
      <UiPanel
        v-for="(section, i) in state.sections"
        :key="state.type + ':' + i"
        :title="section.title"
        ><p v-for="(line, j) in section.lines" :key="j">{{ line }}</p
        ><dl v-if="section.items.length" class="vue-spectator-items"
          ><div v-for="(item, j) in section.items" :key="j"
            ><dt>{{ item.label }}</dt
            ><dd v-if="item.detail">{{ item.detail }}</dd></div
          ></dl
        ></UiPanel
      >
      <section v-if="state.images.length" class="vue-spectator-grid" aria-label="公開題目圖片"
        ><UiPanel v-for="image in state.images" :key="image.src" :title="image.alt"
          ><img
            class="vue-spectator-question-image"
            :src="image.src"
            :alt="image.alt"
            width="512"
            height="384"
            loading="lazy"
            decoding="async" /></UiPanel
      ></section>
      <template v-if="foreground"
        ><UiPanel v-for="clip in state.clips" :key="clip.key" :title="clip.label"
          ><GameSongClip :playback="clip.playback" :active="foreground && !error" /></UiPanel
      ></template>
      <UiPanel v-for="book in state.books" :key="book.ownerId" :title="book.ownerName + ' 的傳遞簿'"
        ><ol class="vue-spectator-pages"
          ><li v-for="(page, i) in book.pages" :key="i"
            ><strong>{{ page.authorName }} · {{ page.kind === 'drawing' ? '畫圖' : '文字' }}</strong
            ><p v-if="page.skipped">本頁略過{{ page.timedOut ? ' · 逾時沒有已同步內容' : '' }}</p
            ><SpectatorCanvas
              v-else-if="page.kind === 'drawing'"
              :strokes="page.strokes"
              :epoch="state.gameRevision + ':' + book.ownerId + ':' + i"
              :label="book.ownerName + ' 第 ' + (i + 1) + ' 頁畫作'"
            /><p v-else>{{ page.text }}</p></li
          ></ol
        ></UiPanel
      >
    </template>
  </main>
</template>
