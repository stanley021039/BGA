<script setup lang="ts">
import { ref } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';

defineProps<{ names: string[] }>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
</script>

<template>
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
