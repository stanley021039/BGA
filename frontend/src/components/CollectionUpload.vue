<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useMutation } from '../composables/mutation';
import type { Artwork } from '../contracts/libraries';
import { audioDuration, fileBase64 } from '../services/files';
import { uploadBinary } from '../services/http';
import { record, text } from '../services/validation';
import UiButton from './UiButton.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{
  kind: 'avatar' | 'character' | 'from-artwork' | 'music';
  artworks?: Artwork[];
  reload: () => Promise<boolean>;
}>();
const { pending, message, failed, run } = useMutation();
const name = ref(''),
  shared = ref(false),
  artworkId = ref(''),
  file = shallowRef<File | null>(null),
  input = ref<HTMLInputElement | null>(null);
const label = computed(
  () =>
    ({ avatar: '上傳頭像', character: '上傳角色', 'from-artwork': '建立角色', music: '上傳音樂' })[
      props.kind
    ],
);
const maxName = computed(() => (props.kind === 'music' ? 80 : props.kind === 'avatar' ? 40 : 32));
async function submit() {
  await run(async (request, signal) => {
    let warning = '';
    if (props.kind === 'music') {
      if (!file.value || file.value.size > 20 * 1024 * 1024) throw Error('每首最多 20 MB');
      const duration = await audioDuration(file.value, signal);
      await uploadBinary(
        '/api/music/upload',
        file.value,
        {
          'Content-Type': 'application/octet-stream',
          'X-Music-Title': encodeURIComponent(name.value.trim()),
          'X-Music-Duration': String(duration),
        },
        signal,
      );
    } else {
      let image: { artworkId: string } | { mime: string; base64: string };
      if (props.kind === 'from-artwork') {
        if (!artworkId.value) throw Error('先選擇自己收藏的圖片，或開啟繪圖工具建立。');
        image = { artworkId: artworkId.value };
      } else {
        if (!file.value) throw Error('請先選擇圖片');
        if (file.value.type && !['image/png', 'image/gif', 'image/webp'].includes(file.value.type))
          throw Error('只支援 PNG、GIF、WebP');
        image = {
          mime: file.value.type,
          base64: await fileBase64(file.value, (props.kind === 'avatar' ? 1 : 4) * 1024 * 1024),
        };
      }
      const result = record(
        await request(props.kind === 'avatar' ? '/api/artworks' : '/api/profile/characters', {
          name: name.value,
          ...image,
        }),
      );
      if (shared.value) {
        const id = text(result.id);
        try {
          await request(
            props.kind === 'avatar'
              ? `/api/artworks/${encodeURIComponent(id)}/sharing`
              : `/api/profile/characters/${encodeURIComponent(id.slice(5))}/sharing`,
            { shared: true },
          );
        } catch {
          signal.throwIfAborted();
          warning = '已加入私人收藏，但分享失敗；可從卡片再次分享。';
        }
      }
    }
    name.value = '';
    shared.value = false;
    artworkId.value = '';
    file.value = null;
    if (input.value) input.value.value = '';
    const loaded = await props.reload();
    message.value =
      (warning || '已加入收藏庫。') + (loaded ? '' : '清單暫時無法更新，請重新載入。');
    failed.value = !!warning;
  });
}
</script>
<template>
  <form class="collection-upload" :aria-busy="pending" @submit.prevent="submit">
    <label
      >{{ kind === 'music' ? '曲名' : kind === 'from-artwork' ? '角色名稱' : '名稱'
      }}<input v-model="name" name="name" :maxlength="maxName" required :disabled="pending"
    /></label>
    <label v-if="kind === 'from-artwork'"
      >我的收藏圖片<select
        id="character-artwork"
        v-model="artworkId"
        name="artworkId"
        required
        :disabled="pending"
        ><option value="">選擇自己的圖片</option
        ><option
          v-for="artwork in (artworks || []).filter((a) => a.owned)"
          :key="artwork.id"
          :value="artwork.id"
          >{{ artwork.name }}</option
        ></select
      ></label
    >
    <label v-else
      >選擇檔案<input
        ref="input"
        type="file"
        name="file"
        :accept="
          kind === 'music'
            ? 'audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg'
            : 'image/png,image/gif,image/webp'
        "
        required
        :disabled="pending"
        @change="file = ($event.target as HTMLInputElement).files?.[0] || null"
    /></label>
    <label v-if="kind !== 'music'" class="collection-share"
      ><input
        v-model="shared"
        type="checkbox"
        name="shared"
        :disabled="pending"
      />分享給會員（未勾選則私人）</label
    >
    <UiButton
      type="submit"
      :label="label"
      :icon="kind === 'from-artwork' ? 'add' : 'upload'"
      icon-only
      :pending="pending"
    />
    <p v-if="kind !== 'from-artwork'">{{
      kind === 'music'
        ? 'MP3、M4A、OGG，每首最多 20 MB，每人 20 首'
        : `PNG、GIF、WebP，每張最多 ${kind === 'avatar' ? 1 : 4} MB`
    }}</p>
    <StatusSlot :message="message" :error="failed" />
  </form>
</template>
