<script setup lang="ts">
import QuacksRuleVisual from './QuacksRuleVisual.vue';
import QuacksWaiting from './QuacksWaiting.vue';
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { ingredientNames } from '../../contracts/quacks';
import QuacksGlyph from './QuacksGlyph.vue';
import QuacksChoices from './QuacksChoices.vue';
import QuacksMarket from './QuacksMarket.vue';
import QuacksAlchemy from './QuacksAlchemy.vue';
import QuacksWitches from './QuacksWitches.vue';
import QuacksPot from './QuacksPot.vue';
import QuacksBooks from './QuacksBooks.vue';
import QuacksScoreboard from './QuacksScoreboard.vue';
import UiButton from '../../components/UiButton.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import { useRoomStore } from '../../stores/room';
defineProps<{ overlay?: boolean }>();
const game = useQuacksStore(),
  room = useRoomStore(),
  s = computed(() => game.state!),
  m = computed(() => game.mine),
  own = computed(() => game.own!);
const compactEffects = computed(() =>
  ['black', 'green', 'purple'].map((color) => {
    const entries = m.value?.effectSummary.filter((e) => e.color === color) || [];
    return {
      color,
      triggered: entries.some((e) => e.triggered),
      text: entries.map((e) => e.text).join('；'),
    };
  }),
);
function reserveBlocked(c: { effectColor?: string; must?: boolean }) {
  return (
    !game.available ||
    own.value.chosen ||
    ((s.value.options.books?.red ?? s.value.options.bookSet) === 2 &&
      c.effectColor === 'red' &&
      !own.value.stopped)
  );
}
</script>
<template>
  <section class="vue-quacks-play">
    <p v-if="s.interrupted">有人離席，本場已中止；保留已完成回合。由房主重新開始或返回大廳。</p>
    <QuacksBooks v-else-if="s.phase === 'waiting'" />
    <section v-else-if="s.phase === 'round-intro'" class="vue-quacks-round-intro"
      ><h2>第 {{ s.round + 1 }} 回合</h2><p>本輪結果已保存，伺服器正在準備下一回合。</p
      ><RoomCountdown
        :deadline="s.nextRoundAt"
        :duration="2000"
        :now="game.now"
        :offset="room.clockOffset"
        :epoch="s.roundId || ''"
        caption="準備下一回合"
    /></section>
    <template v-else-if="m?.pending"><QuacksChoices /></template>
    <QuacksWaiting
      v-else-if="m?.waitingEffect"
      title="等待其他玩家完成效果"
      detail="藥材或占卜牌選擇完成後，大家再一起抽藥。"
    />
    <QuacksWaiting
      v-else-if="s.stage === 'essence' && m?.alchemy?.confirmed && !m.alchemy.diceRemaining"
      title="特效藥已確認"
      detail="等待其他玩家完成調製與額外效果。"
    />
    <QuacksAlchemy v-else-if="s.phase === 'patients' || s.stage === 'essence'" />
    <section v-else-if="s.phase === 'fortune'" class="vue-quacks-fortune-draw"
      ><template v-if="s.me === s.roundStarterId"
        ><button
          type="button"
          :disabled="!game.available"
          aria-label="點擊抽取本輪占卜牌"
          @click="game.drawFortune()"
          ><img src="/assets/quacks/fortune-back.svg" alt="" /><strong>點一下抽牌</strong></button
        ></template
      ><QuacksWaiting
        v-else
        :title="
          '等待 ' +
          (s.players.find((p) => p.id === s.roundStarterId)?.name || '本輪起始玩家') +
          ' 抽占卜牌'
        "
        detail="抽牌後一起揭曉本輪效果。"
    /></section>
    <template v-else-if="s.phase === 'brewing'"
      ><QuacksWaiting
        v-if="s.stage === 'drawing' && !m?.canDraw"
        :title="own.stopped ? '你已停手，等待其他玩家' : '已選擇，等待大家抽藥'"
        detail="全員決定後，一起揭曉本次結果。"
      /><QuacksPot v-else-if="!overlay && game.viewed" :state="s" :recipe="game.viewed" /><section
        v-if="m?.reserve.length || m?.alchemy?.pool.length || m?.alchemy?.returnable.length"
        class="vue-quacks-extra"
        ><h2>暫存與特效藥選擇</h2
        ><div v-if="m?.canDraw && m.alchemy?.drawablePool.length" data-private
          ><h3>可用私人預抽取代這次隨機抽藥</h3
          ><div class="vue-quacks-choice-grid"
            ><button
              v-for="c in m.alchemy.drawablePool"
              :key="c.id"
              type="button"
              :disabled="!game.available"
              @click="game.command('draw', { step: s.step, chipId: c.id })"
              ><QuacksGlyph :chip="c" />改放 {{ ingredientNames[c.color] }} {{ c.value }}</button
            ></div
          ></div
        ><div v-for="c in m?.reserve || []" :key="c.id" class="vue-quacks-reserve-row"
          ><QuacksGlyph :chip="c" /><span
            >{{ ingredientNames[c.color] }} {{ c.value }} ·
            {{ c.must ? '本輪必須投入' : '可保留到下輪' }}</span
          ><UiButton legacy
            icon="play"
            label="投入暫存"
            :disabled="reserveBlocked(c)"
            @click="game.command('reserve', { chipId: c.id })" /><UiButton legacy
            v-if="!c.must"
            icon="undo"
            label="放回藥袋"
            :disabled="!game.available || own.chosen"
            @click="game.command('reserve-return', { chipId: c.id })" /></div
        ><div v-if="s.stage === 'reserves'"
          ><template v-for="c in m?.alchemy?.pool || []" :key="c.id"
            ><UiButton legacy
              v-if="c.color === 'red' && (s.options.books?.red ?? s.options.bookSet) === 2"
              icon="play"
              :label="'投入預抽紅色 ' + c.value"
              :disabled="!game.available"
              @click="game.command('alchemy-pool', { chipId: c.id })" /></template></div
        ><div v-if="m?.alchemy?.returnable.length" class="vue-quacks-choice-grid"
          ><button
            v-for="c in m.alchemy.returnable"
            :key="c.id"
            type="button"
            :disabled="!game.available"
            @click="game.command('alchemy-return', { chipId: c.id })"
            ><QuacksGlyph :chip="c" />收回 {{ ingredientNames[c.color] }} {{ c.value }} · 花
            {{ c.value }} 格特效藥</button
          ></div
        ></section
      ></template
    >
    <template v-else-if="s.phase === 'settlement' && m"
      ><template v-if="m.ready"
        ><section class="vue-quacks-stage-message vue-quacks-stage-complete" role="status"
          ><h2>你已完成本階段</h2><p>等待其他玩家完成後，一起進入下一階段。</p></section
        ><QuacksPot v-if="!overlay && game.viewed" :state="s" :recipe="game.viewed" /></template
      ><template v-else-if="s.stage === 'witches'"
        ><section class="vue-quacks-stage-message vue-quacks-witches-intro"
          ><h2>全員大釜已公開，先決定適用女巫</h2><p>可先使用符合條件的女巫，再按下方準備結算。</p
          ><QuacksWitches /></section
        ><QuacksPot v-if="!overlay && game.viewed" :state="s" :recipe="game.viewed" /></template
      ><section v-else-if="s.stage === 'bonus'" class="vue-quacks-stage-message"
        ><h2>獎勵骰</h2
        ><p>{{
          m.bonusEligible
            ? '你在符合資格的玩家中進度最遠，可以親自擲骰。'
            : '本輪沒有獎勵骰資格；符合條件且並列最遠的人都可以擲骰。'
        }}</p
        ><p v-if="m.bonusDice.length"
          >本次結果：{{
            m.bonusDice
              .map((n) => ['1分', '1分', '2分', '紅寶石1', '水滴前進1', '南瓜1'][n])
              .join('、')
          }}</p
        ></section
      ><section v-else-if="s.stage === 'effects-confirm'" class="vue-quacks-effects-compact"
        ><h2>綠色、黑色與紫色藥材結算</h2
        ><article
          v-for="(effect, index) in compactEffects"
          :key="index"
          class="vue-quacks-effect-row"
          :class="{ 'is-triggered': effect.triggered }"
          :title="effect.text"
          ><QuacksRuleVisual
            :text="effect.text"
            :chip="{ color: effect.color as 'black' | 'green' | 'purple', value: 1 }"
          /><span class="ui-sr-only">{{ effect.triggered ? '已觸發' : '未觸發' }}</span></article
        ><p>確認不會重複領取；全員確認後才進入格位獎勵。</p></section
      ><section v-else-if="s.stage === 'rewards'" class="vue-quacks-stage-message"
        ><h2>領取結算位置獎勵</h2
        ><p
          >大釜第 {{ own.position }} 格，結算位置
          {{ s.board[Math.min(s.board.length - 1, (own.position || 0) + 1)]?.position }}。</p
        ><p>{{
          own.exploded
            ? '大釜爆炸，通常需選勝利分數或購物；保護效果可能讓你兩者兼得。'
            : '安全完成，可同時取得勝利分數與購物預算。'
        }}</p></section
      ><template v-else-if="s.stage === 'shopping'"
        ><QuacksMarket /><QuacksMarket
          v-if="m.extraBudget > 0 || m.extraBought.length"
          extra /><section v-if="s.round < 9" class="vue-quacks-ruby"
          ><h2>使用紅寶石 · 每次 {{ m.discount }} 顆</h2
          ><div class="vue-quacks-tabs"
            ><UiButton legacy
              icon="refresh"
              label="補滿藥水瓶"
              :disabled="!game.available || m.potion || own.rubies < m.discount"
              @click="game.command('ruby', { mode: 'refill' })" /><UiButton legacy
              icon="next"
              label="永久水滴前進一格"
              :disabled="!game.available || own.rubies < m.discount"
              @click="game.command('ruby', { mode: 'droplet' })" /></div></section></template
      ><QuacksWaiting v-else title="等待必要效果結算" detail="完成後會一起進入下一階段。"
    /></template>
    <section v-else-if="s.phase === 'finished'" class="vue-quacks-final"
      ><h2>{{
        s.interrupted
          ? '本場中止'
          : s.winner
            ? '獲勝：' + s.winner.names.join('、') + ' · ' + s.winner.score + ' 分'
            : '本場結束'
      }}</h2
      ><p>完成 {{ s.results.length }}／9 輪。先比總分，同分再比最後大釜位置；可以共同獲勝。</p
      ><div class="vue-quacks-results"
        ><article v-for="result in s.results" :key="result.round"
          ><h3>第 {{ result.round }} 回合 · {{ result.fortune.name }}</h3
          ><p>{{ result.fortune.text }}</p
          ><div v-for="p in result.players" :key="p.id"
            ><strong>{{ p.name }} · 累計 {{ p.score }} 分</strong
            ><p
              >{{ p.exploded ? '爆炸' : '安全' }} · 第 {{ p.position }} 格 · 普通抽藥
              {{ p.draws }} 片 · 紅寶石 {{ p.rubies }}</p
            ><details
              ><summary>藥材、溢出與採購明細</summary><h4>大釜藥材</h4
              ><div class="vue-quacks-tabs"
                ><span v-for="c in p.pot" :key="c.id"
                  ><QuacksGlyph :chip="c" />第 {{ c.position }} 格</span
                ></div
              ><h4>溢出盆</h4
              ><div class="vue-quacks-tabs"
                ><QuacksGlyph v-for="c in p.overflow" :key="c.id" :chip="c" /></div
              ><h4>本輪購買</h4
              ><div class="vue-quacks-tabs"
                ><QuacksGlyph v-for="(c, index) in p.bought" :key="index" :chip="c" /></div
              ><p
                >擲骰：{{
                  p.dice
                    .map((n) => ['1分', '1分', '2分', '紅寶石1', '水滴前進1', '南瓜1'][n])
                    .join('、') || '無'
                }}</p
              ><p v-if="p.alchemy"
                >病患
                {{ s.patients.find((patient) => patient.id === p.alchemy?.patientId)?.name }} ·
                特效藥 {{ p.alchemy.essence }} 格</p
              ></details
            ></div
          ></article
        ></div
      ></section
    >
    <section v-else-if="s.phase === 'between'"
      ><h2>本輪環形計分板</h2><QuacksScoreboard /><p>查看後由房主開始下一回合。</p></section
    >
    <UiButton legacy
      v-if="m?.canGoodNeighbor"
      icon="add"
      label="好鄰居：拿白色炸彈3，其他人各得2紅寶石"
      :disabled="!game.available"
      @click="game.command('fortune-neighbor')"
    />
  </section>
</template>
