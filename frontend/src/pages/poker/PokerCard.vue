<script setup lang="ts">
import { computed } from 'vue';
const props=defineProps<{card?:number|null;revealed?:boolean;compact?:boolean}>(),suits=['♠','♥','♣','♦'],names=['黑桃','紅心','梅花','方塊'],ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const suit=computed(()=>typeof props.card==='number'?Math.floor(props.card/13):0),rank=computed(()=>typeof props.card==='number'?ranks[props.card%13]:''),label=computed(()=>props.card===undefined?'尚未發牌':props.card===null?'未公開的底牌':names[suit.value]+' '+rank.value);
</script>
<template><span class="vue-poker-card" :class="{'is-empty':card===undefined,'is-back':card===null,'is-red':typeof card==='number'&&(suit===1||suit===3),'is-new':revealed,'is-compact':compact}" role="img" :aria-label="label"><template v-if="typeof card==='number'"><strong aria-hidden="true">{{ rank }}</strong><span aria-hidden="true">{{ suits[suit] }}</span></template><span v-else-if="card===null" aria-hidden="true">♠</span></span></template>
