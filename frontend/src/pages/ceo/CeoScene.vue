<script setup lang="ts">
import { computed } from 'vue';
import { useCeoStore } from '../../stores/ceo';
import { usePartyActionsStore } from '../../stores/party-actions';
import { industries, scoreText } from '../../contracts/ceo';
import UiPanel from '../../components/UiPanel.vue';
import UiStatistic from '../../components/UiStatistic.vue';
import UiButton from '../../components/UiButton.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiNotice from '../../components/UiNotice.vue';
import UiHeading from '../../components/UiHeading.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
const ceo = useCeoStore(),
  actions = usePartyActionsStore();
const log = computed(() =>
  Array.isArray(ceo.state?.log)
    ? ceo.state.log.filter((entry: unknown): entry is string => typeof entry === 'string')
    : [],
);
const game = computed(() => ceo.game),
  ownGroup = computed(() => game.value?.groups.find((g) => g.playerId === ceo.state?.me));
const name = (id: string | null) => ceo.state?.players.find((p) => p.id === id)?.name || 'NPC';
const groupName = (id: string) => game.value?.groups.find((g) => g.id === id)?.card.name || id;
const cardName = (id: string) =>
  game.value?.groups.flatMap((g) => [g.card, ...g.companies]).find((c) => c.id === id)?.name || id;
