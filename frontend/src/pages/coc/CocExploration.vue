<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CocSnapshot } from '../../contracts/coc';
import UiTabs from '../../components/UiTabs.vue';
import UiField from '../../components/UiField.vue';
import UiButton from '../../components/UiButton.vue';
const props = defineProps<{ media: CocSnapshot['exploration'] }>();
const tab = ref('map'),
  artId = ref(''),
  imageState = ref('loading'),
  imageAttempt = ref(0);
const art = computed(
  () => props.media.illustrations.find((a) => a.id === artId.value) || props.media.illustrations[0],
);
const map = computed(() => props.media.map);
const nodeById = computed(() => Object.fromEntries(map.value?.nodes.map((n) => [n.id, n]) || []));
const labels: Record<string, string> = {
  current: '目前位置',
  explored: '已探索',
  known: '已知，尚未探索',
};
watch(
  () => props.media.illustrations.map((a) => a.id).join('|'),
  () => {
    if (!props.media.illustrations.some((a) => a.id === artId.value))
      artId.value =
        props.media.illustrations.find((a) => a.current)?.id ||
        props.media.illustrations[0]?.id ||
        '';
  },
  { immediate: true },
);
watch(
  () => art.value?.url,
  () => {
    imageState.value = 'loading';
    imageAttempt.value = 0;
  },
);
</script>
<template>
  <div class="coc-exploration">
    <UiTabs
      v-model="tab"
      :items="[
        { id: 'map', label: '地圖' },
        { id: 'art', label: '插圖', count: String(media.illustrations.length) },
      ]"
      label="探索資料"
      panel-prefix="coc-explore"
    />
    <section v-show="tab === 'map'" id="coc-explore-map" role="tabpanel" class="coc-explore-slot">
      <template v-if="map">
        <p class="coc-explore-caption">{{ map.title }} · {{ map.note }}</p>
        <div class="coc-map-scroll" tabindex="0" role="region" aria-label="調查地圖，可左右捲動">
          <svg :viewBox="`0 0 ${map.width} ${map.height}`" aria-hidden="true" class="coc-map">
            <g class="map-path">
              <template v-for="link in map.links" :key="link.from + '-' + link.to">
                <line
                  v-if="nodeById[link.from] && nodeById[link.to]"
                  :x1="nodeById[link.from].x"
                  :y1="nodeById[link.from].y"
                  :x2="nodeById[link.to].x"
                  :y2="nodeById[link.to].y"
                />
              </template>
            </g>
            <g
              v-for="node in map.nodes"
              :key="node.id"
              :class="['map-node', node.status]"
              :transform="`translate(${node.x},${node.y})`"
            >
              <rect x="-78" y="-32" width="156" height="64" rx="8" />
              <text text-anchor="middle" y="-2">{{ node.label }}</text>
              <text class="map-state" text-anchor="middle" y="20">{{ labels[node.status] }}</text>
            </g>
          </svg>
        </div>
        <ul class="coc-map-key" aria-label="已揭露地點"
          ><li v-for="node in map.nodes" :key="node.id"
            >{{ node.name }} · {{ labels[node.status] }}</li
          ></ul
        > </template
      ><p v-else>開始探索後會在這裡記錄地圖。</p>
    </section>
    <section v-show="tab === 'art'" id="coc-explore-art" role="tabpanel" class="coc-explore-slot">
      <div class="coc-art-picker"
        ><UiField
          v-if="media.illustrations.length"
          v-model="artId"
          label="已探索場景插圖"
          control="select"
          :options="media.illustrations.map((a) => ({ value: a.id, label: a.title }))"
        /><p v-else>探索到對應地點後，固定插圖會在這裡揭露。</p></div
      >
      <figure class="coc-art-frame">
        <div class="coc-art-image"
          ><picture v-if="art" :key="art.url + imageAttempt">
            <source media="(max-width: 360px)" :srcset="art.smallUrl" type="image/webp" />
            <source media="(max-width: 760px)" :srcset="art.mediumUrl" type="image/webp" />
            <img
              :src="art.url"
              :alt="art.alt"
              @load="imageState = 'ready'"
              @error="imageState = 'error'"
            /> </picture
          ><p v-else>尚未發現場景插圖</p></div
        >
        <figcaption
          >{{ art ? art.title + ' · 已探索場景' : '尚無已揭露素材'
          }}<span v-if="art"> · {{ art.current ? '目前位置' : '先前探索的地點' }}</span></figcaption
        >
      </figure>
      <div class="coc-image-status" role="status"
        ><template v-if="art && imageState === 'error'"
          ><span>插圖暫時無法載入，調查紀錄仍已保存。</span
          ><UiButton
            label="重新載入插圖"
            icon="refresh"
            @click="
              imageState = 'loading';
              imageAttempt++;
            " /></template
        ><span v-else-if="art && imageState === 'loading'">插圖載入中…</span></div
      >
    </section>
  </div>
</template>
<style scoped>
.coc-exploration {
  min-inline-size: 0;
  display: grid;
  gap: var(--stitch-space-16);
}
.coc-explore-slot {
  block-size: 34rem;
  min-inline-size: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.coc-explore-caption {
  min-block-size: 3em;
  margin: 0 0 var(--stitch-space-12);
}
.coc-map-scroll {
  overflow: auto;
  block-size: 22rem;
  min-inline-size: 0;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--stitch-surface-subtle);
}
.coc-map {
  display: block;
  min-inline-size: 46rem;
  inline-size: 100%;
  block-size: auto;
}
.map-path line {
  stroke: var(--stitch-line);
  stroke-width: 3;
}
.map-node rect {
  fill: var(--stitch-surface);
  stroke: var(--stitch-line);
  stroke-width: 2;
}
.map-node.current rect {
  stroke: var(--stitch-primary);
  stroke-width: 4;
}
.map-node.known rect {
  stroke-dasharray: 6 4;
}
.map-node text {
  fill: var(--stitch-ink);
  font-family: var(--stitch-font-family);
  font-size: 17px;
}
.map-node text.map-state {
  font-size: 13px;
}
.coc-map-key {
  margin-block: var(--stitch-space-12);
  padding-inline-start: 1.25rem;
  line-height: 1.6;
}
.coc-art-picker {
  min-block-size: 5rem;
}
.coc-art-frame {
  margin: 0;
}
.coc-art-image {
  inline-size: min(100%, 36rem);
  margin-inline: auto;
  aspect-ratio: 16/9;
  display: grid;
  place-items: center;
  background: var(--stitch-surface-subtle);
  overflow: hidden;
}
.coc-art-image picture {
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
}
.coc-art-image img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
.coc-art-frame figcaption {
  min-block-size: 3em;
  padding-block: var(--stitch-space-12);
  overflow-wrap: anywhere;
}
.coc-image-status {
  min-block-size: 4rem;
  display: flex;
  align-items: center;
  gap: var(--stitch-space-12);
}
@media (max-width: 760px) {
  .coc-explore-slot {
    block-size: 31rem;
  }
  .coc-map-scroll {
    block-size: 18rem;
  }
  .coc-image-status {
    flex-wrap: wrap;
  }
}
</style>
