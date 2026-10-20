<script setup lang="ts">
import type { MajorityQuestion } from '../../contracts/majority';
import { majorityKindLabels } from '../../contracts/majority';
defineProps<{question:MajorityQuestion;compact?:boolean}>();
</script>
<template><div class="vue-majority-question" :class="{'is-compact':compact}"><small>{{ majorityKindLabels[question.type] }} · {{ question.pack }}{{ question.reused?' · 重新混題':'' }}</small><h3>{{ question.prompt }}</h3><div v-if="question.options.length" class="vue-majority-question-options"><div v-for="(option,i) in question.options" :key="i"><img v-if="question.images[i]" :src="question.images[i]" :alt="option" width="420" height="270" loading="lazy"><strong>{{ String.fromCharCode(65+i) }} · {{ option }}</strong></div></div><p v-else>大家各自填一個答案</p><slot /></div></template>
