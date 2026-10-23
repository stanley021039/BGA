<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MusicQuizSnapshot } from '../contracts/musicquiz';
import UiButton from './UiButton.vue';
const props = defineProps<{
    playback: NonNullable<MusicQuizSnapshot['playback']>;
    active: boolean;
  }>(),
  emit = defineEmits<{ playing: [value: boolean] }>(),
  audio = ref<HTMLAudioElement | null>(null),
  error = ref(''),
  accepted = ref(false);
let unbind: (() => void) | undefined;
function stop() {
  audio.value?.pause();
  emit('playing', false);
}
function play() {
  if (!props.active) {
    stop();
    return;
  }
  error.value = '';
  emit('playing', true);
}
watch(
  () => props.active,
  (value) => {
    if (!value) stop();
  },
);
function visibility() {
  if (document.hidden) stop();
}
onMounted(() => {
  if (audio.value) unbind = window.AudioSettings?.bindPreview(audio.value);
  document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
  stop();
  unbind?.();
  if (audio.value) {
    audio.value.removeAttribute('src');
    audio.value.load();
  }
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div class="vue-room-audio-clip"
    ><template v-if="playback.provider === 'audio'"
      ><audio
        ref="audio"
        :src="playback.url"
        controls
        preload="metadata"
        :aria-label="playback.stage === 'intro' ? '本輪8秒前奏' : '本輪30秒精華'"
        @play="play"
        @pause="emit('playing', false)"
        @ended="emit('playing', false)"
        @error="error = '音檔暫時無法播放，請檢查連線或稍後再試。'"
      /><p>{{ playback.seconds }}秒 · {{ error || '音量只影響自己' }}</p></template
    ><template v-else
      ><UiButton legacy
        v-if="!accepted"
        icon="play"
        label="載入本題影片（連線YouTube）"
        :disabled="!active"
        @click="accepted = true"
      /><iframe
        v-else
        :src="
          'https://www.youtube-nocookie.com/embed/' +
          playback.videoId +
          '?start=' +
          playback.start +
          '&end=' +
          (playback.start + playback.seconds) +
          '&rel=0'
        "
        title="本輪歌曲片段"
        allow="autoplay; encrypted-media"
        referrerpolicy="strict-origin-when-cross-origin"
      /><p>影片若禁止嵌入，請由管理者補上原生音檔。</p></template
    ></div
  >
</template>
