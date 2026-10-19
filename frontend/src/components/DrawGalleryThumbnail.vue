<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue';
import type { PublicDrawSnapshot } from '../contracts/draw-results';
import { useDrawResultsStore } from '../stores/draw-results';
import { useRoomStore } from '../stores/room';
import ResultCanvas from './ResultCanvas.vue';
const props = defineProps<{ resultId: string }>();
const results = useDrawResultsStore(), room = useRoomStore(), snapshot = shallowRef<PublicDrawSnapshot | null>(null);
let generation = 0, disposed = false;
watch(() => [props.resultId, room.scope, results.enabled] as const, async ([id, scope, enabled]) => {
  const epoch = ++generation; snapshot.value = null;
  if (!enabled) return;
  try {
    const value = await results.load(id);
    if (!disposed && epoch === generation && scope === room.scope && results.enabled) snapshot.value = value;
  } catch { /* Full preview owns load errors and retry; a thumbnail is optional. */ }
}, { immediate: true });
onBeforeUnmount(() => { disposed = true; generation++; });
</script>
<template><div class="vue-gallery-thumbnail" aria-hidden="true"><ResultCanvas v-if="snapshot" :snapshot="snapshot" compact /><span v-else class="vue-gallery-thumbnail-empty">畫作</span></div></template>
