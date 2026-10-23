<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { useMarketStore } from '../../stores/market';
import {
  marketBucketLabel,
  marketTime,
  marketPoints,
  marketSigned,
  validMarketDate,
  officialMarketUrl,
} from '../../contracts/market';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import MarketGallery from './MarketGallery.vue';
const market = useMarketStore(),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  settlement = ref<InstanceType<typeof UiDialog> | null>(null),
  formError = ref('');
const create = reactive({ targetDate: '', confirmed: false }),
  override = reactive({ targetDate: '', isOpen: '', reason: '', sourceUrl: '', confirmed: false }),
  recheck = reactive({ targetDate: '', confirmed: false });
const countLabels: Record<string, string> = {
  positive: '正分',
  negative: '負分',
  zero: '零分',
  hit: '猜中',
  miss: '猜錯',
  tie: '和局',
};
const locked = computed(() => market.busy || !!market.attempt || !market.admin),
  round = computed(() => market.state?.rounds.find((r) => r.id === market.settleDraft.roundId)),
  previewAllowed = computed(
    () =>
      !!round.value &&
      round.value.phase !== 'void' &&
      market.now >= Date.parse(round.value.settlementAfter) &&
      !locked.value,
  );
async function createRound() {
  formError.value = '';
  if (!validMarketDate(create.targetDate) || !create.confirmed) {
    formError.value = '請選擇有效交易日，並確認官方行事曆。';
    return;
  }
  const payload = { targetDate: create.targetDate, confirmed: true };
  if (
    await confirm.value?.ask(
      `確認已核對官方行事曆，建立 ${payload.targetDate} 的預測交易日？`,
      '確認建立交易日',
    )
  )
    if (await market.mutate('/api/admin/market/rounds', payload, '交易日已建立。'))
      create.confirmed = false;
}
async function calendarOverride() {
  formError.value = '';
  const sourceUrl = officialMarketUrl(override.sourceUrl),
    payload = {
      targetDate: override.targetDate,
      isOpen: override.isOpen === 'true',
      reason: override.reason.trim(),
      sourceUrl,
      confirmed: true,
    };
  if (
    !validMarketDate(payload.targetDate) ||
    !['true', 'false'].includes(override.isOpen) ||
    !payload.reason ||
    payload.reason.length > 240 ||
    !sourceUrl ||
    !override.confirmed
  ) {
    formError.value = '請填寫有效日期、開休市狀態、原因與證交所官方網址，並勾選確認。';
    return;
  }
  if (
    await confirm.value?.ask(
      `依官方公告將 ${payload.targetDate} 設為${payload.isOpen ? '開市' : '休市'}？已建立的未結算休市輪次會停止收票；既有結算差異仍需人工複核。`,
      '套用日曆修正',
    )
  )
    if (
      await market.mutate(
        '/api/admin/market/calendar-override',
        payload,
        '官方交易日曆修正已保存。',
      )
    )
      override.confirmed = false;
}
async function officialRecheck() {
  formError.value = '';
  const targetDate = recheck.targetDate;
  if (
    !validMarketDate(targetDate) ||
    !recheck.confirmed ||
    market.now < Date.parse(targetDate + 'T14:00:00+08:00')
  ) {
    formError.value = '請選擇已過台北時間 14:00 的有效交易日，並勾選確認。';
    return;
  }
  if (
    await confirm.value?.ask(
      `重新取得並交叉核對 ${targetDate} 的官方收盤資料？這會發出對外資料查詢；已結算數值若不同，只標示待複核，原積分不會自動改寫。`,
      '確認重查指定日期',
    )
  ) {
    await market.recheck(targetDate);
    recheck.confirmed = false;
  }
}
async function getPreview() {
  if (await market.getPreview()) await settlement.value?.open();
}
async function settle() {
  const job = market.settle();
  settlement.value?.close();
  await job;
}
watch(
  () => market.preview,
  (value) => {
    if (!value) settlement.value?.close();
  },
);
watch(
  () => market.admin,
  (value) => {
    if (!value) {
      confirm.value?.cancel();
      settlement.value?.close();
    }
  },
);
watch(
  () => recheck.targetDate,
  () => (recheck.confirmed = false),
);
</script>
<template>
  <section v-if="market.admin" class="vue-market-admin"
    ><StatusSlot :message="formError" :error="!!formError" /><div class="vue-market-admin-grid"
      ><section class="vue-market-panel"
        ><h2>手動建立交易日</h2><p>下一輪由官方交易日曆自動開放；此處只供例外處理。</p
        ><form @submit.prevent="createRound"
          ><label
            >目標交易日<input
              v-model="create.targetDate"
              type="date"
              min="2000-01-01"
              max="2199-12-31"
              required
              :disabled="locked" /></label
          ><p>交易日前一日整個 23:59 分鐘可預測（含 23:59:59.999），交易日 00:00（台北）起截止。</p
          ><label class="vue-market-check"
            ><input
              v-model="create.confirmed"
              type="checkbox"
              required
              :disabled="locked"
            />我已確認此日期為交易日</label
          ><UiButton legacy
            type="submit"
            icon="add"
            label="確認建立交易日"
            :disabled="locked" /></form></section
      ><section class="vue-market-panel"
        ><h2>例外手動結算／更正</h2
        ><p>自動查核從台北 23:59 開始至次日 00:29，每 5 分鐘一次。手動處理請核對官方結果。</p
        ><form @submit.prevent="getPreview"
          ><label
            >交易日<select v-model="market.settleDraft.roundId" required :disabled="locked"
              ><option v-for="r in market.state?.rounds || []" :key="r.id" :value="r.id"
                >{{ r.targetDate }} ·
                {{ r.phase === 'void' ? '已取消' : r.result ? '已結算／可更正' : '待結算' }}</option
              ></select
            ></label
          ><p>{{
            !round
              ? '尚無交易日。'
              : round.phase === 'void'
                ? '本輪已取消，不能結算。'
                : (round.result
                    ? '目前收盤 ' +
                      marketSigned(round.result.returnPct) +
                      '% · 第 ' +
                      round.result.revision +
                      ' 版，更正須填原因。'
                    : '參與 ' + round.voteCount + ' 人。') +
                  ' 可結算時間：' +
                  marketTime(round.settlementAfter) +
                  '（台北）'
          }}</p
          ><label
            >指數收盤漲跌幅（%）<input
              v-model="market.settleDraft.returnPct"
              type="text"
              inputmode="decimal"
              maxlength="30"
              autocomplete="off"
              placeholder="例如 −2 或 2.35"
              required
              :disabled="locked" /></label
          ><label
            >備註／更正原因<input
              v-model="market.settleDraft.reason"
              maxlength="240"
              :required="!!round?.result"
              :disabled="locked" /></label
          ><UiButton legacy
            type="submit"
            icon="expand"
            label="預覽結算影響"
            :disabled="!previewAllowed" /></form></section
    ></div>
    <section class="vue-market-panel"
      ><h2>官方交易日曆修正</h2><p>臨時休市或補開市，請依證交所公告修正。既有結算差異需人工複核。</p
      ><form class="vue-market-admin-form" @submit.prevent="calendarOverride"
        ><label
          >公告適用交易日<input
            v-model="override.targetDate"
            type="date"
            min="2000-01-01"
            max="2199-12-31"
            required
            :disabled="locked" /></label
        ><label
          >交易狀態<select v-model="override.isOpen" required :disabled="locked"
            ><option value="">請選擇</option
            ><option value="false">休市</option
            ><option value="true">開市</option></select
          ></label
        ><label
          >修正原因<input
            v-model="override.reason"
            maxlength="240"
            required
            :disabled="locked" /></label
        ><label
          >證交所官方公告網址<input
            v-model="override.sourceUrl"
            type="url"
            maxlength="2000"
            placeholder="https://www.twse.com.tw/…"
            required
            :disabled="locked" /></label
        ><label class="vue-market-check"
          ><input
            v-model="override.confirmed"
            type="checkbox"
            required
            :disabled="locked"
          />我已核對日期及官方公告</label
        ><UiButton legacy type="submit" icon="check" label="套用日曆修正" :disabled="locked" /></form
    ></section>
    <section class="vue-market-panel"
      ><h2>指定日期官方資料重查</h2
      ><p
        >只重查指定日期；仍須通過官方來源交叉核對。已結算結果若不同，原結果與積分保留並標示待人工複核。官方查核成功即停止自動抓取，未完成日期下一晚限量回補。</p
      ><p v-if="!market.state?.automation.enabled" role="status"
        >官方資料查核已停用，不能發出重查。請確認伺服器設定。</p
      ><form class="vue-market-admin-form" @submit.prevent="officialRecheck"
        ><label
          >重查交易日<input
            v-model="recheck.targetDate"
            type="date"
            min="2000-01-01"
            :max="new Date(market.now + 8 * 3600000).toISOString().slice(0, 10)"
            required
            :disabled="locked || !market.state?.automation.enabled" /></label
        ><label class="vue-market-check"
          ><input
            v-model="recheck.confirmed"
            type="checkbox"
            required
            :disabled="locked || !market.state?.automation.enabled"
          />我已確認日期，要求重新取得官方收盤資料</label
        ><UiButton legacy
          type="submit"
          icon="refresh"
          label="重查指定日期官方資料"
          :disabled="locked || !market.state?.automation.enabled" /></form
    ></section>
    <MarketGallery review />
    <details class="vue-market-panel"
      ><summary>管理員：結果變更紀錄</summary
      ><div class="vue-market-ledger"
        ><template v-for="r in market.state?.rounds || []" :key="r.id"
          ><p v-for="entry in r.settlementHistory" :key="entry.revision"
            ><strong
              >{{ r.targetDate }} · 第 {{ entry.revision }} 版 ·
              {{ marketSigned(entry.returnPct) }}%</strong
            ><span
              >{{ marketTime(entry.at) }} ·
              {{ entry.actorSource === 'system' ? '系統' : entry.administrator }} ·
              {{ entry.reason || '首次結算' }}</span
            ></p
          ></template
        ></div
      ></details
    >
    <UiDialog legacy
      ref="settlement"
      title="確認結算影響"
      :dismissible="!market.busy"
      @closed="market.preview = null"
      ><template v-if="market.preview"
        ><p
          >交易日：<strong>{{ market.preview.details.targetDate }}</strong></p
        ><h3>{{ marketSigned(market.preview.details.returnPct) }}%</h3
        ><p
          >{{ round ? marketBucketLabel(round, market.preview.details.bucket) : '' }} · 參與
          {{ market.preview.details.voteCount }} 人；{{
            Object.entries(market.preview.details.counts)
              .map(([key, value]) => (countLabels[key] || key) + ' ' + value + ' 人')
              .join(' · ')
          }}</p
        ><p v-if="market.preview.details.expectedRevision"
          >更正會先撤銷第
          {{ market.preview.details.expectedRevision }} 版積分，再用本輪凍結規則重新計分。原因：{{
            market.preview.payload.reason
          }}</p
        ><p v-else>確認後保存結果並結算所有已提交預測。</p
        ><p
          >我的本日積分：{{ marketPoints(market.preview.details.ownPrevious) }} →
          {{ marketPoints(market.preview.details.ownNext) }}；累積將為
          {{ marketPoints(market.preview.details.ownScoreAfter) }} 分。</p
        ><div class="vue-market-actions"
          ><UiButton legacy
            label="返回修改"
            :disabled="market.busy"
            @click="settlement?.close()" /><UiButton legacy
            icon="check"
            label="確認結算"
            :disabled="market.busy"
            @click="settle()" /></div></template></UiDialog
    ><ConfirmDialog legacy ref="confirm" />
  </section>
</template>
