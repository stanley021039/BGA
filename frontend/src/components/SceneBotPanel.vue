<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { requestJson } from '../services/http';
import { sceneApiPath } from '../services/scene-scope';
import { attackEffects, fitsAttackSlot } from '../stores/attack-loadout';
import { entranceEffectGroups } from '../services/effect-variants';
import { randomAttacks, randomEntrance } from '../services/random-effects';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiPanel from './UiPanel.vue';
import UiChoiceCard from './UiChoiceCard.vue';
import UiIcon from './UiIcon.vue';
import PlayerAvatar from './PlayerAvatar.vue';
import UiHeading from './UiHeading.vue';
import UiBadge from './UiBadge.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ locked?: boolean }>();
const attackLabels = new Map(attackEffects.map((effect) => [effect.id, effect.label]));
const entranceLabels = new Map(
  entranceEffectGroups.flatMap((group) =>
    group.versions.map((effect) => [effect.id, effect.label] as const),
  ),
);
type Bot = {
  id: string;
  name: string;
  ownerId: string;
  characterId: string;
  entrance: string;
  q: string;
  e: string;
  r: string;
  mode: string;
  team: string;
};
type State = {
  selfId: string;
  limit: number;
  characters: { id: string; name: string; image: string }[];
  bots: Bot[];
};
const state = ref<State | null>(null),
  selected = ref(''),
  pending = ref(false),
  error = ref('');
const arena =
  location.pathname === '/arena' && !new URLSearchParams(location.search).has('training');
