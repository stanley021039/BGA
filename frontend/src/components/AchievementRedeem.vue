<script setup lang="ts">
import BarrageFrames from '../engines/barrage-frames.js';

import { computed, onBeforeUnmount, ref } from 'vue';
import AudioSettings from '../engines/audio-settings.js';
import { readGachaItem, type GachaResult } from '../contracts/gacha';
import GachaRewardCard from './GachaRewardCard.vue';
import UiPanel from './UiPanel.vue';
import UiHeading from './UiHeading.vue';
import UiDialog from './UiDialog.vue';
import UiLink from './UiLink.vue';
import { useMutation } from '../composables/mutation';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import StatusSlot from './StatusSlot.vue';
import { array, record, text } from '../services/validation';
const notice = ref<InstanceType<typeof UiDialog> | null>(null),
  rewardName = ref(''),
  features = ref<string[]>([]),
  draws = ref(0);
const gift = ref<
    {
      label: string;
      requested: number;
      items: {
        label: string;
        rarityLabel: string;
        duplicate: boolean;
        fragments: number;
        card?: GachaResult;
      }[];
    }[]
  >([]),
  repeated = ref(false);
const entries = computed(() =>
  gift.value.flatMap((row) => row.items.map((item) => ({ category: row.label, ...item }))),
);
const activePreview = ref<number | null>(null);
let voice: HTMLAudioElement | undefined;
function stopPreviews() {
  activePreview.value = null;
  AudioSettings?.stopEffect(voice);
  voice = undefined;
}
function playVoice(item: GachaResult) {
  AudioSettings?.stopEffect(voice);
  if (item.kind === 'sounds' && /^ping-voice-[a-z-]+$/.test(item.id))
    voice = AudioSettings?.playEffect?.(item.id);
}
onBeforeUnmount(stopPreviews);
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
    features.value =
      result.features === undefined
        ? []
        : array(result.features)
            .map((value) => text(value))
            .filter(Boolean);
    gift.value = array(result.rewards).map((value) => {
      const row = record(value);
      return {
        label: text(row.label),
        requested: Number(row.requested) || 0,
        items: array(row.items).map((item) => {
          const r = record(item);
          let card: GachaResult | undefined;
          try {
            // Stored gift receipts omit shop pricing; only the visual result is adapted.
            card = {
              ...readGachaItem({
                ...r,
                kind: row.key,
                weight: 0,
                duplicateFragments: 0,
                exchangeCost: 0,
                owned: true,
              }),
              duplicate: r.duplicate === true,
              fragments: Number(r.fragments) || 0,
            };
          } catch {
            // Older receipts remain readable even when they lack a preview identity.
          }
          return {
            label: text(r.label),
            rarityLabel: text(r.rarityLabel),
            duplicate: r.duplicate === true,
            fragments: Number(r.fragments) || 0,
            card,
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
    stopPreviews();
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
    <UiDialog
      ref="notice"
      :title="repeated ? '已兌換過' : '兌換成功'"
      @closing="stopPreviews"
      @closed="stopPreviews"
    >
      <div class="starter-reward-receipt">
        <h3>{{ rewardName }}</h3>
        <p v-if="repeated">以下為原兌換內容，不會重新抽取或發放。</p>
        <p v-if="draws"
          ><strong>{{ draws }} 張抽卡券</strong> · 到抽卡機自行使用</p
        >
        <UiPanel v-for="feature in features" :key="feature">{{ feature }}</UiPanel>
        <div class="redeemed-reward-grid">
          <section v-for="(item, index) in entries" :key="index" class="redeemed-reward-entry">
            <UiHeading :level="3" kind="card" class="redeemed-reward-category">{{
              item.category
            }}</UiHeading>
            <GachaRewardCard
              v-if="item.card"
              :item="item.card"
              :number="index + 1"
              compact
              :preview-active="activePreview === index"
              @preview="activePreview = index"
              @play-voice="playVoice"
            />
            <UiPanel v-else>
              <strong>{{ item.label }}</strong
              ><p
                >{{ item.rarityLabel
                }}<span v-if="item.duplicate"> · 重複轉 {{ item.fragments }} 碎片</span></p
              >
            </UiPanel>
          </section>
        </div>
        <p v-if="!gift.length && !draws && !features.length">這組兌換碼已經領取過。</p>
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
.redeemed-reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  gap: var(--stitch-space-24);
}
.redeemed-reward-entry {
  display: grid;
  grid-template-rows: auto 1fr;
  min-inline-size: 0;
  gap: var(--stitch-space-8);
}
.redeemed-reward-entry > .redeemed-reward-category {
  margin: 0;
  text-align: center;
}
</style>
