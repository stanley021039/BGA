<script setup lang="ts">
import type { TrpgResult } from '../../contracts/trpg';
defineProps<{ result: TrpgResult }>();
const outcomes = { success: '成功', partial: '付出代價仍推進', failure: '受挫仍推進' };
</script>
<template>
  <article class="vue-trpg-result"
    ><h3>第 {{ result.round }} 幕 · {{ result.title }}</h3
    ><p
      ><strong>{{ outcomes[result.outcome] }}</strong> · {{ result.leaderName }} ·
      {{ result.approach }}</p
    ><p class="vue-trpg-formula"
      >骰 {{ result.die }} ＋ 專長 {{ result.skill }} ＋ 協助 {{ result.support }} ＝
      {{ result.total }} ／ 難度 {{ result.difficulty }}</p
    ><p>{{ result.text }}</p
    ><p>線索 ＋{{ result.clues }} · 危機 ＋{{ result.danger }}</p
    ><details
      ><summary>每位冒險者的行動（{{ result.participants.length }} 位）</summary
      ><ul
        ><li v-for="participant in result.participants" :key="participant.id"
          ><strong>{{ participant.name }}</strong
          >：{{ participant.note || '用行動參與故事'
          }}<small>{{
            participant.skipped
              ? '本幕離線休息，沒有恢復或消耗專注'
              : participant.charged
                ? '協助領隊，專注 −1'
                : participant.stance === 'recover'
                  ? '整備，專注 ＋1（上限 3）'
                  : '協助，未扣專注'
          }}</small></li
        ></ul
      ></details
    ></article
  >
</template>
