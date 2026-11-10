<script setup lang="ts">
import UiIcon from '../../components/UiIcon.vue';
defineProps<{ title?: string; video?: boolean }>();
</script>

<template>
  <section class="vue-lounge" aria-label="共看畫面">
    <div id="lounge-stage" class="vue-lounge-stage">
      <div v-if="!video" class="vue-lounge-idle">
        <UiIcon :name="title ? 'sound' : 'video'" />
        <p>{{
          title ? '正在播放「' + title + '」' : '目前沒有影片。打開聊天室的「媒體」查看播放狀態。'
        }}</p>
      </div>
    </div>
  </section>
</template>
