<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useGiftsStore } from '../../stores/libraries';
import { useMutation } from '../../composables/mutation';
import { fileBase64 } from '../../services/files';
import ResourcePanel from '../../components/ResourcePanel.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import UiButton from '../../components/UiButton.vue';
import ArtworkPicker from '../../components/ArtworkPicker.vue';
const store = useGiftsStore();
const { pending, message, failed, run } = useMutation();
const draft = reactive({ title: '', category: '' });
const query = ref(''),
  category = ref(''),
  limit = ref(32),
  selectedArtwork = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null),
  file = shallowRef<File | null>(null),
  previewUrl = ref('');
const found = computed(() =>
  (store.data?.gifts || []).filter(
    (g) =>
      (!category.value || g.category === category.value) &&
      g.title.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()),
  ),
);
const image = computed(
  () =>
    previewUrl.value || store.data?.artworks.find((x) => x.id === selectedArtwork.value)?.url || '',
);
function clearFile() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  file.value = null;
  if (fileInput.value) fileInput.value.value = '';
}
function chooseArtwork(id: string | null) {
  clearFile();
  selectedArtwork.value = id;
}
function fileChanged(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0];
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  file.value = null;
  selectedArtwork.value = null;
  if (!selected) return;
  if (selected.size > 1024 * 1024) {
    message.value = '圖片不得超過 1 MB';
    failed.value = true;
    if (fileInput.value) fileInput.value.value = '';
    return;
  }
  file.value = selected;
  previewUrl.value = URL.createObjectURL(selected);
}
async function submit() {
  await run(async (request) => {
    const picture = selectedArtwork.value
      ? { artworkId: selectedArtwork.value }
      : file.value
        ? { mime: file.value.type, base64: await fileBase64(file.value) }
        : null;
    await request('/api/community/gifts', { ...draft, image: picture });
    draft.title = '';
    selectedArtwork.value = null;
    clearFile();
    limit.value = 32;
    const loaded = await store.load();
    message.value = '禮物已加入共用題庫' + (loaded ? '' : '；清單暫時無法更新，請重新載入。');
  });
}
let initialSelectionApplied = false;
watch(
  () => store.data,
  (data) => {
    if (!data) return;
    if (!data.categories.includes(draft.category)) draft.category = data.categories[0] || '';
    if (!initialSelectionApplied) {
      initialSelectionApplied = true;
      const id = new URLSearchParams(location.search).get('artwork');
      if (data.artworks.some((a) => a.id === id)) selectedArtwork.value = id;
    }
  },
);
onMounted(() => void store.load());
onBeforeUnmount(clearFile);
</script>

