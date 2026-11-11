<script setup lang="ts">
import { useId } from 'vue';
import UiLink from './UiLink.vue';
import '../styles/room-waiting-template.scss';
defineProps<{
  type: string;
  title: string;
  description: string;
  heroTitle?: string;
  heroDescription?: string;
  art?: string;
  // Smaller copies for the narrow layout, where the art is at most 96px tall.
  artSrcset?: string;
  artSizes?: string;
  artAlt?: string;
  facts: readonly { label: string; value: string }[];
  notice?: string;
  flow?: boolean;
  quickAction?: { href: string; label: string };
}>();
const heading = useId();
</script>
<template>
  <section
    class="vue-room-waiting-template"
    :class="{ 'is-flow': flow, 'has-mode-picker': $slots['mode-picker'] }"
    :data-waiting-game="type"
    :aria-labelledby="heading"
  >
    <div v-if="$slots['mode-picker']" class="vue-waiting-mode-picker"
      ><slot name="mode-picker"
    /></div>
    <header class="vue-waiting-hero">
      <div
        class="vue-waiting-art"
        :role="!art ? 'img' : undefined"
        :aria-label="!art ? artAlt || title + '遊戲插畫' : undefined"
        ><slot name="art"
          ><img
            v-if="art"
            :src="art"
            :srcset="artSrcset"
            :sizes="artSrcset ? artSizes : undefined"
            :alt="artAlt || title + '遊戲插畫'" /></slot
      ></div>
      <div class="vue-waiting-hero-copy"
        ><h1 :id="heading">{{ heroTitle || title }}</h1
        ><p>{{ heroDescription || description }}</p
        ><UiLink
          v-if="quickAction"
          class="vue-waiting-quick-action"
          :href="quickAction.href"
          :label="quickAction.label" /><slot name="hero-actions"
      /></div>
    </header>
    <div class="vue-waiting-lower">
      <section class="vue-waiting-summary" aria-label="房間摘要"
        ><h2>{{ heroTitle && heroTitle !== title ? title : '房間摘要' }}</h2
        ><p v-if="heroDescription && heroDescription !== description">{{ description }}</p>
        <dl
          ><div v-for="fact in facts" :key="fact.label"
            ><dt>{{ fact.label }}</dt
            ><dd>{{ fact.value }}</dd></div
          ></dl
        >
        <slot name="summary-extra" /><p v-if="notice" class="vue-waiting-notice">{{ notice }}</p>
      </section>
      <section class="vue-waiting-settings" aria-label="遊戲設定"
        ><h2>房間設定</h2
        ><div v-if="$slots.settings" class="vue-waiting-settings-extra"
          ><slot name="settings" /></div
        ><div :id="'room-waiting-settings-' + type" class="vue-waiting-settings-target"></div
        ><slot name="settings-after"
      /></section>
    </div>
  </section>
</template>
