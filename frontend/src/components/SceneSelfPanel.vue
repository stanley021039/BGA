<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAttackLoadoutStore, attackEffects, fitsAttackSlot } from '../stores/attack-loadout';
import { useLobbyStore } from '../stores/lobby';
import {
  entranceEffect,
  entranceEffects,
  isFreeEntrance,
  setEntranceEffect,
} from '../services/entrance-effects';
import { entranceEffectGroups } from '../services/effect-variants';
import { randomAttacks, randomEntrance } from '../services/random-effects';
import { requestJson } from '../services/http';
import { sceneApiPath } from '../services/scene-scope';
import UiPanel from './UiPanel.vue';
import UiField from './UiField.vue';
import UiButton from './UiButton.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ locked?: boolean }>();
type Settings = { q: string; e: string; r: string; entrance: string };
const emit = defineEmits<{ trainingSettings: [settings: Settings] }>();
const training =
  location.pathname === '/arena' && new URLSearchParams(location.search).has('training');
const store = useAttackLoadoutStore(),
  lobby = useLobbyStore();
const form = ref<Settings>({ ...store.loadout, entrance: entranceEffect.value });
const loading = ref(true),
  loaded = ref(false),
  pending = ref(false),
  error = ref(''),
  saved = ref(false);
const ownedAttacks = ref<string[]>([]),
  ownedEntrances = ref<string[]>([]);
const controller = new AbortController();
const locked = computed(
  () => props.locked || (!training && lobby.snapshot?.arena?.match?.phase === 'running'),
);
const disabled = computed(
  () =>
    !loaded.value ||
    loading.value ||
    pending.value ||
    store.pending ||
    locked.value ||
    !!error.value,
);
const attackAllowed = (id: string) => training || ownedAttacks.value.includes(id);
const entranceAllowed = (id: string) =>
  training || isFreeEntrance(id) || ownedEntrances.value.includes(id);
const attackLabel = (id: string) => attackEffects.find((e) => e.id === id)?.label || '未裝備';
async function load() {
  loading.value = true;
  error.value = '';
  try {
    if (training) {
      const data = (await requestJson(sceneApiPath('/api/lobby/training'), {
        signal: controller.signal,
      })) as { settings: Settings };
      if (!controller.signal.aborted)
        form.value = {
          q: data.settings.q,
          e: data.settings.e,
          r: data.settings.r,
          entrance: data.settings.entrance,
        };
    } else {
      const [data] = await Promise.all([
        requestJson('/api/achievements', { signal: controller.signal }) as Promise<{
          bonusRewards: { attacks: string[]; entrances: string[] };
        }>,
        store.load(),
      ]);
      if (controller.signal.aborted) return;
      if (!store.ready) throw Error(store.message || '無法讀取自己的招式');
      ownedAttacks.value = data.bonusRewards.attacks;
      ownedEntrances.value = data.bonusRewards.entrances;
      form.value = { ...store.loadout, entrance: entranceEffect.value };
    }
    if (!controller.signal.aborted) loaded.value = true;
  } catch (e) {
    if (!controller.signal.aborted) error.value = e instanceof Error ? e.message : '無法讀取設定';
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}
onMounted(() => void load());
onBeforeUnmount(() => controller.abort());
function randomize() {
  if (disabled.value) return;
  saved.value = false;
  form.value = {
    ...randomAttacks(form.value, attackAllowed),
    entrance: randomEntrance(form.value.entrance, entranceAllowed),
  };
}
async function save() {
  if (disabled.value) return;
  pending.value = true;
  saved.value = false;
  try {
    if (training) {
      await requestJson(sceneApiPath('/api/lobby/training'), {
        method: 'POST',
        body: { action: 'settings', ...form.value },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      emit('trainingSettings', { ...form.value });
      await lobby.sync();
    } else {
      await store.chooseAll({ q: form.value.q, e: form.value.e, r: form.value.r });
      if (controller.signal.aborted) return;
      if (store.message) throw Error(store.message);
      setEntranceEffect(form.value.entrance);
    }
    if (!controller.signal.aborted) saved.value = true;
  } catch (e) {
    if (!controller.signal.aborted) error.value = e instanceof Error ? e.message : '儲存失敗';
  } finally {
    if (!controller.signal.aborted) pending.value = false;
  }
}
function retry() {
  if (!loaded.value) {
    void load();
    return;
  }
  error.value = '';
  void save();
}
</script>
<template>
  <div class="scene-self-settings">
    <p v-if="locked">對戰中不能更換自己的招式與進場，請在對戰結束後調整。</p>
    <UiPanel title="自己的招式" density="compact">
      <div class="scene-self-fields">
        <UiField
          v-for="slot in ['q', 'e', 'r'] as const"
          :key="slot"
          :class="{ 'scene-self-wide': slot === 'r' }"
          :label="slot === 'r' ? 'R 大招' : slot.toUpperCase() + ' 普通招式'"
          control="select"
          :selected-label="attackLabel(form[slot])"
          v-model="form[slot]"
          :disabled="disabled"
          @update:model-value="saved = false"
        >
          <option v-if="slot === 'r'" value="">未裝備</option>
          <option
            v-for="effect in attackEffects.filter(
              (e) => fitsAttackSlot(slot, e.id) && attackAllowed(e.id),
            )"
            :key="effect.id"
            :value="effect.id"
            >{{ effect.label }}</option
          >
        </UiField>
      </div>
    </UiPanel>
    <UiPanel title="自己的進場" density="compact">
      <UiField
        label="進場特效"
        control="select"
        :selected-label="entranceEffects.find((e) => e.id === form.entrance)?.label"
        v-model="form.entrance"
        :disabled="disabled"
        @update:model-value="saved = false"
      >
        <optgroup
          v-for="group in entranceEffectGroups.filter((g) =>
            g.versions.some((e) => entranceAllowed(e.id)),
          )"
          :key="group.original.id"
          :label="group.original.label"
        >
          <option
            v-for="effect in group.versions.filter((e) => entranceAllowed(e.id))"
            :key="effect.id"
            :value="effect.id"
            >{{ effect.label }}</option
          >
        </optgroup>
      </UiField>
    </UiPanel>
    <div class="scene-self-actions">
      <UiButton label="隨機配招與進場" :disabled="disabled" @click="randomize" />
      <UiButton
        label="儲存自己的設定"
        variant="primary"
        :disabled="!loaded || loading || locked || !!error || store.pending"
        :pending="pending"
        @click="save"
      />
    </div>
    <StatusSlot
      :message="error || (loading ? '正在讀取自己的設定…' : saved ? '自己的設定已儲存' : '')"
      :error="!!error"
      :persistent="loading || !!error"
    />
    <UiButton v-if="error" label="重試" :disabled="loading || pending || locked" @click="retry" />
  </div>
</template>
<style scoped>
.scene-self-settings,
.scene-self-fields {
  display: grid;
  gap: var(--stitch-space-20);
}
.scene-self-settings {
  container-type: inline-size;
}
.scene-self-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-16);
}
.scene-self-wide {
  grid-column: 1 / -1;
}
@container (min-width:360px) {
  .scene-self-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
