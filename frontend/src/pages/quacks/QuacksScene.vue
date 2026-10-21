<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import { useAchievementsStore } from '../../stores/achievements';
import QuacksPlay from './QuacksPlay.vue';
import QuacksWaitingHero from './QuacksWaitingHero.vue';
import QuacksPot from './QuacksPot.vue';
import QuacksCommands from './QuacksCommands.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import QuacksBag from './QuacksBag.vue';
import QuacksBooks from './QuacksBooks.vue';
import QuacksScoreboard from './QuacksScoreboard.vue';
import QuacksRecords from './QuacksRecords.vue';
import QuacksAlchemy from './QuacksAlchemy.vue';
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
  achievementNotice = ref('');
let disposed = false,
  known: Set<string> | null = null;
const tabs = {
    books: '藥材寶典',
    score: '環形記分板',
    fortune: '本輪占卜牌',
    witches: '草藥女巫',
    alchemy: '煉金術士',
    records: '回合紀錄',
    pot: '大釜設定',
  },
  title = computed(() => tabs[tab.value as keyof typeof tabs] || '更多工具'),
  own = computed(() => game.own),
  mine = computed(() => game.mine),
  state = computed(() => game.state!);
const viewed = computed(() => game.viewed),
  isOwnPot = computed(() => viewed.value?.id === state.value.me),
  boardVisible = computed(
    () => ['brewing', 'settlement'].includes(state.value.phase) && !!viewed.value,
  ),
  complex = computed(
    () =>
      state.value.phase !== 'brewing' ||
      state.value.stage !== 'drawing' ||
      !!mine.value?.pending ||
      !!mine.value?.waitingEffect ||
      !!mine.value?.reserve.length ||
      !!mine.value?.alchemy?.drawablePool.length ||
      !!mine.value?.alchemy?.returnable.length,
  );
