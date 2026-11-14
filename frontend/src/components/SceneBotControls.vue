<script setup lang="ts">
import { ref } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import SceneBotPanel from './SceneBotPanel.vue';
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const opened = ref(false);
function open() {
  opened.value = true;
  dialog.value?.open();
}
</script>
<template>
  <UiButton label="機器人" icon="users" @click="open" />
  <UiDialog ref="dialog" title="機器人設定" @closed="opened = false">
    <SceneBotPanel v-if="opened" @preview="dialog?.close()" />
  </UiDialog>
</template>
