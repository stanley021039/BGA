<script setup lang="ts">
import { ref } from 'vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import type { useRaceLesson } from './useRaceLesson';
defineProps<{ lesson: ReturnType<typeof useRaceLesson> }>();
const panel = ref<HTMLElement | null>(null);
function clearSelection() {
  const selection = window.getSelection();
  if (selection?.anchorNode && panel.value?.contains(selection.anchorNode))
    selection.removeAllRanges();
}
function selectChapter(event: Event, lesson: ReturnType<typeof useRaceLesson>) {
  lesson.go(Number((event.target as HTMLSelectElement).value));
}
</script>
<template>
  <aside ref="panel" class="vue-race-coach" aria-label="雷霆之路教學面板">
    <header
      ><p class="vue-race-lesson-kicker"
        >新手教學 · {{ lesson.chapter.value + 1 }} / {{ lesson.steps.length }}</p
      ><h2>{{ lesson.step.value[0] }}</h2
      ><label
        >教學章節<select :value="lesson.chapter.value" @change="selectChapter($event, lesson)"
          ><option v-for="(item, index) in lesson.steps" :key="index" :value="index"
            >{{ index + 1 }} · {{ item[0] }}</option
          ></select
        ></label
      ></header
    >
    <div class="vue-race-coach-copy" @dragstart.prevent
      ><ul
        ><li v-for="point in lesson.step.value[2]" :key="point">{{ point }}</li></ul
      ><section v-if="lesson.mission.value" class="vue-race-lesson-mission"
        ><h3>本關目標</h3><p>{{ lesson.mission.value.goal }}</p
        ><p>{{ lesson.mission.value.why }}</p
        ><UiButton
          :label="lesson.hint.value ? '收起提示' : '查看操作提示'"
          @click="lesson.hint.value = !lesson.hint.value"
        /><p v-if="lesson.hint.value">{{ lesson.mission.value.hint }}</p></section
      ><p v-else class="vue-race-lesson-readonly"
        >這是導覽局面。先認識配件，實作章節再操作車輛與骰子。</p
      ></div
    >
    <div class="vue-race-lesson-feedback"
      ><StatusSlot
        :message="
          lesson.result.value?.text ||
          lesson.feedback.value ||
          (lesson.practice.value
            ? '請依目標完成這一關。'
            : '本機教學不會影響線上房間，計時已暫停。')
        "
        :error="lesson.failed.value || lesson.result.value?.ok === false"
      /><p v-if="lesson.moving.value">等待車輛移動完成…</p></div
    >
    <footer @pointerdown="clearSelection"
      ><div
        ><UiButton
          label="上一章"
          icon="arrow_back"
          :disabled="lesson.chapter.value === 0"
          @click="lesson.go(lesson.chapter.value - 1)" /><UiButton
          v-if="lesson.practice.value"
          label="重試本關"
          icon="refresh"
          @click="lesson.retry()" /></div
      ><UiButton
        :label="
          lesson.chapter.value === lesson.steps.length - 1
            ? '完成教學'
            : lesson.practice.value && !lesson.success.value
              ? '完成目標後繼續'
              : '下一章'
        "
        variant="primary"
        icon="arrow_forward"
        :disabled="!lesson.canNext.value"
        @click="lesson.next()"
    /></footer>
  </aside>
</template>
