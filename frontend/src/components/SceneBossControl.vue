<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLobbyStore } from '../stores/lobby';
import { requestJson } from '../services/http';
import { sceneApiPath } from '../services/scene-scope';
import UiPanel from './UiPanel.vue';
import UiField from './UiField.vue';
import UiButton from './UiButton.vue';
import UiNotice from './UiNotice.vue';
import UiLink from './UiLink.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ locked?: boolean }>();
type State = {
  available: boolean;
  unlocked: boolean;
  selected: string | null;
  dead: boolean;
  catalog: { id: string; name: string; abilities: { id: string; slot: string; name: string }[] }[];
};
const lobby = useLobbyStore(),
  state = ref<State>(),
  selected = ref('');
const pending = ref(false),
  loading = ref(true),
  message = ref(''),
  failed = ref(false);
const controller = new AbortController();
const self = computed(() => lobby.snapshot?.visitors.find((v) => v.id === lobby.snapshot?.selfId));
const boss = computed(() => state.value?.catalog.find((b) => b.id === selected.value));
const disabled = computed(
  () => loading.value || pending.value || props.locked || !state.value?.unlocked,
);
async function load() {
  loading.value = true;
  failed.value = false;
  message.value = '';
  try {
    const value = (await requestJson(sceneApiPath('/api/lobby/self-boss'), {
      signal: controller.signal,
    })) as State;
    if (!controller.signal.aborted) {
      state.value = value;
      selected.value = value.selected || '';
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      failed.value = true;
      message.value = error instanceof Error ? error.message : '無法讀取 Boss 操控';
    }
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}
async function command(action: 'select' | 'reset', id: string | null = selected.value || null) {
  if (disabled.value) return;
  pending.value = true;
  failed.value = false;
  message.value = '';
  try {
    const value = (await requestJson(sceneApiPath('/api/lobby/self-boss'), {
      method: 'POST',
      body: action === 'reset' ? { action } : { action, bossId: id },
      signal: controller.signal,
    })) as State;
    if (controller.signal.aborted) return;
    state.value = value;
    selected.value = value.selected || '';
    await lobby.sync();
    if (!controller.signal.aborted)
      message.value = value.selected ? 'Boss 操控已套用' : '已恢復普通角色';
  } catch (error) {
    if (!controller.signal.aborted) {
      failed.value = true;
      message.value = error instanceof Error ? error.message : 'Boss 設定失敗';
    }
  } finally {
    if (!controller.signal.aborted) pending.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => controller.abort());
</script>
<template>
  <UiPanel title="Boss 操控" density="compact" class="scene-boss-control">
    <template v-if="state?.available && state.unlocked">
      <UiField
        label="自己操控的 Boss"
        control="select"
        v-model="selected"
        :selected-label="boss?.name || '普通角色'"
        :disabled="disabled"
      >
        <option value="">普通角色</option>
        <option v-for="item in state.catalog" :key="item.id" :value="item.id">{{
          item.name
        }}</option>
      </UiField>
      <p>方向鍵／WASD 或搖桿移動，Q／E 施放專屬普通招式，蓄力滿 100 後按 R。Boss 不使用 C 瞬移。</p>
      <UiList v-if="boss">
        <UiListRow v-for="ability in boss.abilities" :key="ability.id"
          >{{ ability.slot.toUpperCase() }} · {{ ability.name }}</UiListRow
        >
      </UiList>
      <div class="scene-boss-control-actions">
        <UiButton
          label="套用 Boss 操控"
          variant="primary"
          :disabled="disabled"
          :pending="pending"
          @click="command('select')"
        />
        <UiButton
          v-if="self?.controlledBoss"
          label="恢復普通角色"
          :disabled="disabled"
          @click="command('select', null)"
        />
        <UiButton
          v-if="self?.controlledBoss && self.health === 0"
          label="重新召喚自己"
          :disabled="disabled"
          @click="command('reset')"
        />
      </div>
      <p>Boss 專屬招式依目前階段變化；下方招式與進場設定保留給普通角色使用。</p>
    </template>
    <template v-else-if="state && !state.unlocked">
      <UiNotice message="兌換「野獸前輩」後，即可選擇現有 Boss 親自操控。" persistent />
      <UiLink href="/achievements" label="前往兌換碼" />
    </template>
    <StatusSlot
      :message="loading ? '正在讀取 Boss 操控…' : message"
      :error="failed"
      :persistent="loading || failed"
    />
    <UiButton
      v-if="failed"
      label="重新讀取 Boss 操控"
      :disabled="pending || loading"
      @click="load"
    />
  </UiPanel>
</template>
<style scoped>
.scene-boss-control {
  display: grid;
  gap: var(--stitch-space-16);
}
.scene-boss-control-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-16);
}
</style>
