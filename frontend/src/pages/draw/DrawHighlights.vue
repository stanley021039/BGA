<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import type { PublicDrawSnapshot } from '../../contracts/draw-results';
import { useRoomStore } from '../../stores/room';
import { useDrawResultsStore } from '../../stores/draw-results';
import { formatMediaTime } from '../../contracts/media';
import ResultCanvas from '../../components/ResultCanvas.vue';
import UiButton from '../../components/UiButton.vue';
import '../../styles/draw-scene.scss';
const props = defineProps<{ snapshot: DrawSnapshot }>(),
  emit = defineEmits<{ review: [id: string] }>();
const room = useRoomStore(),
  results = useDrawResultsStore(),
  images = shallowRef<Record<string, PublicDrawSnapshot>>({}),
  failures = shallowRef(new Set<string>()),
  loading = ref(false);
const summary = computed(() => props.snapshot.matchSummary),
  list = computed(() =>
    props.snapshot.recentResults.filter((result) => result.gameRunId === props.snapshot.gameRunId),
  );
const highlights = computed(() =>
  [...list.value]
    .sort((a, b) => b.guessedIds.length - a.guessedIds.length || a.round - b.round)
    .slice(0, 3),
);
const elapsed = computed(() =>
  summary.value?.startedAt !== null &&
  summary.value?.startedAt !== undefined &&
  summary.value.endedAt !== null
    ? formatMediaTime((summary.value.endedAt - summary.value.startedAt) / 1000)
    : '—',
);
const success = computed(() =>
  summary.value?.eligibleGuesses
    ? ((summary.value.correctGuesses / summary.value.eligibleGuesses) * 100).toFixed(1) + '%'
    : '—',
);
let generation = 0,
  disposed = false;
async function load() {
  const token = ++generation,
    scope = room.scope;
  images.value = {};
  failures.value = new Set();
  loading.value = true;
  await Promise.allSettled(
    highlights.value.map(async (item) => {
      try {
        const value = await results.load(item.resultId);
        if (!disposed && token === generation && scope === room.scope)
          images.value = { ...images.value, [item.resultId]: value };
      } catch {
        if (!disposed && token === generation && scope === room.scope)
          failures.value = new Set([...failures.value, item.resultId]);
      }
    }),
  );
  if (!disposed && token === generation) loading.value = false;
}
watch(
  [
    () => room.scope,
    () => props.snapshot.gameRunId,
    () => highlights.value.map((item) => item.resultId).join('|'),
  ],
  load,
  { immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  generation++;
});
</script>
<template>
  <section class="vue-draw-summary vue-draw-summary-v2" aria-label="賽局總結"
    ><header
      ><h2>賽局總結</h2><p>對局耗時 {{ elapsed }} · 已完成 {{ summary?.rounds || 0 }} 題</p></header
    ><dl class="vue-draw-summary-grid"
      ><div
        ><dt>MVP 畫作</dt><dd>{{ summary?.bestArtwork?.answer || '尚無完成畫作' }}</dd
        ><small>最多人猜中的畫作；不另加分</small></div
      ><div
        ><dt>猜題成功率</dt><dd>{{ success }}</dd
        ><small>猜中人次／可猜題人次</small></div
      ><div
        ><dt>最快猜中</dt
        ><dd>{{
          summary?.fastest ? (summary.fastest.milliseconds / 1000).toFixed(1) + ' 秒' : '—'
        }}</dd
        ><small>{{ summary?.fastest?.name || '尚無答對紀錄' }}</small></div
      ><div
        ><dt>保留筆畫</dt><dd>{{ summary?.strokeCount ?? '—' }}</dd
        ><small>本局各輪完成畫作的筆畫總數</small></div
      ></dl
    ><header
      ><h2>精彩名場面</h2><p>目前保留本局最近 {{ list.length }} 幅</p></header
    ><div class="vue-draw-highlights"
      ><article v-for="item in highlights" :key="item.resultId"
        ><button
          type="button"
          class="vue-draw-highlight-open"
          :aria-label="'查看第 ' + item.round + ' 輪畫作：' + (item.answer || '未選題')"
          @click="emit('review', item.resultId)"
          ><ResultCanvas
            v-if="images[item.resultId]"
            :snapshot="images[item.resultId]"
            compact
          /><span v-else class="vue-draw-highlight-placeholder">{{
            failures.has(item.resultId) ? '縮圖暫時無法載入，點擊回看畫作' : '正在還原畫作…'
          }}</span
          ><strong>R{{ item.round }} · {{ item.answer || '未選定題目' }}</strong
          ><small>{{ item.artist.name }} · {{ item.guessedIds.length }} 人猜中</small></button
        ></article
      ></div
    ><p v-if="!highlights.length">本局還沒有公開畫作。</p
    ><UiButton
      v-if="failures.size"
      variant="secondary"
      icon="refresh"
      label="重試載入精選縮圖"
      :pending="loading"
      @click="load"
  /></section>
</template>
