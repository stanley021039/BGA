<script setup lang="ts">
import type { QuacksSnapshot } from '../../contracts/quacks';
// The fortune is drawn and flipped in place; every seat sees the same card back first.
defineProps<{
  fortune: QuacksSnapshot['fortune'];
  flipped: boolean;
  canDraw: boolean;
  caption: string;
}>();
defineEmits<{ draw: [] }>();
</script>
<template>
  <section class="vue-quacks-fortune-draw quacks-fortune-stage">
    <button
      type="button"
      class="quacks-fortune-card"
      :class="{ 'is-flipped': flipped, 'can-draw': canDraw }"
      :disabled="!canDraw"
      :aria-label="
        flipped && fortune
          ? fortune.name + '：' + fortune.text
          : canDraw
            ? '點擊抽取本輪占卜牌'
            : caption
      "
      @click="$emit('draw')"
    >
      <span class="quacks-fortune-face is-back" aria-hidden="true"
        ><img src="/assets/quacks/fortune-back.svg" alt=""
      /></span>
      <span
        class="quacks-fortune-face is-front"
        :data-timing="fortune?.timing || 'round'"
        aria-hidden="true"
        ><template v-if="fortune"
          ><small>郎中藥典 · 占卜</small
          ><span class="quacks-fortune-timing">{{
            fortune.timing === 'immediate' ? '立即生效' : '本回合生效'
          }}</span
          ><strong>{{ fortune.name }}</strong
          ><span class="quacks-fortune-text">{{ fortune.text }}</span></template
        ></span
      >
    </button>
    <p role="status">{{ caption }}</p>
  </section>
</template>
<style scoped>
.quacks-fortune-stage {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 16px;
  min-height: 100%;
  perspective: 1200px;
}
.quacks-fortune-stage > p {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
}
.quacks-fortune-card {
  position: relative;
  width: 240px;
  height: 330px;
  padding: 0;
  border: 0;
  background: none;
  transform-style: preserve-3d;
  transition: transform 0.9s cubic-bezier(0.2, 0.65, 0.3, 1);
  cursor: default;
}
.quacks-fortune-card.can-draw {
  cursor: pointer;
}
.quacks-fortune-card.can-draw:hover {
  transform: translateY(-6px);
}
.quacks-fortune-card:disabled {
  opacity: 1;
}
.quacks-fortune-card.is-flipped {
  transform: rotateY(180deg);
}
.quacks-fortune-face {
  position: absolute;
  inset: 0;
  display: grid;
  border-radius: 18px;
  overflow: hidden;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  box-shadow: 0 12px 30px #0006;
}
.quacks-fortune-face.is-back img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.quacks-fortune-face.is-front {
  transform: rotateY(180deg);
  align-content: center;
  justify-items: center;
  gap: 12px;
  padding: 24px;
  box-sizing: border-box;
  border: 3px solid #cdb176;
  color: #fff4d5;
  text-align: center;
  background: linear-gradient(145deg, #456279, #24394c);
}
.quacks-fortune-face.is-front[data-timing='immediate'] {
  background: linear-gradient(145deg, #654966, #2d263b);
}
.quacks-fortune-face.is-front small {
  color: #dacb98;
}
.quacks-fortune-face.is-front strong {
  font-size: 1.5rem;
}
.quacks-fortune-text {
  line-height: 1.7;
}
@media (prefers-reduced-motion: reduce) {
  .quacks-fortune-card {
    transition: none;
  }
}
:global(html.motion-reduced) .quacks-fortune-card {
  transition: none;
}
</style>
