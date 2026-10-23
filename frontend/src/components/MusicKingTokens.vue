<script setup lang="ts">
import { computed } from 'vue';
import tokenImage from '../assets/music-king-token.svg';
const props = defineProps<{ count: number }>();
const count = computed(() =>
  Number.isFinite(props.count) ? Math.max(0, Math.min(5, Math.floor(props.count))) : 0,
);
</script>
<template>
  <span class="mq-king-tokens" role="img" :aria-label="'歌王標記：' + count + ' / 5 枚'">
    <span class="mq-king-token-label" aria-hidden="true"
      >歌王標記 <strong>{{ count }}<small> / 5</small></strong></span
    >
    <span class="mq-king-token-slots" aria-hidden="true"
      ><span
        v-for="slot in 5"
        :key="slot"
        class="mq-king-token-slot"
        :class="{ 'is-owned': slot <= count }"
        ><img v-if="slot <= count" :src="tokenImage" alt="" /></span
    ></span>
  </span>
</template>
<style scoped>
.mq-king-tokens {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--stitch-space-4);
  max-width: 100%;
  vertical-align: middle;
}
.mq-king-token-label {
  display: inline-flex;
  align-items: baseline;
  gap: var(--stitch-gap-label);
  color: var(--stitch-ink);
  font-size: var(--stitch-text-hint);
  line-height: var(--stitch-line-height-body);
}
.mq-king-token-label strong {
  font-size: var(--stitch-text-section);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mq-king-token-label small {
  font-size: var(--stitch-text-hint);
  font-weight: var(--stitch-weight-body);
}
.mq-king-token-slots {
  display: flex;
  gap: var(--stitch-space-4);
}
.mq-king-token-slot {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--stitch-space-24);
  height: var(--stitch-space-24);
  border: var(--stitch-border);
  border-style: dashed;
  border-radius: var(--stitch-radius-pill);
}
.mq-king-token-slot.is-owned {
  border: none;
}
.mq-king-token-slot img {
  display: block;
  width: var(--stitch-space-24);
  height: var(--stitch-space-24);
}
</style>
