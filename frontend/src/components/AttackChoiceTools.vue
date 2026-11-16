<script setup lang="ts">
import UiLink from './UiLink.vue';
import SkillGuide from './SkillGuide.vue';
</script>
<template>
  <div class="attack-choice-tools">
    <UiLink href="/arena?training=1" label="進入訓練場" target="_blank" rel="noopener" />
    <SkillGuide />
    <slot />
  </div>
</template>
<style scoped>
.attack-choice-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-space-16);
  min-inline-size: 0;
}
</style>
