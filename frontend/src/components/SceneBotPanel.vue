<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { requestJson } from '../services/http';
import { sceneApiPath } from '../services/scene-scope';
import { attackEffects, fitsAttackSlot } from '../stores/attack-loadout';
import { entranceEffectGroups } from '../services/effect-variants';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiPanel from './UiPanel.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ locked?: boolean }>();
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
const form = ref({
  characterId: 'builtin:community-asian',
  entrance: 'classic',
  q: 'barrage',
  e: 'beam',
  r: 'guanyin_barrage',
  mode: arena ? 'attack' : 'idle',
  team: 'blue',
});
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
}
async function load() {
  pending.value = true;
  error.value = '';
  try {
    state.value = (await requestJson(sceneApiPath('/api/lobby/bots'))) as State;
    if (selected.value && !state.value.bots.some((b) => b.id === selected.value))
      selected.value = '';
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
    if (action === 'remove') selected.value = '';
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
    <p v-if="state">{{ state.bots.length }}／{{ state.limit }} 隻；只可調整自己加入的機器人。</p>
    <UiField
      label="選擇機器人"
      control="select"
      :model-value="selected"
      :disabled="pending"
      @update:model-value="choose(String($event))"
    >
      <option value="">新增機器人</option
      ><option v-for="bot in state?.bots || []" :key="bot.id" :value="bot.id"
        >{{ bot.name }}{{ bot.ownerId !== state?.selfId ? '（其他玩家加入）' : '' }}</option
      >
    </UiField>
    <UiPanel title="角色與行為" density="compact">
      <div class="scene-bot-fields">
        <UiField
          label="角色"
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
          control="select"
          v-model="form.mode"
          :disabled="arena || pending || !editable"
          ><option value="idle">純走動</option><option value="attack">主動攻擊</option></UiField
        >
        <UiField
          v-if="arena"
          label="隊伍"
          control="select"
          v-model="form.team"
          :disabled="pending || !editable"
          ><option value="red">綠隊</option><option value="blue">藍隊</option></UiField
        >
        <UiField
          label="進場特效"
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
    <div class="scene-bot-fields">
      <UiField
        v-for="slot in ['q', 'e', 'r'] as const"
        :key="slot"
        :label="slot === 'r' ? 'R 大招' : slot.toUpperCase() + ' 普通招式'"
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
    <div class="scene-bot-actions">
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
.scene-bot-fields {
  display: grid;
  gap: var(--stitch-space-20);
}
.scene-bot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-16);
}
@media (min-width: 640px) {
  .scene-bot-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
