<script setup lang="ts">
import SongTitleZh from '../../engines/song-title-zh.js';
import FramePreview from '../../components/FramePreview.vue';

defineProps<{
  cards: readonly { title: string; year: number; artist: string; language?: string }[];
  frame?: string;
}>();
const hint = (title: string, language?: string) => SongTitleZh?.hint(title, language);
</script>

<template>
  <div class="mq-timeline">
    <template v-for="(card, i) in cards" :key="i">
      <slot name="insert" :index="i" />
      <article
        class="mq-timeline-card"
        :title="hint(card.title, card.language)"
        :data-ui-hint="hint(card.title, card.language) ? '' : undefined"
        tabindex="0"
      >
        <FramePreview
          portrait
          :frame="frame || 'default'"
          :name="String(card.year)"
          :message="card.title"
          :lines="[String(card.year), card.title, card.artist]"
        />
      </article>
    </template>
    <slot name="insert" :index="cards.length" />
  </div>
</template>
