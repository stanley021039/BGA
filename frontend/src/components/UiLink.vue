<script setup lang="ts">
import UiIcon from './UiIcon.vue';
defineProps<{ href: string; label: string; icon?: string; iconOnly?: boolean }>();
</script>
<template>
  <a
    :href="href"
    class="ui-button vue-button"
    :class="{ 'ui-icon-button': iconOnly }"
    :aria-label="label"
    :title="iconOnly ? label : undefined"
    ><UiIcon v-if="icon" :name="icon" class="ui-button-icon" /><span
      class="vue-button-caption"
      :class="{ 'ui-sr-only': iconOnly }"
      >{{ label }}</span
    ></a
  >
</template>
