<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import {
  readCocLibrary,
  readCocSnapshot,
  type CocCharacter,
  type CocSnapshot,
} from '../../contracts/coc';
import { requestJson } from '../../services/http';
import { array, record, text } from '../../services/validation';
import GameRoomPage from '../../components/GameRoomPage.vue';
import CocTable from './CocTable.vue';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiButton from '../../components/UiButton.vue';
import UiField from '../../components/UiField.vue';
import UiLink from '../../components/UiLink.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import CocCharacterLibrary from '../../components/CocCharacterLibrary.vue';
const room = useRoomStore(),
  state = computed(() => room.snapshot as CocSnapshot | null),
  me = computed(() => state.value?.heroes.find((h) => h.seat === state.value?.me));
const cards = ref<CocCharacter[]>([]),
  selectedCard = ref(''),
  intent = ref(''),
  destination = ref(''),
  luck = ref(0),
  pushReason = ref('');
const provider = ref('openai'),
  source = ref('user'),
  tokenLimit = ref(500000),
  localError = ref(''),
  moduleId = ref('');
const library = ref<InstanceType<typeof UiDialog> | null>(null),
  saves = ref<InstanceType<typeof UiDialog> | null>(null);
const savesLoading = ref(false),
  savingHeroId = ref(''),
  saveNotice = ref('');
const campaigns = ref<
  {
    id: string;
    code: string;
    title: string;
    status: string;
    character: string;
    updatedAt: string;
  }[]
>([]);
const saveStatuses: Record<string, string> = {
  waiting: '等待開局',
  playing: '調查中',
  paused: '已暫停',
  finished: '已結束',
};
function savedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '時間未記錄'
    : date.toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}
