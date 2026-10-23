<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import { useAchievementsStore } from '../../stores/achievements';
import QuacksPlay from './QuacksPlay.vue';
import QuacksReserves from './QuacksReserves.vue';
import QuacksWaitingHero from './QuacksWaitingHero.vue';
import QuacksPot from './QuacksPot.vue';
import QuacksCommands from './QuacksCommands.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import QuacksBag from './QuacksBag.vue';
import QuacksBooks from './QuacksBooks.vue';
import QuacksScoreboard from './QuacksScoreboard.vue';
import QuacksAlchemy from './QuacksAlchemy.vue';
import QuacksFlask from './QuacksFlask.vue';
import QuacksWitches from './QuacksWitches.vue';
import QuacksEffects from './QuacksEffects.vue';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const emit = defineEmits<{ 'books-opened': [] }>();
const game = useQuacksStore(),
  room = useRoomStore(),
  achievements = useAchievementsStore(),
  tools = ref<InstanceType<typeof UiDialog> | null>(null),
  tab = ref('books'),
  alchemyInspection = ref<string | null>(null),
  achievementNotice = ref('');
let disposed = false,
  known: Set<string> | null = null;
const tabs = {
    books: '本局藥材',
    score: '環形記分板',
    fortune: '本輪占卜牌',
    witches: '草藥女巫',
    alchemy: '煉金術士',
    pot: '大釜設定',
  },
  title = computed(() => tabs[tab.value as keyof typeof tabs] || '遊戲工具'),
  own = computed(() => game.own),
  mine = computed(() => game.mine),
  state = computed(() => game.state!);
const viewedPatient = computed(() =>
  state.value.patients.find((p) => p.id === game.viewed?.alchemy?.patientId),
);
const patientEstimate = computed(() =>
  state.value.phase === 'brewing'
    ? (game.viewed?.alchemy?.stopEstimate ?? null)
    : (game.viewed?.alchemy?.essence ?? null),
);
const inspectedRecipe = computed(() =>
  state.value.recipes.find((p) => p.id === alchemyInspection.value),
);
const inspectedPatient = computed(() =>
  state.value.patients.find((p) => p.id === inspectedRecipe.value?.alchemy?.patientId),
);
// A fresh fortune flips in place on the draw stage for everyone before play resumes.
const revealing = ref(false);
let revealTimer: ReturnType<typeof setTimeout> | undefined, knownReveal: string | null | undefined;
watch(
  () => [state.value?.code, state.value?.fortuneRevealId] as const,
  ([code, id], previous) => {
    if (knownReveal === undefined || code !== previous?.[0]) {
      knownReveal = id ?? null;
      return;
    }
    if (!id || id === knownReveal) return;
    knownReveal = id;
    revealing.value = true;
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => (revealing.value = false), 3600);
  },
  { immediate: true },
);
// The roster selects accepted public recipes; all private actions remain on the own pot.
const potPeek = ref(false),
  actionsOpen = ref(false);
// Optional chip actions (reserve, pre-drawn, returnable) live behind a dock badge.
const chipActions = computed(() => {
  const m = mine.value,
    s = state.value;
  if (!m) return 0;
  const redBook = (s.options.books?.red ?? s.options.bookSet) === 2;
  return (
    m.reserve.length +
    (m.canDraw ? m.alchemy?.drawablePool.length || 0 : 0) +
    (s.stage === 'reserves'
      ? (m.alchemy?.pool || []).filter((c) => c.color === 'red' && redBook).length
      : 0) +
    (m.alchemy?.returnable.length || 0)
  );
});
watch(chipActions, (n) => {
  if (!n) actionsOpen.value = false;
});
// Key on a string: every poll builds a new snapshot, and a fresh array would reset the peek.
watch(
  () =>
    [state.value?.phase, state.value?.stage, mine.value?.pending?.id, state.value?.roundId].join(
      '|',
    ),
  () => {
    potPeek.value = false;
    actionsOpen.value = false;
  },
);
const viewed = computed(() => game.viewed),
  isOwnPot = computed(() => viewed.value?.id === state.value.me),
  boardVisible = computed(
    () =>
      !revealing.value &&
      !actionsOpen.value &&
      ['brewing', 'settlement'].includes(state.value.phase) &&
      (!isOwnPot.value || !complex.value || potPeek.value) &&
      !!viewed.value,
  ),
  // Choice and settlement screens cover the own pot; this lets the player flip back to it.
  canPeekPot = computed(
    () =>
      !revealing.value &&
      ['brewing', 'settlement'].includes(state.value.phase) &&
      isOwnPot.value &&
      complex.value &&
      !!viewed.value &&
      !viewed.value.hidden,
  ),
  complex = computed(
    () =>
      state.value.phase !== 'brewing' ||
      !['drawing', 'reserves'].includes(state.value.stage || '') ||
      !!mine.value?.pending ||
      !!mine.value?.waitingEffect,
  );

