<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import type { SceneEquationPuzzle } from '../contracts/lobby';
import { ApiError, requestJson } from '../services/http';
import StatusSlot from './StatusSlot.vue';
import UiButton from './UiButton.vue';
import UiPanel from './UiPanel.vue';

const props = defineProps<{ puzzle: SceneEquationPuzzle; roomCode?: string; arena?: boolean }>();
const pending = ref<number | null>(null);
const solved = ref(false);
const message = ref('');
const rejected = ref<number[]>([]);
let request: AbortController | undefined;

const rejectedOption = (answer: number) =>
  rejected.value.includes(answer) || props.puzzle.rejectedOptions.includes(answer);

async function submit(answer: number) {
  if (pending.value !== null || rejectedOption(answer) || solved.value) return;
  pending.value = answer;
  message.value = '';
  request = new AbortController();
  try {
    const endpoint = props.roomCode ? '/api/room-space' : '/api/lobby/move';
    await requestJson(props.arena && !props.roomCode ? endpoint + '?arena=1' : endpoint, {
      method: 'POST',
      body: {
        action: 'solve-equation',
        id: props.puzzle.id,
        answer,
        ...(props.roomCode ? { code: props.roomCode } : {}),
      },
      signal: request.signal,
    });
    solved.value = true;
  } catch (cause) {
    if (request.signal.aborted) return;
    if (cause instanceof ApiError && cause.code === 'SCENE_EQUATION_EXPIRED') {
      solved.value = true;
      return;
    }
    if (cause instanceof ApiError && cause.code === 'SCENE_EQUATION_WRONG')
      rejected.value.push(answer);
    message.value = cause instanceof Error ? cause.message : '無法送出答案';
  } finally {
    pending.value = null;
  }
}
onBeforeUnmount(() => request?.abort());
</script>

<template>
  <Teleport to="body">
    <aside v-if="!solved" class="scene-equation" aria-label="終焉方程" @keydown.stop>
      <UiPanel title="答對後即可移動" tone="translucent" density="compact">
        <p class="scene-equation-prompt">{{ puzzle.prompt }} ＝</p>
        <div class="scene-equation-options" role="group" aria-label="五個答案選項">
          <UiButton
            v-for="option in puzzle.options"
            :key="option"
            :label="String(option)"
            :pending="pending === option"
            :disabled="pending !== null || rejectedOption(option)"
            @click="submit(option)"
          />
        </div>
      </UiPanel>
      <div class="scene-equation-feedback">
        <StatusSlot :message="message" :error="!!message" persistent />
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
.scene-equation {
  position: fixed;
  inset-inline-end: var(--stitch-gap-controls);
  inset-block-end: var(--stitch-gap-controls);
  inline-size: min(19rem, calc(100% - 2 * var(--stitch-gap-controls)));
  /* Keep the answers clickable above the mobile character controls. */
  z-index: 1950;
}
.scene-equation-prompt {
  margin: 0;
  font-size: var(--stitch-text-section);
  font-weight: 700;
}
.scene-equation-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--stitch-space-4);
}
.scene-equation-feedback {
  position: absolute;
  inset-inline: 0;
  inset-block-end: calc(100% + var(--stitch-space-4));
  pointer-events: none;
}
</style>
