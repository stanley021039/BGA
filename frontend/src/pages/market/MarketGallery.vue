<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMarketStore, useMarketGalleryStore } from '../../stores/market';
import { marketImageRules, marketTime } from '../../contracts/market';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import MarketRulePicks from './MarketRulePicks.vue';
import MarketImageCard from './MarketImageCard.vue';
const props = defineProps<{ review?: boolean }>(),
  market = useMarketStore(),
  gallery = useMarketGalleryStore(),
  fileInput = ref<HTMLInputElement | null>(null),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const uploadLocked = computed(
    () => gallery.uploadBusy || gallery.uploadReading || !!gallery.uploadAttempt,
  ),
  approvalLocked = computed(() => gallery.approvalBusy || gallery.reviewBusy || !!gallery.approval);
async function upload() {
  if (await gallery.submitUpload()) if (fileInput.value) fileInput.value.value = '';
}
async function openApproval(all = false) {
  if (gallery.openApproval(all)) await dialog.value?.open();
}
async function approve() {
  if (await gallery.approve()) dialog.value?.close();
}
</script>
<template>
  <section v-if="!props.review" class="vue-market-gallery-grid"
    ><section class="vue-market-panel"
      ><h2>投稿預測圖片</h2
      ><p
        >PNG、JPEG 或 WebP，最多 2 MiB；尺寸最多 4096 × 4096，總像素最多 800 萬。核准後才會抽選。</p
      ><p
        >每人最多 {{ gallery.limits.maxPerUser }} 張，全站最多
        {{ gallery.limits.maxImages }} 張、容量
        {{ gallery.limits.maxStorageBytes / 1048576 }} MiB。</p
      ><label
        >圖片檔案<input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          :disabled="uploadLocked"
          @change="gallery.chooseFile(($event.target as HTMLInputElement).files?.[0])" /></label
      ><div class="vue-market-upload-preview"
        ><template v-if="gallery.upload"
          ><img :src="gallery.upload.url" alt="待投稿圖片預覽" /><p
            >{{ gallery.upload.name }} · {{ gallery.upload.width }} × {{ gallery.upload.height }}</p
          ></template
        ><p v-else>選擇檔案後顯示預覽</p></div
      ><p>上傳者：{{ market.state?.me.displayName }}（依登入帳號記錄）</p
      ><MarketRulePicks
        v-model:buckets="gallery.buckets"
        v-model:weekdays="gallery.weekdays"
        :disabled="uploadLocked" /><p
        >區間與星期須同時符合，同組擇一符合即可。全選七天表示不限星期；送出後不能原地修改規則。</p
      ><StatusSlot :message="gallery.uploadMessage" :error="gallery.uploadFailed" /><UiButton legacy
        icon="upload"
        :label="gallery.uploadAttempt ? '重試確認同一筆投稿' : '送出投稿'"
        :pending="gallery.uploadBusy || gallery.uploadReading"
        :disabled="
          !gallery.uploadAttempt &&
          (!gallery.upload ||
            !gallery.buckets.length ||
            !gallery.weekdays.length ||
            gallery.mine.length >= gallery.limits.maxPerUser)
        "
        @click="upload()"
    /></section>
    <section class="vue-market-panel"
      ><div class="vue-market-panel-heading"
        ><h2>我的投稿</h2
        ><UiButton legacy
          icon="refresh"
          label="更新我的投稿"
          :pending="gallery.mineBusy"
          @click="gallery.loadMine()" /></div
      ><StatusSlot
        :message="
          gallery.mineError ||
          (gallery.mineBusy
            ? '正在載入投稿…'
            : `共 ${gallery.mine.length} / ${gallery.limits.maxPerUser} 張投稿`)
        "
        :error="!!gallery.mineError"
      /><div class="vue-market-image-list"
        ><article v-for="image in gallery.mine" :key="image.id + ':' + gallery.reloadKey"
          ><MarketImageCard
            :image="image"
            label="我的投稿預覽"
            :active="market.view === 'uploads'"
          /><strong>{{ image.status === 'approved' ? '已核准' : '待核准' }}</strong
          ><p>{{ marketImageRules(image) }}</p
          ><small
            >{{ image.width }} × {{ image.height }} · {{ marketTime(image.createdAt) }}</small
          ></article
        ><p v-if="!gallery.mine.length && !gallery.mineBusy && !gallery.mineError"
          >尚無投稿。</p
        ></div
      ></section
    ></section
  >
  <section v-else class="vue-market-panel"
    ><div class="vue-market-panel-heading"
      ><h2>待核准圖片</h2
      ><UiButton legacy
        icon="refresh"
        label="更新待審清單"
        :pending="gallery.reviewBusy"
        :disabled="gallery.approvalBusy"
        @click="gallery.loadReview()" /></div
    ><p>同組勾選為「或」，區間與星期為「且」；未勾選的組別不限。星期依目標交易日判定。</p
    ><MarketRulePicks
      v-model:buckets="gallery.filterBuckets"
      v-model:weekdays="gallery.filterWeekdays"
      filters
      :disabled="gallery.approvalBusy"
    /><div class="vue-market-actions"
      ><UiButton legacy
        icon="check"
        :label="`核准已勾選（${gallery.selected.length}）`"
        :disabled="approvalLocked || !gallery.selected.length"
        @click="openApproval(false)" /><UiButton legacy
        icon="users"
        :label="`核准全部篩選結果（${gallery.review.length}）`"
        :disabled="approvalLocked || !gallery.review.length"
        @click="openApproval(true)" /><UiButton legacy
        v-if="gallery.approval"
        icon="refresh"
        label="確認上一批操作"
        :disabled="gallery.approvalBusy"
        @click="dialog?.open()" /></div
    ><StatusSlot
      :message="
        gallery.reviewError ||
        gallery.reviewMessage ||
        (gallery.reviewBusy
          ? '正在載入待審圖片…'
          : `已勾選 ${gallery.selected.length} / ${gallery.review.length} 張`)
      "
      :error="!!gallery.reviewError"
    /><div class="vue-market-image-list"
      ><article v-for="image in gallery.review" :key="image.id + ':' + gallery.reloadKey"
        ><label
          ><input
            v-model="gallery.selected"
            type="checkbox"
            :value="image.id"
            :disabled="gallery.approvalBusy"
          />選擇 {{ image.authorName }} 的投稿</label
        ><MarketImageCard
          :image="image"
          label="待核准投稿預覽"
          :active="market.view === 'admin'"
        /><p>{{ marketImageRules(image) }}</p
        ><small
          >{{ image.width }} × {{ image.height }} · {{ marketTime(image.createdAt) }} · 版本
          {{ image.version }}</small
        ></article
      ><p v-if="!gallery.review.length && !gallery.reviewBusy && !gallery.reviewError"
        >沒有符合篩選的待核准圖片。</p
      ></div
    >
    <UiDialog legacy
      ref="dialog"
      title="確認核准圖片"
      :dismissible="!gallery.approvalBusy"
      @closed="gallery.closeApproval()"
      ><template v-if="gallery.approval"
        ><p
          >本次只核准以下
          {{ gallery.approval.images.length }} 張圖片及其版本。確認後的新投稿不會加入此批次。</p
        ><div class="vue-market-approval-items"
          ><p v-for="image in gallery.approval.details" :key="image.id"
            ><strong>{{ image.authorName }}</strong> · {{ marketImageRules(image)
            }}<small>圖片 {{ image.id }} · 版本 {{ image.version }}</small></p
          ></div
        ><StatusSlot :message="gallery.approval.error" :error="!!gallery.approval.error" /><div
          class="vue-market-actions"
          ><UiButton legacy
            label="返回清單"
            :disabled="gallery.approvalBusy"
            @click="dialog?.close()" /><UiButton legacy
            icon="check"
            :label="
              gallery.approval.uncertain
                ? '重試確認同一批'
                : `確認核准 ${gallery.approval.images.length} 張`
            "
            :pending="gallery.approvalBusy"
            :disabled="gallery.approval.invalid"
            @click="approve()" /></div></template
    ></UiDialog>
  </section>
</template>
