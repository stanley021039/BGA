<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ name: string; avatar?: string | null; bot?: boolean }>();
const failed = ref(false), source = computed(() => props.avatar || (props.bot ? '/assets/characters/sunny-neutral.png' : '/assets/characters/traveler-neutral.png'));
watch(source, () => { failed.value = false; });
</script>
<template><span class="vue-player-avatar" aria-hidden="true"><span>{{ [...name][0] || '？' }}</span><img v-if="!failed" :src="source" alt="" @error="failed = true"></span></template>
