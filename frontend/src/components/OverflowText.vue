<script setup lang="ts">
defineProps<{ text: string }>();
</script>
<template><span class="ui-player-name ui-overflow-text vue-overflow-text" data-name-activation="hover" :title="text"><span class="ui-player-name-text">{{ text }}</span></span></template>
