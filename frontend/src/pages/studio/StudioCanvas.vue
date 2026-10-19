<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import UiButton from '../../components/UiButton.vue';
import UiIcon from '../../components/UiIcon.vue';
import { mountStudioEditor } from './editor.js';
import type { StudioEditor } from '../../contracts/studio';
const host = ref<HTMLElement | null>(null);
let editor: StudioEditor | undefined;
const emit = defineEmits<{ ready: [editor: StudioEditor] }>();
onMounted(() => {
  if (host.value) {
    editor = mountStudioEditor(host.value);
    emit('ready', editor);
  }
});
onBeforeUnmount(() => {
  editor?.destroy();
  editor = undefined;
});
</script>
<template>
  <div ref="host" class="studio-renderer-host">
    <section class="page-panel studio-board studio-board-approved" aria-label="自由尺寸繪圖工作區">
      <header class="studio-document-bar"
        ><p
          >自由尺寸畫布 <strong>預設 512 × 1024</strong> · 最大 1024 × 1024 · 透明背景 ·
          照片在筆跡下方。</p
        ><slot name="save" /><button id="paint-download" v-once type="button"
          >下載 PNG</button
        ></header
      >
      <div class="studio-workbench studio-workbench-approved">
        <aside v-once class="studio-controls" aria-label="繪圖控制">
          <div class="studio-toolbar-top">
            <div class="studio-color-workspace"
              ><span class="studio-control-label">顏色</span
              ><div
                id="paint-palette"
                class="paint-palette studio-main-palette"
                role="group"
                aria-label="常用繪圖顏色"
              ></div
              ><UiButton
                id="studio-palette-trigger"
                stitch
                variant="ghost"
                icon="edit"
                icon-only
                label="自訂畫筆顏色與最近色"
                popovertarget="studio-palette-popover"
                aria-controls="studio-palette-popover"
                aria-expanded="false"
              />
              <div
                id="studio-palette-popover"
                class="studio-palette-panel"
                popover="auto"
                role="dialog"
                aria-label="自訂畫筆顏色"
              >
                <header
                  ><strong>調色盤 Palette</strong
                  ><UiButton
                    stitch
                    variant="ghost"
                    icon="close"
                    icon-only
                    label="關閉調色盤"
                    popovertarget="studio-palette-popover"
                    popovertargetaction="hide"
                /></header>
                <div class="studio-spectrum"
                  ><div class="studio-palette-heading"><span>調整色相與飽和度</span></div
                  ><div
                    id="paint-sv"
                    class="paint-sv"
                    data-spectrum="rect"
                    role="button"
                    tabindex="0"
                    aria-label="矩形調色盤；左右鍵調色相，上下鍵調飽和度"
                    ><span id="paint-sv-marker"></span></div
                  ><label class="studio-color-slider studio-brightness"
                    >亮度 <output id="paint-brightness-value">71%</output
                    ><input
                      id="paint-brightness"
                      type="range"
                      min="0"
                      max="100"
                      value="71" /></label
                  ><div class="paint-hex-row"
                    ><label for="paint-hex"
                      >HEX<input
                        id="paint-hex"
                        type="text"
                        inputmode="text"
                        maxlength="7"
                        spellcheck="false"
                        value="#557bb5"
                        aria-label="十六進位色號" /></label
                    ><input
                      id="paint-native-color"
                      type="color"
                      value="#557bb5"
                      aria-label="開啟系統選色器" /></div
                ></div>
                <details class="studio-swatches"
                  ><summary>最近使用的 10 色</summary
                  ><div class="studio-current-row"
                    ><span id="paint-current" aria-label="目前顏色"></span
                    ><button id="paint-wheel-pick" type="button" aria-label="從畫布滴管取色"
                      >滴管</button
                    ></div
                  ><div
                    id="paint-recent"
                    class="paint-palette paint-recent"
                    role="group"
                    aria-label="最近使用的顏色"
                  ></div
                ></details>
              </div>
            </div>
            <div class="studio-sliders"
              ><label
                >粗細 <input id="paint-size" type="range" min="1" max="64" value="8" /><output
                  id="paint-size-value"
                  >8 像素</output
                ></label
              ></div
            >
          </div>
          <div class="studio-editor-options"
            ><label class="studio-color-slider studio-opacity"
              >透明度
              <input
                id="paint-opacity"
                type="range"
                min="0"
                max="100"
                step="5"
                value="100"
              /><output id="paint-opacity-value">100%</output></label
            ><label class="studio-zoom"
              >檢視縮放
              <input
                id="paint-zoom"
                type="range"
                min="100"
                max="300"
                step="25"
                value="100"
              /><output id="paint-zoom-value">100%</output></label
            ><details class="studio-advanced"
              ><summary>自訂畫布尺寸</summary
              ><div class="studio-size-settings" role="group" aria-label="設定畫布尺寸"
                ><label
                  >寬度
                  <input
                    id="paint-width"
                    type="number"
                    min="1"
                    max="1024"
                    step="1"
                    value="512"
                    inputmode="numeric" /></label
                ><span aria-hidden="true">×</span
                ><label
                  >高度
                  <input
                    id="paint-height"
                    type="number"
                    min="1"
                    max="1024"
                    step="1"
                    value="1024"
                    inputmode="numeric" /></label
                ><button id="paint-resize" type="button">套用畫布尺寸</button
                ><p class="studio-size-note"
                  >改變尺寸會把目前筆跡與照片等比例置中；可使用復原還原原尺寸。</p
                ></div
              ></details
            ></div
          >
          <div class="studio-tools" role="group" aria-label="繪圖工具，可捲動查看全部工具"
            ><button id="paint-brush" type="button" class="active" aria-pressed="true">畫筆</button
            ><button id="paint-erase" type="button" aria-pressed="false">橡皮擦</button
            ><button id="paint-line" type="button" aria-pressed="false">直線</button
            ><button id="paint-rect" type="button" aria-pressed="false">矩形</button
            ><button id="paint-rect-filled" type="button" aria-pressed="false">實心矩形</button
            ><button id="paint-ellipse" type="button" aria-pressed="false">圓形／橢圓</button
            ><button id="paint-ellipse-filled" type="button" aria-pressed="false">實心橢圓</button
            ><button id="paint-fill" type="button" aria-pressed="false">油漆桶</button
            ><button id="paint-pick" type="button" aria-pressed="false">滴管取色</button
            ><label class="studio-photo-import"
              >加入照片圖層<input
                id="photo-files"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple /></label
            ><button id="paint-undo" type="button">復原</button
            ><button id="paint-redo" type="button">重做</button
            ><button id="paint-clear" type="button">清空筆跡</button
            ><button id="paint-reset" type="button">清空全部</button></div
          >
        </aside>
        <div class="studio-drawing"
          ><div id="studio-canvas-frame" v-once class="studio-canvas-frame"
            ><div class="studio-canvas-stack"
              ><canvas id="photo-canvas" width="512" height="1024" aria-hidden="true"></canvas
              ><canvas
                id="paint-canvas"
                width="512"
                height="1024"
                tabindex="0"
                aria-label="512 乘 1024 像素繪圖畫布；可使用滑鼠、觸控或方向鍵與空白鍵繪製"
              ></canvas></div></div
        ></div>
        <div class="studio-editor-feedback"
          ><span class="studio-mode-label"><UiIcon name="edit" />自由繪畫</span
          ><p id="paint-status" class="upload-status" role="status" aria-live="polite"></p
          ><span class="studio-key-hint">Ctrl / ⌘ + Z 可復原</span></div
        >
      </div>
      <div class="studio-network-feedback"><slot name="feedback" /></div>
      <details v-once class="studio-layer-panel"
        ><summary>照片圖層 <span id="photo-layer-count">0 / 8</span></summary
        ><div class="studio-layer-content"
          ><p
            >可一次選多張或拖放到畫布。支援 JPEG、PNG、WebP、GIF（取第一格）；每張來源最多 12
            MB。照片可調順序、透明度與顯示狀態。</p
          ><div class="studio-fit-options" role="group" aria-label="照片加入畫布的方式"
            ><button type="button" data-photo-fit="contain" aria-pressed="true">完整放入</button
            ><button type="button" data-photo-fit="cover" aria-pressed="false"
              >填滿裁切</button
            ></div
          ><label class="studio-bg-tolerance"
            >去背容差 <output id="bg-tolerance-value">22%</output
            ><input
              id="bg-tolerance"
              type="range"
              min="0"
              max="100"
              value="22"
              aria-label="純色背景去除容差" /></label
          ><p
            >去背適用於白底、純色或相近色背景；可一鍵從邊角判斷，也可在畫布點選背景色。複雜照片仍需手動修整。</p
          ><p id="photo-status" role="status" aria-live="polite"></p
          ><div id="photo-layers" class="studio-layer-list"></div></div
      ></details>
      <p class="studio-hint"
        >存入圖庫時依目前畫布尺寸合成，超過 1 MB 的 PNG 會嘗試轉為
        WebP。圖層編排只保留在本次編輯；已有圖片也能在下方直接上傳。</p
      >
    </section>
  </div>
</template>
