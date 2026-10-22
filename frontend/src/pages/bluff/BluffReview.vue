<script setup lang="ts">
import { computed } from 'vue';
import { bluffRoles, type BluffSnapshot } from '../../contracts/bluff';
import UiButton from '../../components/UiButton.vue';
const props = defineProps<{ state: BluffSnapshot; modelValue: string; disabled: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; ban: [id: string] }>();
const result = computed(
  () => props.state.results.find((r) => r.resultId === props.modelValue) || null,
);
</script>
<template>
  <section class="vue-bluff-review" aria-label="回合詳細結果"
    ><header
      ><h2>{{ state.phase === 'reveal' ? '本輪詳細揭曉' : '本場回顧' }}</h2
      ><label v-if="state.phase === 'finished' && state.results.length"
        >查看回合<select
          :value="modelValue"
          @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
          ><option v-for="item in state.results" :key="item.resultId" :value="item.resultId"
            >第 {{ item.round }} 輪 · {{ item.title }}</option
          ></select
        ></label
      ></header
    ><p v-if="!result">正在讀取已完成回合。</p
    ><article v-else class="vue-bluff-result"
      ><h3>{{ result.round }}. {{ result.title }}（{{ result.level }} 級）</h3
      ><p>{{ result.answer }}</p
      ><p
        >想想：{{ result.thinkerName }} · 選擇：{{ result.selectedName }} · 老實人：{{
          result.honestName
        }}</p
      ><p v-if="result.challenges.length">公三小：{{ result.challenges.join('、') }}</p
      ><section v-if="result.transcript.length" class="vue-bluff-review-speech"
        ><h4>大家說了什麼</h4
        ><ol
          ><li v-for="(line, index) in result.transcript" :key="index"
            ><strong>{{ line.name }}</strong
            ><span>{{ line.text }}</span></li
          ></ol
        ></section
      ><template v-if="result.explanation"
        ><p>{{ result.explanation.detail }}</p
        ><p>例子：{{ result.explanation.example }}</p
        ><p>易混淆：{{ result.explanation.clarification }}</p></template
      ><ul class="vue-bluff-scores"
        ><li v-for="(player, index) in result.roles" :key="index"
          ><strong>{{ player.name }} · {{ bluffRoles[player.role] }}</strong
          ><span
            :data-delta="player.delta > 0 ? 'positive' : player.delta < 0 ? 'negative' : 'neutral'"
            >{{ player.delta >= 0 ? '+' : '' }}{{ player.delta }} 分</span
          ><span>累計 {{ player.score }}</span></li
        ></ul
      ><a :href="result.source.url" target="_blank" rel="noopener noreferrer"
        >查證來源：{{ result.source.title }}</a
      ><div v-if="result.ban" class="vue-bluff-ban"
        ><p>禁題票數 {{ result.ban.votes }}／{{ result.ban.required }}（本輪真人過半數）</p
        ><UiButton
          stitch
          variant="secondary"
          icon="help"
          :label="
            result.ban.banned ? '已全站禁用' : result.ban.voted ? '已投票禁用' : '投票禁用此題'
          "
          :disabled="disabled || result.ban.banned || result.ban.voted || !result.ban.canVote"
          @click="emit('ban', result.resultId)" /></div></article
  ></section>
</template>
