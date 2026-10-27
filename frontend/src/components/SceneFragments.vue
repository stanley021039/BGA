<script setup lang="ts">
import type { LobbyVisitor } from '../contracts/lobby';
import { sizedImage } from '../services/image-size';
defineProps<{ visitors: LobbyVisitor[] }>();
</script>
<template>
  <template v-for="owner in visitors" :key="owner.id">
    <div
      v-if="owner.fragment"
      class="scene-fragment"
      :style="{ left: owner.fragment.x + '%', top: owner.fragment.y + '%' }"
      role="img"
      :aria-label="owner.name + '的下半身，本人走近可拾回'"
    >
      <div class="scene-fragment-crop"
        ><img :src="sizedImage(owner.image, 128)" alt="" draggable="false"
      /></div>
      <progress
        :value="owner.fragment.health"
        :max="owner.fragment.maxHealth"
        :aria-label="owner.name + '的下半身生命'"
      />
    </div>
  </template>
</template>
<style scoped>
.scene-fragment {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 64px;
  pointer-events: none;
}
.scene-fragment-crop {
  height: 32px;
  overflow: hidden;
}
.scene-fragment img {
  display: block;
  width: 64px;
  height: 64px;
  object-fit: contain;
  translate: 0 -32px;
}
.scene-fragment progress {
  display: block;
  width: 100%;
  height: 6px;
  accent-color: var(--stitch-warning-ink);
}
</style>
