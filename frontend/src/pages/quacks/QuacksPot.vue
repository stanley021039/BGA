<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';import type {QuacksSnapshot,QuacksRecipe,QuacksInsight} from '../../contracts/quacks';
const props=defineProps<{state:QuacksSnapshot;recipe:QuacksRecipe}>(),host=ref<HTMLElement|null>(null),insight=ref<QuacksInsight|null>(null),error=ref('');
const signature=computed(()=>JSON.stringify([props.state.roundId,props.state.options,props.state.books,props.recipe]));
function render(){if(!host.value)return;insight.value=null;const focused=host.value.contains(document.activeElement)?(document.activeElement as HTMLElement)?.getAttribute('data-position'):null;if(!window.QuacksArt){error.value='大釜圖像未載入，請更新頁面。';return;}if(props.recipe.hidden){host.value.replaceChildren();return;}try{const node=window.QuacksArt.cauldron(props.state,props.recipe,d=>insight.value=d,()=>{});host.value.replaceChildren(node);if(focused!==null)node.querySelector<HTMLElement>(`[data-position="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});error.value='';}catch(cause){error.value=cause instanceof Error?cause.message:'無法繪製大釜。';}}
onMounted(render);watch(signature,render,{flush:'post'});
</script>
<template><div class="vue-quacks-pot"><div ref="host" class="vue-quacks-pot-art"/><div class="vue-quacks-insight" role="status"><p v-if="error">{{ error }}</p><template v-else-if="insight"><strong>{{ insight.title }}</strong><p>{{ insight.effect }} {{ insight.caption }}</p></template><p v-else>指向、點選大釜格位，或用方向鍵查看藥材與結算格資訊。</p></div></div></template>
