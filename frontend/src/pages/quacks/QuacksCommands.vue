<script setup lang="ts">
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import UiButton from '../../components/UiButton.vue';
const game = useQuacksStore(),
  s = computed(() => game.state!),
  m = computed(() => game.mine);
</script>
<template>
  <div class="vue-quacks-commands">
    <template v-if="game.setup"
      ><span>{{
        s.phase === 'waiting' ? '準備好後，由房主開始遊戲。' : '由房主按房間設定中的再玩一局。'
      }}</span></template
    >
    <span v-else-if="s.interrupted">本場中止，已完成回合保留。</span>
    <span v-else-if="m?.pending">請完成上方必要效果選擇。</span
    ><span v-else-if="m?.waitingEffect">等待其他人完成效果。</span>
    <UiButton
      v-else-if="s.phase === 'fortune' && s.me === s.roundStarterId"
      icon="play"
      label="抽取本輪占卜牌"
      :disabled="!game.available"
      @click="game.drawFortune()"
    />
    <template v-else-if="s.phase === 'brewing' && m"
      ><template v-if="s.stage === 'drawing'"
        ><template v-if="m.canDraw"
          ><UiButton
            class="vue-quacks-draw-action"
            icon="draw-bag"
            label="還要爽爽 · 繼續抽藥"
            :disabled="!game.available"
            @click="game.command('draw', { step: s.step })"
            ><template #icon><img src="/assets/quacks/draw-777.png" alt="" /></template></UiButton
          ><UiButton
            class="vue-quacks-stop-action"
            icon="close"
            label="我不抽了 QQ · 安全停手"
            :disabled="!game.available"
            @click="game.command('stop', { step: s.step })"
            ><template #icon
              ><img
                src="/assets/quacks/stop-portrait-v1.png"
                alt="" /></template></UiButton></template
        ><span v-else>{{
          game.own?.stopped ? '你已停止，等待其他人。' : '已選擇，等待同步揭曉。'
        }}</span
        ><UiButton
          v-if="m.canPotion"
          icon="undo"
          label="藥水瓶：收回最後白色炸彈"
          :disabled="!game.available"
          @click="game.command('potion')" /></template
      ><UiButton
        v-else-if="s.stage === 'reserves'"
        icon="check"
        label="暫存決定完成，其餘保留"
        :disabled="!game.available || m.reserve.some((c) => c.must)"
        @click="game.command('reserve-done')"
    /></template>
    <template v-else-if="s.phase === 'settlement' && m"
      ><template v-if="s.stage === 'essence'"
        ><UiButton
          v-if="m.alchemy?.diceRemaining"
          icon="dice"
          :label="'擲特效藥骰（剩' + m.alchemy.diceRemaining + '次）'"
          :disabled="!game.available"
          @click="game.command('essence-roll')"
        /><UiButton
          v-else-if="!m.alchemy?.confirmed"
          icon="check"
          :label="'確認特效藥第 ' + m.alchemy?.max + ' 格'"
          :disabled="!game.available"
          @click="game.command('essence', { position: m.alchemy?.max })"
        /><span v-else>特效藥已確認，等待其他人及額外效果。</span></template
      ><span v-else-if="m.ready">你已完成，等待其他人。</span
      ><UiButton
        v-else-if="s.stage === 'witches'"
        icon="check"
        label="準備結算"
        :disabled="!game.available"
        @click="game.command('settle-ready')" /><template v-else-if="s.stage === 'bonus'"
        ><UiButton
          v-if="m.bonusEligible && !m.bonusRolled"
          icon="dice"
          label="擲獎勵骰"
          :disabled="!game.available"
          @click="game.command('roll-bonus')" /><UiButton
          v-else
          icon="check"
          label="獎勵骰完成，查看藥材效果"
          :disabled="!game.available"
          @click="game.command('bonus-ready')" /></template
      ><UiButton
        v-else-if="s.stage === 'effects-confirm'"
        icon="check"
        label="確認藥材效果"
        :disabled="!game.available"
        @click="game.command('confirm-effects')" /><template v-else-if="s.stage === 'rewards'"
        ><UiButton
          icon="star"
          :label="game.own?.exploded ? '我要勝利分數' : '領取本輪獎勵'"
          :disabled="!game.available"
          @click="game.command('reward', { mode: 'score' })" /><UiButton
          v-if="game.own?.exploded"
          icon="ingredient"
          label="我要買藥材"
          :disabled="!game.available"
          @click="game.command('reward', { mode: 'buy' })" /></template
      ><UiButton
        v-else-if="s.stage === 'shopping'"
        icon="check"
        label="完成本輪結算"
        :disabled="!game.available"
        @click="game.command('shop-ready')"
    /></template>
    <UiButton
      v-else-if="s.phase === 'between'"
      icon="next"
      label="下一回合"
      :disabled="!game.available || s.host !== s.me"
      @click="game.command('next')"
    /><span v-else>{{
      s.phase === 'round-intro'
        ? '準備下一回合…'
        : s.phase === 'patients'
          ? '在上方選擇本場治療的病患。'
          : '等待其他玩家。'
    }}</span>
    <UiButton
      v-if="game.canRetry"
      icon="refresh"
      label="重試同一操作"
      :disabled="!game.canRetry"
      @click="game.retrySame()"
    />
  </div>
</template>
