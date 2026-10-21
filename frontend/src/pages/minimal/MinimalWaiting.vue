<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import MinimalRules from './MinimalRules.vue';
const art = new URL('./minimal-waiting.svg', import.meta.url).href;
</script>
<template>
  <RoomWaitingTemplate
    type="minimal"
    title="極簡畫家"
    hero-title="線條已備，等你作畫。"
    description="3–6 人 · 只畫直線與封閉圓"
    :art="art"
    :facts="[
      { label: '圖形工具', value: '直線、封閉圓' },
      { label: '筆畫上限', value: '40 筆' },
      { label: '猜圖順序', value: '少筆畫 → 多筆畫' },
    ]"
    notice="朋友集結中"
    ><template #settings
      ><p>本遊戲使用固定規則，無需調整。</p
      ><details><summary>一分鐘學會極簡畫家</summary><MinimalRules /></details></template
  ></RoomWaitingTemplate>
</template>
