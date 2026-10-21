<script setup lang="ts">
import { useQuacksStore } from '../../stores/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
const game = useQuacksStore();
</script>
<template>
  <section class="vue-quacks-records vue-quacks-records-rq"
    ><p v-if="!game.state?.results.length" class="vue-quacks-records-empty">尚無已完成回合。</p
    ><article
      v-for="result in game.state?.results"
      :key="result.round"
      :data-quacks-record-round="result.round"
      ><h2>第 {{ result.round }} 回合 · {{ result.fortune.name }}</h2
      ><p>{{ result.fortune.text }}</p
      ><section v-for="p in result.players" :key="p.id" class="vue-quacks-record-player"
        ><h3>{{ p.name }} · 累計 {{ p.score }} 分</h3
        ><p
          >{{ p.exploded ? '爆炸' : '安全' }} · 位置 {{ p.position }} · 普通抽藥 {{ p.draws }} 片 ·
          紅寶石 {{ p.rubies }}</p
        ><p
          >結算格 {{ p.field.position }} · {{ p.field.coins }} 金幣 · {{ p.field.points }} 分{{
            p.field.ruby ? ' · 紅寶石格' : ''
          }}</p
        ><h4>大釜藥材</h4
        ><div class="vue-quacks-tabs"
          ><span v-for="c in p.pot" :key="c.id"
            ><QuacksGlyph :chip="c" />第 {{ c.position }} 格</span
          ></div
        ><h4>溢出盆</h4
        ><div class="vue-quacks-tabs"
          ><QuacksGlyph v-for="c in p.overflow" :key="c.id" :chip="c" /></div
        ><h4>採購</h4
        ><div class="vue-quacks-tabs"
          ><span v-for="(c, index) in p.bought" :key="index"
            ><QuacksGlyph :chip="c" />{{ c.price === undefined ? '' : c.price + ' 金幣' }}</span
          ></div
        ><p
          >擲骰：{{
            p.dice
              .map((n) => ['1分', '1分', '2分', '紅寶石1', '水滴前進1', '南瓜1'][n])
              .join('、') || '無'
          }}</p
        ><p v-if="p.alchemy"
          >病患
          {{ game.state?.patients.find((patient) => patient.id === p.alchemy?.patientId)?.name }} ·
          特效藥 {{ p.alchemy.essence }} 格</p
        ><p v-if="p.alchemy?.calculation"
          >彩色種類 {{ p.alchemy.calculation.colors }} · 白色恰好7
          {{ p.alchemy.calculation.exactSeven }} · 鄰座爆炸 {{ p.alchemy.calculation.explosions }} ·
          愚人草 {{ p.alchemy.calculation.locoweed }} · 占卜 {{ p.alchemy.calculation.fortune }}</p
        ></section
      ></article
    ></section
  >
</template>
