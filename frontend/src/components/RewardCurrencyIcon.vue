<script setup lang="ts">
defineProps<{ kind: 'stone' | 'fragment'; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 32 32"
    aria-hidden="true"
    focusable="false"
    class="reward-currency-icon"
  >
    <g v-if="kind === 'stone'" stroke-linejoin="round">
      <path
        d="M16 2 26 8l2 13-12 9L4 21 6 8Z"
        fill="var(--stitch-primary-active)"
        stroke="color-mix(in srgb, var(--stitch-on-primary), var(--stitch-primary) 36%)"
      />
      <path
        d="m16 2 3.8 9.2L26 8ZM6 8l10-6-4 9.2ZM4 21l8-9.8 4 18.8Zm24 0-8.2-9.8L16 30Z"
        fill="var(--stitch-primary-hover)"
      />
      <path
        d="m6 8 6 3.2L4 21Zm20 0-6.2 3.2L28 21ZM12 11.2h7.8L16 30Z"
        fill="color-mix(in srgb, var(--stitch-on-primary), var(--stitch-primary) 65%)"
      />
      <path
        d="m16 7 1.7 6.8 6 1.8-6 1.8L16 24l-1.7-6.6-6-1.8 6-1.8Z"
        fill="var(--stitch-selected-bg)"
      />
      <path
        d="M8 10.5 16 6l8 4.5"
        fill="none"
        stroke="var(--stitch-selected-bg)"
        stroke-linecap="round"
      />
    </g>
    <g
      v-else
      stroke="color-mix(in srgb, var(--stitch-on-primary), var(--stitch-info-line) 34%)"
      stroke-linejoin="round"
    >
      <path d="M14 3 24 6l-3 10-7-5Z" fill="var(--stitch-info-line)" />
      <path
        d="m3 18 8-7 6 6-5 9Z"
        fill="color-mix(in srgb, var(--stitch-info-line), var(--stitch-info-ink) 23%)"
      />
      <path
        d="m16 27 5-8 8-3-2 10-7 4Z"
        fill="color-mix(in srgb, var(--stitch-info-line), var(--stitch-info-ink) 12%)"
      />
      <path d="m14 3 5 6 5-3Zm7 13-2-7-5 2Z" fill="var(--stitch-info-bg)" stroke="none" />
      <path d="m3 18 9 1-1-8Zm13 9 8-5 5-6-8 3Z" fill="var(--stitch-info-bg)" stroke="none" />
      <path
        d="m12 19 5-2-5 9Zm12 3-4 8 7-4Z"
        fill="color-mix(in srgb, var(--stitch-info-line), var(--stitch-info-ink) 43%)"
        stroke="none"
      />
    </g>
  </svg>
</template>

<style scoped>
.reward-currency-icon {
  flex: none;
  display: inline-block;
  vertical-align: middle;
}
</style>
