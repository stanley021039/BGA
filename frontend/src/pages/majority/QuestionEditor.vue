<script setup lang="ts">
import { majorityKindLabels } from '../../contracts/majority';
import type { MajorityKind } from '../../contracts/majority';
defineProps<{
  draft: { type: MajorityKind; topic: string; prompt: string; options: string[] };
  topics: { id: string; label: string }[];
  disabled?: boolean;
  showTopic?: boolean;
}>();
</script>
<template>
  <fieldset class="vue-majority-question-editor" :disabled="disabled"
    ><legend>自己出題</legend
    ><label
      >題型<select v-model="draft.type"
        ><option v-for="(label, key) in majorityKindLabels" :key="key" :value="key">{{
          label
        }}</option></select
      ></label
    ><label v-if="showTopic"
      >分類<select v-model="draft.topic"
        ><option
          v-for="topic in topics.filter((t) => t.id !== 'cruel')"
          :key="topic.id"
          :value="topic.id"
          >{{ topic.label }}</option
        ></select
      ></label
    ><label class="vue-majority-prompt-field"
      >想問大家什麼？<textarea
        v-model="draft.prompt"
        maxlength="160"
        required
        rows="3"
        placeholder="問一個具體、簡短的問題"
      /></label
    ><p v-if="draft.type === 'blank'">每人填一個答案，不需要設定正確答案。</p
    ><label v-for="n in draft.type === 'blank' ? 0 : draft.type === 'two' ? 2 : 3" :key="n"
      >選項 {{ String.fromCharCode(64 + n)
      }}<input v-model="draft.options[n - 1]" maxlength="60" required /></label
  ></fieldset>
</template>
