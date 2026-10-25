<script setup lang="ts">
import { useId } from 'vue';
import '../styles/room-waiting-template.scss';
defineProps<{
  type: string;
  title: string;
  description: string;
  heroTitle?: string;
  heroDescription?: string;
  art?: string;
  artAlt?: string;
  facts: readonly { label: string; value: string }[];
  notice?: string;
  flow?: boolean;
}>();
const heading = useId();
</script>
<template>
  <section
    class="vue-room-waiting-template"
    :class="{ 'is-flow': flow }"
    :data-waiting-game="type"
    :aria-labelledby="heading"
  >
    <header class="vue-waiting-hero">
      <div
        class="vue-waiting-art"
        :role="!art ? 'img' : undefined"
        :aria-label="!art ? artAlt || title + '遊戲插畫' : undefined"
        ><slot name="art"><img v-if="art" :src="art" :alt="artAlt || title + '遊戲插畫'" /></slot
      ></div>
      <div class="vue-waiting-hero-copy"
        ><h1 :id="heading">{{ heroTitle || title }}</h1
        ><p>{{ heroDescription || description }}</p
        ><slot name="hero-actions"
      /></div>
    </header>
    <div class="vue-waiting-lower">
      <section class="vue-waiting-summary" aria-label="已設定內容"
        ><span class="vue-waiting-summary-label">已設定內容</span><h2>{{ title }}</h2
        ><p>{{ description }}</p>
        <dl
          ><div v-for="fact in facts" :key="fact.label"
            ><dt>{{ fact.label }}</dt
            ><dd>{{ fact.value }}</dd></div
          ></dl
        >
        <slot name="summary-extra" /><p class="vue-waiting-notice">{{
          notice || '等待房主或管理者開始'
        }}</p>
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
