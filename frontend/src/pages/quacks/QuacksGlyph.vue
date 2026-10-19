<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';import type {Ingredient} from '../../contracts/quacks';
const props=withDefaults(defineProps<{chip?:Ingredient;resource?:string;patient?:string;size?:number}>(),{size:40}),host=ref<HTMLElement|null>(null);
function render(){if(!host.value)return;const art=window.QuacksArt,node=props.chip?art?.token(props.chip,{size:props.size,decorative:true}):props.patient?art?.patientPortrait(props.patient):art?.resource(props.resource||'bag',{size:props.size,decorative:true});host.value.replaceChildren(...(node?[node]:[]));}
onMounted(render);watch(()=>JSON.stringify([props.chip,props.resource,props.patient,props.size]),render);
</script>
<template><span ref="host" class="vue-quacks-glyph" :style="{width:size+'px',height:size+'px'}" aria-hidden="true"/></template>
