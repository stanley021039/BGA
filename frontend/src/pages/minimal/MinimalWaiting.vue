<script setup lang="ts">
import RoomLeaveButton from '../../components/RoomLeaveButton.vue';
import MinimalRules from './MinimalRules.vue';
const art = new URL('./minimal-waiting.svg', import.meta.url).href;
</script>
<template>
  <section class="vue-minimal-waiting-screen">
    <header class="vue-minimal-task-header"
      ><div><h1>極簡畫家</h1><p>3–6 人 · 只畫直線與封閉圓</p></div
      ><span class="vue-minimal-badge">朋友集結中</span></header
    >
    <section class="vue-minimal-waiting-panel"
      ><h2>房間設定</h2
      ><div class="vue-minimal-waiting-content">
        <div class="vue-minimal-hero"
          ><div class="vue-minimal-hero-art"><img :src="art" alt="畫著貓咪的筆記本與鉛筆" /></div
          ><div class="vue-minimal-hero-copy"
            ><p>朋友集結中</p><h2>線條已備，等你作畫。</h2
            ><p>3–6 人一起玩。用直線與圓作畫，由少到多一起猜圖。</p></div
          ></div
        >
        <div class="vue-minimal-fixed-rules"
          ><strong>本遊戲使用固定規則，無需調整。</strong
          ><p>每個圖形算一筆，最多 40 筆；從少筆畫到多筆畫依序猜圖。</p></div
        >
        <details class="vue-minimal-guide"
          ><summary>一分鐘學會極簡畫家</summary><MinimalRules
        /></details> </div
      ><footer class="vue-minimal-footer"
        ><RoomLeaveButton stitch /><div id="minimal-setup-slot"></div></footer
    ></section>
  </section>
</template>
