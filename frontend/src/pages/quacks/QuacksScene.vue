<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import { useAchievementsStore } from '../../stores/achievements';
import QuacksPlay from './QuacksPlay.vue';
import QuacksPot from './QuacksPot.vue';
import QuacksCommands from './QuacksCommands.vue';
import QuacksGlyph from './QuacksGlyph.vue';
import QuacksBag from './QuacksBag.vue';
import QuacksBooks from './QuacksBooks.vue';
import QuacksScoreboard from './QuacksScoreboard.vue';
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
    pot: '大釜設定',
  },
  title = computed(() => tabs[tab.value as keyof typeof tabs] || '遊戲工具'),
  own = computed(() => game.own),
  mine = computed(() => game.mine),
  state = computed(() => game.state!);
const viewedPatient = computed(() =>
  state.value.patients.find((p) => p.id === game.viewed?.alchemy?.patientId),
);
const inspecting = ref(false);
const viewed = computed(() => game.viewed),
  isOwnPot = computed(() => viewed.value?.id === state.value.me),
  boardVisible = computed(
    () =>
      (inspecting.value ||
        (['brewing', 'settlement'].includes(state.value.phase) && !complex.value)) &&
      !!viewed.value,
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
  tab.value = key;
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
      <div class="vue-quacks-ready" role="status"
        ><strong>{{
          state.players.length >= 2 ? '人數達標，房主可隨時開始' : '入座成功，等朋友一起開桌'
        }}</strong
        ><span>目前 {{ state.players.length }} 人已入座，藥袋與大釜已備妥</span></div
      >
      <div class="vue-quacks-waiting-hero"
        ><span>CLASSIC MODE · 2–8 人一起煮藥</span
        ><img src="/assets/playful/game-quacks.svg" alt="郎中闖江湖遊戲插畫" /><h1
          >郎中闖江湖 <small>Quacks</small></h1
        ><p>朋友集結中，藥袋已備，等房主開釜。</p
        ><p>九回合同步抽藥，逐色共選本局藥材效果。可加入草藥女巫與煉金術士。</p
        ><UiButton
          stitch
          variant="secondary"
          icon="book"
          label="搭配本局藥材書"
          @click="open('books')"
        /><div class="vue-quacks-waiting-facts"
          ><span>全員一起抽<br />同步煮藥</span><span>9 回合累計<br />對局回合</span
          ><span>逐色共選效果<br />本局藥材</span></div
        ></div
      >
    </section>
    <template v-else>
      <header class="vue-quacks-scene-header"
        ><nav class="vue-quacks-pot-tabs" aria-label="切換大釜">
          <button
            v-for="person in state.recipes"
            :key="person.id"
            type="button"
            :aria-pressed="game.viewed?.id === person.id"
            :disabled="person.hidden && person.id !== state.me"
            @click="
              game.selectedPot = person.id;
              inspecting = true;
            "
            >{{ person.name
            }}{{ person.id === state.me ? '（你）' : person.hidden ? ' · 未公開' : '' }}</button
          > </nav
        ><button
          v-if="state.fortune"
          type="button"
          class="vue-quacks-current-fortune"
          :data-timing="state.fortune.timing"
          :aria-label="state.fortune.name + '：' + state.fortune.text"
          data-ui-hint
          @click="open('fortune')"
          ><strong>{{ state.fortune.name }}</strong></button
        ><div class="vue-quacks-scene-tools"
          ><UiButton
            stitch
            variant="ghost"
            icon-only
            label="檢視目前大釜"
            :aria-pressed="inspecting"
            @click="inspecting = true"
            ><template #icon
              ><svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                aria-hidden="true"
              >
                <path
                  d="M5 9h14l-1.5 10h-11L5 9ZM5 11H2v4h4m13-4h3v4h-4M9 6V3m6 3V3M4 21h16"
                /></svg></template></UiButton
          ><UiButton
            :disabled="!inspecting"
            stitch
            variant="ghost"
            icon="previous"
            icon-only
            label="返回目前階段"
            @click="inspecting = false" /><UiButton
            stitch
            variant="ghost"
            icon="settings"
            icon-only
            label="占卜、女巫、特效藥與大釜設定"
            @click="open('fortune')" /></div
      ></header>
      <div
        class="vue-quacks-board-space"
        :class="{
          'has-overlay': !inspecting && complex,
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
          ><div class="vue-quacks-pot-markers"
            ><span><QuacksGlyph resource="droplet" :size="16" />水滴 {{ viewed.droplet }}</span
            ><span
              ><QuacksGlyph resource="rat" :size="16" />起點
              {{ viewed.hidden ? '未公開' : viewed.startPosition }}</span
            ><span>當前 {{ viewed.hidden ? '未公開' : viewed.position }}</span></div
          ><h1>{{ viewed.potName }}</h1
          ><div v-if="!viewed.hidden" class="vue-quacks-viewed-resources"
            ><span data-quacks-ruby
              ><QuacksGlyph resource="ruby" :size="18" />{{ viewed.rubies }}</span
            ><span>藥袋 {{ viewed.bagCount }}</span
            ><span>分數 {{ viewed.score }}</span
            ><span>炸彈 {{ viewed.white }}／{{ viewed.threshold }}</span></div
          ></div
        >
        <div v-if="boardVisible" class="vue-quacks-pot-dock" aria-label="藥水瓶與藥袋">
          <button
            v-if="isOwnPot"
            data-quacks-potion
            type="button"
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
          <QuacksBag /><span
            v-if="viewedPatient"
            class="vue-quacks-patient-badge"
            data-ui-hint
            :title="viewedPatient.name + '：' + viewedPatient.text"
            :aria-label="viewedPatient.name + '：' + viewedPatient.text"
            tabindex="0"
            ><QuacksGlyph :patient="viewedPatient.id" :size="64"
          /></span>
        </div>
        <div
          v-show="!inspecting && ((isOwnPot && complex) || !boardVisible)"
          class="vue-quacks-stage-overlay"
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
        ><div
          class="vue-quacks-risk"
          :class="{ 'is-critical': !own?.exploded && own?.white === own?.threshold }"
          ><span>{{ isOwnPot ? '白色炸彈' : '你的白色炸彈' }}</span
          ><strong>{{ own?.white ?? 0 }}／{{ own?.threshold ?? 7 }}</strong
          ><span>（超過 {{ own?.threshold ?? 7 }} 爆炸）</span
          ><div
            v-if="isOwnPot && (state.options.witches || state.visitingWitch)"
            class="vue-quacks-witch-coins"
            aria-label="女巫幣"
            ><template v-for="color in ['gold', 'copper', 'silver'] as const" :key="color"
              ><button
                v-if="state.witches[color]"
                type="button"
                :disabled="!game.available || !mine?.witchAvailable[color]"
                :aria-label="
                  '使用' + state.witches[color]!.name + '：' + state.witches[color]!.text
                "
                data-ui-hint
                :title="state.witches[color]!.text"
                @click="game.command('witch', { color })"
                ><QuacksGlyph :resource="color" :size="24" /><span>{{
                  { gold: '金', copper: '銅', silver: '銀' }[color]
                }}</span></button
              ></template
            ><button
              v-if="state.fortune?.id === 'witch-visit' && state.visitingWitch"
              type="button"
              aria-label="查看免費來訪女巫效果"
              @click="open('witches')"
              >免</button
            ><UiButton
              stitch
              variant="ghost"
              icon="help"
              icon-only
              label="查看女巫能力與條件"
              @click="open('witches')" /></div
        ></div>
        <QuacksCommands v-if="!inspecting && (isOwnPot || !boardVisible)" /><UiButton
          v-else-if="!inspecting"
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
  <UiDialog ref="tools" :title="title"
    ><nav class="vue-quacks-tabs" aria-label="遊戲工具"
      ><button
        v-for="(label, key) in tabs"
        :key="key"
        type="button"
        :aria-pressed="tab === key"
        :disabled="
          (key === 'alchemy' && !state.options.alchemists) ||
          (key === 'witches' && !state.options.witches && !state.visitingWitch)
        "
        @click="tab = key"
        >{{ label }}</button
      ></nav
    ><QuacksBooks v-if="tab === 'books'" /><QuacksScoreboard
      v-else-if="tab === 'score'" /><QuacksWitches v-else-if="tab === 'witches'" /><QuacksAlchemy
      v-else-if="tab === 'alchemy'" /><section
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
    ><StatusSlot :message="game.notice" :error="!!game.notice && !game.pending" /></UiDialog
  ><QuacksEffects />
</template>
