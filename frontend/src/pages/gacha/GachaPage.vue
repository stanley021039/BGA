<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useGachaStore } from '../../stores/gacha';
import { useSessionStore } from '../../stores/session';
import { usePreferencesStore } from '../../stores/preferences';
import { type GachaItem, type GachaReceipt } from '../../contracts/gacha';
import { isEntranceEffect } from '../../services/entrance-effects';
import { watchMotionCancellation } from '../../services/motion-lifetime.js';
import UiHeading from '../../components/UiHeading.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiIcon from '../../components/UiIcon.vue';
import UiField from '../../components/UiField.vue';
import UiCheckbox from '../../components/UiCheckbox.vue';
import UiTabs from '../../components/UiTabs.vue';
import UiNotice from '../../components/UiNotice.vue';
import UiChoiceCard from '../../components/UiChoiceCard.vue';
import UiDialog from '../../components/UiDialog.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
import AttackArtwork from '../../components/AttackArtwork.vue';
import EntrancePreview from '../../components/EntrancePreview.vue';
import FramePreview from '../../components/FramePreview.vue';
const store = useGachaStore(),
  session = useSessionStore(),
  prefs = usePreferencesStore();
const tab = ref('draw'),
  pool = ref('all'),
  search = ref(''),
  unowned = ref(false),
  previewRevision = ref(0),
  skip = ref(false);
const tabs = [
  { id: 'draw', label: '召喚' },
  { id: 'exchange', label: '兌換' },
  { id: 'odds', label: '獎池' },
  { id: 'history', label: '紀錄' },
];
const icons: Record<string, string> = {
  all: 'cards',
  attacks: 'attack-up',
  entrances: 'emoji',
  backgrounds: 'landscape',
  frames: 'frame',
  media: 'play',
  sounds: 'sound',
};
const kindNames: Record<string, string> = {
  attacks: '攻擊招式',
  entrances: '進場特效',
  backgrounds: '大廳背景',
  frames: '彈幕框',
  media: '播放器風格',
  sounds: '標記語音',
};
const number = (n: number) => n.toLocaleString('zh-TW');
const poolItems = computed(() =>
  (store.state?.items || []).filter((i) => pool.value === 'all' || i.kind === pool.value),
);
const poolInfo = computed(() => store.state?.pools.find((p) => p.id === pool.value));
const filtered = computed(() =>
  poolItems.value.filter(
    (i) => (!unowned.value || !i.owned) && (!search.value || i.label.includes(search.value)),
  ),
);
const featured = computed(
  () =>
    poolItems.value.find((i) => i.id === 'gate_of_babylon') ||
    poolItems.value.find((i) => i.rarity === 'legendary') ||
    poolItems.value[0],
);
const locked = computed(() => store.pending || !!store.unsettled || !store.state);
const result = ref<GachaReceipt | null>(null),
  animating = ref(false),
  resultDialog = ref<InstanceType<typeof UiDialog> | null>(null);
const confirmation = ref<InstanceType<typeof UiDialog> | null>(null),
  exchangeItem = ref<GachaItem | null>(null);
let animationTimer: ReturnType<typeof setTimeout> | undefined,
  stopMotion: (() => void) | undefined,
  disposed = false;
