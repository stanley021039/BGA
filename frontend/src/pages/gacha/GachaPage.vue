<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useGachaStore } from '../../stores/gacha';
import { useSessionStore } from '../../stores/session';
import { usePreferencesStore } from '../../stores/preferences';
import { attackEffects } from '../../stores/attack-loadout';
import {
  gachaPoolKinds,
  gachaRarities,
  gachaShowcaseItems,
  type GachaItem,
  type GachaReceipt,
} from '../../contracts/gacha';
import AudioSettings from '../../engines/audio-settings.js';
import { motionAllowed, watchMotionCancellation } from '../../services/motion-lifetime.js';
import { requestJson } from '../../services/http';
import { sizedImage } from '../../services/image-size';
import { warm } from '../../services/preload';
import { gachaEnding, type GachaSound } from '../../services/gacha-cinematic';
import { groupGachaEffects } from '../../services/effect-variants';
import { warmGachaAudio } from '../../services/game-assets';
import economy from '../../../../public/shared/gacha-economy.json';
import RewardCurrencyIcon from '../../components/RewardCurrencyIcon.vue';
import GachaCinematic from '../../components/GachaCinematic.vue';
import GachaRewardCard from '../../components/GachaRewardCard.vue';
import GachaSpectator from '../../components/GachaSpectator.vue';
import SpectatorRoster from '../../components/SpectatorRoster.vue';
import GachaSpotlight from '../../components/GachaSpotlight.vue';
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
import GachaFeatured from '../../components/GachaFeatured.vue';
const store = useGachaStore(),
  session = useSessionStore(),
  prefs = usePreferencesStore();
const tab = ref('draw'),
  pool = ref('all'),
  search = ref(''),
  unowned = ref(false),
  skip = ref(false);
const tabs = [
  { id: 'draw', label: '召喚' },
  { id: 'exchange', label: '兌換' },
  { id: 'odds', label: '獎池與機率' },
  { id: 'history', label: '紀錄' },
];
const poolIcons: Record<string, string> = {
  all: 'cards',
  combat: 'attack-up',
  arrival: 'emoji',
  styles: 'frame',
};
const rarityRank = { legendary: 0, epic: 1, rare: 2, common: 3 };
const rarityTone = { legendary: 'primary', epic: 'epic', rare: 'info', common: 'neutral' } as const;
const kindNames: Record<string, string> = {
  attacks: '攻擊招式',
  entrances: '進場特效',
  backgrounds: '大廳背景',
  frames: '彈幕框',
  media: '播放器風格',
  sounds: '標記語音',
};
const number = (n: number) => n.toLocaleString('zh-TW');
const loginBonuses = economy.dailyLoginBonuses.flatMap((coins, index) =>
  coins ? [`第 ${index + 1} 次額外 +${number(coins)}`] : [],
);
function formatOdds(weight: number, total: number) {
  const percent = (weight / total) * 100;
  if (percent > 0 && percent < 0.001) return '<0.001%';
  if (percent > 99.999 && weight < total) return '>99.999%';
  return percent.toFixed(3) + '%';
}
const poolItems = computed(() => {
  const kinds = gachaPoolKinds(pool.value);
  return (store.state?.items || [])
    .filter((item) => kinds.includes(item.kind))
    .sort((a, b) => rarityRank[a.rarity] - rarityRank[b.rarity]);
});
const poolInfo = computed(() => store.state?.pools.find((p) => p.id === pool.value));
const untilBonus = computed(
  () => economy.bonusInterval - ((poolInfo.value?.drawCount ?? 0) % economy.bonusInterval),
);
const filtered = computed(() =>
  poolItems.value.filter(
    (i) => (!unowned.value || !i.owned) && (!search.value || i.label.includes(search.value)),
  ),
);
const exchangeGroups = computed(() => groupGachaEffects(filtered.value));
const oddsGroups = computed(() => groupGachaEffects(poolItems.value));
const highlights = computed(() => gachaShowcaseItems(poolItems.value));
const openSpectate = ref(false);
const spectateStarting = ref(false);
const spectateId = ref<string>();
const hostedSpectate = ref<{ id: string; viewerNames: string[] }>();
const spectateError = ref('');
const locked = computed(
  () => store.pending || spectateStarting.value || !!store.unsettled || !store.state,
);
const result = ref<GachaReceipt | null>(null),
  animating = ref(false),
  cinematicFinished = ref(false),
  cinematicCancelled = ref(false),
  cinematicSoundPlaying = ref(false),
  revealAction = ref<InstanceType<typeof UiButton> | null>(null),
  revealIndex = ref<number | null>(null),
  faceUp = ref(false),
  repeatPool = ref<string | null>(null),
  spotlight = ref<ReturnType<typeof rewardSpotlight> | null>(null),
  cardMotion = ref(false),
  drawName = ref('玩家'),
  drawImage = ref(''),
  revealRegion = ref<HTMLElement | null>(null),
  cardBoard = ref<HTMLElement | null>(null),
  resultSummary = ref<HTMLElement | null>(null),
  resultDialog = ref<InstanceType<typeof UiDialog> | null>(null);
const confirmation = ref<InstanceType<typeof UiDialog> | null>(null),
  exchangeItem = ref<GachaItem | null>(null),
  exchangePreviewDialog = ref<InstanceType<typeof UiDialog> | null>(null),
  exchangePreview = ref<ReturnType<typeof rewardSpotlight> | null>(null);
