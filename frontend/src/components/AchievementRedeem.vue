<script setup lang="ts">
import BarrageFrames from '../engines/barrage-frames.js';

import { ref } from 'vue';
import { useMutation } from '../composables/mutation';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';
import StatusSlot from './StatusSlot.vue';
import { array, record, text } from '../services/validation';
const gift = ref<{ label: string; requested: number; items: string[] }[]>([]),
  repeated = ref(false);
const emit = defineEmits<{ redeemed: [] }>(),
  code = ref(''),
  mutation = useMutation();
async function redeem() {
  if (mutation.pending.value) return;
  let label = '獎勵';
  const success = await mutation.run(async (request) => {
    const data = await request('/api/achievements/redeem', { code: code.value });
    label = text(record(record(data).redemption).label) || label;
    const result = record(record(data).redemption);
    gift.value = array(result.rewards).map((value) => {
      const row = record(value);
      return {
        label: text(row.label),
        requested: Number(row.requested) || 0,
        items: array(row.items).map((item) => text(record(item).label)),
      };
    });
    repeated.value = result.alreadyRedeemed === true;
    (
      BarrageFrames as typeof BarrageFrames & { acceptRewards?(data: unknown): void }
    )?.acceptRewards?.(data);
    code.value = '';
    window.dispatchEvent(new Event('achievement-rewards-updated'));
    emit('redeemed');
  });
  if (success)
    mutation.message.value = repeated.value
      ? '已兌換過，保留原有獎勵，不會重新抽取。'
      : '兌換成功！' + label + '已加入收藏，可立即套用。';
}
</script>
<template>
  <section class="page-panel achievement-redemption" aria-labelledby="rewardCodeHeading">
    <h2 id="rewardCodeHeading">成就兌換碼</h2>
    <p>兌換只開放對應獎勵，成就仍需實際遊玩達成。</p>
    <form @submit.prevent="redeem" :aria-busy="mutation.pending.value">
      <UiField
        label="兌換碼"
        id="achievementRewardCode"
        v-model="code"
        maxlength="80"
        autocomplete="off"
        :disabled="mutation.pending.value"
        required
      />
      <UiButton
        type="submit"
        icon="gift"
        label="兌換獎勵"
        :disabled="mutation.pending.value || !code.trim()"
      />
    </form>
    <StatusSlot :message="mutation.message.value" :error="mutation.failed.value" />
    <div
      v-if="gift.length"
      class="starter-reward-receipt"
      role="region"
      aria-label="新手大禮包獎勵"
    >
      <h3>新手大禮包{{ repeated ? '（原兌換結果）' : '' }}</h3>
      <p>進場、攻擊各5種，其餘各3種；只抽未擁有的獎勵，不足時給剩餘全部。</p>
      <UiList
        ><UiListRow v-for="row in gift" :key="row.label"
          ><div
            ><strong>{{ row.label }} · {{ row.items.length }}／{{ row.requested }}</strong
            ><p>{{
              row.items.length ? row.items.join('、') : '目前已全部擁有，沒有可追加的項目。'
            }}</p></div
          ></UiListRow
        ></UiList
      >
    </div>
  </section>
</template>
<style lang="scss">
.achievement-redemption form {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}
.achievement-redemption .ui-field {
  display: grid;
  gap: 0.5rem;
  flex: 1 1 15rem;
  min-width: 0;
}
.starter-reward-receipt {
  margin-block-start: var(--stitch-space-24);
  overflow-wrap: anywhere;
}
</style>
