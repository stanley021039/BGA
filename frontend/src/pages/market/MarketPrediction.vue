<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMarketStore, useMarketGalleryStore } from '../../stores/market';
import {
  marketBucketLabel,
  marketCurveSlots,
  marketImageRules,
  marketPoints,
  marketSigned,
  marketTime,
  marketVoteLabel,
} from '../../contracts/market';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import MarketImageCard from './MarketImageCard.vue';
import MarketCurve from './MarketCurve.vue';
const market = useMarketStore(),
  gallery = useMarketGalleryStore(),
  ready = ref(false),
  r = computed(() => market.selected),
  curve = computed(() => r.value?.rules.version === 3),
  labels = computed(() =>
    r.value?.rules.version !== 3 && r.value ? window.MarketRules?.labels(r.value.rules) || [] : [],
  );
watch(
  () => r.value?.id,
  () => {
    ready.value = false;
  },
);
function cutoff(target: string) {
  const day = new Date(Date.parse(target + 'T00:00:00Z') - 1).toISOString().slice(0, 10);
  return `${day} 23:59:59.999 前可預測；${target} 00:00（台北）起截止。`;
}
const status = computed(() => {
  const round = r.value;
  if (!round) return '尚未建立可查看的交易日。';
  if (round.phase === 'void') return '本輪已取消，不計分。' + round.voidReason;
  if (round.result)
    return `收盤 ${marketSigned(round.result.returnPct)}% · ${marketBucketLabel(round, round.result.bucket)} · ${round.vote ? '本日 ' + marketPoints(round.result.points || 0) + ' 分' : '未投票，不計分'}`;
  return (
    (round.vote
      ? '已提交：' + marketVoteLabel(round) + ' · ' + marketTime(round.vote.updatedAt)
      : '尚未投票') + (market.closed ? '。投票已截止。' : '。截止前可以修改。')
  );
});
</script>
<template>
  <section class="vue-market-daily"
    ><div class="vue-market-prediction-summary"
      ><div
        ><small>目前開放預測的交易日</small
        ><h2>{{ market.current?.targetDate || '等待下一個交易日開放' }}</h2
        ><p>{{
          market.current
            ? cutoff(market.current.targetDate)
            : '依官方交易日曆確認，暫無可提交預測；已截止輪次仍繼續查核收盤結果。'
        }}</p></div
      ><UiButton
        v-if="market.current && market.current.id !== r?.id"
        icon="next"
        label="返回目前預測"
        :disabled="market.busy || !!market.attempt"
        @click="market.chooseRound(market.current.id, true)" /></div
    ><div class="vue-market-round-heading"
      ><label
        >查看交易日（含歷史）<select
          :value="market.selectedId"
          :disabled="market.busy || !!market.attempt || !market.state?.rounds.length"
          @change="market.chooseRound(($event.target as HTMLSelectElement).value)"
          ><option
            v-for="round in [...(market.state?.rounds || [])].reverse()"
            :key="round.id"
            :value="round.id"
            >{{ round.targetDate }} ·
            {{
              { open: '可預測', closed: '待結算', settled: '已結算', void: '休市／已取消' }[
                round.phase
              ]
            }}</option
          ></select
        ></label
      ><strong>{{
        !r
          ? '等待開放'
          : r.phase === 'void'
            ? '休市／本輪取消'
            : r.result
              ? '已結算'
              : market.closed
                ? '已截止 · 等待官方結算'
                : '預測開放中'
      }}</strong></div
    ><p v-if="r">{{
      r.rules.version >= 2
        ? cutoff(r.targetDate)
        : `沿用舊規則：前一晚 ${r.rules.cutoffTime}（台北）截止。`
    }}</p
    ><div class="vue-market-draw-tools"
      ><StatusSlot
        :message="
          gallery.drawBusy
            ? '正在抽選圖片…'
            : gallery.drawError ||
              (r
                ? '圖片依 ' + r.targetDate + ' 的星期與各區間抽選；換圖不影響投票。'
                : '有交易日後才會抽選圖片。')
        "
        :error="!!gallery.drawError" /><UiButton
        icon="refresh"
        label="換一組圖片"
        :pending="gallery.drawBusy"
        :disabled="!r"
        @click="gallery.drawImages()"
    /></div>
    <template v-if="r"
      ><template v-if="curve"
        ><div class="vue-market-forecast-heading"
          ><h2>預測收盤漲跌幅</h2
          ><output for="market-forecast-tick"
            >{{ marketSigned(market.draft.forecastTick / 10) }}%</output
          ></div
        ><label for="market-forecast-tick"
          >範圍 −10%～+10%，每格 0.1%；方向鍵微調，Home／End 到兩端</label
        ><input
          id="market-forecast-tick"
          v-model.number="market.draft.forecastTick"
          type="range"
          min="-100"
          max="100"
          step="1"
          :aria-valuetext="marketSigned(market.draft.forecastTick / 10) + '%'"
          :disabled="market.closed || market.busy || !!market.attempt" /><p
          >拖動只修改草稿，按「送出預測」才提交。圖片僅供裝飾；點圖只會放大，不改變預測。</p
        ><div class="vue-market-curve-images"
          ><article
            v-for="slot in marketCurveSlots"
            :key="slot.id + ':' + gallery.reloadKey"
            :data-slot="slot.id"
            ><strong>{{ slot.label }}</strong
            ><MarketImageCard
              :image="gallery.draw[slot.id] || null"
              :label="slot.label + '區段圖片'"
              :active="market.view === 'daily'"
              eager
            /><p v-if="gallery.draw[slot.id]"
              >此圖原適用：{{ marketImageRules(gallery.draw[slot.id]!) }}</p
            ></article
          ></div
        ><p
          >五格固定抽選並預載，依螢幕寬度對稱顯示 1～5
          張；縮放不會重新換圖。中央圖片取自小跌／微漲圖片池，實際資格另列。</p
        ><MarketCurve @ready="ready = $event" /></template
      ><fieldset v-else class="vue-market-legacy-options"
        ><legend>預測漲跌幅區間</legend
        ><article
          v-for="(option, i) in r.rules.version !== 3 ? r.rules.options : []"
          :key="option.id + ':' + gallery.reloadKey"
          ><label
            ><input
              v-model="market.draft.optionId"
              type="radio"
              :disabled="market.closed || market.busy || !!market.attempt"
              :value="option.id"
              name="market-option"
            /><strong>{{ option.name }}</strong
            ><span>{{ labels[i] }}</span></label
          ><MarketImageCard
            :image="gallery.draw[option.id] || null"
            :label="option.name + '圖片'"
            :active="market.view === 'daily'"
            eager /></article></fieldset
    ></template>
    <footer class="vue-market-vote-footer"
      ><p role="status">{{ status }}</p
      ><UiButton
        icon="send"
        :label="r?.vote ? '儲存修改' : '送出預測'"
        :pending="market.busy"
        :disabled="!r || market.closed || !market.dirty || !!market.attempt || (curve && !ready)"
        @click="market.vote()" /></footer
    ><p>台北時間 {{ marketTime(market.now) }} · 以伺服器截止判定為準</p></section
  >
</template>
