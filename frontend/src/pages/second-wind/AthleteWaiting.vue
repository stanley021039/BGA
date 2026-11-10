<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import athleteHero from '../../assets/second-wind/hero-384.webp?url&no-inline';
import AthleteArt from './AthleteArt.vue';
defineProps<{ roster: string }>();
</script>

<template>
  <RoomWaitingTemplate
    flow
    type="second-wind"
    title="運動員 Second Wind"
    description="招募四名選手，秘密安排出賽順序，利用能力搶下四場比賽的積分。"
    :facts="[
      { label: '人數', value: '3–6 人' },
      { label: '角色', value: roster },
      { label: '賽程', value: 'Twisty／Whirly 各兩場' },
      { label: '獎分', value: '3／1、4／2、5／3、7／4' },
    ]"
    notice="四場能力競速，可加入測試 AI。"
    ><template #art
      ><AthleteArt
        :src="athleteHero"
        alt="Second Wind 原版選手衝線慶祝插畫"
        :width="560"
        :height="394"
        eager /></template
  ></RoomWaitingTemplate>
</template>
