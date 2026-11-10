<script setup lang="ts">
import { ref, watch } from 'vue';
import AudioSettings from '../engines/audio-settings.js';
import type { SpectatorSnapshot } from '../contracts/spectator';
import UiButton from './UiButton.vue';

const props = defineProps<{
  music: SpectatorSnapshot['roomMusic'];
  active: boolean;
  offset: number;
}>();
const listening = ref(false);
const audio = ref<HTMLAudioElement | null>(null);

function sync() {
  const player = audio.value,
    music = props.music;
  if (!player || !music) return;
  const elapsed = music.playing
    ? Math.max(0, (Date.now() - props.offset - music.serverNow) / 1000)
    : 0;
  if (player.readyState >= 1 && Number.isFinite(player.duration)) {
    const position = Math.min(player.duration, Math.max(0, music.position + elapsed));
    if (Math.abs(player.currentTime - position) > 1.5) player.currentTime = position;
  }
  if (listening.value && props.active && music.playing)
    void player.play().catch(() => {
      listening.value = false;
    });
  else player.pause();
}

function toggle() {
  listening.value = !listening.value;
  sync();
}

watch(() => [props.music, props.active, audio.value], sync, { flush: 'post' });
watch(
  audio,
  (player, _, onCleanup) => {
    if (!player) return;
    const unbind = AudioSettings?.bindPreview(player);
    onCleanup(() => {
      player.pause();
      unbind?.();
    });
  },
  { flush: 'post' },
);
</script>

<template>
  <div v-if="music">
    <audio
      ref="audio"
      :src="'/assets/music/' + encodeURIComponent(music.id)"
      preload="metadata"
      @loadedmetadata="sync"
    />
    <UiButton
      :label="listening ? '靜音房間音樂' : '播放房間音樂'"
      :aria-pressed="listening"
      @click="toggle"
    />
    <p>{{ music.title }}</p>
  </div>
</template>
