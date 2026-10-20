<script setup lang="ts">
import { ref, watch } from 'vue';
import UiIcon from './UiIcon.vue';
const props = defineProps<{ icon: string; image?: string }>(),
  failed = ref(false);
watch(
  () => props.image,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <img v-if="image && !failed" :src="image" alt="" @error="failed = true" /><UiIcon
    v-else
    :name="icon"
  />
</template>
