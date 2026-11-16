<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { requestJson } from '../services/http';
import { sceneApiPath } from '../services/scene-scope';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiPanel from './UiPanel.vue';
import { sizedImage } from '../services/image-size';
import StatusSlot from './StatusSlot.vue';
type Entry = {
  id: string;
  name: string;
  description: string;
  image: string;
  abilities: { id: string; slot: string; name: string }[];
};
type Boss = { id: string; bossId: string; name: string; ownerId: string; arrived?: boolean };
type State = { selfId: string; limit: number; catalog: Entry[]; bosses: Boss[] };
const state = ref<State | null>(null),
  bossId = ref('mutalith'),
  pending = ref(false),
  error = ref('');
const selected = computed(() => state.value?.catalog.find((b) => b.id === bossId.value));
async function command(action = 'list', id?: string) {
  if (pending.value) return;
  pending.value = true;
  error.value = '';
  try {
    state.value = (await requestJson(
      sceneApiPath('/api/lobby/bosses'),
      action === 'list'
        ? undefined
        : {
            method: 'POST',
            body: { action, ...(id ? { id } : { bossId: bossId.value }) },
          },
    )) as State;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Boss操作失敗';
  } finally {
    pending.value = false;
  }
}

onMounted(() => {
  void command();
});
</script>
<template>
  <div class="scene-boss-controls">
    <p>與機器人分開計算；加入後預告五秒，再從空中登場。Boss會主動攻擊。</p>
    <p v-if="state">目前 {{ state.bosses.length }}／{{ state.limit }} 隻</p>
    <UiField label="選擇 Boss" control="select" v-model="bossId" :disabled="pending">
      <option v-for="boss in state?.catalog || []" :key="boss.id" :value="boss.id">{{
        boss.name
      }}</option>
    </UiField>
    <img
      v-if="selected"
      class="scene-boss-preview"
      :src="sizedImage(selected.image, 256)"
      :alt="selected.name"
    />
    <p>{{ selected?.description }}。生命為一般角色的8倍，擊倒後會重生。</p>
    <UiPanel v-if="selected" title="專屬招式" density="compact">
      <p v-for="skill in selected.abilities" :key="skill.id"
        >{{ skill.slot === 'r' ? '蓄力大招' : '普通招式' }}：{{ skill.name
        }}{{ skill.slot === 'r' ? '（蓄力2.6秒）' : '' }}</p
      >
    </UiPanel>
    <UiButton
      label="加入 Boss"
      :disabled="pending || !state || state.bosses.length >= state.limit"
      @click="command('add')"
    />
    <UiPanel
      v-for="boss in state?.bosses || []"
      :key="boss.id"
      :title="boss.name + (!boss.arrived ? ' · 即將登場' : '')"
      density="compact"
    >
      <div v-if="boss.ownerId === state?.selfId" class="scene-boss-actions">
        <UiButton label="恢復狀態" :disabled="pending" @click="command('reset', boss.id)" />
        <UiButton
          label="移除"
          variant="danger"
          :disabled="pending"
          @click="command('remove', boss.id)"
        />
      </div>
      <p v-else>由其他玩家加入</p>
    </UiPanel>
    <StatusSlot :message="error" error persistent />
  </div>
</template>
<style scoped>
.scene-boss-controls {
  display: grid;
  gap: var(--stitch-space-16);
}
.scene-boss-preview {
  width: 128px;
  height: 128px;
  object-fit: contain;
  justify-self: center;
}
.scene-boss-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-12);
}
</style>
