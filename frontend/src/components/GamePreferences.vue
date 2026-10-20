<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { useResource } from '../composables/resource';
import { record, text } from '../services/validation';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import '../styles/approved-lobby.scss';
import '../styles/game-preferences.scss';
import FramePicker from './FramePicker.vue';
import StatusSlot from './StatusSlot.vue';
const prefs = usePreferencesStore(),
  barrage = ref<InstanceType<typeof FramePicker> | null>(null),
  media = ref<InstanceType<typeof FramePicker> | null>(null),
  status = ref('');
let clip: HTMLAudioElement | undefined;
let lastVolumeCue = -Infinity;
const version = useResource(async (request) => {
  const value = text(record(await request('/api/version')).version);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) || value.length > 30)
    throw Error('版本資料格式不正確');
  return value;
});
void version.load();
const frameName = (id: string) => prefs.frames.find((frame) => frame.id === id)?.label || '預設';
function theme(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'auto' || value === 'light' || value === 'dark') prefs.setTheme(value);
}
function audio(kind: 'music' | 'effects', event: Event, volume = false) {
  const input = event.target as HTMLInputElement;
  const settings = window.AudioSettings;
  const previousVolume = settings?.get()[kind].volume;
  settings?.set(kind, volume ? { volume: Number(input.value) / 100 } : { enabled: input.checked }, {
    gesture: event.isTrusted,
  });
  status.value = '';
  if (
    kind === 'effects' &&
    volume &&
    event.isTrusted &&
    previousVolume !== Number(input.value) / 100
  ) {
    previewVolume();
  }
}
function barrages(event: Event) {
  window.MotionPolicy?.set({ barrages: (event.target as HTMLInputElement).checked });
}
function frames(event: Event) {
  window.BarrageFrames?.set({ enabled: (event.target as HTMLInputElement).checked });
}
function previewVolume() {
  const settings = window.AudioSettings;
  const effects = settings?.get().effects;
  if (!effects?.enabled || !effects.volume || document.hidden) return;
  const now = performance.now();
  // A drag updates the current clip's gain through AudioSettings; do not queue
  // a new sound for every input event or replay anything after the gesture.
  if (now - lastVolumeCue < 350) return;
  if (clip) settings?.stopEffect(clip);
  lastVolumeCue = now;
  clip = settings?.playEffect?.('turn', {
    onError: () => {
      status.value = '無法播放音效，請再試一次。';
    },
  });
}
onBeforeUnmount(() => {
  if (clip) window.AudioSettings?.stopEffect(clip);
});
</script>
<template>
  <div class="vue-game-preferences vue-approved-preferences">
    <div class="vue-preferences-scroll">
      <p class="vue-preferences-intro">全遊戲共用</p>
      <section class="vue-preference-group vue-preference-theme"
        ><label
          >外觀模式<select :value="prefs.color?.preference || 'auto'" @change="theme"
            ><option value="auto">跟隨系統</option
            ><option value="light">亮色模式</option
            ><option value="dark">深色模式</option></select
          ></label
        ></section
      >
      <section class="vue-preference-group vue-preference-audio">
        <div
          v-for="kind in ['music', 'effects'] as const"
          :key="kind"
          class="vue-preference-channel"
        >
          <label class="vue-preference-switch"
            ><span>{{ kind === 'music' ? '背景音樂' : '遊戲音效' }}</span
            ><input
              type="checkbox"
              role="switch"
              :checked="prefs.audio?.[kind].enabled"
              :disabled="!prefs.audio"
              :aria-label="'開啟' + (kind === 'music' ? '背景音樂' : '遊戲音效')"
              @change="audio(kind, $event)"
          /></label>
          <label class="vue-preference-volume"
            ><span class="ui-sr-only">{{ kind === 'music' ? '背景音樂' : '遊戲音效' }}音量</span
            ><input
              type="range"
              min="0"
              max="100"
              :value="Math.round((prefs.audio?.[kind].volume || 0) * 100)"
              :disabled="!prefs.audio"
              @input="audio(kind, $event, true)"
            /><output>{{ Math.round((prefs.audio?.[kind].volume || 0) * 100) }}%</output></label
          >
        </div>
      </section>
      <section class="vue-preference-group"
        ><label class="vue-preference-switch"
          ><span>遊戲動畫</span
          ><input
            type="checkbox"
            role="switch"
            :checked="prefs.motion?.enabled"
            :disabled="!prefs.motion"
            @change="prefs.setMotion(($event.target as HTMLInputElement).checked)" /></label
        ><label class="vue-preference-switch"
          ><span>文字與 emoji 彈幕</span
          ><input
            type="checkbox"
            role="switch"
            :checked="prefs.motion?.barrages"
            :disabled="!prefs.motion"
            @change="barrages" /></label
        ><p>{{
          prefs.motion?.reduced
            ? '系統已減少動態；結果保留，彈幕改為靜態。'
            : '關閉動畫仍保留結果；彈幕可另外隱藏。'
        }}</p></section
      >
      <section class="vue-preference-group"
        ><label class="vue-preference-switch"
          ><span>顯示彈幕框</span
          ><input
            type="checkbox"
            role="switch"
            :checked="prefs.barrage?.enabled"
            :disabled="!prefs.barrage"
            @change="frames" /></label
        ><button
          type="button"
          class="vue-preference-frame"
          :disabled="!prefs.frames.length"
          @click="barrage?.open($event.currentTarget as HTMLElement)"
          ><UiIcon name="frame" /><span>彈幕框樣式</span
          ><small>{{ frameName(prefs.barrage?.selected || 'default') }}</small
          ><UiIcon name="next" /></button
        ><button
          type="button"
          class="vue-preference-frame"
          :disabled="!prefs.frames.length"
          @click="media?.open($event.currentTarget as HTMLElement)"
          ><UiIcon name="video" /><span>播放器外觀</span><small>{{ frameName(prefs.media) }}</small
          ><UiIcon name="next" /></button
      ></section>
      <StatusSlot :message="status" :error="!!status" />
    </div>
    <footer
      ><p>{{
        version.data.value
          ? 'v' + version.data.value
          : version.loading.value
            ? '版本載入中…'
            : '版本暫時無法取得'
      }}</p
      ><UiButton
        v-if="version.error.value"
        stitch
        variant="ghost"
        icon="refresh"
        label="重試載入版本"
        :disabled="version.loading.value"
        @click="version.load()"
    /></footer>
  </div>
  <FramePicker ref="barrage" kind="barrage" /><FramePicker ref="media" kind="media" />
</template>
