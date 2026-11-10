<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
</script>

<template>
  <RoomWaitingTemplate
    flow
    type="ceo"
    title="王牌執行長"
    description="每回合收購公司、買進他人股票或發放股利，讓自己的投資組合獲得最高總分。"
    :facts="[
      { label: '人數', value: '3–6 人' },
      { label: '起始現金', value: '30 元' },
      { label: '牌庫', value: '48 張本站替代公司' },
      { label: '終局', value: '公開資產 100 後再兩輪' },
    ]"
    notice="替代牌庫的卡片與原版不同；可加入電腦玩家試玩。"
  >
    <template #art><strong>1st CEO</strong></template>
  </RoomWaitingTemplate>
</template>
