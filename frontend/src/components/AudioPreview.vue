<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
defineProps<{ src: string; title: string }>();
const audio=ref<HTMLAudioElement|null>(null);let unbind:(()=>void)|undefined;
onMounted(()=>{if(audio.value)unbind=window.AudioSettings?.bindPreview?.(audio.value);});
onBeforeUnmount(()=>{audio.value?.pause();unbind?.();});
function play(){document.querySelectorAll<HTMLAudioElement>('.resource-audio-preview').forEach(other=>{if(other!==audio.value)other.pause();});}
</script>
<template><audio ref="audio" class="resource-audio-preview" :src="src" :aria-label="title" controls preload="none" @play="play"></audio></template>
