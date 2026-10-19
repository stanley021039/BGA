import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useResource } from '../composables/resource';
import { useMutation } from '../composables/mutation';
import { fileBase64 } from '../services/files';
import { readStudioArtworks, readStudioArtwork, studioName } from '../contracts/studio';
import type { StudioArtwork } from '../contracts/studio';
const maxBytes = 1024 * 1024;
function blobFrom(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}
async function encodeCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw Error('無法讀取畫布。');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels.some((value, index) => index % 4 === 3 && value > 0))
    throw Error('先在畫布上畫圖或加入照片。');
  let blob = await blobFrom(canvas, 'image/png');
  if (blob && blob.size > maxBytes)
    for (const quality of [0.92, 0.8, 0.65]) {
      blob = await blobFrom(canvas, 'image/webp', quality);
      if (blob && blob.size <= maxBytes) break;
    }
  if (!blob || blob.size > maxBytes)
    throw Error('畫作超過圖庫的 1 MB 限制，請減少照片細節或圖層。');
  return {
    mime: blob.type,
    base64: await fileBase64(new File([blob], 'artwork', { type: blob.type })),
  };
}
export const useStudioStore = defineStore('studio', () => {
  const gallery = useResource(async (request) =>
    readStudioArtworks(await request('/api/artworks')),
  );
  const mutation = useMutation(),
    imageLoad = useMutation();
  const artworkName = ref(''),
    uploadName = ref('');
  async function saveCanvas(canvas: HTMLCanvasElement) {
    return mutation.run(async (request) => {
      gallery.requests.cancel();
      const name = studioName(artworkName.value),
        image = await encodeCanvas(canvas);
      if (!gallery.requests.active()) return;
      const artwork = readStudioArtwork(await request('/api/artworks', { name, ...image }));
      gallery.data.value = [
        artwork,
        ...(gallery.data.value || []).filter((a) => a.id !== artwork.id),
      ];
    }, '畫作已存入我的圖庫。可以在下方選擇用作角色或禮物。');
  }
  async function upload(file: File) {
    return mutation.run(async (request) => {
      gallery.requests.cancel();
      const name = studioName(uploadName.value);
      if (!['image/png', 'image/gif', 'image/webp'].includes(file.type))
        throw Error('僅接受 PNG、GIF 或 WebP 圖片。');
      const base64 = await fileBase64(file);
      if (!gallery.requests.active()) return;
      const artwork = readStudioArtwork(
        await request('/api/artworks', { name, mime: file.type, base64 }),
      );
      gallery.data.value = [
        artwork,
        ...(gallery.data.value || []).filter((a) => a.id !== artwork.id),
      ];
      uploadName.value = '';
    }, '圖片已存入我的圖庫。');
  }
  async function remove(artwork: StudioArtwork) {
    return mutation.run(async (request) => {
      gallery.requests.cancel();
      await request('/api/artworks/' + encodeURIComponent(artwork.id) + '/delete', {});
      gallery.data.value = gallery.data.value?.filter((a) => a.id !== artwork.id) || [];
    }, '作品已從圖庫刪除；已用於角色或禮物的圖片會保留。');
  }
  async function fetchImage(artwork: StudioArtwork, onFile: (file: File) => Promise<void>) {
    return imageLoad.run(async (_request, signal) => {
      const response = await fetch(artwork.url, { credentials: 'same-origin', signal });
      if (!response.ok) throw Error('無法讀取圖庫作品。');
      const blob = await response.blob();
      signal.throwIfAborted();
      await onFile(new File([blob], artwork.name, { type: artwork.mime }));
      signal.throwIfAborted();
    }, '已載入收藏圖片。儲存會建立新的作品，保留原圖。');
  }
  return {
    artworks: gallery.data,
    loading: gallery.loading,
    error: gallery.error,
    load: gallery.load,
    artworkName,
    uploadName,
    pending: mutation.pending,
    message: mutation.message,
    failed: mutation.failed,
    imagePending: imageLoad.pending,
    imageMessage: imageLoad.message,
    imageFailed: imageLoad.failed,
    saveCanvas,
    upload,
    remove,
    fetchImage,
  };
});
