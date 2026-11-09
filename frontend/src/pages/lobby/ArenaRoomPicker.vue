<script setup lang="ts">
import UiButton from '../../components/UiButton.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';

defineProps<{
  rooms: { id: string; name: string; count: number }[];
  currentId?: string | null;
  invitedId?: string | null;
  disabled?: boolean;
}>();
const emit = defineEmits<{ create: []; join: [id: string] }>();
</script>
<template>
  <UiButton
    label="建立房間"
    icon="add"
    variant="primary"
    :disabled="disabled"
    @click="emit('create')"
  />
  <UiList aria-label="競技場房間">
    <UiListRow v-for="room in rooms" :key="room.id">
      <div class="arena-room-row">
        <span
          >{{ room.name }} · {{ room.count }}/16 人{{
            room.id === invitedId ? ' · 受邀' : ''
          }}</span
        >
        <UiButton
          :label="room.id === currentId ? '目前房間' : '加入'"
          :disabled="disabled || room.id === currentId || room.count >= 16"
          @click="emit('join', room.id)"
        />
      </div>
    </UiListRow>
    <UiListRow v-if="!rooms.length">目前沒有房間。</UiListRow>
  </UiList>
</template>