let disposed = false;
let spectateQueue = Promise.resolve();
function publishSpectate(action: string) {
  const id = spectateId.value;
  if (!id) return;
  if (action === 'close') spectateId.value = undefined;
  spectateQueue = spectateQueue
    .then(async () => {
      await requestJson('/api/gacha/spectate', {
        method: 'POST',
        body: { id, action },
        signal: AbortSignal.timeout(5000),
      });
    })
    .catch(() => {
      if (spectateId.value === id) spectateError.value = '觀戰同步失敗，請關閉本次結果後重新開放。';
    });
}
function leaveSpectate() {
  const id = spectateId.value;
  if (!id) return;
  spectateId.value = undefined;
  void fetch('/api/gacha/spectate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'close' }),
    keepalive: true,
  }).catch(() => {});
}
let stopReveal: (() => void) | undefined;
let announcementId: string | undefined;
let cinematicSound: HTMLAudioElement | undefined;
let cinematicCue: GachaSound | 'card-draw' | `ping-voice-${string}` | undefined;
let marketSound: HTMLAudioElement | undefined;
let cancelMarketHandoff: (() => void) | undefined;
function stopCinematicSound() {
  const previous = cinematicSound;
  const previousMarket = marketSound;
  cinematicSound = undefined;
  cinematicCue = undefined;
  marketSound = undefined;
  cancelMarketHandoff?.();
  cancelMarketHandoff = undefined;
  cinematicSoundPlaying.value = false;
  AudioSettings?.stopEffect(previous);
  AudioSettings?.stopEffect(previousMarket);
}
function playCinematicSound(cue: GachaSound | 'card-draw' | `ping-voice-${string}`) {
  if (cue === 'gacha-shuffle' && cinematicCue === 'gacha-rush' && cinematicSound) {
    const rush = cinematicSound;
    const handoff = () => {
      if (!Number.isFinite(rush.duration) || rush.duration - rush.currentTime > 0.35) return;
      cancelMarketHandoff?.();
      cancelMarketHandoff = undefined;
      marketSound = AudioSettings?.playEffect?.(cue);
    };
    rush.addEventListener('timeupdate', handoff);
    cancelMarketHandoff = () => rush.removeEventListener('timeupdate', handoff);
    handoff();
    return;
  }
  stopCinematicSound();
  cinematicCue = cue;
  cinematicSound = AudioSettings?.playEffect?.(cue, {
    onStop: (clip) => {
      if (cinematicSound !== clip) return;
      cinematicSound = undefined;
      cinematicCue = undefined;
      cinematicSoundPlaying.value = false;
      if (cancelMarketHandoff) {
        cancelMarketHandoff();
        cancelMarketHandoff = undefined;
        playCinematicSound('gacha-shuffle');
      }
    },
  });
  cinematicSoundPlaying.value = !!cinematicSound;
}
function playRewardVoice(item: GachaItem) {
  if (item.kind === 'sounds' && /^ping-voice-[a-z-]+$/.test(item.id))
    playCinematicSound(item.id as `ping-voice-${string}`);
}
function traderImage() {
  return sizedImage(
    store.state?.characterImage || '',
    window.matchMedia('(max-width: 600px)').matches ? 128 : 256,
  );
}
function captureTrader() {
  drawName.value = session.user?.displayName || '玩家';
  drawImage.value = traderImage();
}
watch(
  () => store.state?.characterImage,
  () => {
    if (!skip.value && motionAllowed()) warm([traderImage()]);
  },
);
watch(
  () => store.state !== null,
  (loaded) => {
    if (loaded && !skip.value && motionAllowed()) warmGachaAudio();
  },
);
const revealItem = computed(() =>
  result.value?.operation === 'draw' && revealIndex.value !== null
    ? result.value.results[revealIndex.value]
    : undefined,
);
const drawBonus = computed(() => {
  const receipt = result.value;
  if (receipt?.operation !== 'draw' || receipt.drawCount === undefined) return;
  const number = receipt.drawCount - (receipt.drawCount % economy.bonusInterval);
  const position = receipt.results.length - (receipt.drawCount - number);
  if (number > 0 && position > 0) return { number, position };
});
const canAdvance = computed(
  () => revealIndex.value !== null && faceUp.value && !spotlight.value && !animating.value,
);
function reveal() {
  stopCinematicSound();
  animating.value = false;
  cinematicFinished.value = false;
  cinematicCancelled.value = false;
  revealIndex.value = null;
  faceUp.value = false;
  spotlight.value = null;
  cardMotion.value = false;
  stopReveal?.();
  stopReveal = undefined;
}
function showAllResults() {
  publishSpectate('summary');
  forgetUnrevealedDraw();
  reveal();
  announceReveal();
  void nextTick(() => {
    cardBoard.value?.scrollTo(0, 0);
    resultSummary.value?.focus({ preventScroll: true });
  });
}
function skipReveal() {
  showAllResults();
}
function announceReveal() {
  if (!announcementId) return;
  const requestId = announcementId;
  announcementId = undefined;
  void requestJson('/api/gacha/reveal', { method: 'POST', body: { requestId } }).catch(() => {
    // The server also releases the notice if the browser is disconnected.
  });
}
function finishCinematic(cancelled: boolean) {
  if (!animating.value || cinematicFinished.value) return;
  cinematicFinished.value = true;
  cinematicCancelled.value = cancelled;
  if (cancelled) stopCinematicSound();
}
const canReveal = computed(() => cinematicFinished.value && !cinematicSoundPlaying.value);
watch(
  canReveal,
  (ready) => {
    if (ready) revealAction.value?.$el.focus({ preventScroll: true });
  },
  { flush: 'post' },
);
function showCardBoard() {
  publishSpectate('board');
  stopCinematicSound();
  animating.value = false;
  cinematicFinished.value = false;
  void nextTick(() => revealRegion.value?.focus({ preventScroll: true }));
}
function openCardBoard() {
  if (animating.value && canReveal.value) showCardBoard();
}
function fromResultControl(event: Event) {
  return (
    event.target instanceof Element &&
    !!event.target.closest('button, a, input, select, textarea, [role="button"]')
  );
}
function onResultClick(event: MouseEvent) {
  if (fromResultControl(event)) return;
  if (canAdvance.value) advanceReveal();
  else openCardBoard();
}
function onResultAdvanceKey(event: KeyboardEvent) {
  if (!canAdvance.value || event.repeat || fromResultControl(event)) return;
  event.preventDefault();
  advanceReveal();
}
function rewardSpotlight(item: GachaItem) {
  const attack =
    item.kind === 'attacks' ? attackEffects.find((effect) => effect.id === item.id) : undefined;
  return {
    item,
    area: !!attack?.area,
    attackId: attack?.variantOf || attack?.id,
  };
}
function revealFromCard() {
  const item = revealItem.value;
  if (animating.value || spotlight.value || !item || faceUp.value) return;
  faceUp.value = true;
  const reward = rewardSpotlight(item);
  const featured =
    reward.area || reward.attackId === 'shaohua_devour' || item.rarity === 'legendary';
  publishSpectate(featured ? 'spotlight' : 'card');
  stopReveal?.();
  cardMotion.value = !featured && motionAllowed();
  stopReveal = cardMotion.value
    ? watchMotionCancellation(() => {
        cardMotion.value = false;
      })
    : undefined;
  playCinematicSound('card-draw');
  if (featured) {
    spotlight.value = reward;
    return;
  }
  void nextTick(focusCardStatus);
}
function focusCardStatus() {
  revealRegion.value?.focus({ preventScroll: true });
}
function advanceReveal() {
  const receipt = result.value;
  const index = revealIndex.value;
  if (receipt?.operation !== 'draw' || index === null || !canAdvance.value) return;
  if (index === receipt.results.length - 1) {
    showAllResults();
    return;
  }
  stopReveal?.();
  stopReveal = undefined;
  stopCinematicSound();
  cardMotion.value = false;
  faceUp.value = false;
  revealIndex.value = index + 1;
  publishSpectate('next');
  void nextTick(focusCardStatus);
}
function closeSpotlight() {
  spotlight.value = null;
  publishSpectate('card');
  stopCinematicSound();
  void nextTick(focusCardStatus);
}
async function show(receipt: GachaReceipt, { animate = false, announce = false } = {}) {
  if (disposed) return;
  reveal();
  result.value = receipt;
  repeatPool.value = announce && receipt.operation === 'draw' ? receipt.pool : null;
  if (repeatPool.value) revealIndex.value = 0;
  announcementId =
    announce &&
    receipt.operation === 'draw' &&
    receipt.results.some((item) => item.rarity === 'legendary')
      ? receipt.requestId
      : undefined;
  animating.value = animate && !skip.value;
  if (
    animating.value &&
    (prefs.motion?.enabled === false || prefs.motion?.reduced === true || !motionAllowed())
  )
    finishCinematic(true);
  await nextTick();
  await resultDialog.value?.open();
  if (!animating.value && revealItem.value) focusCardStatus();
}
function unrevealedDrawKey(userId: string) {
  return 'bga:gacha:unrevealed:' + userId;
}
function rememberUnrevealedDraw(userId: string, requestId: string) {
  try {
    sessionStorage.setItem(unrevealedDrawKey(userId), requestId);
  } catch {
    // Results remain available in the server history.
  }
}
function forgetUnrevealedDraw() {
  if (!session.user || result.value?.operation !== 'draw') return;
  try {
    const key = unrevealedDrawKey(session.user.id);
    if (sessionStorage.getItem(key) === result.value.requestId) sessionStorage.removeItem(key);
  } catch {
    // Storage is optional.
  }
}
function closeResult() {
  if (!disposed) forgetUnrevealedDraw();
  publishSpectate('close');
  reveal();
}
async function resumeUnrevealedDraw() {
  const userId = session.user?.id;
  if (!userId) return;
  let requestId: string | null;
  try {
    requestId = sessionStorage.getItem(unrevealedDrawKey(userId));
  } catch {
    return;
  }
  if (!requestId) return;
  await store.loadHistory();
  if (disposed || session.user?.id !== userId || result.value) return;
  const receipt = store.history.find(
    (entry) => entry.operation === 'draw' && entry.requestId === requestId,
  );
  if (receipt) await show(receipt, { announce: true });
}
async function draw(count: 1 | 10, selectedPool = pool.value, voucher = false) {
  const userId = session.user?.id;
  const share = openSpectate.value;
  captureTrader();
  const receipt = await store.draw(selectedPool, count, voucher);
  if (receipt && userId && session.user?.id === userId) {
    rememberUnrevealedDraw(userId, receipt.requestId);
    publishSpectate('close');
    if (share && !disposed) {
      spectateStarting.value = true;
      spectateError.value = '';
      try {
        const value = (await requestJson('/api/gacha/spectate', {
          method: 'POST',
          body: { action: 'start', requestId: receipt.requestId, market: !skip.value },
          signal: AbortSignal.timeout(5000),
        })) as { id: string };
        if (session.user?.id === userId) {
          spectateId.value = value.id;
          if (disposed) leaveSpectate();
        }
      } catch {
        spectateError.value = '未能開放本次觀戰，可照常查看自己的抽卡結果。';
      } finally {
        spectateStarting.value = false;
      }
    }
    if (session.user?.id !== userId) return;
    await show(receipt, { animate: true, announce: true });
  }
}
async function recover() {
  const userId = session.user?.id;
  const receipt = await store.recover();
  if (receipt) {
    if (receipt.operation === 'draw' && userId && session.user?.id === userId)
      rememberUnrevealedDraw(userId, receipt.requestId);
    captureTrader();
    await show(receipt, { announce: true });
  }
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
async function previewReward(item: GachaItem, event: MouseEvent) {
  const trigger = event.currentTarget;
  captureTrader();
  exchangePreview.value = rewardSpotlight(item);
  await nextTick();
  await exchangePreviewDialog.value?.open(trigger instanceof HTMLElement ? trigger : undefined);
}
watch(tab, (value) => {
  stopCinematicSound();
  if (value === 'history') void store.loadHistory();
  if (value === 'odds' && session.user?.role === 'admin') void store.loadOdds();
});
const weights = ref({ common: 70, rare: 20, epic: 7, legendary: 3 });
const rarities = [
  { id: 'legendary', label: '傳說' },
  { id: 'epic', label: '史詩' },
  { id: 'rare', label: '稀有' },
  { id: 'common', label: '普通' },
] as const;
watch(
  () => store.adminOdds,
  (value) => {
    if (value) weights.value = { ...value.weights };
  },
);
const weightsValid = computed(() =>
  Object.values(weights.value).every(
    (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= 1000000,
  ),
);
const rarityCounts = computed(() => {
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const item of poolItems.value) counts[item.rarity]++;
  return counts;
});
const rarityOdds = computed(() =>
  rarities.map((r) => ({
    ...r,
    chance: formatOdds(
      rarityCounts.value[r.id] ? (store.state?.odds.weights[r.id] ?? 0) : 0,
      poolInfo.value?.totalWeight || 1,
    ),
  })),
);
const bonusTotal = computed(() =>
  Object.values(poolInfo.value?.bonusWeights ?? {}).reduce((sum, weight) => sum + weight, 0),
);
const exchangeDescription =
  gachaRarities
    .map(
      (tier) =>
        `${rarities.find((rarity) => rarity.id === tier)?.label} ${economy.exchangeCosts[tier]}`,
    )
    .join('／') + ' 碎片。只可兌換未擁有的外觀。';
const proposedOdds = computed(() => {
  const total = rarities.reduce(
    (n, r) => n + (rarityCounts.value[r.id] ? Number(weights.value[r.id]) || 0 : 0),
    0,
  );
  return rarities.map((r) => ({
    ...r,
    chance:
      weightsValid.value && total > 0
        ? formatOdds(rarityCounts.value[r.id] ? weights.value[r.id] : 0, total)
        : '—',
  }));
});
watch(
  () => [prefs.motion?.enabled, prefs.motion?.reduced],
  () => {
    if (!motionAllowed() && animating.value) finishCinematic(true);
  },
);
watch(
  () => session.user?.id,
  () => {
    leaveSpectate();
    reveal();
    result.value = null;
    announcementId = undefined;
    resultDialog.value?.close();
    exchangePreviewDialog.value?.close();
    confirmation.value?.close();
  },
);
function resultEscape(event: KeyboardEvent) {
  if (!spotlight.value && !animating.value) return;
  event.preventDefault();
  event.stopPropagation();
  if (spotlight.value) closeSpotlight();
  else showCardBoard();
}
function refreshTrader() {
  if (session.user) void store.load();
}
onMounted(async () => {
  window.addEventListener('profile-updated', refreshTrader);
  window.addEventListener('pagehide', leaveSpectate);
  try {
    skip.value = localStorage.getItem('bga:gacha:skip') === '1';
  } catch {
    /* Optional preference. */
  }
  try {
    await session.refresh();
    if (session.user && !store.state && !store.loading) await store.load();
    await resumeUnrevealedDraw();
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
  window.removeEventListener('profile-updated', refreshTrader);
  window.removeEventListener('pagehide', leaveSpectate);
  leaveSpectate();
  reveal();
});
const newCount = computed(() =>
  result.value?.operation === 'draw' ? result.value.results.filter((i) => !i.duplicate).length : 0,
);
</script>
<template>
  <div class="gacha-page">
    <div class="gacha-heading">
      <UiHeading :level="1" kind="page">獎勵召喚</UiHeading>
      <div class="gacha-wallet" aria-label="抽卡餘額">
        <UiBadge tone="primary"
          ><RewardCurrencyIcon kind="stone" :size="20" /> 聖潔石
          {{ number(store.state?.wallet.coins || 0) }}</UiBadge
        >
        <UiBadge
          ><RewardCurrencyIcon kind="fragment" :size="20" /> 共用碎片
          {{ number(store.state?.wallet.fragments || 0) }}</UiBadge
        >
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
      <p>確認結果不會重複扣款。</p>
      <UiButton label="確認上次結果" :pending="store.pending" @click="recover" />
    </UiPanel>
    <GachaSpectator
      v-if="session.user"
      :key="session.user.id"
      :hosting="spectateId"
      @roster="hostedSpectate = $event"
    />
    <UiPanel v-if="!session.authenticated" title="登入後使用抽卡機">
      <UiLink href="/login" label="登入" variant="primary" />
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
                  ><UiIcon :name="poolIcons[p.id]" />{{ p.label
                  }}<UiBadge counter>{{ p.count }}</UiBadge></span
                ></template
              >
              <template #selection
                ><span class="gacha-selection">{{ pool === p.id ? '已選擇' : '' }}</span></template
              >
            </UiChoiceCard>
          </div>
          <div class="gacha-pool-mobile">
            <UiField v-model="pool" control="select" label="目前卡池" :disabled="store.pending">
              <option v-for="p in store.state?.pools || []" :key="p.id" :value="p.id"
                >{{ p.label }}（{{ p.count }}項）</option
              >
            </UiField>
          </div>
        </UiPanel>
        <UiPanel title="聖潔石來源" density="compact">
          <UiList>
            <UiListRow
              ><span class="gacha-income"
                ><span>每日登入</span><strong>{{ number(economy.dailyCoins) }} 聖潔石</strong></span
              ></UiListRow
            >
            <UiListRow
              ><span class="gacha-income"
                ><span>有效對局</span><strong>{{ economy.matchCoins }} 聖潔石</strong></span
              ></UiListRow
            >
            <UiListRow
              ><span class="gacha-income"
                ><span>勝者額外</span><strong>{{ economy.winnerCoins }} 聖潔石</strong></span
              ></UiListRow
            >
          </UiList>
          <div class="gacha-income-notes gacha-note">
            <div>
              <p>每 {{ economy.dailyLoginBonuses.length }} 次登入一輪</p>
              <ul>
                <li v-for="bonus in loginBonuses" :key="bonus">{{ bonus }} 石</li>
              </ul>
            </div>
            <p>有效對局須至少兩位真人完賽，並有實際操作。</p>
          </div>
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
          <UiPanel :title="poolInfo?.label" description="各卡池的機率加成獨立計算。">
            <GachaFeatured
              :pool="pool"
              :items="highlights"
              :blocked="store.pending || !!result"
              :name="session.user?.displayName || '玩家'"
              :image="store.state.characterImage"
              @play-voice="playRewardVoice"
            />
            <div class="gacha-draw-controls">
              <UiCheckbox v-model="skip" variant="prominent" label="略過抽卡演出" />
              <UiCheckbox v-model="openSpectate" variant="prominent" label="開放觀看" />
              <div class="gacha-mobile-rules gacha-income-notes gacha-note">
                <p
                  >每日登入 +{{ number(economy.dailyCoins) }} 聖潔石。每
                  {{ economy.dailyLoginBonuses.length }} 次登入一輪，{{
                    loginBonuses.join('、')
                  }}。</p
                >
                <p
                  >有效對局 +{{ economy.matchCoins }} 石，勝者再 +{{
                    economy.winnerCoins
                  }}
                  石。須至少兩位真人完賽，並有實際操作。</p
                >
              </div>
              <p>距下次加成 {{ untilBonus }} 抽</p>
              <div class="gacha-buttons">
                <UiButton
                  label="單次抽取 · 100 聖潔石"
                  :disabled="locked || store.state.wallet.coins < 100"
                  :pending="store.pending"
                  @click="draw(1)"
                />
                <UiButton
                  label="十連抽取 · 1,000 聖潔石"
                  variant="primary"
                  :disabled="locked || store.state.wallet.coins < 1000"
                  :pending="store.pending"
                  @click="draw(10)"
                />
                <UiButton
                  v-if="store.state.voucherAvailable"
                  label="使用傳說單抽券"
                  icon="gift"
                  :disabled="locked"
                  :pending="store.pending"
                  @click="draw(1, pool, true)"
                />
              </div>
              <div class="gacha-buttons"
                ><UiButton label="查看本池機率" icon="help" @click="tab = 'odds'"
              /></div>
              <p v-if="store.state.wallet.coins < 100" class="gacha-note">聖潔石不足。</p>
            </div>
          </UiPanel>
          <UiPanel title="收藏與兌換"
            ><div class="gacha-buttons"
              ><UiButton label="碎片指定兌換" icon="gift" @click="tab = 'exchange'" /><UiLink
                href="/profile"
                label="形象設定"
                icon="emoji" /><UiLink href="/collection" label="收藏庫" icon="cards" /></div
          ></UiPanel>
        </template>
        <template v-else-if="tab === 'exchange'">
          <UiPanel title="碎片指定兌換" :description="exchangeDescription">
            <div class="gacha-filters"
              ><UiField v-model="search" label="搜尋外觀" placeholder="輸入名稱" /><UiCheckbox
                v-model="unowned"
                variant="prominent"
                label="只看未擁有"
            /></div>
            <p aria-live="polite">共 {{ filtered.length }} 項</p>
            <UiList>
              <UiListRow v-for="group in exchangeGroups" :key="group.key">
                <div class="gacha-item-versions">
                  <div v-for="item in group.versions" :key="item.key" class="gacha-item-version">
                    <div class="gacha-item-copy"
                      ><UiButton
                        class="gacha-exchange-name"
                        :label="'預覽 ' + item.label"
                        :caption="item.label"
                        variant="ghost"
                        aria-haspopup="dialog"
                        @click="previewReward(item, $event)"
                      />
                      <div class="gacha-item-meta">
                        <UiBadge :tone="rarityTone[item.rarity]">{{ item.rarityLabel }}</UiBadge>
                        <span>{{ kindNames[item.kind] }}</span>
                      </div></div
                    >
                    <div class="gacha-item-actions">
                      <UiBadge v-if="item.owned" tone="success">已擁有</UiBadge
                      ><UiButton
                        v-else
                        :label="number(item.exchangeCost) + ' 碎片兌換'"
                        :disabled="locked || store.state.wallet.fragments < item.exchangeCost"
                        @click="chooseExchange(item)"
                      />
                    </div>
                  </div>
                </div>
              </UiListRow>
            </UiList>
            <p v-if="!filtered.length">目前沒有符合條件的外觀。</p>
          </UiPanel>
        </template>
        <UiPanel v-else-if="tab === 'odds'" title="獎池與機率">
          <p>{{ poolInfo?.label }}・{{ poolInfo?.count }} 項</p>
          <p>一般抽取</p>
          <div class="gacha-buttons"
            ><UiBadge v-for="r in rarityOdds" :key="r.id" :tone="rarityTone[r.id]"
              >{{ r.label }} {{ r.chance }}</UiBadge
            ><UiButton label="更新機率" icon="refresh" :pending="store.loading" @click="store.load"
          /></div>
          <template v-if="bonusTotal && poolInfo?.bonusWeights">
            <p>加成抽取・距下次加成 {{ untilBonus }} 抽</p>
            <div class="gacha-buttons">
              <UiBadge v-for="r in rarities" :key="r.id" :tone="rarityTone[r.id]">
                {{ r.label }} {{ formatOdds(poolInfo.bonusWeights[r.id], bonusTotal) }}
              </UiBadge>
            </div>
          </template>
          <UiPanel v-if="session.user?.role === 'admin'" title="管理員權重設定">
            <UiNotice :message="store.oddsMessage" :notice-key="store.oddsNotice" persistent />
            <template v-if="store.adminOdds">
              <form
                class="gacha-odds-form"
                @submit.prevent="weightsValid && store.saveOdds({ ...weights })"
              >
                <div class="gacha-odds-fields"
                  ><UiField
                    v-for="r in rarities"
                    :key="r.id"
                    v-model.number="weights[r.id]"
                    :label="r.label + '總權重'"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    :disabled="store.oddsPending"
                    hint="1～1,000,000 整數"
                /></div>
                <p
                  >此卡池儲存後：{{
                    proposedOdds.map((r) => r.label + ' ' + r.chance).join('／')
                  }}</p
                >
                <div class="gacha-buttons"
                  ><UiButton
                    label="重新讀取權重"
                    icon="refresh"
                    :disabled="store.oddsPending"
                    @click="store.loadOdds" /><UiButton
                    label="儲存權重"
                    type="submit"
                    variant="primary"
                    :pending="store.oddsPending"
                    :disabled="!weightsValid || store.pending"
                /></div>
              </form>
            </template>
            <UiButton
              v-else
              label="讀取管理設定"
              :pending="store.oddsPending"
              @click="store.loadOdds"
            />
          </UiPanel>
          <UiList>
            <UiListRow v-for="group in oddsGroups" :key="group.key">
              <div class="gacha-item-versions">
                <div v-for="item in group.versions" :key="item.key" class="gacha-item-version">
                  <div class="gacha-item-copy"
                    ><UiButton
                      class="gacha-exchange-name"
                      :label="'預覽 ' + item.label"
                      :caption="item.label"
                      variant="ghost"
                      @click="previewReward(item, $event)"
                    /><div class="gacha-item-meta">
                      <UiBadge :tone="rarityTone[item.rarity]">{{ item.rarityLabel }}</UiBadge>
                      <span
                        >{{ kindNames[item.kind] }}・重複 +{{ item.duplicateFragments }} 片</span
                      >
                    </div></div
                  >
                  <div class="gacha-item-actions">
                    <UiButton
                      v-if="item.kind === 'sounds' && item.owned"
                      :label="'播放語音 ' + item.label"
                      icon="sound"
                      icon-only
                      @click="playRewardVoice(item)"
                    /><span>{{
                      formatOdds(
                        item.weight,
                        (poolInfo?.totalWeight || 1) * rarityCounts[item.rarity],
                      )
                    }}</span>
                  </div>
                </div>
              </div>
            </UiListRow>
          </UiList>
        </UiPanel>
        <UiPanel v-else title="最近操作紀錄" description="最近 20 次抽取與兌換">
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
    <UiDialog
      ref="exchangePreviewDialog"
      title="獎品預覽"
      class="gacha-result-dialog"
      full-viewport
      title-hidden
      @closing="stopCinematicSound"
      @closed="exchangePreview = null"
    >
      <GachaSpotlight
        v-if="exchangePreview"
        v-bind="exchangePreview"
        :name="drawName"
        :image="drawImage"
        preview
        @close="exchangePreviewDialog?.close()"
        @voice="playRewardVoice"
        @silence="stopCinematicSound"
      />
    </UiDialog>
    <UiDialog
      ref="resultDialog"
      title="召喚結果"
      class="gacha-result-dialog"
      :full-viewport="result?.operation === 'draw'"
      :title-hidden="!!spotlight"
      :dismissible="!store.pending"
      :data-ready-to-reveal="canReveal || canAdvance || undefined"
      @closing="closeResult"
      @closed="result = null"
      @click="onResultClick"
      @keydown.esc.capture="resultEscape"
      @keydown.enter="onResultAdvanceKey"
      @keydown.space="onResultAdvanceKey"
    >
      <template #header-actions>
        <SpectatorRoster
          v-if="spectateId && hostedSpectate?.id === spectateId"
          :names="hostedSpectate.viewerNames"
        />
      </template>
      <UiNotice v-if="spectateError" :message="spectateError" persistent error />
      <div v-if="animating && result?.operation === 'draw'" class="gacha-animation">
        <GachaCinematic
          v-if="!cinematicCancelled"
          :name="drawName"
          :image="drawImage"
          :ending="gachaEnding(result.results)"
          :chart-id="spectateId"
          full-viewport
          @sound="playCinematicSound"
          @complete="finishCinematic"
          @settle="publishSpectate('settle')"
        />
        <UiButton
          v-if="cinematicFinished"
          ref="revealAction"
          label="揭曉獎勵"
          caption="點任意處揭曉獎勵"
          variant="primary"
          :disabled="!canReveal"
          @click.stop="openCardBoard"
        />
        <UiButton v-else label="略過動畫，開始翻牌" @click.stop="showCardBoard" />
      </div>
      <template v-else-if="result?.operation === 'draw'">
        <GachaSpotlight
          v-if="spotlight"
          :item="spotlight.item"
          :area="spotlight.area"
          :attack-id="spotlight.attackId"
          :name="drawName"
          :image="drawImage"
          @close="closeSpotlight"
          @voice="playRewardVoice"
          @silence="stopCinematicSound"
        />
        <div v-show="!spotlight" class="gacha-card-reveal">
          <p
            v-if="revealIndex !== null"
            ref="revealRegion"
            class="gacha-result-summary gacha-card-progress"
            role="status"
            tabindex="-1"
            :aria-keyshortcuts="canAdvance ? 'Enter Space' : undefined"
            >第 {{ revealIndex + 1 }}／{{ result.results.length }} 張<span
              v-if="drawBonus?.position === revealIndex + 1"
              >・第 {{ drawBonus.number }} 抽加成</span
            ></p
          >
          <p v-else ref="resultSummary" class="gacha-result-summary" role="status" tabindex="-1"
            >{{ result.results.length }} 項獎勵・{{ newCount }} 新獲得・{{
              result.results.length - newCount
            }}
            重複・共 +{{ result.fragmentsGained }} 碎片<span v-if="drawBonus"
              >・第 {{ drawBonus.position }} 張為第 {{ drawBonus.number }} 抽加成</span
            ></p
          >
          <div
            ref="cardBoard"
            class="gacha-card-scroll"
            role="region"
            aria-label="獎勵牌陣"
            tabindex="0"
          >
            <div
              v-if="revealIndex !== null && revealItem"
              class="gacha-card-board gacha-card-board-prominent"
            >
              <GachaRewardCard
                :key="revealIndex"
                :number="revealIndex + 1"
                :item="faceUp ? revealItem : undefined"
                :rarity-hint="
                  revealItem.rarity === 'epic' || revealItem.rarity === 'legendary'
                    ? revealItem.rarity
                    : undefined
                "
                :active="cardMotion"
                :motion-enabled="prefs.motion?.enabled !== false && prefs.motion?.reduced !== true"
                prominent
                @play-voice="playRewardVoice"
                @reveal="revealFromCard"
              />
            </div>
            <div
              v-else
              class="gacha-card-board"
              :class="{ 'gacha-card-board-multiple': result.results.length > 1 }"
            >
              <GachaRewardCard
                v-for="(item, index) in result.results"
                :key="index"
                :data-card-index="index"
                :number="index + 1"
                :item="item"
                :compact="result.results.length > 1"
                @play-voice="playRewardVoice"
              />
            </div>
          </div>
          <div
            v-if="revealIndex !== null"
            class="gacha-buttons gacha-reveal-actions gacha-card-next"
          >
            <UiButton
              v-if="faceUp && revealIndex + 1 === result.results.length"
              label="查看抽卡結果"
              variant="primary"
              @click="advanceReveal"
            />
            <UiButton v-else label="略過翻牌" @click="skipReveal" />
          </div>
          <div v-else class="gacha-result-footer">
            <p
              >本次結算餘額：{{ number(result.wallet.coins) }} 聖潔石／{{
                number(result.wallet.fragments)
              }}
              碎片</p
            >
            <div class="gacha-buttons gacha-reveal-actions">
              <template v-if="repeatPool">
                <UiButton
                  label="再單抽 · 100 聖潔石"
                  :disabled="locked || (store.state?.wallet.coins ?? 0) < 100"
                  @click="draw(1, repeatPool)"
                />
                <UiButton
                  label="再十連抽 · 1,000 聖潔石"
                  variant="primary"
                  :disabled="locked || (store.state?.wallet.coins ?? 0) < 1000"
                  @click="draw(10, repeatPool)"
                />
              </template>
              <UiButton
                label="完成"
                :variant="repeatPool ? 'secondary' : 'primary'"
                :disabled="store.pending"
                @click="resultDialog?.close()"
              />
              <UiLink href="/profile" label="前往形象設定" />
            </div>
            <UiNotice
              v-if="repeatPool && store.message"
              :message="store.message"
              :notice-key="store.notice"
              :persistent="!!store.unsettled"
              error
            />
            <UiButton
              v-if="repeatPool && store.unsettled"
              label="確認上次結果"
              :pending="store.pending"
              @click="recover"
            />
          </div>
        </div>
      </template>
      <template v-else-if="result">
        <UiHeading :level="2">{{ result.item.label }}</UiHeading>
        <p>已加入帳號收藏。</p>
        <p
          >本次結算餘額：{{ number(result.wallet.coins) }} 聖潔石／{{
            number(result.wallet.fragments)
          }}
          碎片</p
        >
        <div class="gacha-buttons">
          <UiButton
            v-if="result.item.kind === 'sounds'"
            :label="'播放語音 ' + result.item.label"
            caption="播放語音"
            icon="sound"
            @click="playRewardVoice(result.item)"
          />
          <UiButton label="完成" variant="primary" @click="resultDialog?.close()" />
          <UiLink href="/profile" label="前往形象設定" />
        </div>
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
.gacha-filters {
  display: flex;
  align-items: center;
  gap: var(--stitch-gap-controls);
  flex-wrap: wrap;
}
.gacha-heading {
  justify-content: space-between;
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
.gacha-income {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  column-gap: var(--stitch-space-8);
  inline-size: 100%;
}
.gacha-income > * {
  white-space: nowrap;
}
.gacha-income-notes {
  display: grid;
  gap: var(--stitch-space-8);
}
.gacha-income-notes p,
.gacha-income-notes ul {
  margin: 0;
}
.gacha-income-notes ul {
  padding-inline-start: var(--stitch-space-16);
}
.gacha-pool-name {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
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
.gacha-mobile-rules {
  display: none;
}
.gacha-draw-controls {
  display: grid;
  gap: var(--stitch-gap-controls);
  margin-block-start: var(--stitch-space-24);
}
.gacha-note {
  font-size: var(--stitch-text-hint);
  color: var(--stitch-muted);
}
.gacha-filters {
  margin-block-end: var(--stitch-space-20);
}
.gacha-item-versions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: var(--stitch-gap-controls);
  inline-size: 100%;
}
.gacha-item-version,
.gacha-item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-space-8);
}
.gacha-item-actions {
  margin-inline-start: auto;
}
.gacha-item-copy {
  display: grid;
  gap: var(--stitch-space-4);
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.gacha-item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-space-8);
}
.gacha-item-copy > span,
.gacha-item-meta > span:not(.ui-stitch-badge) {
  font-size: var(--stitch-text-hint);
  color: var(--stitch-muted);
}
.gacha-exchange-name {
  justify-self: start;
  max-inline-size: 100%;
  text-align: start;
}
.gacha-content :deep(.ui-stitch-list-row) {
  flex-wrap: wrap;
  gap: var(--stitch-gap-controls);
}
.gacha-animation {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-columns: minmax(0, 1fr);
  block-size: 100%;
  gap: var(--stitch-gap-controls);
}
.gacha-animation > :only-child {
  grid-row: 2;
}
.gacha-card-reveal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  block-size: 100%;
  gap: var(--stitch-gap-controls);
}
.gacha-card-scroll {
  min-block-size: 0;
  min-inline-size: 0;
  overflow: auto;
}
.gacha-card-board {
  display: grid;
  inline-size: max-content;
  grid-template-columns: minmax(0, 15rem);
  margin-inline: auto;
  padding: var(--stitch-space-8);
  gap: var(--stitch-space-12);
}
.gacha-card-board-prominent {
  box-sizing: border-box;
  inline-size: min(100%, 31rem);
  grid-template-columns: minmax(0, 1fr);
  min-block-size: 100%;
  align-content: center;
  padding: var(--stitch-space-24);
}
.gacha-card-board-multiple {
  box-sizing: border-box;
  inline-size: 100%;
  max-inline-size: 90rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  padding: var(--stitch-space-16);
  gap: var(--stitch-space-20);
}
@media (max-width: 979px) {
  .gacha-card-board-multiple {
    max-inline-size: 48rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-inline: var(--stitch-space-8);
    gap: var(--stitch-space-12);
  }
}
@media (max-width: 600px) {
  .gacha-card-board-multiple {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.gacha-reveal-actions {
  justify-content: center;
}
.gacha-card-next {
  min-block-size: var(--stitch-control-height);
}
.gacha-card-progress {
  text-align: center;
}
.gacha-result-footer {
  display: grid;
  gap: var(--stitch-space-4);
  text-align: center;
}
.gacha-result-footer p {
  margin: 0;
}
.gacha-result-dialog {
  inline-size: min(64rem, calc(100vw - var(--stitch-space-32)));
  max-inline-size: calc(100vw - var(--stitch-space-32));
}
.gacha-result-dialog :deep(.vue-dialog-content) {
  block-size: min(40rem, 70dvh);
  overflow-y: auto;
}
.gacha-result-dialog.vue-dialog-full-viewport :deep(.vue-dialog-content) {
  block-size: auto;
  overflow: hidden;
  scrollbar-gutter: auto;
}
.gacha-result-dialog[data-ready-to-reveal] {
  cursor: pointer;
}
.gacha-odds-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--stitch-gap-controls);
}
.gacha-odds-form {
  display: grid;
  gap: var(--stitch-gap-controls);
}
.gacha-result-summary {
  margin: 0;
  font-weight: 700;
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
    display: grid;
  }
}
</style>
