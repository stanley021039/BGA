<script setup lang="ts">
import {ref,watch} from 'vue';import type {GiftCard} from '../../contracts/gift';
const props=defineProps<{gift:GiftCard}>(),failed=ref(false);watch(()=>props.gift.image,()=>failed.value=false);
</script>
<template><span class="vue-gift-art"><img v-if="gift.image&&!failed" :src="gift.image" alt="" loading="lazy" @error="failed=true"><span v-else aria-hidden="true">🎁</span></span></template>
