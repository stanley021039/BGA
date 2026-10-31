<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import type { CocSnapshot } from '../../contracts/coc';
import { text } from '../../services/validation';
import UiPanel from '../../components/UiPanel.vue';
import UiButton from '../../components/UiButton.vue';
import UiField from '../../components/UiField.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import CocCombatControls from './CocCombatControls.vue';
import CocExploration from './CocExploration.vue';
import UiDialog from '../../components/UiDialog.vue';
const emit = defineEmits<{ library: []; saves: [] }>();
const room = useRoomStore(),
  state = computed(() => room.snapshot as CocSnapshot | null),
  me = computed(() => state.value?.heroes.find((h) => h.seat === state.value?.me));
const intent = ref(''),
  destination = ref(''),
  luck = ref(0),
  pushReason = ref(''),
  patient = ref(''),
  method = ref('firstAid');
const provider = ref('openai'),
  source = ref('user'),
  tokenLimit = ref(500000);
const host = computed(() => state.value?.host === state.value?.me);
const explorationDialog = ref<InstanceType<typeof UiDialog> | null>(null);
const journalElement = ref<HTMLElement | null>(null);
const journalContent = ref<HTMLElement | null>(null);
let followingJournal = true;
let journalObserver: ResizeObserver | undefined;
let journalFrame = 0;
const journalAtBottom = (element: HTMLElement) =>
  element.scrollHeight - element.clientHeight - element.scrollTop <= 8;
