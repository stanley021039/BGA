<script setup lang="ts">
import { useId } from 'vue';
import type { DrawingTool } from '../contracts/drawing';
import ColorPicker from './ColorPicker.vue';
import DrawingToolButton from './DrawingToolButton.vue';
import '../styles/drawing-toolbar.scss';
withDefaults(defineProps<{ editable?: boolean; disabled?: boolean; tool: DrawingTool; filled?: boolean; color: string; size: number; fillDisabled?: boolean; undoDisabled?: boolean; clearDisabled?: boolean; epoch?: string | number }>(), { editable: true });
const emit=defineEmits<{ 'update:tool':[value:DrawingTool];'update:filled':[value:boolean];'update:color':[value:string];'update:size':[value:number];undo:[];clear:[] }>();
const prefix=useId();
const tools: {tool:DrawingTool;filled?:boolean;label:string}[]=[
 {tool:'brush',label:'畫筆'},{tool:'erase',label:'橡皮擦'},{tool:'line',label:'直線'},
 {tool:'rect',label:'空心矩形'},{tool:'rect',filled:true,label:'實心矩形'},
 {tool:'ellipse',label:'空心橢圓'},{tool:'ellipse',filled:true,label:'實心橢圓'},{tool:'fill',label:'油漆桶'},
];
function select(choice: typeof tools[number]) { emit('update:tool',choice.tool);emit('update:filled',!!choice.filled); }
</script>

<template>
 <div class="vue-drawing-console" :class="{'is-editable':editable}">
  <div class="vue-drawing-console-layout">
   <div v-if="editable" class="vue-drawing-console-top"><ColorPicker :model-value="color" :disabled="disabled" :epoch="epoch" @update:model-value="emit('update:color',$event)" /><label class="vue-drawing-console-size" :for="prefix+'-size'">粗細<input :id="prefix+'-size'" type="range" :value="size" min="1" max="40" step="1" :disabled="disabled" @input="emit('update:size',Number(($event.target as HTMLInputElement).value))"><output :for="prefix+'-size'">{{ size }} px</output></label></div>
   <div v-if="editable" class="vue-drawing-console-rail" aria-label="繪畫工具"><div class="vue-drawing-console-tools" role="group" aria-label="選擇畫具"><DrawingToolButton v-for="choice in tools" :key="choice.tool+(choice.filled?'Filled':'')" :tool="choice.tool+(choice.filled?'Filled':'')" :label="choice.label" :selected="choice.tool===tool&&!!choice.filled===!!filled" :disabled="disabled||(choice.tool==='fill'&&fillDisabled)" @click="select(choice)" /></div><div class="vue-drawing-console-history" role="group" aria-label="畫布歷程"><DrawingToolButton tool="undo" label="復原上一筆" :disabled="disabled||undoDisabled" @click="emit('undo')" /><DrawingToolButton tool="clear" label="清空畫布" :disabled="disabled||clearDisabled" @click="emit('clear')" /></div></div>
   <div class="vue-drawing-console-stage"><slot /></div>
  </div>
 </div>
</template>
