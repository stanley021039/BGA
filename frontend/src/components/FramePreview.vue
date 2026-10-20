<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import UiIcon from './UiIcon.vue';
import '../styles/frame-picker.scss';
const props = withDefaults(
  defineProps<{ frame: string; name?: string; message?: string; kind?: 'barrage' | 'media' }>(),
  { name: '小雨', message: '這一桌好好玩！', kind: 'barrage' },
);
const root = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null),
  scale = ref(0);
const nativeSize: Record<string, string> = {
  display: 'block',
  position: 'relative',
  left: 'auto',
  top: 'auto',
  inlineSize: '360px',
  width: '360px',
  maxInlineSize: 'none',
  maxWidth: 'none',
  blockSize: '148px',
  height: '148px',
  minBlockSize: '148px',
  boxSizing: 'border-box',
};
const stageStyle = computed(() => ({
  transform: 'translate(-50%,-50%) scale(' + scale.value + ')',
}));
const surface = shallowRef<Record<string, string>>({});
let generation = 0,
  disposed = false,
  observer: ResizeObserver | null = null;
function fit() {
  const box = viewport.value;
  if (!box || disposed) return;
  scale.value = Math.max(0, Math.min(1, (box.clientWidth - 8) / 360, (box.clientHeight - 8) / 148));
}
async function draw() {
  const epoch = ++generation;
  if (!root.value) return;
  const host = root.value;
  host.replaceChildren();
  surface.value = {};
  // Preserve the original allowlisted CSS/SVG artwork renderer in an isolated leaf.
  window.BarrageFrames?.decorate(
    host,
    { kind: 'builtin', id: props.frame, version: 1 },
    props.name,
    props.message,
  );
  if (props.kind !== 'media') return;
  host.querySelector('.barrage-frame-content')?.remove();
  await nextTick();
  if (disposed || epoch !== generation || !host.isConnected || props.kind !== 'media') return;
  // Match RoomMedia's actual surface extraction from the original frame art.
  if (props.frame === 'default') return;
  const view = getComputedStyle(host),
    opaque = (value: string) => {
      if (!value || value === 'transparent') return '';
      const match = value.match(/^rgba?\(([^)]+)\)$/);
      if (!match) return value;
      const channels = match[1]!
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return channels.length > 3 && channels[3] === 0
        ? ''
        : 'rgb(' + channels.slice(0, 3).join(', ') + ')';
    };
  const ink = view.getPropertyValue('--barrage-frame-text').trim() || view.color;
  let background = opaque(view.getPropertyValue('--barrage-frame-background').trim()),
    line = view.getPropertyValue('--barrage-frame-line').trim(),
    image = 'none',
    area = 0;
  if (host.classList.contains('barrage-frame-ornate'))
    for (const node of host.querySelectorAll<HTMLElement>('.barrage-frame-art div')) {
      const style = getComputedStyle(node),
        box = node.getBoundingClientRect(),
        size = box.width * box.height,
        fill = opaque(style.backgroundColor);
      if (
        size <= area ||
        parseFloat(style.borderTopWidth) <= 0 ||
        (!fill && style.backgroundImage === 'none')
      )
        continue;
      area = size;
      background = fill;
      image = style.backgroundImage;
      line = opaque(style.borderTopColor) || line;
    }
  surface.value = {
    '--frame-preview-background': background || 'var(--stitch-surface)',
    '--frame-preview-ink': ink,
    '--frame-preview-line': line || ink,
    '--frame-preview-image': image,
  };
}
onMounted(() => {
  fit();
  void draw();
  observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  if (viewport.value) observer?.observe(viewport.value);
  window.addEventListener('resize', fit);
});
watch(() => [props.frame, props.name, props.message, props.kind], draw, { flush: 'post' });
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  observer?.disconnect();
  window.removeEventListener('resize', fit);
});
</script>
<template>
  <span ref="viewport" class="vue-frame-preview-viewport"
    ><span class="vue-frame-preview-stage" :style="stageStyle"
      ><span
        v-if="kind === 'barrage'"
        ref="root"
        class="barrage-frame-preview"
        :style="nativeSize"
      ></span
      ><span
        v-else
        class="vue-frame-media-preview"
        :style="[surface, nativeSize]"
        role="img"
        aria-label="播放器外觀示意，沒有播放媒體"
        ><span
          ref="root"
          class="barrage-frame-preview vue-frame-media-art"
          :style="nativeSize"
          aria-hidden="true" /><span class="vue-frame-media-demo" aria-hidden="true"
          ><span class="vue-frame-media-demo-header"><i /><i /><span>播放器外觀</span><i /></span
          ><span class="vue-frame-media-demo-body"
            ><span class="vue-frame-media-demo-cover"><UiIcon class="ui-icon" name="sound" /></span
            ><span class="vue-frame-media-demo-lines"><i /><i /><i /></span></span
          ><span class="vue-frame-media-demo-progress"><i /></span></span></span></span
  ></span>
</template>
