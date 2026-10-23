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
  gap: 4px;
  max-width: 100%;
  vertical-align: middle;
}
.mq-king-token-label {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  color: var(--play-ink, #292639);
  font-size: 14px;
  line-height: 1.5;
}
.mq-king-token-label strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mq-king-token-label small {
  font-size: 14px;
  font-weight: 500;
}
.mq-king-token-slots {
  display: flex;
  gap: 4px;
}
.mq-king-token-slot {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  border: 1px dashed var(--play-line, #8e8594);
  border-radius: 50%;
}
.mq-king-token-slot.is-owned {
  border: none;
}
.mq-king-token-slot img {
  display: block;
  width: 24px;
  height: 24px;
}
</style>