function rememberJournalPosition() {
  if (journalElement.value) followingJournal = journalAtBottom(journalElement.value);
}
function followJournal() {
  cancelAnimationFrame(journalFrame);
  journalFrame = requestAnimationFrame(() => {
    if (followingJournal && journalElement.value)
      journalElement.value.scrollTop = journalElement.value.scrollHeight;
  });
}
watch(
  [journalElement, journalContent],
  ([element, content]) => {
    journalObserver?.disconnect();
    followingJournal = true;
    if (!element || !content) return;
    journalObserver = new ResizeObserver(followJournal);
    journalObserver.observe(element);
    journalObserver.observe(content);
    followJournal();
  },
  { flush: 'post' },
);
watch(
  () => [
    state.value?.campaignId,
    state.value?.journal.map((entry) => `${entry.id}:${entry.text}`).join('|'),
  ],
  async ([campaign], [previousCampaign]) => {
    if (campaign !== previousCampaign) followingJournal = true;
    else if (journalElement.value) followingJournal = journalAtBottom(journalElement.value);
    await nextTick();
    followJournal();
  },
  { flush: 'pre' },
);
onBeforeUnmount(() => {
  journalObserver?.disconnect();
  cancelAnimationFrame(journalFrame);
});
const sourceOptions = computed(() => [
  ...(state.value?.cli.enabled ? [{ value: 'cli', label: 'Codex CLI（此站 ChatGPT 登入）' }] : []),
  { value: 'user', label: '房主本人 API 金鑰' },
  { value: 'station', label: '站方 API 額度' },
]);
watch([source, provider], () => {
  if (source.value === 'cli') provider.value = 'openai';
});
const canAct = computed(
  () =>
    !!state.value &&
    state.value.phase === 'playing' &&
    !state.value.pending &&
    !state.value.offer &&
    !state.value.check &&
    !state.value.sanity &&
    !state.value.combat &&
    !state.value.recovery &&
    !room.busy,
);
const names = computed(() =>
  Object.fromEntries(state.value?.players.map((p) => [p.id, p.name]) || []),
);
const growth = computed(() =>
  state.value?.development.find(
    (item) => item.actor === state.value?.me && item.status === 'pending',
  ),
);
const growthLabels = computed(
  () => growth.value?.skills.map((id) => state.value?.skillLabels[id] || id).join('、') || '',
);
const clock = (minutes: number) =>
  `第 ${Math.floor(minutes / 1440) + 1} 天 ${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
const conditionLabels: Record<string, string> = {
  healthy: '可以行動',
  unconscious: '昏迷',
  dying: '瀕死',
  dead: '死亡',
  retired: '永久退場',
  returnNextScene: '下個場景歸隊',
  luckConscious: '靠幸運保持清醒',
  blazeGlory: '最後一搏',
};
const rollLabel = (level: number) =>
  ({ [-1]: '大失敗', 0: '失敗', 1: '一般成功', 2: '困難成功', 3: '極難成功', 4: '大成功' })[
    level
  ] || '檢定結果';
watch(
  () =>
    state.value
      ? [state.value.ai.provider, state.value.ai.source, state.value.ai.tokenLimit].join(':')
      : '',
  () => {
    if (state.value) {
      provider.value = state.value.ai.provider;
      source.value = state.value.ai.source;
      tokenLimit.value = state.value.ai.tokenLimit;
    }
  },
  { immediate: true },
);
watch(
  () => state.value?.scene.id,
  () => {
    destination.value = '';
  },
);
watch(
  () => state.value?.check?.id,
  () => {
    luck.value = 0;
    pushReason.value = '';
  },
);
async function act(action: string, data: Record<string, unknown> = {}) {
  if (!state.value) return false;
  return room.command('action', {
    action,
    requestId: crypto.randomUUID(),
    revision: state.value.campaignRevision,
    ...data,
  });
}
</script>
<template>
  <section v-if="state" class="coc-game" aria-label="調查桌">
    <div class="coc-top-actions"
      ><span>{{ state.scene.name }} · {{ clock(state.minutes) }}</span
      ><UiButton
        label="開啟探索地圖與插圖"
        caption="地圖與插圖"
        icon="landscape"
        @click="explorationDialog?.open()" />
      <UiButton
        v-if="state.phase === 'playing'"
        :label="state.tutorial ? '暫停本次教學' : '暫停並保存冒險'"
        caption="暫停"
        icon="pause"
        :disabled="room.busy"
        @click="act('pause')" /><UiButton
        v-if="state.phase === 'paused' && host"
        label="確認同伴已回來，恢復冒險"
        caption="恢復冒險"
        icon="play"
        :disabled="room.busy"
        @click="act('resume')" /><UiButton
        v-if="host && !state.tutorial && canAct"
        label="結束本次跑團並保存；下次開始恢復幸運值"
        caption="結束本次跑團"
        icon="save"
        :disabled="room.busy"
        @click="act('endSession')" /><UiButton
        v-if="!state.tutorial"
        label="開啟調查者角色庫"
        caption="角色庫"
        icon="cards"
        @click="emit('library')"
    /></div>
    <StatusSlot
      :message="
        state.pauseReason ||
        (state.pending
          ? state.pending.error || '主持人正在回應；已保存的骰值與資源不會重算。'
          : state.tutorial
            ? '教學操作僅在本次練習暫存，不寫入正式資料。'
            : '每個行動都會自動保存。')
      "
      :error="!!state.pending?.error"
      persistent
    />
    <div class="coc-scene-grid">
      <UiPanel title="調查手記" :note="state.scene.name" class="coc-journal-panel"
        ><div
          ref="journalElement"
          class="coc-journal"
          tabindex="0"
          aria-label="故事與行動紀錄"
          @scroll.passive="rememberJournalPosition"
          ><div ref="journalContent"
            ><p>{{ state.scene.description }}</p
            ><article v-for="entry in state.journal" :key="entry.id"
              ><small
                >{{ clock(entry.minutes) }} ·
                {{
                  entry.kind === 'keeper' ? '主持人' : entry.kind === 'clue' ? '新線索' : '紀錄'
                }}</small
              ><p>{{ entry.text }}</p></article
            ></div
          ></div
        ></UiPanel
      >
      <div class="coc-information">
        <UiPanel :title="me?.name || '我的調查者'" note="冒險副本"
          ><div v-if="me" class="coc-character-scroll" tabindex="0" aria-label="角色狀態"
            ><dl class="coc-meters"
              ><div
                ><dt>體力</dt><dd>{{ me.hp }}／{{ me.maxHp }}</dd></div
              ><div
                ><dt>理智</dt><dd>{{ me.san }}</dd></div
              ><div
                ><dt>魔力</dt><dd>{{ me.mp }}／{{ me.maxMp }}</dd></div
              ><div
                ><dt>幸運</dt><dd>{{ me.luck }}</dd></div
              ></dl
            ><p>狀態：{{ conditionLabels[me.condition] || me.condition }}</p
            ><div
              v-if="
                !state.combat && !state.tutorial && !state.pending && !state.offer && !state.check
              "
              class="coc-actions"
              ><UiButton
                v-if="me.luck >= 30 && ['dead', 'dying'].includes(me.condition)"
                :label="'花費全部 ' + me.luck + ' 幸運避免死亡，下個場景歸隊'"
                icon="shield"
                :disabled="room.busy"
                @click="act('pulpLuck', { kind: 'escapeDeath' })" /><UiButton
                v-if="me.hp < me.maxHp && me.luck >= 20 && me.condition !== 'dead'"
                label="花費 20 幸運恢復 1d6 體力"
                icon="healing"
                :disabled="room.busy"
                @click="act('pulpLuck', { kind: 'scratch' })" /></div
            ><p v-if="me.phobias.length">{{ me.phobias.join('；') }}</p
            ><details
              ><summary>能力與技能</summary
              ><p v-for="(value, id) in me.skills" :key="id"
                >{{ state.skillLabels[id] || id }} {{ value }} / {{ Math.floor(value / 2) }} /
                {{ Math.floor(value / 5) }}</p
              ></details
            ></div
          ></UiPanel
        >
        <UiPanel title="共同線索" :note="state.clues.length + ' 項已發現'" class="coc-clue-panel"
          ><div class="coc-clues" tabindex="0" aria-label="已發現的隊伍線索"
            ><details v-for="clue in state.clues" :key="clue.id"
              ><summary>{{ clue.title }}</summary
              ><p>{{ clue.text }}</p></details
            ><p v-if="!state.clues.length"
              >合理調查即可取得主線基本線索；檢定會影響額外資訊與代價。</p
            ></div
          ></UiPanel
        >
      </div>
    </div>
    <UiPanel title="你的下一步" class="coc-action-panel">
      <div class="coc-operation-slot" tabindex="0" aria-label="目前操作與確認">
        <div v-if="state.phase === 'paused' && !state.offer"
          ><p>{{ state.pauseReason }}。暫停、討論與教學不推進故事時間。</p
          ><UiButton
            v-if="state.canEndInvestigation"
            label="全員確認結束本篇調查"
            icon="close"
            :disabled="room.busy"
            @click="act('endInvestigation')" /><UiButton
            v-if="me && !state.replacementDeferred && ['dead', 'retired'].includes(me.condition)"
            label="選擇新的合法角色"
            icon="cards"
            @click="emit('library')" /><div v-if="host && !state.tutorial" class="coc-fields"
            ><UiField
              v-model="provider"
              label="AI 服務"
              control="select"
              :disabled="source === 'cli'"
              :options="[
                { value: 'openai', label: 'OpenAI' },
                { value: 'anthropic', label: 'Claude' },
              ]" /><UiField
              v-model="source"
              label="主持連線"
              control="select"
              :options="sourceOptions" /><UiField
              v-model.number="tokenLimit"
              label="本篇 token 上限"
              type="number"
              min="10000"
              max="2000000" /><UiButton
              label="儲存 AI 與額度設定"
              icon="save"
              :disabled="room.busy"
              @click="act('aiSettings', { provider, source, tokenLimit })" /></div
        ></div>
        <template v-else-if="state.recovery">
          <h3>第 {{ state.recovery.session }} 次跑團 · 幸運恢復</h3>
          <p>由每位玩家自行按鈕擲骰。結果只套用一次，不推進故事時間，不能支出幸運值或孤注一擲。</p>
          <p>等待：{{ state.recovery.pending.map((id) => names[id] || '同伴').join('、') }}</p>
          <UiButton
            v-if="state.recovery.pending.includes(state.me)"
            label="擲幸運恢復骰"
            icon="cards"
            :disabled="room.busy"
            @click="act('recoverLuck')"
          />
        </template>
        <template v-else-if="state.offer"
          ><h3>{{ state.offer.label }}</h3
          ><p>{{ state.offer.risk }}</p
          ><p
            >{{
              state.offer.unanimous
                ? '所有在席玩家確認後執行'
                : state.offer.party
                  ? '過半同意後執行'
                  : '由提出的玩家確認'
            }}；尚未扣除資源。</p
          ><p v-for="id in state.offer.electorate" :key="id"
            >{{ names[id] }}：{{
              state.offer.votes[id] === true
                ? '同意'
                : state.offer.votes[id] === false
                  ? '取消'
                  : '尚未決定'
            }}</p
          ><div v-if="state.offer.party || state.offer.actor === state.me" class="coc-actions"
            ><UiButton
              label="確認已知代價並同意"
              icon="check"
              variant="primary"
              :disabled="room.busy"
              @click="act('confirm', { offerId: state.offer.id, approve: true })" /><UiButton
              label="取消這項行動"
              icon="close"
              :disabled="room.busy"
              @click="act('confirm', { offerId: state.offer.id, approve: false })" /></div
        ></template>
        <template v-else-if="state.check"
          ><h3>{{ state.check.label }}</h3
          ><p v-if="state.check.tiebreak"
            >雙方同級且數值相同，改擲 D100 比點數，較低者勝出；不再支付原行動資源或推進故事時間。</p
          ><p v-else
            >{{ names[state.check.actor] }} ·
            {{
              state.skillLabels[state.check.skill] ||
              state.attributeLabels[state.check.skill] ||
              state.check.skill
            }}
            ·
            {{
              state.check.difficulty === 'hard'
                ? '困難'
                : state.check.difficulty === 'extreme'
                  ? '極難'
                  : '一般'
            }}檢定</p
          ><div v-if="state.check.actor === state.me"
            ><UiButton
              v-if="state.check.status === 'awaitingRoll'"
              :label="state.check.tiebreak ? '擲 D100 平手決勝' : '擲百分骰'"
              icon="cards"
              variant="primary"
              :pending="room.busy"
              @click="act('roll', { checkId: state.check.id })" /><template
              v-else-if="state.check.roll"
              ><p v-if="state.check.tiebreak"
                >你的 D100：{{ state.check.roll.roll }}；對方：{{
                  state.check.opposition?.roll
                }}。骰值已保存。</p
              ><p v-else
                >{{ state.check.roll.roll }}／{{ state.check.roll.target }} ·
                {{ rollLabel(state.check.roll.level) }}；骰值已保存。</p
              ><p v-if="!state.check.tiebreak && state.check.opposition"
                >對方：{{ rollLabel(state.check.opposition.level) }}。</p
              ><div class="coc-fields"
                ><UiField
                  v-if="!state.check.tiebreak"
                  v-model.number="luck"
                  label="要支出的幸運值（0 表示不用）"
                  type="number"
                  min="0"
                  :max="me?.luck || 0" /><UiButton
                  :label="state.check.tiebreak ? '接受平手決勝結果' : '接受結果／支出幸運值'"
                  icon="check"
                  :disabled="room.busy"
                  @click="
                    act('acceptRoll', {
                      checkId: state.check.id,
                      luck: state.check.tiebreak ? 0 : luck,
                    })
                  " /></div
              ><div
                v-if="
                  !state.check.noPush &&
                  !state.check.pushed &&
                  !state.check.roll.luckSpent &&
                  state.check.roll.level <
                    (({ hard: 2, extreme: 3 } as Record<string, number>)[state.check.difficulty] ||
                      1)
                "
                class="coc-fields"
                ><UiField
                  v-model="pushReason"
                  label="孤注一擲的新方法"
                  maxlength="300"
                  hint="再失敗會多耗兩小時，可能錯失時機並遭當地人阻撓；不能用幸運修改重擲結果。" /><UiButton
                  label="確認風險，孤注一擲"
                  icon="refresh"
                  :disabled="room.busy || !pushReason.trim()"
                  @click="
                    act('acceptRoll', {
                      checkId: state.check.id,
                      push: true,
                      justification: pushReason,
                    })
                  " /></div></template></div
          ><p v-else>等待這位調查者完成檢定。</p></template
        >
        <template v-else-if="state.sanity"
          ><h3>理智檢定：{{ state.sanity.reason }}</h3
          ><p>由 {{ names[state.sanity.actor] }} 完成。</p
          ><div v-if="state.sanity.actor === state.me"
            ><UiButton
              v-if="state.sanity.status === 'awaitingRoll' || state.sanity.status === 'awaitingInt'"
              :label="
                state.sanity.status === 'awaitingInt' ? '擲 INT，確認對恐怖的理解' : '擲理智骰'
              "
              icon="cards"
              :disabled="room.busy"
              @click="act('sanity', { checkId: state.sanity.id })" /><template v-else
              ><p v-if="state.sanity.result?.roll"
                >骰值 {{ state.sanity.result.roll.roll }}／{{ state.sanity.result.roll.target }} ·
                {{ rollLabel(state.sanity.result.roll.level) }}；結果已暫存。</p
              ><p>本次損失 {{ state.sanity.result?.loss || 0 }} 理智。</p
              ><div class="coc-actions"
                ><UiButton
                  label="接受理智損失"
                  icon="check"
                  :disabled="room.busy"
                  @click="act('sanity', { checkId: state.sanity.id })" /><UiButton
                  v-if="state.sanity.result?.roll && state.sanity.result.roll.level < 1"
                  :label="'花費 ' + state.sanity.result.loss * 2 + ' 幸運，損失減半'"
                  icon="shield"
                  :disabled="room.busy || (me?.luck || 0) < state.sanity.result.loss * 2"
                  @click="
                    act('sanity', { checkId: state.sanity.id, halve: true })
                  " /></div></template></div
        ></template>
        <template v-else-if="state.pending"
          ><p>{{ state.pending.error || '主持人正在回應…' }}</p
          ><UiButton
            v-if="host && ['failed', 'uncertain'].includes(state.pending.status)"
            label="重試同一次 AI 回覆（可能再次使用額度）"
            icon="refresh"
            :disabled="room.busy"
            @click="act('retryAi')" /><UiButton
            v-if="state.pending.stage === 'intent' && state.pending.actor === state.me"
            label="取消尚未執行的意圖"
            icon="close"
            :disabled="room.busy"
            @click="act('cancelIntent')"
        /></template>
        <CocCombatControls
          v-else-if="state.combat"
          :state="state"
          :busy="room.busy"
          @command="act('combat', $event)"
        />
        <template v-else-if="state.phase === 'finished'"
          ><p>{{ text(state.result?.summary) || '本篇冒險已結束，角色與紀錄已保存。' }}</p
          ><template v-if="growth"
            ><p
              >尚有 {{ growth.skills.length }} 項成長檢定：{{
                growthLabels
              }}。完成後才能另存倖存角色。</p
            ><UiButton
              label="擲本次角色成長檢定"
              icon="cards"
              :disabled="room.busy"
              @click="act('develop')" /></template
          ><UiButton v-if="!state.tutorial" label="查看冒險存檔" icon="book" @click="emit('saves')"
        /></template>
        <template v-else
          ><p
            v-if="
              me &&
              ['dead', 'retired', 'unconscious', 'dying', 'returnNextScene'].includes(me.condition)
            "
            >{{
              state.replacementDeferred
                ? '角色目前無法一般行動；仍須完成已觸發的必要判定，本篇後果結算前不能換角。'
                : '角色目前無法一般行動。可先請同伴急救；永久退場後暫停並選擇新角色。'
            }}</p
          ><div class="coc-action-choices"
            ><UiButton
              v-for="action in state.actions"
              :key="action.id"
              :label="action.label + (action.minutes ? ' · ' + action.minutes + ' 分鐘' : '')"
              icon="book"
              :disabled="!canAct"
              @click="act('preset', { actionId: action.id })" /></div
          ><form
            class="coc-intent"
            @submit.prevent="
              act('intent', { text: intent }).then((ok) => {
                if (ok) intent = '';
              })
            "
            ><UiField
              v-model="intent"
              label="自由描述目標與做法"
              control="textarea"
              rows="2"
              maxlength="500"
              :disabled="!canAct" /><UiButton
              label="提出行動"
              icon="send"
              variant="primary"
              type="submit"
              :disabled="!canAct || !intent.trim()" /></form
          ><div class="coc-fields"
            ><UiField
              v-model="destination"
              label="全隊移動至已知地點"
              control="select"
              :options="[
                { value: '', label: '選擇地點' },
                ...state.destinations.map((d) => ({
                  value: d.id,
                  label: d.name + ' · ' + d.minutes + ' 分鐘',
                })),
              ]"
              :disabled="!canAct" /><UiButton
              label="提出全隊移動（全員確認）"
              icon="next"
              :disabled="!canAct || !destination"
              @click="act('move', { destination })" /></div
          ><details v-if="!state.tutorial"
            ><summary>急救與醫學治療</summary
            ><div class="coc-fields"
              ><UiField
                v-model="patient"
                label="治療對象"
                control="select"
                :options="[
                  { value: '', label: '選擇受傷同伴' },
                  ...state.heroes
                    .filter((h) => h.hp < h.maxHp && h.condition !== 'dead')
                    .map((h) => ({ value: h.seat, label: h.name })),
                ]" /><UiField
                v-model="method"
                label="治療方式"
                control="select"
                :options="[
                  { value: 'firstAid', label: '急救 · 一回合' },
                  { value: 'medicine', label: '醫學 · 一小時' },
                ]" /><UiButton
                label="提出治療並檢視代價"
                icon="healing"
                :disabled="!canAct || !patient"
                @click="act('recover', { target: patient, method })" /></div></details
        ></template>
      </div>
    </UiPanel>
    <p v-if="state.tutorial" class="coc-usage">教學示範不呼叫外部 AI，不使用 API 額度。</p
    ><p v-else class="coc-usage"
      >{{
        state.ai.source === 'cli'
          ? 'Codex CLI'
          : state.ai.provider === 'openai'
            ? 'OpenAI API'
            : 'Claude API'
      }}
      ·
      {{
        state.ai.source === 'cli'
          ? '此站 ChatGPT 登入額度'
          : state.ai.source === 'user'
            ? '房主金鑰'
            : '站方 API 額度'
      }}
      · 已確認輸入 {{ state.usage.input }}／輸出 {{ state.usage.output }} tokens · 預算計入
      {{ state.usage.budgetUsed }}／{{ state.ai.tokenLimit }}（包含未確認請求預留）。</p
    >
    <UiDialog ref="explorationDialog" title="探索地圖與插圖"
      ><CocExploration :media="state.exploration"
    /></UiDialog>
  </section>
</template>
<style scoped>
.coc-game,
.coc-settings,
.coc-saves {
  display: grid;
  gap: var(--stitch-space-16);
  min-inline-size: 0;
}
.coc-top-actions,
.coc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-12);
  align-items: center;
  min-block-size: var(--stitch-control-height);
}
.coc-top-actions > span {
  flex: 1;
  min-inline-size: 10rem;
}
.coc-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-16);
  align-items: end;
}
.coc-scene-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(16rem, 1fr);
  gap: var(--stitch-space-16);
  align-items: stretch;
}
.coc-journal-panel,
.coc-information {
  block-size: 36rem;
  min-inline-size: 0;
  box-sizing: border-box;
}
.coc-journal {
  block-size: 29rem;
  overflow: auto;
  scrollbar-gutter: stable;
  overflow-anchor: none;
  overflow-wrap: anywhere;
}
.coc-journal article {
  padding-block: var(--stitch-space-12);
  border-block-end: var(--stitch-border);
}
.coc-journal p {
  white-space: pre-wrap;
  margin-block: var(--stitch-space-8);
}
.coc-information {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--stitch-space-16);
}
.coc-information :deep(.ui-panel) {
  min-block-size: 0;
}
.coc-character-scroll,
.coc-clues {
  block-size: 10rem;
  overflow: auto;
  scrollbar-gutter: stable;
  overflow-wrap: anywhere;
}
.coc-meters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-8);
  margin: 0;
}
.coc-meters dd {
  margin: 0;
}
.coc-operation-slot {
  block-size: 25rem;
  overflow: auto;
  scrollbar-gutter: stable;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.coc-action-choices :deep(.vue-button-caption) {
  white-space: normal;
  overflow-wrap: anywhere;
}
.coc-action-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-12);
}
.coc-intent {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--stitch-space-12);
  padding-block: var(--stitch-space-16);
}
.coc-usage {
  min-block-size: 3rem;
  overflow-wrap: anywhere;
  margin: 0;
}
.coc-save-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--stitch-space-16);
  min-block-size: var(--stitch-control-height);
}
@media (max-width: 760px) {
  .coc-scene-grid,
  .coc-fields,
  .coc-action-choices,
  .coc-intent {
    grid-template-columns: minmax(0, 1fr);
  }
  .coc-journal-panel {
    block-size: 29rem;
  }
  .coc-journal {
    block-size: 22rem;
  }
  .coc-information {
    block-size: 36rem;
  }
  .coc-operation-slot {
    block-size: 30rem;
  }
  .coc-save-row {
    flex-wrap: wrap;
  }
}
</style>
