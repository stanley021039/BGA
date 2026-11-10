<script setup lang="ts">
import { computed } from 'vue';
import type { QuacksSnapshot } from '../../contracts/quacks';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import UiPanel from '../../components/UiPanel.vue';
import QuacksPot from './QuacksPot.vue';
import QuacksFortuneCard from './QuacksFortuneCard.vue';
import QuacksScoreboard from './QuacksScoreboard.vue';
import QuacksWaitingHero from './QuacksWaitingHero.vue';

const props = defineProps<{ state: QuacksSnapshot; following: string }>();
const recipe = computed(
  () => props.state.recipes.find((pot) => pot.id === props.following) ?? props.state.recipes[0],
);
</script>

<template>
  <RoomWaitingTemplate
    v-if="state.phase === 'waiting'"
    type="quacks"
    title="郎中闖江湖"
    hero-title="藥袋已備，準備開釜。"
    description="九回合同步抽藥，逐色共選本局藥材效果。"
    :facts="[
      { label: '玩家', value: state.players.length + '／' + state.maxPlayers + ' 位' },
      { label: '回合數', value: state.roundLimit + ' 輪' },
      { label: '藥鍋進度', value: state.options.hiddenProgress ? '結算時公開' : '即時公開' },
    ]"
    ><template #art><QuacksWaitingHero art-only /></template
  ></RoomWaitingTemplate>
  <template v-else>
    <QuacksFortuneCard
      v-if="state.phase === 'fortune'"
      :fortune="state.fortune"
      :flipped="!!state.fortune"
      :can-draw="false"
      :caption="state.fortune ? '本輪占卜已公開' : '等待玩家抽取占卜牌'"
    />
    <UiPanel v-else-if="recipe" :title="recipe.potName">
      <QuacksPot :state="state" :recipe="recipe" />
    </UiPanel>
    <QuacksScoreboard :observer="state" />
  </template>
</template>
