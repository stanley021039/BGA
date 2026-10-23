<script setup lang="ts">
import QuacksRuleVisual from './QuacksRuleVisual.vue';
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import UiButton from '../../components/UiButton.vue';
const game = useQuacksStore();
</script>
<template>
  <section
    v-if="game.state && (game.state.options.witches || game.state.visitingWitch)"
    class="vue-quacks-witches"
    ><h2>草藥女巫</h2
    ><article v-if="game.state.visitingWitch"
      ><header
        ><QuacksGlyph :resource="game.state.visitingWitch.color || 'gold'" /><h3
          >免費來訪 · {{ game.state.visitingWitch.name }}</h3
        ></header
      ><QuacksRuleVisual
        :text="game.state.visitingWitch.text"
        :resource="game.state.visitingWitch.color || 'gold'" /><p>{{
        game.mine?.visitorUsed
          ? '本輪已使用'
          : game.mine?.canVisit
            ? '現在可以免費使用，不消耗女巫幣。'
            : '等待符合能力使用條件。'
      }}</p
      ><UiButton legacy
        icon="check"
        label="使用免費來訪女巫"
        :disabled="!game.available || !game.mine?.canVisit"
        @click="game.command('free-witch')" /></article
    ><article v-for="(witch, color) in game.state.witches" :key="color"
      ><template v-if="witch"
        ><header
          ><QuacksGlyph :resource="String(color)" /><h3
            >{{ witch.name }} · {{ game.mine?.coins[color] ? '幣尚未使用' : '幣已使用' }}</h3
          ></header
        ><QuacksRuleVisual :text="witch.text" :resource="String(color)" /><UiButton legacy
          icon="check"
          :label="'使用' + witch.name"
          :disabled="!game.available || !game.mine?.witchAvailable[color]"
          @click="game.command('witch', { color })" /></template></article
  ></section>
</template>