<template>
  <div class="library-intro"
    ><span class="eyebrow">MADE BY FRIENDS</span><h1>把你想送的禮物，<br />放進大家的題庫。</h1
    ><p>寫下禮物名稱，圖片可以不放。投稿後，新的遊戲輪次就有機會抽到它。</p></div
  >
  <div class="library-layout resource-workspace">
    <section
      class="card submit-card resource-compose vue-stitch-panel"
      aria-labelledby="submitTitle"
      ><span class="eyebrow">ADD A GIFT</span><h2 id="submitTitle">新增禮物</h2>
      <form id="giftForm" @submit.prevent="submit" :aria-busy="pending">
        <label for="giftTitle">禮物名稱</label
        ><input
          id="giftTitle"
          v-model="draft.title"
          :disabled="pending"
          required
          maxlength="60"
          placeholder="例如：會自動煮咖啡的馬克杯"
        />
        <label for="giftCategory">分類</label
        ><select
          id="giftCategory"
          v-model="draft.category"
          :disabled="pending || store.loading"
          required
          ><option v-for="item in store.data?.categories || []" :key="item">{{
            item
          }}</option></select
        >
        <label for="giftImage">禮物圖片（選填）</label
        ><input
          id="giftImage"
          ref="fileInput"
          type="file"
          accept="image/png,image/gif,image/webp"
          :disabled="pending"
          @change="fileChanged"
        />
        <p class="small">支援 PNG、GIF、WebP，單張最多 1 MB；沒有像素尺寸限制。</p>
        <div class="gift-artwork-picker"
          ><div class="gift-artwork-heading"
            ><strong>或從我的圖庫選圖</strong><a href="/studio">開啟繪畫圖庫 ↗</a></div
          ><ArtworkPicker
            id="giftArtworkList"
            :items="store.data?.artworks || []"
            :model-value="selectedArtwork"
            :disabled="pending"
            @update:model-value="chooseArtwork"
        /></div>
        <div id="imagePreview" class="image-preview resource-image-preview"
          ><img v-if="image" id="previewArt" :src="image" alt="待上傳的禮物圖片預覽" /><span v-else
            >尚未選擇圖片</span
          ><button
            id="removeImage"
            type="button"
            class="quiet"
            :disabled="pending || !image"
            @click="chooseArtwork(null)"
            >移除圖片</button
          ></div
        > </form
      ><UiButton
        stitch
        variant="primary"
        type="submit"
        form="giftForm"
        id="submitGift"
        class="wide"
        icon="next"
        label="加入共用禮物題庫"
        :pending="pending"
        :disabled="pending || !store.data"
      /><StatusSlot id="giftStatus" class="resource-status" :message="message" :error="failed" />
      <p class="small">投稿會保存於主機。「成人派對」分類只會在房主開啟該分類的房間中抽到。</p>
    </section>
    <ResourcePanel
      class="library-results"
      :loading="store.loading"
      :error="store.error"
      :empty="!found.length"
      empty-label="沒有符合的禮物。"
      @retry="store.load()"
    >
      <template #heading
        ><div class="results-head"
          ><div
            ><span class="eyebrow">THE GIFT SHELF</span><h2 id="browseTitle">大家的禮物</h2></div
          ></div
        ></template
      >
      <template #filters
        ><div class="filters"
          ><input
            id="search"
            v-model="query"
            type="search"
            placeholder="搜尋禮物名稱"
            aria-label="搜尋禮物"
            @input="limit = 32"
          /><select id="filter" v-model="category" aria-label="禮物分類" @change="limit = 32"
            ><option value="">全部分類</option
            ><option v-for="item in store.data?.categories || []" :key="item">{{
              item
            }}</option></select
          ></div
        ></template
      >
      <template #summary
        ><span id="resultCount">{{ found.length }} 件禮物</span></template
      >
      <div id="giftList" class="library-gifts"
        ><article v-for="gift in found.slice(0, limit)" :key="gift.id" class="library-gift"
          ><div class="library-gift-art"
            ><img v-if="gift.image" :src="gift.image" alt="" loading="lazy" /><span
              v-else
              aria-hidden="true"
              >✦</span
            ></div
          ><strong>{{ gift.title }}</strong
          ><small>{{ gift.category }} · {{ gift.author }}</small></article
        ></div
      >
      <template #actions
        ><button
          id="more"
          class="button outline"
          type="button"
          :hidden="found.length <= limit"
          @click="limit += 32"
          >載入更多</button
        ></template
      >
    </ResourcePanel>
  </div>
  <p class="small credit"
    >內建禮物圖片取自
    <a href="https://github.com/googlefonts/noto-emoji" target="_blank" rel="noopener noreferrer"
      >Noto Emoji</a
    >（Google，<a
      href="https://www.apache.org/licenses/LICENSE-2.0"
      target="_blank"
      rel="noopener noreferrer"
      >Apache 2.0</a
    >）與
    <a href="https://kenney.nl/assets/generic-items" target="_blank" rel="noopener noreferrer"
      >Kenney Generic Items</a
    >（CC0）；禮物名稱為本站原創。</p
  >
</template>
