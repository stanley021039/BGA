<script setup lang="ts">
import { computed } from 'vue';
import { useMajorityStore } from '../../stores/majority';
import QuestionPreview from './QuestionPreview.vue';
const props = defineProps<{ recap?: boolean; focusId?: string }>(),
  game = useMajorityStore(),
  s = computed(() => game.state);
const name = (id: string) =>
  s.value?.players.find((p) => p.id === id)?.name ||
  s.value?.departed.find((p) => p.id === id)?.name ||
  '已離席';
const sorted = computed(() => [...(s.value?.groups || [])].sort((a, b) => b.count - a.count));
function answerText(id: string) {
  const a = s.value?.answers[id];
  return typeof a === 'number' ? s.value?.question?.options[a] || '未交卷' : a || '未交卷';
}
</script>
<template>
  <div v-if="s" class="vue-majority-results"
    ><p v-if="s.phase === 'review'" class="vue-majority-banner"
      >答案已公開，分數尚未計入。請房主確認同義答案分組。</p
    ><template v-if="s.question && s.cruel && !(props.recap && s.cruel.solo)"
      ><QuestionPreview :question="s.question" /><div class="vue-majority-answer-members"
        ><p v-for="(option, i) in s.question.options" :key="i"
          ><strong>{{ String.fromCharCode(65 + i) }} · {{ option }}</strong
          ><span>{{
            Object.entries(s.answers)
              .filter(([, answer]) => answer === i)
              .map(([id]) => name(id))
              .join('、') || '沒有人選擇'
          }}</span></p
        ></div
      ></template
    ><template v-else-if="!s.cruel"
      ><section
        v-for="group in sorted"
        :key="group.id"
        class="vue-majority-result-group"
        :class="{ 'is-winner': group.winner, 'is-focused': props.focusId === group.id }"
        :data-group="group.id"
        ><div
          ><h3>{{ group.label }}</h3
          ><strong
            >{{ group.count }} 人{{
              group.winner && s.result ? ' · 每人 +' + s.result.points + ' 分' : ''
            }}</strong
          ></div
        ><meter
          min="0"
          :max="Math.max(1, s.participantIds.length)"
          :value="group.count"
          :aria-label="group.label + '：' + group.count + ' / ' + s.participantIds.length + ' 人'"
        /><div class="vue-majority-member-chips"
          ><span v-for="id in group.playerIds" :key="id" :data-member="id"
            >{{ name(id)
            }}{{
              s.phase === 'review' && s.question?.type === 'blank' ? '：' + answerText(id) : ''
            }}</span
          ></div
        ></section
      ><p v-if="!s.groups.length">本題沒有人交卷。</p></template
    >
    <template v-if="s.result && !(props.recap && s.cruel?.solo)"
      ><p class="vue-majority-banner"
        >{{
          s.cruel
            ? s.cruel.rules === 'teams'
              ? '同隊兩人都交卷且答案相同，隊伍 +1 分。'
              : s.cruel.solo
                ? '已記錄你的選擇，不計分。'
                : s.cruel.scoring === 'minority'
                  ? '唯一非空少數組 +1 分；平票或只有一組不加分。'
                  : '唯一多數組 +1 分；平票不加分。'
            : sorted.some((g) => g.winner)
              ? '唯一最大答案組，每人 +' + s.result.points + ' 分。'
              : '最大組並列或不足兩人，本題無人加分。'
        }}{{ s.result.presenterPenalty ? ' 出題者 -1 分：最大組未超過全體玩家三分之一。' : ''
        }}{{
          s.result.missingIds.length
            ? ' 未交卷 ' + s.result.missingIds.length + ' 人，不計分。'
            : ''
        }}</p
      ><div v-if="s.cruel?.rules === 'teams'" class="vue-majority-score-rows"
        ><p v-for="team in s.cruel.teams" :key="team.id"
          ><span>{{ team.name }}</span
          ><strong>+{{ s.result.teamGains[team.id] || 0 }}</strong
          ><span>隊伍總分 {{ team.score }}</span></p
        ></div
      ><div v-else-if="!s.cruel?.solo" class="vue-majority-score-rows"
        ><p v-for="id in s.participantIds" :key="id"
          ><span>{{ name(id) }}{{ s.result.missingIds.includes(id) ? ' · 未交卷' : '' }}</span
          ><strong
            >{{ (s.result.gains[id] || 0) > 0 ? '+' : '' }}{{ s.result.gains[id] || 0 }} 分</strong
          ><span>總分 {{ s.players.find((p) => p.id === id)?.score ?? '—' }}</span></p
        ></div
      ></template
    >
    <template v-if="props.recap && s.cruel"
      ><article v-for="(entry, i) in s.cruel.recap" :key="i" class="vue-majority-recap"
        ><h3>第 {{ i + 1 }} 題</h3
        ><QuestionPreview v-if="entry.question" :question="entry.question" compact /><p
          >你的選擇：{{
            typeof entry.answers[s.me] === 'number'
              ? entry.question?.options[Number(entry.answers[s.me])] || '未交卷'
              : entry.answers[s.me] || '未交卷'
          }}</p
        ></article
      ></template
    >
    <a v-if="s.phase === 'finished'" href="/history">查看對局歷史</a>
  </div>
</template>
