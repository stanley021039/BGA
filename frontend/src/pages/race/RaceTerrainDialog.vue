<script setup lang="ts">
import { computed, ref } from 'vue';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import { terrainReference } from './terrain-reference';
import '../../styles/race-terrain.scss';
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const selected = ref<string | null>(null);
const item = computed(() => terrainReference.find((entry) => entry.key === selected.value));
function open(key?: string) {
  selected.value = typeof key === 'string' ? key : null;
  dialog.value?.open();
}
defineExpose({ open });
</script>
<template>
  <UiDialog
    ref="dialog"
    stitch
    class="vue-race-terrain-dialog"
    :title="item?.name || '地形與危險圖例'"
  >
    <div v-if="item" class="vue-race-terrain-detail">
      <img :src="item.art" :alt="item.name + '地形原生格位'" width="160" height="160" />
      <p>{{ item.help }}</p>
    </div>
    <div v-else class="vue-race-terrain-index">
      <p>⚠ 表示未揭露危險；規劃路線只使用已公開地形，抵達後才揭示。直升機不能部署在任何危險格。</p>
      <div class="vue-race-terrain-options">
        <UiButton
          v-for="entry in terrainReference"
          :key="entry.key"
          stitch
          :label="entry.name"
          @click="selected = entry.key"
        >
          <template #icon><img :src="entry.art" alt="" width="64" height="64" /></template>
        </UiButton>
      </div>
      <p>惡魔賽道為地形／危險試玩；目前沒有 21 張持續效果牌。</p>
    </div>
    <footer class="vue-race-terrain-footer">
      <UiButton v-if="item" stitch label="全部地形" icon="arrow_back" @click="selected = null" />
      <UiButton stitch label="關閉" @click="dialog?.close()" />
    </footer>
  </UiDialog>
</template>
