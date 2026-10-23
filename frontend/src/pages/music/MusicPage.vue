<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useMusicStore } from '../../stores/libraries';
import { useMutation } from '../../composables/mutation';
import { audioDuration } from '../../services/files';
import { uploadBinary } from '../../services/http';
import ResourcePanel from '../../components/ResourcePanel.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import UiButton from '../../components/UiButton.vue';
import AudioPreview from '../../components/AudioPreview.vue';
const store = useMusicStore(),
  query = ref(''),
  title = ref(''),
  file = shallowRef<File | null>(null),
  input = ref<HTMLInputElement | null>(null);
const { pending, message, failed, run } = useMutation();
const found = computed(() =>
  (store.data?.tracks || []).filter((t) =>
    (t.title + ' ' + t.author).toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()),
  ),
);
const duration = (n: number) =>
  Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0');
async function upload() {
  await run(async (_request, signal) => {
    if (!file.value) throw Error('請先選擇音樂檔案');
    if (file.value.size > 20 * 1024 * 1024) throw Error('每首最多 20 MB。');
    const seconds = await audioDuration(file.value, signal);
    await uploadBinary(
      '/api/music/upload',
      file.value,
      {
        'Content-Type': ['audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(file.value.type)
          ? file.value.type
          : 'application/octet-stream',
        'X-Music-Title': encodeURIComponent(title.value.trim()),
        'X-Music-Duration': String(seconds),
      },
      signal,
    );
    title.value = '';
    file.value = null;
    if (input.value) input.value.value = '';
    const loaded = await store.load();
    message.value = '已上傳，所有會員都能選用。' + (loaded ? '' : '清單暫時無法更新，請重新載入。');
  });
}
async function remove(id: string, name: string) {
  if (!confirm('刪除「' + name + '」？正在使用它的桌子會停止播放。')) return;
  await run(async (request) => {
    await request('/api/music/' + id + '/delete', {});
    const loaded = await store.load();
    message.value = '音樂已刪除。' + (loaded ? '' : '清單暫時無法更新，請重新載入。');
  });
}
onMounted(() => void store.load());
</script>
<template>
  <h1>選一首，陪朋友玩。</h1
  ><p
    >上傳後所有已登入會員都能收聽，同房玩家都可在遊戲桌選曲播放。每首最多 20 MB，每人最多 20 首。</p
  >
  <form id="music-upload" class="vue-stitch-panel" @submit.prevent="upload" :aria-busy="pending"
    ><label
      >曲名<input
        id="upload-title"
        v-model="title"
        maxlength="80"
        required
        placeholder="這首歌叫什麼？"
        :disabled="pending" /></label
    ><label
      >音樂檔案<input
        id="upload-file"
        ref="input"
        type="file"
        accept=".mp3,.m4a,.ogg,audio/mpeg,audio/mp4,audio/ogg"
        required
        :disabled="pending"
        @change="file = ($event.target as HTMLInputElement).files?.[0] || null" /></label
    ><p>支援 MP3、M4A、OGG。請分享你有權公開播放的音樂。</p
    ><UiButton
      variant="primary"
      type="submit"
      id="upload-button"
      icon="upload"
      label="上傳到共用音樂庫"
      :pending="pending"
      :disabled="pending" /><StatusSlot
      id="upload-message"
      class="resource-status"
      :message="message"
      :error="failed"
  /></form>
  <ResourcePanel
    :loading="store.loading"
    :error="store.error"
    :empty="!found.length"
    empty-label="目前沒有符合的音樂。"
    @retry="store.load()"
  >
    <template #heading
      ><h2
        >大家的音樂 <span id="music-count">{{ store.data?.tracks.length || 0 }} 首</span></h2
      ></template
    >
    <template #filters
      ><input
        id="music-search"
        v-model="query"
        placeholder="搜尋曲名或上傳者"
        aria-label="搜尋音樂"
    /></template>
    <div id="music-list"
      ><article v-for="track in found" :key="track.id"
        ><h2>{{ track.title }}</h2
        ><p class="music-meta"
          >{{ track.author }} · {{ duration(track.duration) }} ·
          {{ (track.size / 1024 / 1024).toFixed(1) }} MB</p
        ><AudioPreview :src="'/assets/music/' + track.id" :title="track.title" /><button
          v-if="track.ownerId === store.data?.me || store.data?.admin"
          class="button outline"
          :disabled="pending"
          @click="remove(track.id, track.title)"
          >刪除音樂</button
        ></article
      ></div
    >
  </ResourcePanel>
</template>
