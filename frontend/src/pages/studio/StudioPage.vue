<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import { useStudioStore } from '../../stores/studio';
import type { StudioEditor, StudioArtwork } from '../../contracts/studio';
import StudioCanvas from './StudioCanvas.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import UiIcon from '../../components/UiIcon.vue';
const studio=useStudioStore(),editor=shallowRef<StudioEditor>(),confirm=ref<InstanceType<typeof ConfirmDialog>|null>(null);
const file=shallowRef<File>(),fileInput=ref<HTMLInputElement|null>(null),localMessage=ref(''),localFailed=ref(false);
let active=true;
const query=new URLSearchParams(location.search),returnHref='/collection?section='+(query.get('section')==='characters'?'characters':'avatars');
function ready(value:StudioEditor){editor.value=value;}
function chooseFile(event:Event){file.value=(event.target as HTMLInputElement).files?.[0];}
async function upload(){localMessage.value='';localFailed.value=false;if(!file.value){localMessage.value='請先選擇一張圖片。';localFailed.value=true;return;}if(await studio.upload(file.value)){file.value=undefined;if(fileInput.value)fileInput.value.value='';}}
async function editFile(){if(!file.value||!editor.value){localMessage.value='請先選擇一張圖片。';localFailed.value=true;return;}localMessage.value='';localFailed.value=false;try{const result=await editor.value.importFiles([file.value]);if(result&&!result.added)throw Error(result.errors.join(' '));}catch(error){if(active){localMessage.value=error instanceof Error?error.message:'無法匯入圖片';localFailed.value=true;}return;}if(active)document.querySelector('.studio-board')?.scrollIntoView({behavior:'smooth'});}
async function editArtwork(artwork:StudioArtwork){
 const renderer=editor.value;if(!renderer)return;const revision=renderer.revision;
 await studio.fetchImage(artwork,async image=>{if(active&&renderer===editor.value){if(renderer.revision!==revision)throw Error('載入圖片期間畫布已變更，請重新載入圖片。');const result=await renderer.importFiles([image]);if(result&&!result.added)throw Error(result.errors.join(' '));}});
 if(active)document.querySelector('.studio-board')?.scrollIntoView({behavior:'smooth'});
}
async function remove(artwork:StudioArtwork){if(studio.pending)return;if(await confirm.value?.ask(`要從我的圖庫刪除「${artwork.name}」嗎？已用於角色或禮物的圖片會保留。`,'刪除作品'))await studio.remove(artwork);}
async function save(){if(editor.value)await studio.saveCanvas(editor.value.flatten());}
onMounted(async()=>{if(await studio.load()){const artwork=studio.artworks?.find(a=>a.id===query.get('artwork'));if(artwork&&active&&editor.value?.revision===0){studio.artworkName=artwork.name;await editArtwork(artwork);}}});
onBeforeUnmount(()=>{active=false;editor.value=undefined;});
</script>
<template>
 <a id="collection-return" class="quiet" :href="returnHref">← 返回收藏庫</a>
 <div class="page-heading"><div class="kicker">YOUR ART / YOUR GAMES</div><h1>我的繪畫圖庫</h1><p>畫一張、上傳一張，先存進自己的圖庫，再用於角色、表情或禮物。</p></div>
 <div class="studio-layout">
  <StudioCanvas @ready="ready"><template #save>
   <form class="studio-save" @submit.prevent="save"><label><span class="ui-sr-only">畫作名稱（最多 40 字）</span><input id="paint-name" v-model="studio.artworkName" type="text" maxlength="80" required placeholder="我的畫作" :disabled="studio.pending"></label><UiButton id="paint-save" stitch variant="primary" type="submit" icon-only icon="save" label="儲存目前畫布" :pending="studio.pending" :disabled="!editor" /></form>
  </template><template #feedback>
   <StatusSlot id="studio-save-status" :message="studio.message" :error="studio.failed" />
   <StatusSlot id="studio-image-status" :message="studio.imagePending?'正在載入圖片…':studio.imageMessage" :error="studio.imageFailed" />
  </template></StudioCanvas>
  <section class="page-panel studio-sidebar studio-upload-approved" aria-labelledby="studio-upload-heading"><div class="studio-section-kicker">MORE ART</div><h2 id="studio-upload-heading">上傳已有圖片</h2><p>已完成的圖片可以直接存入圖庫；需要去背或疊圖時，先載入畫布。</p>
   <form id="artwork-upload" class="studio-upload" @submit.prevent="upload"><label>作品名稱<input id="artwork-name" v-model="studio.uploadName" type="text" maxlength="80" required :disabled="studio.pending" placeholder="例如：我畫的禮物"></label><label>選擇圖片<input id="artwork-file" ref="fileInput" type="file" accept="image/png,image/gif,image/webp" required :disabled="studio.pending" @change="chooseFile"></label><p>PNG、GIF、WebP；直接存入圖庫單張最多 1 MB。畫布照片圖層另支援 JPEG，單張最多 12 MB。</p><div class="studio-upload-actions"><UiButton id="artwork-edit" stitch variant="secondary" icon="edit" label="載入畫布編輯／去背" :disabled="!file || !editor || studio.imagePending" @click="editFile" /><UiButton stitch variant="primary" type="submit" icon="upload" label="直接加入我的圖庫" :pending="studio.pending" /></div><StatusSlot id="upload-status" :message="localMessage || studio.message" :error="localFailed || studio.failed" /></form>
  </section>
 </div>
 <section class="page-panel artwork-library studio-library-approved" aria-labelledby="studio-gallery-heading" :aria-busy="studio.loading"><div class="artwork-library-heading"><div><div class="studio-section-kicker">MY GALLERY</div><h2 id="studio-gallery-heading">我的作品</h2></div><span id="artwork-count">{{ studio.artworks?.length || 0 }} / 100 件作品</span><UiButton stitch variant="ghost" icon="refresh" label="重新載入圖庫" :pending="studio.loading" :disabled="studio.pending" @click="studio.load" /></div><p>選一張作品就能用於角色或自訂禮物。刪除圖庫原圖不會移除已加入角色或禮物的圖片。</p>
  <StatusSlot :message="studio.error || (studio.loading?'正在載入我的圖庫…':'')" :error="!!studio.error" />
  <StatusSlot :message="studio.message || studio.imageMessage" :error="studio.failed || studio.imageFailed" /><div id="artwork-list" class="artwork-grid"><article v-for="artwork in studio.artworks || []" :key="artwork.id" class="artwork-card"><img :src="artwork.url" :alt="artwork.name" loading="lazy"><strong>{{ artwork.name }}</strong><div class="artwork-actions"><a class="vue-studio-art-link" :href="'/profile?artwork='+encodeURIComponent(artwork.id)">用作角色／表情</a><a class="vue-studio-art-link" :href="'/gifts?artwork='+encodeURIComponent(artwork.id)">用作禮物</a><UiButton stitch variant="secondary" icon="edit" icon-only :label="'載入畫布作圖層：'+artwork.name" :disabled="studio.imagePending || !editor" @click="editArtwork(artwork)" /><UiButton stitch variant="danger" icon="remove" icon-only :label="'刪除圖庫作品：'+artwork.name" :disabled="studio.pending" @click="remove(artwork)" /></div></article></div>
  <div v-if="!studio.loading && !studio.error && !studio.artworks?.length" id="artwork-empty" class="gallery-empty studio-gallery-empty"><UiIcon name="cards" /><strong>尚未建立或上傳任何作品</strong><p>畫一張、加入照片，或從上方上傳已有圖片。儲存後就能在這裡用作角色或自訂禮物。</p></div>
 </section>
 <ConfirmDialog ref="confirm" />
</template>
