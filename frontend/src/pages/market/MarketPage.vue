<script setup lang="ts">
import { computed, onMounted, provide, ref, shallowRef, watch } from 'vue';
import { useMarketStore, useMarketGalleryStore } from '../../stores/market';
import { useGameFocus } from '../../composables/game-focus';
import { marketSigned, marketPoints, marketTime } from '../../contracts/market';
import type { MarketImage, LegacyMarketRules } from '../../contracts/market';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import MarketPrediction from './MarketPrediction.vue';
import MarketGallery from './MarketGallery.vue';
import MarketRecords from './MarketRecords.vue';
import MarketAdmin from './MarketAdmin.vue';
import { marketImagePreviewKey } from './image-preview';
const market = useMarketStore(),
  gallery = useMarketGalleryStore(),
  focus = useGameFocus('vue-market-focus'),
  image = shallowRef<MarketImage | null>(null),
  imageDialog = ref<InstanceType<typeof UiDialog> | null>(null);
const tabs = computed(() => [
  { id: 'daily', label: '每日預測' },
  { id: 'uploads', label: '圖片投稿' },
  { id: 'records', label: '我的戰績' },
  { id: 'marketHistory', label: '近月行情' },
  { id: 'leaderboard', label: '積分排行' },
  ...(market.admin ? [{ id: 'admin', label: '管理結算' }] : []),
]);
const legacy = computed<LegacyMarketRules | undefined>(() => {
  const selected = market.selected;
  return selected && selected.rules.version !== 3 ? selected.rules : market.state?.rules;
});
const a = computed(() => market.state?.automation),
  automationLabels: Record<string, string> = {
    ok: '自動結算正常',
    waiting: '等待官方同日收盤資料',
    'calendar-unavailable': '官方交易日曆尚未確認',
    disabled: '自動結算已停用',
    error: '自動查核暫時失敗',
    'manual-required': '自動查核已停止，等待管理員重查',
    unavailable: '自動結算狀態尚未提供',
  };