const points = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(n);
function held(playerId: string, groupId: string) {
  return (
    game.value?.players.find((p) => p.id === playerId)?.holdings.find((h) => h.groupId === groupId)
      ?.count || 0
  );
}
</script>
<template>
  <div class="ceo-scene">
    <UiNotice
      v-if="!game?.results"
      persistent
      tone="warning"
      message="本站暫用替代牌庫：公司與增減牌數值非原版，平衡仍待試玩。"
    />
    <UiPanel v-if="!game" title="本局已結束">
      <p>{{
        ceo.state?.restoreFailed
          ? '伺服器重啟後無法安全還原本局，已中止且不計勝負；房主可重新開局。'
          : ceo.state?.interrupted
            ? '有人離席，本局中止，不計勝負。'
            : '你未參與上一局；等待房主開始新局。'
      }}</p>
    </UiPanel>
    <template v-else>
      <UiPanel v-if="game.phase === 'playing'" title="經營動態" density="compact">
        <div class="ceo-status">
          <UiBadge :tone="ceo.canAct ? 'primary' : 'neutral'">{{
            game.turnId === ceo.state?.me ? '輪到你行動' : `等待 ${name(game.turnId)}`
          }}</UiBadge>
          <span>第 {{ game.round }} 輪</span
          ><span v-if="ceo.me">我的現金 {{ ceo.me.cash }} 元</span>
          <strong v-if="game.countdown === 1">最後一輪 · 禁止買股</strong>
          <span v-else-if="game.countdown === 2">倒數兩輪</span>
          <span v-else-if="game.endingTriggered">本輪結束後，再進行兩輪</span>
          <span v-else>公開資產達 100 啟動倒數</span>
        </div>
        <p v-if="game.endingReason === 'provisional-market-exhausted'"
          >替代牌庫市場已耗盡，依暫行規則啟動倒數。</p
        >
        <div class="ceo-actions" v-if="game.phase === 'playing'">
          <UiButton
            variant="primary"
            label="發放股利"
            :disabled="!ceo.canAct"
            @click="ceo.act('dividend')"
          />
          <span>你的集團收入 {{ ownGroup?.income || 0 }} 元／股；每位持有人按持股數領取。</span>
        </div>
        <UiNotice
          :message="actions.notice"
          :error="!actions.pending && !!actions.notice"
          persistent
          density="action"
        >
          <template #actions
            ><UiButton v-if="actions.canRetry" label="重試同一操作" @click="actions.retrySame()"
          /></template>
        </UiNotice>
      </UiPanel>
      <UiPanel
        v-if="game.phase === 'playing'"
        title="公司市場"
        :note="`牌堆剩餘 ${game.remainingCompanies} 張`"
      >
        <p>收購費＝卡面資產＋格子附加費；只把卡面資產加入集團。</p>
        <div class="ceo-market">
          <UiPanel
            v-for="(slot, index) in game.market"
            :key="slot.card.id"
            density="compact"
            as="article"
            :title="slot.card.name"
          >
            <UiBadge>{{ industries[slot.card.industry] }}</UiBadge>
            <p>第 {{ index + 1 }} 格 · 資產 {{ slot.card.assets }} · 收入 {{ slot.card.income }}</p>
            <UiStatistic
              label="收購合計"
              :value="(slot.card.assets || 0) + slot.extraCost"
              suffix="元"
            />
            <p>附加費 {{ slot.extraCost }} 元</p>
            <p>{{ scoreText(slot.card) }}</p>
            <p>{{
              slot.card.adjustment === 'up'
                ? '收購時抽一張私人增值牌'
                : slot.card.adjustment === 'down'
                  ? '收購時抽一張私人減值牌'
                  : '不抽增減牌'
            }}</p>
            <p>{{ slot.discardsLeftmost ? '購買後棄最左剩餘卡' : '購買後不棄卡' }}</p>
            <p v-if="ceo.me && ceo.me.cash < (slot.card.assets || 0) + slot.extraCost"
              >現金不足，還差 {{ (slot.card.assets || 0) + slot.extraCost - ceo.me.cash }} 元。</p
            >
            <UiButton
              :label="`收購${slot.card.name}`"
              :disabled="
                !ceo.canAct || !ceo.me || ceo.me.cash < (slot.card.assets || 0) + slot.extraCost
              "
              @click="ceo.act('acquire', { companyId: slot.card.id })"
            />
          </UiPanel>
        </div>
        <p v-if="!game.market.length">市場已無公司；仍可發放股利，非最後一輪時也可買股。</p>
      </UiPanel>
      <template v-if="game.results">
        <UiNotice
          persistent
          tone="success"
          :message="game.results.winners.map(name).join('、') + ' 獲勝｜本站替代卡，非原版。'"
        />
        <UiPanel title="個人結算">
          <div class="ceo-groups">
            <UiPanel
              v-for="result in game.results.players"
              :key="result.playerId"
              :title="name(result.playerId)"
              :heading-level="3"
              density="compact"
            >
              <UiStatistic label="總分" :value="points(result.total)" suffix="分" />
              <UiList
                ><UiListRow>股票 {{ points(result.stockScore) }}</UiListRow
                ><UiListRow>公司 {{ result.companiesScore }}</UiListRow
                ><UiListRow>現金 {{ result.cashScore }}</UiListRow></UiList
              >
            </UiPanel>
          </div>
        </UiPanel>
        <UiPanel title="集團結算"
          ><UiList>
            <UiListRow v-for="rank in game.results.ranking" :key="rank.groupId"
              >第 {{ rank.rank }} 名 · {{ groupName(rank.groupId)
              }}{{ rank.npc ? '（NPC）' : '' }} · 最終資產 {{ rank.assets }} · 每股
              {{ points(rank.stockValue) }} 分</UiListRow
            >
          </UiList></UiPanel
        >
        <template v-for="result in game.results.players" :key="result.playerId">
          <UiPanel :title="name(result.playerId) + '・股票明細'"
            ><UiList>
              <UiListRow v-for="stock in result.stock" :key="stock.groupId"
                >{{ groupName(stock.groupId) }}：{{ stock.count }} 股 ×
                {{ points(stock.value) }} 分</UiListRow
              >
            </UiList></UiPanel
          >
          <UiPanel :title="name(result.playerId) + '・公司計分明細'"
            ><UiList v-if="result.companies.length">
              <UiListRow v-for="company in result.companies" :key="company.cardId"
                >{{ cardName(company.cardId) }}：{{ company.score }} 分</UiListRow
              > </UiList
            ><p v-else>本局沒有收購公司。</p></UiPanel
          >
        </template>
        <p>本站暫用替代牌庫：公司與增減牌數值非原版，平衡仍待試玩。</p>
      </template>
      <UiHeading v-if="!game.results">六大集團與持股</UiHeading>
      <div v-if="!game.results" class="ceo-groups">
        <UiPanel
          v-for="group in game.groups"
          :key="group.id"
          :title="group.card.name"
          density="compact"
        >
          <UiBadge v-if="group.playerId === ceo.state?.me" tone="primary">我的集團</UiBadge
          ><p
            >{{ name(group.playerId) }} · 公開資產 {{ group.publicAssets }} · 收入
            {{ group.income }}／股</p
          >
          <p>{{ scoreText(group.card) }}</p>
          <p v-if="group.adjustments !== null"
            >{{ game.phase === 'finished' ? '揭示' : '僅你可見的' }}增減牌：{{
              group.adjustments.map((n) => (n > 0 ? `+${n}` : String(n))).join('、') || '無'
            }}</p
          >
          <p v-else>隱藏增減牌 {{ group.adjustmentCount }} 張</p>
          <template v-if="group.playerId">
            <p
              >現金 {{ game.players.find((p) => p.id === group.playerId)?.cash }} 元 · 下一張股票
              {{ group.nextStockPrice === null ? '已售完' : group.nextStockPrice + ' 元' }}</p
            >
            <UiList
              ><UiListRow v-for="player in game.players" :key="player.id"
                >{{ name(player.id) }}持有 {{ held(player.id, group.id) }} 股</UiListRow
              ></UiList
            >
            <UiButton
              v-if="game.phase === 'playing' && group.playerId !== ceo.state?.me"
              :label="`買入${group.card.name}一股`"
              :disabled="
                !ceo.canAct ||
                game.countdown === 1 ||
                group.nextStockPrice === null ||
                !ceo.me ||
                ceo.me.cash < group.nextStockPrice
              "
              @click="ceo.act('buyStock', { issuerId: group.id })"
            />
          </template>
          <details
            ><summary>旗下公司 {{ group.companies.length }} 張</summary>
            <UiList v-if="group.companies.length"
              ><UiListRow v-for="card in group.companies" :key="card.id"
                ><div
                  ><strong>{{ card.name }}</strong
                  ><p
                    >{{ industries[card.industry] }} · 資產 {{ card.assets }} · 收入
                    {{ card.income }}</p
                  ><p>{{ scoreText(card) }}</p></div
                ></UiListRow
              ></UiList
            >
            <p v-else>尚無收購公司。</p>
          </details>
        </UiPanel>
      </div>
      <UiPanel title="操作紀錄" density="compact"
        ><p v-if="!log.length">尚無操作紀錄。</p
        ><UiList v-else
          ><UiListRow v-for="(event, index) in log" :key="index">{{ event }}</UiListRow></UiList
        ></UiPanel
      >
    </template>
    <div v-if="ceo.state?.phase === 'finished'" id="ceo-restart-settings"></div>
  </div>
</template>
<style scoped>
.ceo-scene {
  display: grid;
  gap: var(--stitch-gap-section);
  min-width: 0;
}
.ceo-status,
.ceo-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-gap-controls);
}
.ceo-market,
.ceo-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--stitch-space-16);
  align-items: stretch;
}
.ceo-market > *,
.ceo-groups > * {
  min-width: 0;
  overflow-wrap: anywhere;
}
.ceo-groups {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}
.ceo-scene p {
  margin: 0;
}
.ceo-market > .ui-panel {
  display: flex;
  flex-direction: column;
  gap: var(--stitch-space-16);
}
.ceo-market > .ui-panel > .ui-button {
  margin-top: auto;
}
.ceo-groups > .ui-panel {
  display: grid;
  gap: var(--stitch-space-16);
  align-content: start;
}
.ceo-scene > .ui-panel:last-of-type .ui-stitch-list {
  max-height: 24rem;
  overflow: auto;
}
</style>
