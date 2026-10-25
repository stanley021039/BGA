<script setup lang="ts">
import BarrageFrames from '../engines/barrage-frames.js';

import { ref } from 'vue';
import { useMutation } from '../composables/mutation';
import UiButton from './UiButton.vue';
import StatusSlot from './StatusSlot.vue';
import { record, text } from '../services/validation';
const emit = defineEmits<{ redeemed: [] }>(),
  code = ref(''),
  mutation = useMutation();
async function redeem() {
  if (mutation.pending.value) return;
  let label = '獎勵';
  const success = await mutation.run(async (request) => {
    const data = await request('/api/achievements/redeem', { code: code.value });
    label = text(record(record(data).redemption).label) || label;
    (
      BarrageFrames as typeof BarrageFrames & { acceptRewards?(data: unknown): void }
    )?.acceptRewards?.(data);
    code.value = '';
    window.dispatchEvent(new Event('achievement-rewards-updated'));
    emit('redeemed');
  });
  if (success) mutation.message.value = '兌換成功！' + label + '已加入收藏，可立即套用。';
}
</script>
<template>
  <section class="page-panel achievement-redemption" aria-labelledby="rewardCodeHeading">
    <h2 id="rewardCodeHeading">成就兌換碼</h2>
    <p>兌換只開放對應獎勵，成就仍需實際遊玩達成。</p>
    <form @submit.prevent="redeem" :aria-busy="mutation.pending.value">
      <label for="achievementRewardCode"
        >兌換碼<input
          id="achievementRewardCode"
          v-model="code"
          maxlength="80"
          autocomplete="off"
          :disabled="mutation.pending.value"
          required
      /></label>
      <UiButton
        type="submit"
        icon="gift"
        label="兌換獎勵"
        :disabled="mutation.pending.value || !code.trim()"
      />
    </form>
    <StatusSlot :message="mutation.message.value" :error="mutation.failed.value" />
  </section>
</template>
<style lang="scss">
.achievement-redemption form {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}
.achievement-redemption label {
  display: grid;
  gap: 0.5rem;
  flex: 1 1 15rem;
  min-width: 0;
}
.achievement-redemption input {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
}
</style>
