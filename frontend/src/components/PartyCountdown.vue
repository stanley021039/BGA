<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoomStore } from '../stores/room';
import RoomCountdown from './RoomCountdown.vue';
defineProps<{ deadline: number; duration: number; epoch: string; caption: string }>();
const room = useRoomStore(),
  now = ref(Date.now());
let timer: number | undefined;
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 200);
});
onBeforeUnmount(() => window.clearInterval(timer));
</script>
<template>
  <RoomCountdown
    :deadline="deadline"
    :duration="duration"
    :offset="room.clockOffset"
    :epoch="epoch"
    :caption="caption"
    :now="now"
  />
</template>