defineExpose({ open });
function open(key: string) {
  alchemyInspection.value = null;
  tab.value = key;
  if (key === 'books') emit('books-opened');
  void tools.value?.open();
}
function openPatient() {
  const id = game.viewed?.id;
  if (!id || !viewedPatient.value) return;
  open('alchemy');
  alchemyInspection.value = id;
}
async function checkAchievements() {
  await achievements.load();
  if (disposed || !achievements.loaded) return;
  const unlocked = achievements.items.filter((a) => a.unlockedAt);
  if (known) {
    const fresh = unlocked.filter((a) => !known!.has(a.id));
    if (fresh.length) achievementNotice.value = '解鎖成就：' + fresh.map((a) => a.title).join('、');
  }
  known = new Set(unlocked.map((a) => a.id));
}
onMounted(() => void checkAchievements());
watch(
  () => state.value?.phase,
  (phase, old) => {
    if (phase === 'finished' && old && old !== 'waiting') void checkAchievements();
  },
);
watch(
  () => room.scope,
  () => {
    tools.value?.close();
    achievementNotice.value = '';
  },
);
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(revealTimer);
});
</script>
<template>
  <section
    class="vue-game-panel vue-quacks-stage"
    :class="{ 'is-waiting': state.phase === 'waiting', 'has-board': boardVisible }"
  >
    <section v-if="state.phase === 'waiting'" class="vue-quacks-waiting-layout">
      <div class="vue-quacks-waiting-game">
        <h1>郎中闖江湖</h1>
        <QuacksWaitingHero art-only />
      </div>
      <section class="vue-waiting-settings" aria-label="房間設定">
        <h2>房間設定</h2>
        <div id="room-waiting-settings-quacks" class="vue-waiting-settings-target"></div>
      </section>
    </section>
    <template v-else>
      <div
        class="vue-quacks-board-space"
        :class="{
          'has-overlay': complex && !potPeek,
          'is-shopping': state.stage === 'shopping',
          'is-phase-view': !boardVisible,
        }"
      >
        <QuacksPot
          v-if="boardVisible && viewed && !viewed.hidden"
          :state="state"
          :recipe="viewed"
        />
        <p v-else-if="viewed?.hidden" class="vue-quacks-hidden-pot">這位玩家的大釜尚未公開。</p>
        <div
          v-if="boardVisible && viewed"
          class="vue-quacks-pot-caption"
          :aria-label="'目前大釜：' + viewed.name"
          ><div class="vue-quacks-pot-heading">
            <h1>{{ viewed.potName }}</h1>
            <UiButton
              class="vue-quacks-info-button"
              variant="ghost"
              icon="info"
              icon-only
              label="遊戲資訊：占卜、女巫、特效藥、記分板與大釜設定"
              @click="open('fortune')"
            />
          </div>
          <div class="vue-quacks-pot-markers">
            <span><QuacksGlyph resource="droplet" :size="16" />水滴 {{ viewed.droplet }}</span>
            <span><QuacksGlyph resource="rat" :size="16" />起點 {{ viewed.startPosition }}</span>
            <span>當前 {{ viewed.position }}</span>
            <span><QuacksGlyph resource="ruby" :size="16" />紅寶石 {{ viewed.rubies }}</span>
          </div>
          <button
            v-if="state.fortune"
            type="button"
            class="vue-quacks-current-fortune"
            data-ui-hint
            :data-timing="state.fortune.timing"
            :aria-label="state.fortune.name + '：' + state.fortune.text"
            @click="open('fortune')"
            >{{ state.fortune.name }}</button
          >
        </div>
        <div v-if="boardVisible" class="vue-quacks-pot-dock" aria-label="藥水瓶與藥袋">
          <button
            v-if="isOwnPot && chipActions"
            type="button"
            class="vue-quacks-chip-actions-button"
            :aria-label="'藥材操作，' + chipActions + ' 項可操作'"
            data-ui-hint
            :title="'藥材操作（' + chipActions + '）：暫存、預抽與收回藥材'"
            @click="actionsOpen = true"
            ><QuacksGlyph resource="draw-hand" :size="42" /><span>操作</span
            ><strong class="vue-quacks-action-badge" aria-hidden="true">{{
              chipActions
            }}</strong></button
          >
          <button
            v-if="isOwnPot"
            data-quacks-potion
            type="button"
            data-ui-hint
            :title="
              mine?.potion
                ? '滿瓶：未爆炸且最後抽到白色炸彈時，可把它放回藥袋；用後變空瓶。'
                : '空瓶：購物階段花紅寶石補滿後，下一輪才能再用。'
            "
            :disabled="!game.available || !mine?.canPotion"
            :aria-label="
              mine?.canPotion
                ? '使用藥水瓶：收回最後白色炸彈'
                : mine?.potion
                  ? '藥水瓶已裝滿，目前不能使用'
                  : '藥水瓶是空瓶'
            "
            @click="game.command('potion')"
            ><QuacksGlyph resource="potion" :size="42" /><span>{{
              mine?.potion ? '滿瓶' : '空瓶'
            }}</span></button
          >
          <button
            v-if="viewedPatient"
            type="button"
            class="vue-quacks-patient-badge"
            data-ui-hint
            :title="
              viewedPatient.name +
              '：' +
              viewedPatient.text +
              (state.phase === 'brewing'
                ? '\n現在停手預估 ' +
                  (patientEstimate ?? '未知') +
                  ' 格；按目前狀態計算，鄰座後續爆鍋或其他效果仍會更新。'
                : '')
            "
            :aria-label="
              '開啟' +
              viewedPatient.name +
              '的特效藥' +
              (patientEstimate !== null
                ? '；' +
                  (state.phase === 'brewing' ? '現在停手預估 ' : '特效藥 ') +
                  patientEstimate +
                  ' 格'
                : '')
            "
            @click="openPatient()"
            ><span aria-hidden="true" inert
              ><QuacksGlyph :patient="viewedPatient.id" :size="64" /></span
            ><strong class="vue-quacks-patient-estimate"
              >{{ patientEstimate ?? '—'
              }}<small v-if="patientEstimate !== null"> 格</small></strong
            ></button
          >
        </div>
        <div
          v-if="!boardVisible"
          class="vue-quacks-stage-overlay"
          :class="{
            'is-distilling': state.stage === 'essence' && !mine?.pending && !mine?.waitingEffect,
          }"
          ><QuacksReserves v-if="actionsOpen" /><QuacksPlay v-else overlay :revealing="revealing"
        /></div>
        <UiButton
          v-if="actionsOpen"
          class="vue-quacks-pot-peek is-edge"
          variant="secondary"
          icon="previous"
          label="返回大釜"
          @click="actionsOpen = false"
        />
        <UiButton
          v-else-if="canPeekPot"
          class="vue-quacks-pot-peek"
          :class="{ 'is-edge': boardVisible }"
          variant="secondary"
          :icon="potPeek ? 'previous' : 'eye'"
          :label="potPeek ? (mine?.pending ? '返回選擇' : '返回結算') : '查看大釜'"
          @click="potPeek = !potPeek"
        />
        <UiButton
          v-if="!boardVisible && !actionsOpen"
          class="vue-quacks-board-settings"
          variant="ghost"
          icon="info"
          icon-only
          label="遊戲資訊：占卜、女巫、特效藥、記分板與大釜設定"
          @click="open('fortune')"
        />
        <div class="vue-quacks-board-controls" :class="{ 'is-phase-controls': !boardVisible }">
          <div
            v-if="boardVisible"
            class="vue-quacks-risk"
            :class="{ 'is-critical': !viewed?.exploded && viewed?.white === viewed?.threshold }"
            ><span>白色炸彈</span
            ><strong>{{ viewed?.white ?? 0 }}／{{ viewed?.threshold ?? 7 }}</strong
            ><div
              v-if="isOwnPot && (state.options.witches || state.visitingWitch)"
              class="vue-quacks-witch-coins"
              aria-label="女巫幣"
              ><template v-for="color in ['gold', 'copper', 'silver'] as const" :key="color"
                ><button
                  v-if="state.witches[color]"
                  type="button"
                  class="vue-quacks-witch-coin"
                  :class="{
                    'is-used': !mine?.coins[color],
                    'is-ready': game.available && mine?.witchAvailable[color],
                  }"
                  :disabled="!game.available || !mine?.witchAvailable[color]"
                  :aria-label="
                    '使用' +
                    state.witches[color]!.name +
                    '：' +
                    state.witches[color]!.text +
                    (mine?.coins[color] ? '' : '（已使用）')
                  "
                  data-ui-hint
                  :title="
                    state.witches[color]!.name +
                    (mine?.coins[color]
                      ? mine?.witchAvailable[color]
                        ? '（可使用）'
                        : '（目前條件不符）'
                      : '（已使用）') +
                    '：' +
                    state.witches[color]!.text
                  "
                  @click="game.command('witch', { color })"
                  ><QuacksGlyph :resource="color" :size="32" /></button></template
              ><button
                v-if="state.fortune?.id === 'witch-visit' && state.visitingWitch"
                type="button"
                class="vue-quacks-witch-coin is-visitor"
                data-ui-hint
                :title="'免費來訪 · ' + state.visitingWitch.name + '：' + state.visitingWitch.text"
                :aria-label="'查看免費來訪女巫：' + state.visitingWitch.name"
                @click="open('witches')"
                >免</button
              ></div
            ></div
          >
          <QuacksBag v-if="boardVisible && isOwnPot" />
          <QuacksCommands v-if="(isOwnPot || !boardVisible) && !actionsOpen" />
          <UiButton
            v-else-if="!actionsOpen"
            icon="previous"
            label="返回我的大釜"
            @click="game.selectedPot = state.me"
          />
        </div>
      </div>
      <footer class="vue-quacks-control-deck">
        <div class="vue-quacks-feedback"
          ><StatusSlot
            :persistent="game.pending || game.canRetry"
            :message="game.notice || achievementNotice || (game.pending ? '正在送出…' : '')"
            :error="!!game.notice && !game.pending"
          /><a v-if="achievementNotice" href="/achievements">查看收藏冊</a></div
        >
      </footer>
    </template>
  </section>
  <UiDialog
    ref="tools"
    :title="title"
    :class="{
      'vue-quacks-codex-dialog': tab === 'books' && game.setup,
      'vue-quacks-tools-dialog': !game.setup,
    }"
    ><nav v-if="tab !== 'books' || !game.setup" class="vue-quacks-tabs" aria-label="遊戲工具"
      ><button
        v-for="(label, key) in tabs"
        :key="key"
        type="button"
        :aria-pressed="tab === key"
        :disabled="
          (key === 'alchemy' && !state.options.alchemists) ||
          (key === 'witches' && !state.options.witches && !state.visitingWitch)
        "
        @click="
          tab = key;
          alchemyInspection = null;
        "
        >{{ label }}</button
      ></nav
    ><QuacksBooks v-if="tab === 'books'" :current-only="!game.setup" /><QuacksScoreboard
      v-else-if="tab === 'score'" /><QuacksWitches v-else-if="tab === 'witches'" />
    <section
      v-else-if="
        tab === 'alchemy' && inspectedRecipe && inspectedRecipe.id !== state.me && inspectedPatient
      "
      :aria-label="inspectedRecipe.name + '的特效藥'"
    >
      <QuacksFlask
        :patient="inspectedPatient"
        :value="inspectedRecipe.alchemy?.essence || 0"
        :calculation="inspectedRecipe.alchemy?.calculation"
        :tone="state.potColors[inspectedRecipe.potColor]?.liquid[1]"
        :final="state.round === 9"
      /> </section
    ><QuacksAlchemy v-else-if="tab === 'alchemy'" /><section
      v-else-if="tab === 'fortune'"
      class="vue-quacks-fortune-card"
      :data-timing="state.fortune?.timing"
      ><h2>{{ state.fortune?.name || '尚未抽牌' }}</h2
      ><p>{{ state.fortune?.text || '每輪由起始玩家親自點擊抽牌。' }}</p
      ><p v-if="state.fortune">{{
        state.fortune.timing === 'immediate' ? '立即生效' : '本回合生效'
      }}</p
      ><h3>本輪公開擲骰</h3><p v-if="!state.rollEvents.length">尚無擲骰紀錄。</p
      ><p v-for="event in state.rollEvents" :key="event.id"
        >{{ event.name }} ·
        {{ ['1分', '1分', '2分', '紅寶石1', '水滴前進1', '南瓜1'][event.face] }} ·
        {{ event.source }}</p
      ></section
    ><section v-else-if="tab === 'pot'" class="vue-quacks-customize"
      ><label
        >你的大釜名稱（1–24 字）<input
          v-model="game.nameDraft"
          maxlength="48"
          :disabled="!game.available" /></label
      ><UiButton
        icon="save"
        label="儲存大釜名稱"
        :disabled="!game.available"
        @click="game.setName()"
      /><h2>大釜顏色（同桌不能重複）</h2
      ><div class="vue-quacks-choice-grid"
        ><button
          v-for="(theme, color) in state.potColors"
          :key="color"
          type="button"
          :style="{
            '--pot-color': theme.liquid[1],
            '--pot-light': theme.liquid[0],
            '--pot-dark': theme.liquid[2],
          }"
          class="vue-quacks-color-choice"
          :aria-pressed="own?.potColor === color"
          :disabled="
            !game.available || state.recipes.some((p) => p.id !== state.me && p.potColor === color)
          "
          @click="game.command('color-pot', { color })"
          ><span class="vue-quacks-color-swatch" aria-hidden="true"></span>{{ theme.name
          }}{{
            state.recipes.some((p) => p.id !== state.me && p.potColor === color) ? ' · 使用中' : ''
          }}</button
        ></div
      ></section
    ><StatusSlot
      :persistent="game.pending || game.canRetry"
      :message="game.notice"
      :error="!!game.notice && !game.pending" /></UiDialog
  ><QuacksEffects />
</template>
