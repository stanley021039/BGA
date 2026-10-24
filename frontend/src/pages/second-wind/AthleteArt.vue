<script setup lang="ts">
import { ref, watch } from 'vue';
import UiBadge from '../../components/UiBadge.vue';
const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
    width: number;
    height: number;
    eager?: boolean;
    srcset?: string;
    sizes?: string;
  }>(),
  { eager: false, srcset: '', sizes: '' },
);
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <span class="athlete-art" :style="{ aspectRatio: `${width}/${height}` }">
    <img
      v-if="!failed && src"
      :src="src"
      :srcset="srcset || undefined"
      :sizes="sizes || undefined"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="athlete-art-fallback" role="img" :aria-label="alt + '，圖片未載入'">
      <UiBadge label="圖片未載入" />
    </span>
  </span>
</template>
<style scoped>
.athlete-art {
  display: block;
  width: 100%;
  min-width: 0;
}
.athlete-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.athlete-art-fallback {
  display: flex;
  align-items: center;
  height: 100%;
  overflow-wrap: anywhere;
}
.athlete-art-fallback > * {
  position: sticky;
  left: 0;
}
</style>