function reveal() {
  clearTimeout(animationTimer);
  animationTimer = undefined;
  const stop = stopMotion;
  stopMotion = undefined;
  stop?.();
  animating.value = false;
}
async function show(receipt: GachaReceipt, animate = false) {
  if (disposed) return;
  reveal();
  result.value = receipt;
  animating.value =
    animate &&
    !skip.value &&
    prefs.motion?.enabled !== false &&
    prefs.motion?.reduced !== true &&
    !document.hidden;
  await nextTick();
  await resultDialog.value?.open();
  if (animating.value) {
    animationTimer = setTimeout(reveal, 900);
    stopMotion = watchMotionCancellation(reveal);
  }
}
async function draw(count: 1 | 10) {
  const receipt = await store.draw(pool.value, count);
  if (receipt) await show(receipt, true);
}
async function recover() {
  const receipt = await store.recover();
  if (receipt) await show(receipt);
}
async function confirmExchange() {
  if (!exchangeItem.value) return;
  const receipt = await store.exchange(exchangeItem.value.key);
  if (receipt) {
    confirmation.value?.close();
    await show(receipt);
  }
}
function chooseExchange(item: GachaItem) {
  exchangeItem.value = item;
  void confirmation.value?.open();
}
watch(tab, (value) => {
  if (value === 'history') void store.loadHistory();
});
watch(pool, () => {
  previewRevision.value++;
});
onMounted(async () => {
  try {
    skip.value = localStorage.getItem('bga:gacha:skip') === '1';
  } catch {
    /* Optional preference. */
  }
  try {
    await session.refresh();
    if (session.user && !store.state && !store.loading) await store.load();
  } catch {
    /* Header and page show retry state. */
  }
});
watch(skip, (value) => {
  try {
    localStorage.setItem('bga:gacha:skip', value ? '1' : '0');
  } catch {
    /* Optional preference. */
  }
});
onBeforeUnmount(() => {
  disposed = true;
  reveal();
});
const newCount = computed(() =>
  result.value?.operation === 'draw' ? result.value.results.filter((i) => !i.duplicate).length : 0,
);
</script>
<template>
  <div class="gacha-page">
    <div class="gacha-heading">
      <div><UiHeading :level="1" kind="page">獎勵召喚</UiHeading><p>收集招式與個人風格</p></div>
      <div class="gacha-wallet" aria-label="抽卡餘額">
        <UiBadge tone="primary">抽卡幣 {{ number(store.state?.wallet.coins || 0) }}</UiBadge>
        <UiBadge>共用碎片 {{ number(store.state?.wallet.fragments || 0) }}</UiBadge>
        <UiLink href="/" label="返回大廳" icon="previous" />
      </div>
    </div>
    <UiTabs
      v-model="tab"
      :items="tabs"
      label="抽卡機功能"
      panel-prefix="gacha-panel"
      id-prefix="gacha-tab"
    />
    <UiNotice
      :message="store.message"
      :notice-key="store.notice"
      error
      :persistent="!!store.unsettled || !store.state"
    />
    <UiPanel v-if="store.unsettled" title="上次操作結果待確認">
      <p>請先確認上次操作。同一識別碼重送只會取回原結果，不會重複扣幣或碎片。</p>
      <UiButton label="確認上次結果" :pending="store.pending" @click="recover" />
    </UiPanel>
    <UiPanel v-if="!session.authenticated" title="登入後使用抽卡機">
      <p>抽卡幣、碎片與已獲得外觀會保存在你的帳號。</p
      ><UiLink href="/login" label="登入" variant="primary" />
    </UiPanel>
    <div v-else class="gacha-layout" :aria-busy="store.loading">
      <aside class="gacha-pools">
        <UiPanel title="召喚卡池" density="compact">
          <div class="gacha-pool-list" role="group" aria-label="卡池選擇">
            <UiChoiceCard
              v-for="p in store.state?.pools || []"
              :key="p.id"
              :label="p.label"
              :selected="pool === p.id"
              :disabled="store.pending"
              @click="pool = p.id"
            >
              <template #label
                ><span class="gacha-pool-name"
                  ><UiIcon :name="icons[p.id]" />{{ p.label
                  }}<UiBadge counter>{{ p.count }}</UiBadge></span
                ></template
              >
              <template #selection
                ><span class="gacha-selection">{{ pool === p.id ? '已選擇' : '' }}</span></template
              >
            </UiChoiceCard>
          </div>
          <UiField
            class="gacha-pool-mobile"
            v-model="pool"
            control="select"
            label="目前卡池"
            :disabled="store.pending"
          >
            <option v-for="p in store.state?.pools || []" :key="p.id" :value="p.id"
              >{{ p.label }}（{{ p.count }}項）</option
            >
          </UiField>
        </UiPanel>
        <UiPanel title="抽卡幣來源" density="compact">
          <UiList
            ><UiListRow>每日登入 <strong>100 幣</strong></UiListRow
            ><UiListRow>有效對局 <strong>50 幣</strong></UiListRow
            ><UiListRow>勝者額外 <strong>25 幣</strong></UiListRow></UiList
          >
          <p class="gacha-note"
            >台灣日期每日一次登入獎勵。至少兩位真人正常完賽，有實際遊戲操作才計入；場次沒有每日上限。</p
          >
        </UiPanel>
      </aside>
      <section
        :id="'gacha-panel-' + tab"
        class="gacha-content"
        role="tabpanel"
        :aria-labelledby="'gacha-tab-' + tab"
      >
        <UiPanel v-if="!store.state" title="讀取抽卡機">
          <p>{{ store.loading ? '正在讀取帳號餘額與外觀…' : '資料暫時無法載入。' }}</p>
          <UiButton label="重新讀取" icon="refresh" :pending="store.loading" @click="store.load" />
        </UiPanel>
        <template v-else-if="tab === 'draw'">
          <UiPanel :title="poolInfo?.label" description="單抽與十連的每抽機率相同，沒有抽數保底。">
            <div v-if="featured" class="gacha-feature">
              <div class="gacha-feature-copy"
                ><UiBadge :tone="featured.rarity === 'legendary' ? 'primary' : 'info'"
                  >{{ featured.rarityLabel }}・{{ kindNames[featured.kind] }}</UiBadge
                >
                <UiHeading :level="2">{{ featured.label }}</UiHeading>
                <p>{{
                  featured.owned
                    ? '已收集，再次抽中會轉換為共用碎片。'
                    : '收集後可在形象設定或收藏庫套用。'
                }}</p>
                <UiButton
                  v-if="featured.kind === 'attacks'"
                  label="重播招式"
                  icon="replay"
                  @click="previewRevision++"
                />
              </div>
              <div class="gacha-feature-art" :aria-label="featured.label + '展示'">
                <AttackArtwork
                  v-if="featured.kind === 'attacks'"
                  :effect="featured.id"
                  preview
                  :play-key="featured.key + ':' + previewRevision"
                  :from="{ x: 22, y: 66 }"
                  :to="{ x: 67, y: 66 }"
                />
                <EntrancePreview
                  v-else-if="featured.kind === 'entrances' && isEntranceEffect(featured.id)"
                  :effect="featured.id"
                  image="/assets/characters/traveler-neutral.png"
                  :name="session.user?.displayName || '玩家'"
                />
                <FramePreview
                  v-else-if="featured.kind === 'frames' || featured.kind === 'media'"
                  :frame="featured.id"
                  :kind="featured.kind === 'media' ? 'media' : 'barrage'"
                />
                <div v-else class="gacha-symbol"
                  ><UiIcon :name="icons[featured.kind]" /><span>{{ featured.label }}</span></div
                >
              </div>
            </div>
            <div class="gacha-draw-controls">
              <UiCheckbox v-model="skip" label="略過揭卡動畫" />
              <p class="gacha-mobile-rules"
                >每日登入 100 幣；至少兩位真人正常完賽且有實際操作，每局 50 幣、勝者額外 25
                幣。場次沒有每日上限。</p
              >
              <p class="gacha-note">每抽獨立抽取。重複外觀轉為 1／5／20 共用碎片。</p>
              <div class="gacha-buttons">
                <UiButton
                  label="單次抽取 · 100 幣"
                  :disabled="locked || store.state.wallet.coins < 100"
                  :pending="store.pending"
                  @click="draw(1)"
                />
                <UiButton
                  label="十連抽取 · 1,000 幣"
                  variant="primary"
                  :disabled="locked || store.state.wallet.coins < 1000"
                  :pending="store.pending"
                  @click="draw(10)"
                />
              </div>
              <p class="gacha-balance-note">{{
                store.state.wallet.coins < 100
                  ? '抽卡幣不足，可每日登入或完成有效對局取得。'
                  : '結果由伺服器抽取，獎勵會直接加入帳號。'
              }}</p>
            </div>
          </UiPanel>
          <UiPanel title="還想找哪一款？"
            ><p>六類外觀共用碎片，可指定兌換未擁有的獎勵。</p
            ><div class="gacha-buttons"
              ><UiButton label="碎片指定兌換" icon="gift" @click="tab = 'exchange'" /><UiLink
                href="/profile"
                label="形象設定"
                icon="emoji" /><UiLink href="/collection" label="收藏庫" icon="cards" /></div
          ></UiPanel>
        </template>
        <template v-else-if="tab === 'exchange'">
          <UiPanel
            title="碎片指定兌換"
            description="普通 20／稀有 100／傳說 400 碎片。只可兌換未擁有的外觀。"
          >
            <div class="gacha-filters"
              ><UiField v-model="search" label="搜尋外觀" placeholder="輸入名稱" /><UiCheckbox
                v-model="unowned"
                label="只看未擁有"
            /></div>
            <p aria-live="polite">共 {{ filtered.length }} 項</p>
            <UiList
              ><UiListRow v-for="item in filtered" :key="item.key">
                <div class="gacha-item-copy"
                  ><strong>{{ item.label }}</strong
                  ><span>{{ kindNames[item.kind] }}・{{ item.rarityLabel }}</span></div
                >
                <template #actions
                  ><UiBadge v-if="item.owned" tone="success">已擁有</UiBadge
                  ><UiButton
                    v-else
                    :label="number(item.exchangeCost) + ' 碎片兌換'"
                    :disabled="locked || store.state.wallet.fragments < item.exchangeCost"
                    @click="chooseExchange(item)"
                /></template> </UiListRow
            ></UiList>
            <p v-if="!filtered.length">目前沒有符合條件的外觀。</p>
          </UiPanel>
        </template>
        <UiPanel v-else-if="tab === 'odds'" title="獎池與規則">
          <p
            >每個獎項相對權重為
            100／20／2，這些數字不是百分比。綜合池直接合併所有獎項權重，不先抽類別；十連沒有保底。</p
          >
          <p
            >目前 {{ poolInfo?.label }} 共 {{ poolInfo?.count }} 項，總權重
            {{ poolInfo?.totalWeight }}。</p
          >
          <UiList
            ><UiListRow v-for="item in poolItems" :key="item.key">
              <div class="gacha-item-copy"
                ><strong>{{ item.label }}</strong
                ><span>{{ item.rarityLabel }}・重複 +{{ item.duplicateFragments }} 片</span></div
              >
              <template #actions
                ><span
                  >約 {{ ((item.weight / (poolInfo?.totalWeight || 1)) * 100).toFixed(3) }}%</span
                ></template
              >
            </UiListRow></UiList
          >
        </UiPanel>
        <UiPanel
          v-else
          title="最近操作紀錄"
          description="保留最近 20 次抽取與兌換，可重新查看完整明細。"
        >
          <template #actions
            ><UiButton label="重新整理紀錄" icon="refresh" @click="store.loadHistory"
          /></template>
          <UiList
            ><UiListRow v-for="receipt in store.history" :key="receipt.requestId">
              <div class="gacha-item-copy"
                ><strong>{{
                  receipt.operation === 'draw'
                    ? '抽取 ' + receipt.results.length + ' 次'
                    : receipt.item.label
                }}</strong
                ><span>{{ new Date(receipt.at).toLocaleString('zh-TW') }}</span></div
              >
              <template #actions
                ><UiButton label="查看結果" @click="show(receipt)"
              /></template> </UiListRow></UiList
          ><p v-if="!store.history.length">還沒有抽取或兌換紀錄。</p>
        </UiPanel>
      </section>
    </div>
    <UiDialog ref="confirmation" title="確認碎片兌換">
      <template v-if="exchangeItem && store.state"
        ><UiHeading :level="2">{{ exchangeItem.label }}</UiHeading>
        <p>{{ kindNames[exchangeItem.kind] }}・{{ exchangeItem.rarityLabel }}</p>
        <p
          >共用碎片 {{ number(store.state.wallet.fragments) }} −
          {{ number(exchangeItem.exchangeCost) }} →
          {{ number(Math.max(0, store.state.wallet.fragments - exchangeItem.exchangeCost)) }}</p
        >
        <div class="gacha-buttons"
          ><UiButton
            label="返回"
            :disabled="store.pending"
            @click="confirmation?.close()" /><UiButton
            label="確認兌換"
            variant="primary"
            :pending="store.pending"
            :disabled="
              locked ||
              exchangeItem.owned ||
              store.state.wallet.fragments < exchangeItem.exchangeCost
            "
            @click="confirmExchange"
        /></div>
      </template>
    </UiDialog>
    <UiDialog ref="resultDialog" title="召喚結果" @closing="reveal">
      <div v-if="animating" class="gacha-animation" role="status" aria-live="polite"
        ><UiIcon name="gift" /><p>獎勵即將揭曉</p><UiButton label="略過動畫" @click="reveal"
      /></div>
      <template v-else-if="result">
        <template v-if="result.operation === 'draw'">
          <p class="gacha-result-summary"
            >{{ result.results.length }} 項獎勵・{{ newCount }} 新獲得・{{
              result.results.length - newCount
            }}
            重複・共 +{{ result.fragmentsGained }} 碎片</p
          >
          <UiList
            ><UiListRow v-for="(item, index) in result.results" :key="index">
              <div class="gacha-item-copy"
                ><strong>{{ index + 1 }}. {{ item.label }}</strong
                ><span>{{ kindNames[item.kind] }}・{{ item.rarityLabel }}</span></div
              >
              <template #actions
                ><UiBadge :tone="item.duplicate ? 'neutral' : 'success'">{{
                  item.duplicate ? '重複 +' + item.fragments + ' 片' : '新獲得'
                }}</UiBadge></template
              >
            </UiListRow></UiList
          >
        </template>
        <template v-else
          ><UiHeading :level="2">{{ result.item.label }}</UiHeading
          ><p>已加入帳號收藏。</p></template
        >
        <p
          >本次結算餘額：{{ number(result.wallet.coins) }} 幣／{{
            number(result.wallet.fragments)
          }}
          碎片</p
        >
        <div class="gacha-buttons"
          ><UiButton label="完成" variant="primary" @click="resultDialog?.close()" /><UiLink
            href="/profile"
            label="前往形象設定"
        /></div>
      </template>
    </UiDialog>
  </div>