const host = computed(() => state.value?.host === state.value?.me);
const sourceOptions = computed(() => [
  ...(state.value?.cli.enabled ? [{ value: 'cli', label: 'Codex CLI（此站 ChatGPT 登入）' }] : []),
  { value: 'user', label: '房主本人 API 金鑰' },
  { value: 'station', label: '站方 API 額度' },
]);
watch([source, provider], () => {
  if (source.value === 'cli') provider.value = 'openai';
});
const setup = computed(() => state.value?.phase === 'waiting');
const canStart = computed(
  () =>
    !!state.value &&
    state.value.playEnabled &&
    host.value &&
    state.value.players.every((p) => state.value!.heroes.some((h) => h.seat === p.id)),
);
const canAct = computed(
  () =>
    !!state.value &&
    state.value.phase === 'playing' &&
    !state.value.pending &&
    !state.value.offer &&
    !state.value.check &&
    !state.value.sanity &&
    !state.value.recovery &&
    !room.busy,
);
const phase = computed(
  () =>
    ({ waiting: '選擇調查者', playing: '調查進行中', paused: '已暫停', finished: '冒險結束' })[
      state.value?.phase || 'waiting'
    ] || '讀取冒險',
);
const names = computed(() =>
  Object.fromEntries(state.value?.players.map((p) => [p.id, p.name]) || []),
);
const clock = (minutes: number) =>
  `第 ${Math.floor(minutes / 1440) + 1} 天 ${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
const status = (p: { id: string }) => {
  const h = state.value?.heroes.find((h) => h.seat === p.id);
  return h ? `${h.name} · HP ${h.hp}/${h.maxHp} · SAN ${h.san}` : '尚未選擇調查者';
};
const rollLabel = (level: number) =>
  ({ [-1]: '大失敗', 0: '失敗', 1: '一般成功', 2: '困難成功', 3: '極難成功', 4: '大成功' })[
    level
  ] || '檢定結果';
watch(
  () =>
    state.value
      ? [
          state.value.ai.provider,
          state.value.ai.source,
          state.value.ai.tokenLimit,
          state.value.module.id,
        ].join(':')
      : '',
  () => {
    if (state.value) {
      provider.value = state.value.ai.provider;
      source.value = state.value.ai.source;
      tokenLimit.value = state.value.ai.tokenLimit;
      moduleId.value = state.value.module.id;
    }
  },
);
async function loadCards() {
  try {
    cards.value = readCocLibrary(await requestJson('/api/coc/characters')).characters.filter(
      (c) => c.status === 'ready',
    );
  } catch (e) {
    localError.value = e instanceof Error ? e.message : '角色庫載入失敗';
  }
}
async function act(action: string, data: Record<string, unknown> = {}) {
  if (!state.value) return false;
  try {
    const ok = await room.command('action', {
      action,
      requestId: crypto.randomUUID(),
      revision: state.value.campaignRevision,
      ...data,
    });
    localError.value = ok
      ? ''
      : room.message || room.error || '目前無法送出操作，請確認房間連線後重試。';
    return ok;
  } catch (e) {
    localError.value = e instanceof Error ? e.message : '目前無法送出操作';
    return false;
  }
}
async function choose(id = selectedCard.value) {
  if (await act('character', { characterId: id })) {
    library.value?.close();
    await loadCards();
  }
}
async function showSaves() {
  savesLoading.value = true;
  localError.value = '';
  saveNotice.value = '';
  saves.value?.open();
  try {
    const data = record(await requestJson('/api/coc/campaigns'));
    campaigns.value = array(data.campaigns).map((v) => {
      const c = record(v);
      return {
        id: text(c.id),
        code: text(c.code),
        title: text(c.title),
        status: text(c.status),
        character: text(c.character),
        updatedAt: text(c.updatedAt),
      };
    });
  } catch (e) {
    localError.value = e instanceof Error ? e.message : '存檔載入失敗';
  } finally {
    savesLoading.value = false;
  }
}
async function exportHero(id: string) {
  if (savingHeroId.value) return;
  savingHeroId.value = id;
  localError.value = '';
  saveNotice.value = '';
  try {
    await requestJson('/api/coc/characters/continue', {
      method: 'POST',
      body: { id, requestId: crypto.randomUUID() },
    });
    await loadCards();
    saveNotice.value = '倖存角色已另存到角色庫，原卡保持獨立。';
  } catch (e) {
    localError.value = e instanceof Error ? e.message : '無法另存角色';
  } finally {
    savingHeroId.value = '';
  }
}
async function resume(id: string) {
  try {
    const data = record(
      await requestJson('/api/coc/campaigns/resume', { method: 'POST', body: { id } }),
    );
    location.assign('/coc/' + text(data.code));
  } catch (e) {
    localError.value = e instanceof Error ? e.message : '存檔恢復失敗';
  }
}
onMounted(() => void loadCards());
</script>
<template>
  <GameRoomPage
    :watchable="false"
    type="coc"
    title="克蘇魯的呼喚"
    description="1–4 人 · COC7＋Pulp · AI 主持、共同調查與持久冒險"
    :reader="readCocSnapshot"
    :phase="phase"
    :round="state ? clock(state.minutes) : '準備出發'"
    :max-players="4"
    :status="status"
    :setup="setup"
    :can-start="canStart"
    start-label="開始冒險"
    :show-metrics="false"
    @start="room.command('start')"
  >
    <RoomWaitingTemplate
      v-if="state && setup"
      type="coc"
      :title="state.module.title"
      hero-title="翻開調查手記"
      :description="state.module.era + ' · ' + state.module.place + '。' + state.module.note"
      art="/assets/playful/game-trpg.svg"
      :facts="[
        { label: '規則', value: 'COC7＋Pulp' },
        { label: '玩家', value: '1–4 位真人，AI 只主持' },
        { label: '角色', value: state.heroes.length + '／' + state.players.length + ' 位已選擇' },
        {
          label: 'AI 費用',
          value:
            state.ai.source === 'cli'
              ? '此站 ChatGPT 的 Codex 額度'
              : state.ai.source === 'user'
                ? '房主自備 API 金鑰'
                : '站方 API 額度',
        },
      ]"
      :notice="
        state.playEnabled
          ? state.ai.source === 'cli'
            ? '每人先選擇完成的調查者；按開始會使用此站已登入 ChatGPT 帳號的 Codex 額度。'
            : '每人先選擇完成的調查者；按開始會使用所選 AI 服務的 API 額度。'
          : '完整冒險尚未開放；可先準備角色、設定 AI 或練習獨立教學。'
      "
    >
      <template #summary-extra
        ><p class="coc-module-credit"
          >原作 {{ state.module.originalTitle }} · {{ state.module.author }} ·
          {{ state.module.license }}</p
        ><UiLink href="/settings#coc-ai" icon="settings" label="AI 主持連線設定"
      /></template>
    </RoomWaitingTemplate>
    <CocTable v-else-if="state" @library="library?.open()" @saves="showSaves" />
    <template #settings
      ><div v-if="state" class="coc-settings"
        ><div v-if="host && setup && !state.tutorial" class="coc-fields">
          <UiField
            v-model="moduleId"
            label="劇本"
            control="select"
            :options="state.modules.map((item) => ({ value: item.id, label: item.title }))"
          />
          <UiButton
            label="選擇這個劇本"
            icon="book"
            :disabled="room.busy || moduleId === state.module.id"
            @click="act('module', { moduleId })"
          /> </div
        ><UiField
          v-model="selectedCard"
          label="我的調查者"
          control="select"
          :options="[
            { value: '', label: '選擇已完成角色' },
            ...cards.map((c) => ({ value: c.id, label: c.name })),
          ]"
          :disabled="room.busy" /><div class="coc-actions"
          ><UiButton
            label="選入冒險副本"
            icon="check"
            :disabled="!selectedCard || room.busy"
            @click="choose()" /><UiButton
            label="建立或編輯角色"
            icon="cards"
            @click="library?.open()" /><UiButton
            label="重新讀取角色庫"
            icon="refresh"
            :disabled="room.busy"
            @click="loadCards" /></div
        ><p>房間中的角色卡與狀態會分享給同伴，角色庫原卡維持獨立。</p
        ><div v-if="host" class="coc-fields"
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
            label="儲存 AI 設定"
            icon="save"
            :disabled="room.busy"
            @click="act('aiSettings', { provider, source, tokenLimit })" /></div
        ><p v-if="state.ai.source === 'cli'">{{ state.cli.message }}</p
        ><UiLink href="/settings#coc-ai" label="AI 主持連線設定" icon="settings" /></div
    ></template>
    <template #entry-actions
      ><UiLink href="/settings#coc-characters" label="我的調查者角色庫" icon="cards" /><UiLink
        href="/settings#coc-ai"
        label="設定 AI 主持連線"
        icon="settings" /><UiButton label="繼續已保存冒險" icon="book" @click="showSaves"
    /></template>
    <template #help
      ><p
        >AI 擔任主持人，伺服器依 COC7＋Pulp 支援規則保存骰值、角色與資源。1–4 位真人共同調查，沒有
        AI 隊友。</p
      ><ol
        ><li
          >每人從私人角色庫選擇角色，冒險使用獨立副本。只有房主可開始，主持連線可使用此站已設定的
          CLI 或 API。</li
        ><li>可按預設行動或自由描述。合理調查提供基本主線線索；檢定影響額外資訊、耗時與代價。</li
        ><li>非戰鬥檢定由玩家點擊擲骰，骰子由伺服器產生。已保存的結果不會因重試 AI 而改變。</li
        ><li>重大共同決策採多數；全隊移動須所有在席玩家確認。離線會暫停，恢復後繼續同一存檔。</li
        ><li>角色死亡或永久退場時可在暫停後換新角色；原角色記錄保留，新角色不繼承舊技能或物品。</li
        ><li>教學由你主動開啟，討論、閱讀說明與暫停不會推進故事時間。</li></ol
      ><p>本篇包含傷亡、異常感知與恐怖事件，以調查與冒險敘事呈現。</p></template
    >
  </GameRoomPage>
  <StatusSlot v-if="localError" :message="localError" :error="true" persistent />
  <UiDialog ref="library" title="調查者角色庫" @closed="loadCards"
    ><CocCharacterLibrary
      :selectable="
        !!state &&
        (state.phase === 'waiting' ||
          (state.phase === 'paused' &&
            !state.replacementDeferred &&
            !!me &&
            ['dead', 'retired'].includes(me.condition)))
      "
      @selected="choose"
  /></UiDialog>
  <UiDialog ref="saves" title="我的冒險存檔"
    ><div class="coc-saves"
      ><p>只有參與過這份冒險的帳號可以恢復。重啟後先暫停，等同伴回來再繼續。</p
      ><p v-if="savesLoading" role="status">正在讀取冒險存檔…</p
      ><div v-for="save in savesLoading ? [] : campaigns" :key="save.id" class="coc-save-row"
        ><span class="coc-save-info"
          ><strong>{{ save.title }} · {{ save.character || '尚未選角' }}</strong
          ><span
            >房間 {{ save.code }} · {{ saveStatuses[save.status] || '狀態未明' }} ·
            {{ savedAt(save.updatedAt) }}</span
          ></span
        ><UiButton
          :label="'開啟冒險存檔 ' + save.code"
          caption="開啟存檔"
          icon="book"
          :disabled="!!savingHeroId"
          @click="resume(save.id)" /><UiButton
          v-if="save.status === 'finished'"
          :label="'另存冒險 ' + save.code + ' 的倖存角色'"
          caption="另存角色"
          :pending="savingHeroId === save.id"
          :disabled="!!savingHeroId"
          icon="cards"
          @click="exportHero(save.id)" /></div
      ><p v-if="!savesLoading && !campaigns.length">尚無保存的冒險。</p
      ><StatusSlot
        class="coc-saves-notice"
        :message="localError || saveNotice"
        :error="!!localError"
        :tone="localError ? 'danger' : 'success'"
        persistent /></div
  ></UiDialog>
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
.coc-save-info {
  display: grid;
  gap: var(--stitch-space-4);
  flex: 1;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.coc-saves {
  display: flex;
  flex-direction: column;
  block-size: min(40rem, 60dvh);
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.coc-saves > * {
  flex-shrink: 0;
}
.coc-saves :deep(.coc-saves-notice[data-density='compact']) {
  block-size: 3lh;
  min-block-size: 0;
  max-block-size: none;
  overflow: visible;
  scrollbar-gutter: auto;
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
  .coc-save-info {
    flex-basis: 100%;
  }
}
</style>
