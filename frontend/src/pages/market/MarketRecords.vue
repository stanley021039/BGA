<script setup lang="ts">
import { useMarketStore } from '../../stores/market';
import {
  marketBucketLabel,
  marketPoints,
  marketSigned,
  marketTime,
  marketVoteLabel,
  officialMarketUrl,
} from '../../contracts/market';
const market = useMarketStore();
defineProps<{ view: string }>();
const numeric = (n: number) =>
  new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
</script>
<template>
  <section v-if="market.state" class="vue-market-panel"
    ><template v-if="view === 'records'"
      ><h2>每日結果</h2><p>最近 100 個交易日</p
      ><div class="vue-market-records"
        ><article v-for="round in market.state.rounds" :key="round.id"
          ><div
            ><h3>{{ round.targetDate }}</h3
            ><span>{{
              round.phase === 'void'
                ? '休市／本輪取消'
                : round.result
                  ? '已結算 · 第 ' + round.result.revision + ' 版'
                  : round.phase === 'open'
                    ? '投票中'
                    : '等待結算'
            }}</span></div
          ><p>我的預測：{{ marketVoteLabel(round) }}</p
          ><p>{{
            round.phase === 'void'
              ? '不計分 · ' + round.voidReason
              : round.result
                ? '收盤 ' +
                  marketSigned(round.result.returnPct) +
                  '% · ' +
                  marketBucketLabel(round, round.result.bucket)
                : '等待官方收盤結果'
          }}</p
          ><strong>{{
            round.result ? (round.vote ? marketPoints(round.result.points || 0) : '0') + ' 分' : '—'
          }}</strong></article
        ><p v-if="!market.state.rounds.length">有交易日後，預測與結果會顯示於此。</p></div
      ><details
        ><summary>我的積分異動紀錄</summary
        ><div class="vue-market-ledger"
          ><p v-for="item in market.state.ledger" :key="item.id"
            ><strong>{{ marketPoints(item.points) }} 分 · {{ item.targetDate }}</strong
            ><span
              >第 {{ item.revision }} 版 ·
              {{
                item.kind === 'reversal' ? '撤銷第 ' + item.reversesRevision + ' 版' : '結算'
              }}</span
            ><span>{{ marketTime(item.at) }} · {{ item.reason || '首次結算' }}</span></p
          ><p v-if="!market.state.ledger.length">尚無積分異動。</p></div
        ></details
      ></template
    >
    <template v-else-if="view === 'marketHistory'"
      ><h2>近一個月官方行情</h2
      ><p
        >{{ market.state.marketHistory.from }} ～
        {{
          market.state.marketHistory.to
        }}（台北），前一個日曆月同日至今天，月底取該月末日，並非固定 30 天。</p
      ><p
        >等待資料：{{
          market.state.marketHistory.waitingDates.join('、') || '無'
        }}。缺少資料不等於休市。</p
      ><p
        >「計算值」依同日官方收盤與漲跌點數計算：漲跌點數 ÷（收盤指數 − 漲跌點數）×
        100，四捨五入至小數後 2 位；不是交易所直接發布的百分比。</p
      ><div class="vue-market-table-scroll" tabindex="0" aria-label="官方每日收盤行情，可捲動查看"
        ><table
          ><thead
            ><tr
              ><th>交易日</th><th>收盤指數</th><th>漲跌點數</th><th>漲跌幅</th
              ><th>來源／狀態</th></tr
            ></thead
          ><tbody
            ><tr v-for="row in market.state.marketHistory.rows" :key="row.targetDate"
              ><th scope="row">{{ row.targetDate }}</th
              ><td>{{ numeric(row.close) }}</td
              ><td>{{ row.change > 0 ? '+' : '' }}{{ numeric(row.change) }}</td
              ><td
                >{{ row.returnPct > 0 ? '+' : '' }}{{ numeric(row.returnPct) }}%<small
                  v-if="row.returnPctSource === 'computed-from-official-close-change'"
                  >計算值</small
                ></td
              ><td
                ><a
                  v-if="officialMarketUrl(row.sourceUrl)"
                  :href="officialMarketUrl(row.sourceUrl)"
                  target="_blank"
                  rel="noopener noreferrer"
                  >證交所官方資料 ↗</a
                ><span v-else>官方來源連結待確認</span
                ><small>取得 {{ marketTime(row.fetchedAt) }}</small
                ><small v-if="row.firstValidObservedAt"
                  >首次觀測到有效資料
                  {{ marketTime(row.firstValidObservedAt) }}（非官方發布時間）</small
                ><strong v-if="row.reviewRequired">待複核</strong></td
              ></tr
            ><tr v-if="!market.state.marketHistory.rows.length"
              ><td colspan="5">官方資料確認後會顯示於此。</td></tr
            ></tbody
          ></table
        ></div
      ></template
    >
    <template v-else
      ><h2>股市冥燈積分排行</h2
      ><p
        >歷來累積積分，含更正與撤銷；同分同名次，後續名次跳號。共
        {{ market.state.leaderboard.totalParticipants }} 位玩家，最多顯示前 100 位。</p
      ><div class="vue-market-table-scroll" tabindex="0" aria-label="累積積分排名，可捲動查看"
        ><table
          ><thead
            ><tr><th>名次</th><th>玩家暱稱</th><th>累積積分</th></tr></thead
          ><tbody
            ><tr
              v-for="(row, i) in market.state.leaderboard.rows"
              :key="i"
              :class="{ 'is-me': row.isMe }"
              ><td>{{ row.rank }}</td
              ><th scope="row">{{ row.displayName }}{{ row.isMe ? ' · 你' : '' }}</th
              ><td>{{ marketPoints(row.score) }}</td></tr
            ><tr v-if="!market.state.leaderboard.rows.length"
              ><td colspan="3">尚無已結算預測，首筆結算後即可上榜。</td></tr
            ></tbody
          ></table
        ></div
      ><p
        v-if="
          market.state.leaderboard.ownRank && !market.state.leaderboard.rows.some((r) => r.isMe)
        "
        >你的排名：第 {{ market.state.leaderboard.ownRank.rank }} 名 ·
        {{ marketPoints(market.state.leaderboard.ownRank.score) }} 分</p
      ><p v-if="!market.state.leaderboard.ownRank"
        >你尚無已結算預測，結算後會顯示排名。</p
      ></template
    ></section
  >
</template>
