<script setup lang="ts">
import { onBeforeUnmount,onMounted,ref,watch } from 'vue';
import UiButton from './UiButton.vue';
const props=defineProps<{src:string; title:string; active:boolean}>(),audio=ref<HTMLAudioElement|null>(null),error=ref(''),ready=ref(false);let unbind:(()=>void)|undefined;
function stop(){audio.value?.pause();}
function visibility(){if(document.hidden)stop();}
function play(){if(!props.active||document.hidden){stop();return;}error.value='';}
function retry(){if(!audio.value)return;stop();error.value='';ready.value=false;audio.value.load();}
watch(()=>props.active,value=>{if(!value)stop();});
onMounted(()=>{if(audio.value)unbind=window.AudioSettings?.bindPreview(audio.value);document.addEventListener('visibilitychange',visibility);});
onBeforeUnmount(()=>{stop();unbind?.();if(audio.value){audio.value.removeAttribute('src');audio.value.load();}document.removeEventListener('visibilitychange',visibility);});
</script>
<template><div class="vue-room-audio-clip"><audio ref="audio" :src="src" controls preload="none" :aria-label="title" @play="play" @error="error='這段音訊暫時無法載入，請確認連線後重試。'" @loadedmetadata="ready=true"></audio><p role="status">{{ error || (!active ? '目前連線未就緒，恢復後請手動播放。' : ready ? '可以重聽，不按速度計分。' : '按播放收聽六秒旋律。') }}</p><UiButton icon="refresh" :disabled="!active" label="重新載入音訊" @click="retry" /></div></template>
