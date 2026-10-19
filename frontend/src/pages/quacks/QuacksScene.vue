<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { useRoomStore } from '../../stores/room';
import { useAchievementsStore } from '../../stores/achievements';
import QuacksPlay from './QuacksPlay.vue';
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
  title = computed(() => tabs[tab.value as keyof typeof tabs] || '遊戲工具'),
  own = computed(() => game.own),
  mine = computed(() => game.mine),
  state = computed(() => game.state!);
function open(key: string) {
  tab.value = key;
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
  <section class="vue-game-panel vue-quacks-stage"
    ><header
      ><div class="vue-quacks-topbar"
        ><label
          >查看大釜<select v-model="game.selectedPot"
            ><option
              v-for="person in state.recipes"
              :key="person.id"
              :value="person.id"
              :disabled="person.hidden && person.id !== state.me"
              >{{ person.name
              }}{{ person.id === state.me ? '（你）' : person.hidden ? ' · 未公開' : '' }}</option
            ></select
          ></label
        ><QuacksBag /><UiButton
          icon="book"
          icon-only
          caption="藥典"
          label="查看及選擇藥材書"
          @click="open('books')" /><UiButton
          icon="star"
          icon-only
          caption="計分"
          label="查看環形記分板"
          @click="open('score')" /><UiButton
          icon="settings"
          icon-only
          caption="工具"
          label="占卜、女巫、特效藥、紀錄與大釜設定"
          @click="open('fortune')" /></div
      ><h1>{{ game.viewed?.potName || '我的大釜' }}</h1
      ><div v-if="own" class="vue-quacks-resources" aria-label="你自己的大釜與資源"
        ><span
          class="vue-quacks-white"
          :class="{ 'is-critical': !!own.white && own.white === own.threshold && !own.exploded }"
          ><QuacksGlyph :chip="{ color: 'white', value: 1 }" :size="28" />白色炸彈
          <strong>{{ own.white ?? 0 }}／{{ own.threshold ?? 7 }}</strong></span
        ><span
          >位置 <b>{{ own.position ?? 0 }}</b></span
        ><span
          >水滴 <b>{{ own.droplet }}</b></span
        ><span
          >鼠尾 <b>{{ own.rat }}</b></span
        ><span
          >紅寶石 <b>{{ own.rubies }}</b></span
        ><span
          >藥袋 <b>{{ own.bagCount }}</b></span
        ><span
          >瓶 <b>{{ mine?.potion ? '滿' : '空' }}</b></span
        ><span v-if="state.stage === 'shopping'"
          >預算 <b>{{ mine?.budget }}</b></span
        ></div
      ><p class="vue-quacks-fortune-summary"
        ><button type="button" @click="open('fortune')">{{
          state.fortune ? state.fortune.name + ' · ' + state.fortune.text : '占卜牌尚未揭曉'
        }}</button></p
      ></header
    >
    <div class="vue-quacks-live"><QuacksPlay /></div>
    <div class="vue-quacks-feedback"
      ><StatusSlot
        :message="game.notice || achievementNotice || (game.pending ? '正在送出…' : '')"
        :error="!!game.notice && !game.pending"
      /><a v-if="achievementNotice" href="/achievements">查看收藏冊</a></div
    >
    <footer class="vue-quacks-footer"
      ><QuacksCommands /><div class="vue-quacks-quick"
        ><UiButton
          v-if="state.options.witches || state.visitingWitch"
          icon="help"
          icon-only
          caption="女巫"
          :label="
            Object.values(mine?.witchAvailable || {}).some(Boolean) || mine?.canVisit
              ? '有可使用的女巫能力，查看完整說明'
              : '查看女巫能力與條件'
          "
          @click="open('witches')" /><UiButton
          v-if="state.options.alchemists"
          icon="help"
          icon-only
          caption="特效藥"
          label="查看自己的特效藥與預抽藥材"
          @click="open('alchemy')" /></div
    ></footer> </section
  ><UiDialog ref="tools" :title="title"
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
      v-else-if="tab === 'score'" /><QuacksRecords v-else-if="tab === 'records'" /><QuacksWitches
      v-else-if="tab === 'witches'" /><QuacksAlchemy v-else-if="tab === 'alchemy'" /><section
      v-else-if="tab === 'fortune'"
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