function tabKey(event: KeyboardEvent) {
  const nodes = [
      ...(event.currentTarget as HTMLElement).parentElement!.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      ),
    ],
    i = nodes.indexOf(event.currentTarget as HTMLButtonElement);
  let next = i;
  if (event.key === 'ArrowRight') next = (i + 1) % nodes.length;
  else if (event.key === 'ArrowLeft') next = (i - 1 + nodes.length) % nodes.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = nodes.length - 1;
  else return;
  event.preventDefault();
  nodes[next]?.focus();
}
provide(marketImagePreviewKey, async (value) => {
  image.value = value;
  await imageDialog.value?.open();
});
watch([() => market.selectedId, () => market.view], () => {
  imageDialog.value?.close();
  image.value = null;
});
onMounted(() => market.start());
</script>
<template>
  <div class="vue-market-heading"
    ><div
      ><small>MARKET JINX / 每日預測</small><h1>股市冥燈</h1
      ><p>下一個交易日的台股，你看哪邊？</p></div
    ><UiLink href="/market?learn=1" label="試玩教學" icon="play" /><p>免費娛樂 · 無現金、無兌現</p
    ><UiButton
      icon="expand"
      :label="focus.focused.value ? '退出專注全螢幕' : '專注全螢幕'"
      :aria-pressed="focus.focused.value"
      @click="focus.toggle()" /></div
  ><div class="vue-market-navigation"
    ><nav role="tablist" aria-label="股市冥燈導覽"
      ><button
        v-for="tab in tabs"
        :id="'market-tab-' + tab.id"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="market.view === tab.id"
        :aria-controls="'market-panel-' + tab.id"
        :tabindex="market.view === tab.id ? 0 : -1"
        :disabled="market.busy"
        @click="market.setView(tab.id)"
        @keydown="tabKey"
        >{{ tab.label }}</button
      ></nav
    ><UiButton
      icon="refresh"
      label="更新行情與預測"
      :pending="market.loading"
      :disabled="market.busy"
      @click="market.load()" /></div
  ><div class="vue-market-feedback"
    ><StatusSlot
      :message="market.message || (market.loading ? '正在載入股市冥燈…' : '')"
      :error="market.failed" /><UiButton
      v-if="market.attempt"
      icon="refresh"
      :label="market.attempt.acknowledged ? '更新已確認的操作結果' : '重試確認同一筆操作'"
      :disabled="market.busy"
      @click="market.retry()"
  /></div>
  <template v-if="market.state"
    ><details class="vue-market-automation" :class="{ 'needs-attention': a?.status !== 'ok' }"
      ><summary
        ><h2>{{ automationLabels[a?.status || 'unavailable'] || '自動查核狀態待確認' }}</h2
        ><span>結算狀態與查核紀錄</span></summary
      ><div
        ><p
          >每天台北 23:59 起每 5 分鐘查核，至次日
          00:29，最多七次；只採同日正式收盤報表，成功即停止抓取，未完成日期下一晚限量回補。</p
        ><p
          >本夜 {{ a?.nightAttempts }} 次 · 最近查核 {{ marketTime(a?.lastAttemptAt || null) }} ·
          最近成功 {{ marketTime(a?.lastSuccessAt || null) }} · 下次查核
          {{ marketTime(a?.nextAttemptAt || null) }} · 下一交易日
          {{ a?.nextTradingDate || '尚未確認' }}</p
        ><p v-if="a?.dailyFetch"
          >查核日期 {{ a.dailyFetch.targetDate }} · 自動累計 {{ a.dailyFetch.automaticAttempts }} 次
          · 人工 {{ a.dailyFetch.manualAttempts }} 次<template
            v-if="a.dailyFetch.firstValidObservedAt"
          >
            · 首次觀測到有效資料
            {{
              marketTime(a.dailyFetch.firstValidObservedAt)
            }}（本站觀測時間，非官方發布時間）</template
          ></p
        ><p
          >等待資料：{{ a?.waitingDates.join('、') || '無' }} · 需複核：{{
            a?.reviewDates.join('、') || '無'
          }}
          · 已停止自動重試、待管理員重查：{{ a?.manualRequiredDates.join('、') || '無' }}</p
        ><p v-if="a?.status === 'calendar-unavailable'"
          >官方行事曆年份覆蓋未確認；已取得年份：{{
            a.calendarYears.join('、') || '尚無'
          }}。不推測未知日期，缺少資料不代表休市。</p
        ><p v-if="a?.status === 'disabled'">目前不會自動抓取或結算，請洽管理員。</p></div
      ></details
    ><div class="vue-market-score-strip"
      ><div
        ><span>累積積分</span><strong>{{ marketPoints(market.state.stats.score) }}</strong></div
      ><div
        ><span>命中</span><strong>{{ market.state.stats.hits }}</strong></div
      ><div
        ><span>已結算預測</span><strong>{{ market.state.stats.played }}</strong></div
      ><p>{{
        market.selected?.rules.version === 3
          ? '依精準程度曲線計分 · 單日最高 +100 分 · 0% 也計分'
          : `六區間舊規則：猜中 ${marketSigned(legacy?.hit || 0)}、猜錯 ${marketSigned(legacy?.miss || 0)}；剛好 0% 為和局，不計分`
      }}</p></div
    >
    <section
      v-show="market.view === 'daily'"
      id="market-panel-daily"
      role="tabpanel"
      aria-labelledby="market-tab-daily"
      ><MarketPrediction /></section
    ><section
      v-if="market.view === 'uploads'"
      id="market-panel-uploads"
      role="tabpanel"
      aria-labelledby="market-tab-uploads"
      ><MarketGallery /></section
    ><section
      v-for="view in ['records', 'marketHistory', 'leaderboard']"
      v-show="market.view === view"
      :id="'market-panel-' + view"
      :key="view"
      role="tabpanel"
      :aria-labelledby="'market-tab-' + view"
      ><MarketRecords v-if="market.view === view" :view="view" /></section
    ><section
      v-if="market.view === 'admin' && market.admin"
      id="market-panel-admin"
      role="tabpanel"
      aria-labelledby="market-tab-admin"
      ><MarketAdmin
    /></section>
    <details class="vue-market-panel"
      ><summary>玩法與積分規則</summary
      ><p
        >每帳號每交易日一票，預測下一交易日台股加權指數收盤漲跌幅，截止前可以修改。未投票不加減分。下一輪依已確認官方交易日曆獨立開放，不依賴上一輪結算成功；來源延遲或資料未確認時維持等待。</p
      ><p
        >曲線輪次可預測 −10%～+10%，每格 0.1%；使用開場時凍結的非均勻分布計分，0%
        也計分。六區間歷史輪次保留當時規則；等機率隨機選六項時，非和局期望為 (1/6 ×
        {{ legacy?.hit }})+(5/6 × {{ legacy?.miss }})={{
          ((legacy?.hit || 0) + 5 * (legacy?.miss || 0)) / 6
        }}，不代表真實發生機率相同。</p
      ><p
        >圖片只從管理員已核准、符合區間與目標交易日星期的投稿抽選；無符合圖片時保留同尺寸位置。換圖不修改預測或積分。這是免費積分遊戲，不提供即時行情或投資建議。</p
      ></details
    > </template
  ><UiDialog ref="imageDialog" title="圖片預覽" @closed="image = null"
    ><template v-if="image"
      ><img class="vue-market-full-image" :src="image.url" alt="預測投稿原圖" /><p
        >上傳者：{{ image.authorName }}</p
      ></template
    ></UiDialog
  >
</template>