</template>
<style scoped>
.gacha-page {
  display: grid;
  gap: var(--stitch-gap-panel);
  padding-block: var(--stitch-space-24);
  min-inline-size: 0;
}
.gacha-heading,
.gacha-wallet,
.gacha-buttons,
.gacha-pool-name,
.gacha-filters {
  display: flex;
  align-items: center;
  gap: var(--stitch-gap-controls);
  flex-wrap: wrap;
}
.gacha-heading {
  justify-content: space-between;
}
.gacha-heading p {
  margin-block: var(--stitch-space-8) 0;
}
.gacha-layout {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  align-items: start;
  gap: var(--stitch-gap-panel);
}
.gacha-pools,
.gacha-content,
.gacha-pool-list {
  display: grid;
  gap: var(--stitch-gap-controls);
  min-inline-size: 0;
}
.gacha-pools {
  position: sticky;
  top: var(--stitch-space-16);
}
.gacha-pool-list {
  gap: var(--stitch-space-4);
}
.gacha-pool-name {
  justify-content: space-between;
  gap: var(--stitch-space-8);
}
.gacha-selection {
  display: block;
  min-block-size: 1.4em;
  font-size: var(--stitch-text-hint);
}
.gacha-pool-mobile {
  display: none;
}
.gacha-feature {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(0, 1.5fr);
  align-items: center;
  gap: var(--stitch-gap-panel);
}
.gacha-mobile-rules {
  display: none;
}
.gacha-feature-copy {
  display: grid;
  justify-items: start;
  gap: var(--stitch-gap-controls);
  min-inline-size: 0;
}
.gacha-feature-art {
  position: relative;
  block-size: 22rem;
  min-inline-size: 0;
  overflow: hidden;
}
.gacha-symbol {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--stitch-gap-controls);
  block-size: 100%;
}
.gacha-symbol :deep(svg) {
  inline-size: 5rem;
  block-size: 5rem;
}
.gacha-draw-controls {
  display: grid;
  gap: var(--stitch-gap-controls);
  margin-block-start: var(--stitch-space-24);
}
.gacha-note,
.gacha-balance-note {
  font-size: var(--stitch-text-hint);
  color: var(--stitch-muted);
}
.gacha-balance-note {
  min-block-size: 3em;
}
.gacha-filters {
  margin-block-end: var(--stitch-space-20);
}
.gacha-item-copy {
  display: grid;
  gap: var(--stitch-space-4);
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.gacha-item-copy span {
  font-size: var(--stitch-text-hint);
  color: var(--stitch-muted);
}
.gacha-content :deep(.ui-stitch-list-row) {
  flex-wrap: wrap;
  gap: var(--stitch-gap-controls);
}
.gacha-animation {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--stitch-gap-panel);
  min-block-size: 20rem;
}
.gacha-animation :deep(svg) {
  inline-size: 6rem;
  block-size: 6rem;
  animation: gacha-reveal 900ms ease-out 1;
}
.gacha-result-summary {
  font-weight: 700;
}
@keyframes gacha-reveal {
  0% {
    transform: scale(0.7) rotate(-8deg);
    opacity: 0.4;
  }
  60% {
    transform: scale(1.2) rotate(8deg);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}
@media (max-width: 800px) {
  .gacha-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .gacha-pools {
    position: static;
  }
  .gacha-pool-list {
    display: none;
  }
  .gacha-pool-mobile {
    display: grid;
  }
  .gacha-pools > .ui-panel:nth-child(2) {
    display: none;
  }
  .gacha-feature {
    grid-template-columns: minmax(0, 1fr);
  }
  .gacha-feature-art {
    block-size: 16rem;
  }
  .gacha-wallet {
    gap: var(--stitch-space-8);
  }
  .gacha-buttons > * {
    flex: 1 1 auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gacha-animation :deep(svg) {
    animation: none;
  }
}
@media (max-width: 800px) {
  .gacha-mobile-rules {
    display: block;
    font-size: var(--stitch-text-hint);
  }
}
</style>
