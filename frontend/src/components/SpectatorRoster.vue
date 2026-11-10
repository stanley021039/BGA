<script setup lang="ts">
import { ref } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';

defineProps<{ names: string[]; inline?: boolean }>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
</script>

<template>
  <section v-if="inline && names.length" class="vue-room-viewer-list" aria-label="觀戰中">
    <h3>觀戰中 · {{ names.length }} 人</h3>
    <ul
      ><li v-for="(name, index) in names" :key="index">{{ name }}</li></ul
    >
  </section>
  <template v-else-if="!inline">
    <UiButton
      :label="'觀戰 ' + names.length + ' 人'"
      variant="ghost"
      aria-haspopup="dialog"
      @click.stop="dialog?.open($event.currentTarget as HTMLElement)"
    />
    <Teleport to="body">
      <UiDialog ref="dialog" title="觀戰名單" compact>
        <UiList v-if="names.length" as="ul">
          <UiListRow v-for="(name, index) in names" :key="index" as="li">{{ name }}</UiListRow>
        </UiList>
        <p v-else>目前沒有觀眾。</p>
      </UiDialog>
    </Teleport>
  </template>
</template>
