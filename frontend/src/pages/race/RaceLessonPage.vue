<script setup lang="ts">
import UiButton from '../../components/UiButton.vue';
import { useGameFocus } from '../../composables/game-focus';
import { useRaceLesson } from './useRaceLesson';
import RaceLessonScene from './RaceLessonScene.vue';
import RaceLessonCoach from './RaceLessonCoach.vue';
import RaceLessonRoster from './RaceLessonRoster.vue';
import '../../styles/race-lesson.scss';
const lesson = useRaceLesson(),
  { focused, toggle } = useGameFocus('vue-race-lesson-focus');
</script>
<template>
  <div class="vue-race-lesson-page"
    ><header class="vue-race-lesson-toolbar"
      ><div><h1>雷霆之路 · 新手教學</h1><p>獨立本機教學桌 · 暫停計時</p></div
      ><nav aria-label="教學操作"
        ><a class="quiet" :href="lesson.exitHref">離開教學</a
        ><UiButton
          :label="focused ? '退出專注' : '專注全螢幕'"
          :icon="focused ? 'fullscreen_exit' : 'fullscreen'"
          @click="toggle" /></nav></header
    ><div class="vue-race-lesson-layout"
      ><RaceLessonRoster v-if="lesson.model.state" :state="lesson.model.state" /><section
        class="vue-race-lesson-stage"
        aria-label="教學棋盤"
        ><RaceLessonScene
          v-if="lesson.model.state"
          :key="lesson.sceneKey.value"
          :model="lesson.model" /></section
      ><RaceLessonCoach :lesson="lesson" /></div
  ></div>
</template>
