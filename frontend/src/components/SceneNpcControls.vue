<script setup lang="ts">
import { ref, useId } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiTabs from './UiTabs.vue';
import SceneBotPanel from './SceneBotPanel.vue';
import SceneBossPanel from './SceneBossPanel.vue';
withDefaults(
  defineProps<{ botsLocked?: boolean; variant?: 'secondary' | 'ghost'; caption?: string }>(),
  {
    variant: 'secondary',
  },
);
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const opened = ref(false),
  tab = ref('bots');
const prefix = 'scene-npc-' + useId();
const training =
  location.pathname === '/arena' && new URLSearchParams(location.search).has('training');
const arena = location.pathname === '/arena' && !training;
const tabs = [
  { id: 'bots', label: '機器人', count: arena ? '固定主動攻擊' : '最多5隻' },
  { id: 'bosses', label: 'Boss', count: arena || training ? '最多1隻' : '最多5隻' },
];
function open() {
  opened.value = true;
  dialog.value?.open();
}
</script>
<template>
  <UiButton
    label="機器人與 Boss"
    :caption="caption"
    icon="users"
    :variant="variant"
    @click="open"
  />
  <UiDialog ref="dialog" title="機器人與 Boss" @closed="opened = false">
    <template #before-content>
      <UiTabs
        v-if="opened"
        class="scene-npc-tabs"
        v-model="tab"
        :items="tabs"
        label="陪練類型"
        :id-prefix="prefix"
        :panel-prefix="prefix + '-panel'"
      />
    </template>
    <div v-if="opened" class="scene-npc-controls">
      <div
        v-show="tab === 'bots'"
        :id="prefix + '-panel-bots'"
        role="tabpanel"
        :aria-labelledby="prefix + '-bots'"
      >
        <SceneBotPanel :locked="botsLocked" @preview="dialog?.close()" />
      </div>
      <div
        v-show="tab === 'bosses'"
        :id="prefix + '-panel-bosses'"
        role="tabpanel"
        :aria-labelledby="prefix + '-bosses'"
      >
        <SceneBossPanel />
      </div>
    </div>
  </UiDialog>
</template>
<style scoped>
.scene-npc-controls {
  display: grid;
  gap: var(--stitch-space-20);
}
.scene-npc-tabs {
  flex-shrink: 0;
}
</style>
