<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import UiButton from './UiButton.vue';
import UiPopover from './UiPopover.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/drawing-toolbar.scss';

const props = defineProps<{ modelValue: string; disabled?: boolean; epoch?: string | number }>();
const emit = defineEmits<{ 'update:modelValue': [color: string] }>();
const prefix = useId(),
  popover = ref<InstanceType<typeof UiPopover> | null>(null);
const colors = [
  ['#1b1c1c', '黑色'],
  ['#ffffff', '白色'],
  ['#6b7280', '灰色'],
  ['#ba1a1a', '紅色'],
  ['#f97316', '橘色'],
  ['#f8c838', '黃色'],
  ['#16a34a', '綠色'],
  ['#0284c7', '藍色'],
  ['#4338ca', '靛色'],
  ['#7e22ce', '紫色'],
  ['#735947', '棕色'],
  ['#fedbc4', '膚色'],
];
const hue = ref(0),
  saturation = ref(0),
  value = ref(0),
  hex = ref('#1B1C1C'),
  error = ref('');
const hueColor = computed(() => `hsl(${hue.value} 100% 50%)`);
function normalize(text: string): string | null {
  const result = text.trim().replace(/^#/, '');
  if (/^[\da-f]{6}$/i.test(result)) return '#' + result.toUpperCase();
  if (/^[\da-f]{3}$/i.test(result))
    return (
      '#' +
      [...result]
        .map((char) => char + char)
        .join('')
        .toUpperCase()
    );
  return null;
}
function fromHex(text: string) {
  const normalized = normalize(text);
  if (!normalized) return;
  const channels = [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255);
  const r = channels[0]!,
    g = channels[1]!,
    b = channels[2]!,
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  hue.value =
    delta === 0
      ? hue.value
      : ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) *
          60 +
          360) %
        360;
  saturation.value = max === 0 ? 0 : delta / max;
  value.value = max;
  hex.value = normalized;
}
function updateHex() {
  const chroma = value.value * saturation.value,
    section = hue.value / 60,
    x = chroma * (1 - Math.abs((section % 2) - 1)),
    m = value.value - chroma;
  const rgb =
    section < 1
      ? [chroma, x, 0]
      : section < 2
        ? [x, chroma, 0]
        : section < 3
          ? [0, chroma, x]
          : section < 4
            ? [0, x, chroma]
            : section < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  hex.value =
    '#' +
    rgb
      .map((channel) =>
        Math.round((channel + m) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase();
  error.value = '';
}
let pointer: number | null = null;
function locate(event: PointerEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  saturation.value = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  value.value = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
  updateHex();
}
function down(event: PointerEvent) {
  if (props.disabled || pointer !== null || event.button !== 0) return;
  event.preventDefault();
  pointer = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture(pointer);
  locate(event);
}
function move(event: PointerEvent) {
  if (event.pointerId === pointer && !props.disabled) locate(event);
}
function up(event: PointerEvent) {
  if (event.pointerId !== pointer) return;
  const element = event.currentTarget as HTMLElement,
    id = pointer;
  pointer = null;
  if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
}
function keyboard(event: KeyboardEvent) {
  if (props.disabled) return;
  const amount = event.shiftKey ? 0.1 : 0.01;
  if (event.key === 'ArrowLeft') saturation.value = Math.max(0, saturation.value - amount);
  else if (event.key === 'ArrowRight') saturation.value = Math.min(1, saturation.value + amount);
  else if (event.key === 'ArrowUp') value.value = Math.min(1, value.value + amount);
  else if (event.key === 'ArrowDown') value.value = Math.max(0, value.value - amount);
  else return;
  event.preventDefault();
  updateHex();
}
function open(event: MouseEvent) {
  if (props.disabled) return;
  if (popover.value?.visible) {
    popover.value.close();
    return;
  }
  pointer = null;
  error.value = '';
  fromHex(props.modelValue);
  void popover.value?.open(event.currentTarget as HTMLElement);
}
function choose(color: string) {
  if (!props.disabled) emit('update:modelValue', color);
}
function apply() {
  if (props.disabled) return;
  const selected = normalize(hex.value);
  if (!selected) {
    error.value = '請輸入 3 或 6 位 HEX 色碼，例如 #F8C838。';
    return;
  }
  emit('update:modelValue', selected);
  popover.value?.close();
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      pointer = null;
      popover.value?.close(false);
    }
  },
);
watch(
  () => props.epoch,
  () => {
    pointer = null;
    error.value = '';
    popover.value?.close(false);
  },
);
</script>

<template>
  <div class="vue-color-picker" role="group" aria-label="畫筆顏色">
    <div class="vue-color-swatches" aria-label="十二種常用顏色"
      ><button
        v-for="[color, name] in colors"
        :key="color"
        type="button"
        class="vue-color-swatch"
        :aria-label="name + ' ' + color"
        :title="name"
        :aria-pressed="modelValue.toLowerCase() === color"
        :disabled="disabled"
        @click="choose(color!)"
        ><span :style="{ background: color }" aria-hidden="true" /></button
    ></div>
    <UiButton
      variant="secondary"
      icon="edit"
      label="自訂畫筆顏色"
      caption="自訂色"
      :disabled="disabled"
      :aria-expanded="!!popover?.visible"
      :aria-controls="prefix + '-popover'"
      aria-haspopup="dialog"
      @click="open"
      ><template #icon
        ><span
          class="vue-color-current"
          :style="{ background: modelValue }"
          aria-hidden="true" /></template
    ></UiButton>
  </div>
  <UiPopover :id="prefix + '-popover'" ref="popover" title="自訂畫筆顏色" @closed="pointer = null">
    <form class="vue-color-picker-content" @submit.prevent="apply">
      <p :id="prefix + '-instructions'">拖曳調整顏色，或輸入 HEX 色碼後套用。</p>
      <div
        class="vue-color-plane"
        role="group"
        :aria-describedby="prefix + '-instructions'"
        aria-label="飽和度與亮度；左右鍵調整飽和度，上下鍵調整亮度，Shift 加快"
        tabindex="0"
        :aria-disabled="disabled"
        :style="{ backgroundColor: hueColor }"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
        @lostpointercapture="up"
        @keydown="keyboard"
        ><span
          class="vue-color-cursor"
          :style="{ left: saturation * 100 + '%', top: (1 - value) * 100 + '%' }"
          aria-hidden="true"
      /></div>
      <label class="vue-color-hue"
        >色相<input
          v-model.number="hue"
          type="range"
          min="0"
          max="359"
          step="1"
          :disabled="disabled"
          @input="updateHex"
      /></label>
      <div class="vue-color-preview"
        ><span :style="{ background: normalize(hex) || modelValue }" aria-hidden="true" /><output
          aria-label="目前預覽顏色"
          >{{ normalize(hex) || '尚未輸入有效色碼' }}</output
        ></div
      >
      <div class="vue-color-hex"
        ><label :for="prefix + '-hex'">HEX</label
        ><input
          :id="prefix + '-hex'"
          v-model="hex"
          type="text"
          autocomplete="off"
          spellcheck="false"
          maxlength="7"
          :disabled="disabled"
          :aria-invalid="!!error"
          :aria-describedby="prefix + '-error'"
          @input="error = ''"
          @change="fromHex(hex)" /><UiButton
          variant="contrast"
          icon="check"
          type="submit"
          label="套用顏色"
          caption="套用"
          :disabled="disabled"
      /></div>
      <StatusSlot persistent :id="prefix + '-error'" :message="error" :error="!!error" />
    </form>
  </UiPopover>
</template>