defineExpose({ open });
function open(key: string) {
  tab.value = key in tabs ? key : 'overview';
  if (key === 'books') emit('books-opened');
  void tools.value?.open();
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
});
</script>
<template>
  <section
    class="vue-game-panel vue-quacks-stage"
    :class="{ 'is-waiting': state.phase === 'waiting', 'has-board': boardVisible }"
  >
    <section v-if="state.phase === 'waiting'" class="vue-quacks-waiting" aria-label="組隊房間介紹">
      <QuacksWaitingHero />
      <div id="quacks-setup-slot" class="vue-quacks-setup-slot"></div>
      <div class="vue-quacks-rq03-book-entry"
        ><UiButton
          stitch
          variant="secondary"
          icon="book"
          label="搭配本局藥材書"
          @click="open('books')"
      /></div>
    </section>
    <template v-else>
      <header class="vue-quacks-scene-header vue-quacks-scene-header-rq"
        ><div
          ><h1>{{ viewed?.potName || '郎中闖江湖' }}</h1
          ><p>{{
            isOwnPot
              ? '查看自己的大釜與資源'
              : '查看 ' + (viewed?.name || '玩家') + ' 的公開大釜與資源'
          }}</p></div
        ><label class="vue-quacks-view-select"
          ><span class="vue-quacks-sr-only">切換查看的大釜</span
          ><select v-model="game.selectedPot" aria-label="切換查看的大釜"
            ><option
              v-for="person in state.recipes"
              :key="person.id"
              :value="person.id"
              :disabled="person.hidden && person.id !== state.me"
              >{{ person.name
              }}{{ person.id === state.me ? '（你）' : person.hidden ? ' · 未公開' : '' }}</option
            ></select
          ></label
        ></header
      >
      <div v-if="viewed" class="vue-quacks-resource-strip" aria-label="目前大釜與資源"
        ><span class="vue-quacks-white-count"
          >白色炸彈
          {{
            viewed.hidden ? '未公開' : (viewed.white ?? 0) + '／' + (viewed.threshold ?? 7)
          }}</span
        ><span>位置 {{ viewed.hidden ? '未公開' : (viewed.position ?? 0) }}</span
        ><span>水滴 {{ viewed.droplet }}</span
        ><span>鼠尾 {{ viewed.rat }}</span
        ><span :data-quacks-ruby="viewed.id"
          ><QuacksGlyph resource="ruby" :size="18" />紅寶石 {{ viewed.rubies }}</span
        ><span>藥袋 {{ viewed.bagCount }}</span
        ><span v-if="isOwnPot">瓶：{{ mine?.potion ? '滿' : '空' }}</span></div
      >
      <div class="vue-quacks-fortune-strip"
        ><strong>本輪占卜牌</strong><span>{{ state.fortune?.name || '尚未抽牌' }}</span></div
      >
      <div
        class="vue-quacks-board-space"
        :class="{ 'has-overlay': complex, 'is-shopping': state.stage === 'shopping' }"
      >
        <QuacksPot
          v-if="boardVisible && viewed && !viewed.hidden"
          :state="state"
          :recipe="viewed"
        />
        <p v-else-if="viewed?.hidden" class="vue-quacks-hidden-pot">這位玩家的大釜尚未公開。</p>
        <div v-show="(isOwnPot && complex) || !boardVisible" class="vue-quacks-stage-overlay"
          ><QuacksPlay overlay
        /></div>
        <UiButton
          v-if="boardVisible && isOwnPot"
          class="vue-quacks-pot-customize"
          stitch
          variant="ghost"
          icon="settings"
          icon-only
          label="大釜命名與換色"
          @click="open('pot')"
        />
      </div>
      <footer class="vue-quacks-control-deck"
        ><nav class="vue-quacks-stage-shortcuts" aria-label="大釜工具"
          ><QuacksBag /><UiButton
            stitch
            variant="secondary"
            icon="settings"
            label="更多工具"
            @click="open('overview')"
        /></nav>
        <QuacksCommands v-if="isOwnPot || !boardVisible" /><UiButton
          v-else
          stitch
          variant="secondary"
          icon="previous"
          label="返回自己的大釜繼續操作"
          @click="game.selectedPot = state.me"
        />
        <div class="vue-quacks-feedback"
          ><StatusSlot
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
    stitch
    class="vue-quacks-tools-dialog"
    :data-quacks-tool="tab"
    ><nav v-if="tab === 'overview'" class="vue-quacks-tools-overview" aria-label="更多工具"
      ><UiButton
        v-for="(label, key) in tabs"
        :key="key"
        stitch
        variant="secondary"
        :label="label"
        :disabled="
          (key === 'alchemy' && !state.options.alchemists) ||
          (key === 'witches' && !state.options.witches && !state.visitingWitch)
        "
        @click="open(key)" /></nav
    ><UiButton
      v-if="['witches', 'alchemy', 'records', 'pot'].includes(tab)"
      class="vue-quacks-tools-back"
      stitch
      variant="ghost"
      icon="previous"
      label="返回更多工具"
      @click="tab = 'overview'" />
    <QuacksBooks v-if="tab === 'books'" /><QuacksScoreboard
      v-else-if="tab === 'score'" /><QuacksRecords v-else-if="tab === 'records'" /><QuacksWitches
      v-else-if="tab === 'witches'" /><QuacksAlchemy v-else-if="tab === 'alchemy'" /><section
      v-else-if="tab === 'fortune'"
      class="vue-quacks-fortune-card"
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
        stitch
        variant="secondary"
      /><h2>大釜顏色（同桌不能重複）</h2
      ><div class="vue-quacks-choice-grid"
        ><button
          v-for="(theme, color) in state.potColors"
          :key="color"
          type="button"
          :style="{ '--pot-color': theme.liquid[1] }"
          :aria-pressed="own?.potColor === color"
          :disabled="
            !game.available || state.recipes.some((p) => p.id !== state.me && p.potColor === color)
          "
          @click="game.command('color-pot', { color })"
          >{{ theme.name
          }}{{
            state.recipes.some((p) => p.id !== state.me && p.potColor === color) ? ' · 使用中' : ''
          }}</button
        ></div
      ></section
    ><StatusSlot :message="game.notice" :error="!!game.notice && !game.pending" /></UiDialog
  ><QuacksEffects />
</template>
