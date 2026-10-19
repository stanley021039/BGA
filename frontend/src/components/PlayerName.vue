<script setup lang="ts">
defineProps<{ name: string }>();
</script>
<template>
  <span class="vue-player-name ui-player-name" :title="name"
    ><span class="ui-player-name-text">{{ name }}</span></span
  >
</template>
