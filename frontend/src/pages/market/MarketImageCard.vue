<script setup lang="ts">
import { computed,inject,onBeforeUnmount,ref,watch } from 'vue';
import type { MarketImage } from '../../contracts/market';
import { marketImagePreviewKey } from './image-preview';
const props=withDefaults(defineProps<{image:MarketImage|null;label?:string;active?:boolean;eager?:boolean}>(),{active:true,eager:false,label:'投稿圖片'}),preview=inject(marketImagePreviewKey),failed=ref(false),attempt=ref(0),nonce=ref(0),foreground=ref(!document.hidden);
let timer:ReturnType<typeof setTimeout>|undefined;const delays=[1000,3000,10000,30000],src=computed(()=>props.image?.url+'/thumbnail');
function stop(){clearTimeout(timer);timer=undefined;}
function retry(){stop();if(!props.active||!foreground.value||!failed.value||attempt.value>=delays.length)return;timer=setTimeout(()=>{timer=undefined;if(props.active&&foreground.value){attempt.value++;nonce.value++;}},delays[attempt.value]);}
function error(event:Event){if(!(event.target as HTMLImageElement).isConnected)return;failed.value=true;retry();}function loaded(event:Event){if(!(event.target as HTMLImageElement).isConnected)return;failed.value=false;stop();}
watch([()=>props.image?.id,()=>props.image?.version],()=>{stop();failed.value=false;attempt.value=0;nonce.value++;});watch(()=>props.active,active=>{if(active)retry();else stop();});
function visibility(){foreground.value=!document.hidden;if(document.hidden)stop();else retry();}document.addEventListener('visibilitychange',visibility);onBeforeUnmount(()=>{stop();document.removeEventListener('visibilitychange',visibility);});
</script>
<template><div class="vue-market-image-card"><template v-if="image"><button type="button" class="vue-market-image-button" :aria-label="'放大'+label" @click="preview?.(image)"><img :key="nonce" :src="src" :alt="label" :loading="eager?'eager':'lazy'" :class="{'is-failed':failed}" @load="loaded" @error="error"><span v-if="failed" class="vue-market-thumbnail-status" role="status">{{ attempt>=4?'縮圖暫時無法載入，可點擊放大原圖或更新清單。':'縮圖載入失敗，稍後重試…' }}</span><span class="vue-market-preview-hint">點擊放大</span></button><p>上傳者：{{ image.authorName }}</p></template><div v-else class="vue-market-image-placeholder" :aria-label="label+'：尚無符合圖片'">尚無符合圖片</div></div></template>
