<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import UiButton from './UiButton.vue';
import { installMobileLandscape } from '../services/mobile-landscape';
const portrait = ref(false);
let controller: ReturnType<typeof installMobileLandscape> | undefined;
onMounted(() => {
  controller = installMobileLandscape(window, document, (value) => (portrait.value = value));
});
onBeforeUnmount(() => controller?.stop());
</script>
<template>
  <Teleport to="body">
    <UiButton
      v-if="portrait"
      class="mobile-landscape-hint"
      label="請將手機轉橫 · 橫向全螢幕"
      @click="controller?.request()"
    />
  </Teleport>
</template>
<style scoped>
.mobile-landscape-hint {
  position: fixed;
  inset-block-start: max(var(--stitch-space-8), env(safe-area-inset-top));
  inset-inline-start: 50%;
  translate: -50% 0;
  max-inline-size: calc(100dvw - var(--stitch-space-32));
  z-index: 1900;
}
</style>
