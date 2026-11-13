<script setup lang="ts">
import BarrageFrames from '../engines/barrage-frames.js';

import { ref } from 'vue';
import UiDialog from './UiDialog.vue';
import UiLink from './UiLink.vue';
import { useMutation } from '../composables/mutation';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';
import StatusSlot from './StatusSlot.vue';
import { array, record, text } from '../services/validation';
const notice = ref<InstanceType<typeof UiDialog> | null>(null),
  rewardName = ref(''),
  draws = ref(0);
const gift = ref<
    {
      label: string;
      requested: number;
      items: { label: string; rarityLabel: string; duplicate: boolean; fragments: number }[];
    }[]
  >([]),
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
    rewardName.value = label;
    draws.value = Number.isSafeInteger(result.draws) ? Number(result.draws) : 0;
    gift.value = array(result.rewards).map((value) => {
      const row = record(value);
      return {
        label: text(row.label),
        requested: Number(row.requested) || 0,
        items: array(row.items).map((item) => {
          const r = record(item);
          return {
            label: text(r.label),
            rarityLabel: text(r.rarityLabel),
            duplicate: r.duplicate === true,
            fragments: Number(r.fragments) || 0,
          };
        }),
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
  if (success) {
    mutation.message.value = repeated.value ? '已兌換過，不會重複發放。' : '兌換成功。';
    await notice.value?.open();
  }
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
    <UiDialog ref="notice" :title="repeated ? '已兌換過' : '兌換成功'" compact>
      <div class="starter-reward-receipt">
        <h3>{{ rewardName }}</h3>
        <p v-if="repeated">以下為原兌換內容，不會重新抽取或發放。</p>
        <p v-if="draws"
          ><strong>{{ draws }} 張抽卡券</strong> · 到抽卡機自行使用</p
        >
        <UiList>
          <UiListRow v-for="row in gift" :key="row.label">
            <div
              ><strong>{{ row.label }}</strong>
              <p v-for="item in row.items" :key="item.label"
                >{{ item.label }}<span v-if="item.rarityLabel"> · {{ item.rarityLabel }}</span
                ><span v-if="item.duplicate"> · 重複轉 {{ item.fragments }} 碎片</span></p
              >
            </div>
          </UiListRow>
        </UiList>
        <p v-if="!gift.length && !draws">這組兌換碼已經領取過。</p>
      </div>
      <div class="reward-receipt-actions"
        ><UiLink v-if="draws" href="/gacha" label="前往抽卡機" variant="primary" /><UiButton
          label="知道了"
          @click="notice?.close()"
      /></div>
    </UiDialog>
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
.reward-receipt-actions {
  display: flex;
  gap: var(--stitch-space-12);
  flex-wrap: wrap;
  margin-block-start: var(--stitch-space-16);
}
</style>