const defaults = () => ({
  characterId: 'builtin:community-asian',
  entrance: 'classic',
  q: 'barrage',
  e: 'beam',
  r: 'guanyin_barrage',
  mode: 'attack',
  team: 'blue',
});
const form = ref(defaults());
const selectedBot = computed(() => state.value?.bots.find((b) => b.id === selected.value));
const characterImage = (id: string) => state.value?.characters.find((c) => c.id === id)?.image;
const editable = computed(
  () =>
    !props.locked &&
    (!selected.value ||
      state.value?.bots.find((b) => b.id === selected.value)?.ownerId === state.value?.selfId),
);
function choose(id: string) {
  selected.value = id;
  const bot = state.value?.bots.find((b) => b.id === id);
  if (bot)
    form.value = {
      characterId: bot.characterId,
      entrance: bot.entrance,
      q: bot.q,
      e: bot.e,
      r: bot.r,
      mode: bot.mode,
      team: bot.team,
    };
  else form.value = defaults();
}
function randomize() {
  if (pending.value || !editable.value) return;
  form.value = {
    ...form.value,
    ...randomAttacks(form.value),
    entrance: randomEntrance(form.value.entrance),
  };
}
async function load() {
  pending.value = true;
  error.value = '';
  try {
    state.value = (await requestJson(sceneApiPath('/api/lobby/bots'))) as State;
    choose(
      state.value.bots.find((b) => b.ownerId === state.value?.selfId)?.id ||
        state.value.bots[0]?.id ||
        '',
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : '無法載入機器人';
  } finally {
    pending.value = false;
  }
}

async function command(action: string) {
  if (pending.value) return;
  pending.value = true;
  error.value = '';
  try {
    state.value = (await requestJson(sceneApiPath('/api/lobby/bots'), {
      method: 'POST',
      body:
        action === 'add' || action === 'update'
          ? { action, id: selected.value, ...form.value }
          : { action, id: selected.value },
    })) as State;
    if (action === 'remove')
      choose(
        state.value.bots.find((b) => b.ownerId === state.value?.selfId)?.id ||
          state.value.bots[0]?.id ||
          '',
      );
    if (action === 'add') choose(state.value.bots.at(-1)?.id || '');
    if (action === 'replay') emit('preview');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失敗';
  } finally {
    pending.value = false;
  }
}
const emit = defineEmits<{ preview: [] }>();
onMounted(() => {
  void load();
});
</script>
<template>
  <div class="scene-bot-controls">
    <p v-if="locked">對戰中不可調整機器人；可切換到 Boss 分頁新增 Boss。</p>
    <div class="scene-bot-summary">
      <UiHeading :level="3" kind="card">選擇陪練</UiHeading>
      <UiBadge v-if="state" counter>{{ state.bots.length }}／{{ state.limit }} 隻</UiBadge>
    </div>
    <div class="scene-bot-picker" role="group" aria-label="切換機器人設定">
      <UiChoiceCard
        v-for="bot in state?.bots || []"
        :key="bot.id"
        :label="bot.name + (bot.ownerId !== state?.selfId ? '（唯讀）' : '')"
        :selected="selected === bot.id"
        :disabled="pending"
        @click="choose(bot.id)"
      >
        <PlayerAvatar :name="bot.name" :avatar="characterImage(bot.characterId)" bot />
        <template #label
          ><span class="ui-choice-label scene-bot-tile-name"
            >{{ bot.name.replace(/^陪練機器人\s*/, '陪練 ')
            }}{{ bot.ownerId !== state?.selfId ? '（唯讀）' : '' }}</span
          ></template
        >
        <template #selection><span hidden /></template>
      </UiChoiceCard>
      <UiChoiceCard
        label="新增機器人"
        :selected="!selected"
        :disabled="pending || !state || !!locked || state.bots.length >= state.limit"
        @click="choose('')"
      >
        <UiIcon name="add" class="scene-bot-add-icon" />
        <template #label><span class="ui-choice-label scene-bot-tile-name">新增</span></template>
        <template #selection><span hidden /></template>
      </UiChoiceCard>
    </div>
    <p v-if="selectedBot && selectedBot.ownerId !== state?.selfId">其他玩家加入，僅供查看。</p>
    <div class="scene-bot-editor">
      <UiPanel
        :title="selectedBot ? selectedBot.name + ' · 角色與行為' : '角色與行為'"
        density="compact"
      >
        <div class="scene-bot-fields">
          <UiField
            label="角色"
            :selected-label="
              state?.characters.find((c) => c.id === form.characterId)?.name || '選擇角色'
            "
            control="select"
            v-model="form.characterId"
            :disabled="pending || !editable"
            ><option
              v-for="character in state?.characters || []"
              :key="character.id"
              :value="character.id"
              >{{ character.name }}</option
            ></UiField
          >
          <UiField
            label="行為"
            :selected-label="form.mode === 'attack' ? '主動攻擊' : '純走動'"
            control="select"
            v-model="form.mode"
            :disabled="arena || pending || !editable"
            ><option value="idle">純走動</option><option value="attack">主動攻擊</option></UiField
          >
          <UiField
            v-if="arena"
            label="隊伍"
            :selected-label="form.team === 'blue' ? '藍隊' : '綠隊'"
            control="select"
            v-model="form.team"
            :disabled="pending || !editable"
            ><option value="red">綠隊</option><option value="blue">藍隊</option></UiField
          >
          <UiField
            label="進場特效"
            :selected-label="entranceLabels.get(form.entrance) || '選擇進場特效'"
            class="scene-bot-wide"
            control="select"
            v-model="form.entrance"
            :disabled="pending || !editable"
            ><optgroup
              v-for="group in entranceEffectGroups"
              :key="group.original.id"
              :label="group.original.label"
              ><option v-for="effect in group.versions" :key="effect.id" :value="effect.id">{{
                effect.label
              }}</option></optgroup
            ></UiField
          >
        </div>
      </UiPanel>
      <UiPanel title="招式配置" density="compact">
        <div class="scene-bot-fields">
          <UiField
            v-for="slot in ['q', 'e', 'r'] as const"
            :key="slot"
            :class="{ 'scene-bot-wide': slot === 'r' }"
            :label="slot === 'r' ? 'R 大招' : slot.toUpperCase() + ' 普通招式'"
            :selected-label="attackLabels.get(form[slot]) || '選擇招式'"
            control="select"
            v-model="form[slot]"
            :disabled="pending || !editable"
            ><option
              v-for="effect in attackEffects.filter((e) => fitsAttackSlot(slot, e.id))"
              :key="effect.id"
              :value="effect.id"
              >{{ effect.label }}</option
            ></UiField
          >
        </div>
      </UiPanel>
    </div>
    <div class="scene-bot-actions">
      <UiButton
        label="隨機配招與進場"
        :disabled="pending || !state || !editable"
        @click="randomize"
      />
      <UiButton
        :label="selected ? '儲存設定' : '加入機器人'"
        variant="primary"
        :disabled="
          pending || !state || !editable || (!selected && state.bots.length >= state.limit)
        "
        @click="command(selected ? 'update' : 'add')"
      />
      <UiButton
        v-if="selected"
        label="重播進場"
        :disabled="pending || !editable"
        @click="command('replay')"
      />
      <UiButton
        v-if="selected"
        label="恢復狀態"
        :disabled="pending || !editable"
        @click="command('reset')"
      />
      <UiButton
        v-if="selected"
        label="移除"
        variant="danger"
        :disabled="pending || !editable"
        @click="command('remove')"
      />
    </div>
    <StatusSlot :message="error" error persistent />
  </div>
</template>
<style scoped>
.scene-bot-controls,
.scene-bot-fields,
.scene-bot-editor {
  display: grid;
  gap: var(--stitch-space-20);
}
.scene-bot-controls {
  container-type: inline-size;
  container-name: scene-bot-settings;
}
.scene-bot-editor > :deep(.ui-panel) {
  container-type: inline-size;
  container-name: scene-bot-section;
}
.scene-bot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-16);
}
.scene-bot-picker {
  display: grid;
  box-sizing: border-box;
  padding: var(--stitch-space-8);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 100px), 1fr));
  gap: var(--stitch-space-12);
  align-items: stretch;
}
.scene-bot-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--stitch-space-12);
}
.scene-bot-wide {
  grid-column: 1 / -1;
}
.scene-bot-picker :deep(.vue-player-avatar) {
  align-self: center;
}
.scene-bot-tile-name {
  text-align: center;
}
.scene-bot-add-icon {
  align-self: center;
  display: grid;
  place-items: center;
  min-block-size: 2.5rem;
}
@container scene-bot-section (min-width: 360px) {
  .scene-bot-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container scene-bot-settings (min-width: 640px) {
  .scene-bot-editor {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
