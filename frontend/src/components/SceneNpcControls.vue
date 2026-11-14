<script setup lang="ts">
import { ref, useId } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiTabs from './UiTabs.vue';
import SceneBotPanel from './SceneBotPanel.vue';
import SceneBossPanel from './SceneBossPanel.vue';
defineProps<{ botsLocked?: boolean }>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const opened = ref(false),
  tab = ref('bots');
const prefix = 'scene-npc-' + useId();
const arena = location.pathname === '/arena';
const tabs = [
  { id: 'bots', label: '機器人', count: arena ? '固定主動攻擊' : '最多3隻' },
  { id: 'bosses', label: 'Boss', count: arena ? '最多1隻' : '最多2隻' },
];
function open() {
  opened.value = true;
  dialog.value?.open();
}
</script>
<template>
  <UiButton label="機器人與 Boss" icon="users" @click="open" />
  <UiDialog ref="dialog" title="機器人與 Boss" @closed="opened = false">
    <div v-if="opened" class="scene-npc-controls">
      <p>加入陪練夥伴，或挑戰大型 Boss。</p>
      <UiTabs
        v-model="tab"
        :items="tabs"
        label="陪練類型"
        :id-prefix="prefix"
        :panel-prefix="prefix + '-panel'"
      />
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
</style>
