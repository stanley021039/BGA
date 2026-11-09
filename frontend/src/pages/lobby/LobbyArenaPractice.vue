<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { requestJson } from '../../services/http';
import { array, record, text } from '../../services/validation';
import { readLobbyArena, type LobbyArena } from '../../contracts/lobby-arena';
import UiDialog from '../../components/UiDialog.vue';
import UiButton from '../../components/UiButton.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiBadge from '../../components/UiBadge.vue';
import SceneCovers from '../../components/SceneCovers.vue';
import StatusSlot from '../../components/StatusSlot.vue';
// Frontend adapter matches the isolated server registry, never the real lobby store.
const adapters = { 'lobby-pvp': readLobbyArena };
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const arena = ref<LobbyArena | null>(null),
  step = ref(0),
  pending = ref(false),
  automatic = ref(false),
  message = ref('');
const visitors = ref<{ id: string; name: string; x: number; y: number }[]>([]);
const labels = [
  '選隊並開始 PK',
  '隔著掩體射擊',
  '移動繞過掩體',
  '再次射擊得分',
  '查看結算',
  '教學完成',
];
const hints = [
  '選綠隊開始，練習繞牆命中對手。',
  '隔牆射擊，觀察石牆如何擋下能量彈。',
  '沿牆移動到對手側邊。',
  '再次射擊，命中得 1 分。',
  '已得 1 分。按下一步查看結算。',
  '你以 1 比 0 獲勝。',
];
const hint = computed(() => hints[step.value]);
let timer: ReturnType<typeof setTimeout> | undefined,
  epoch = 0,
  visible = false;
let controller: AbortController | null = null;
function pause() {
  automatic.value = false;
  clearTimeout(timer);
}
function schedule() {
  clearTimeout(timer);
  if (automatic.value && visible && step.value < 5 && !document.hidden)
    timer = setTimeout(() => void run('next'), 1500);
  else if (step.value === 5) automatic.value = false;
}
async function run(action: 'start' | 'next') {
  if (pending.value) return;
  const current = epoch;
  pending.value = true;
  message.value = '';
  const localController = (controller = new AbortController());
  const timeout = setTimeout(() => localController.abort(), 15000);
  try {
    const r = record(
      await requestJson('/api/lobby/practice', {
        method: 'POST',
        body: { action, ...(action === 'next' ? { step: step.value } : {}) },
        signal: localController.signal,
      }),
    );
    if (!visible || current !== epoch) return;
    if (
      r.adapter !== 'lobby-pvp' ||
      !Number.isInteger(r.step) ||
      Number(r.step) < 0 ||
      Number(r.step) > 5
    )
      throw Error('教學資料不正確');
    arena.value = adapters['lobby-pvp'](r.arena);
    step.value = Number(r.step);
    visitors.value = array(r.visitors).map((v) => {
      const p = record(v);
      if (typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x + p.y))
        throw Error('教學位置不正確');
      return { id: text(p.id), name: text(p.name), x: p.x, y: p.y };
    });
  } catch (e) {
    if (current === epoch) {
      message.value = e instanceof Error ? e.message : '教學載入失敗';
      pause();
    }
  } finally {
    clearTimeout(timeout);
    if (current === epoch) {
      pending.value = false;
      controller = null;
      if (!message.value) schedule();
    }
  }
}
function close() {
  visible = false;
  epoch++;
  pause();
  controller?.abort();
  pending.value = false;
  void requestJson('/api/lobby/practice', { method: 'POST', body: { action: 'close' } }).catch(
    () => {},
  );
}
async function open() {
  visible = true;
  epoch++;
  pause();
  arena.value = null;
  step.value = 0;
  await dialog.value?.open();
  await run('start');
}
function auto() {
  automatic.value = !automatic.value;
  if (automatic.value) schedule();
  else pause();
}
function visibility() {
  if (document.hidden) pause();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', visibility);
  if (visible) close();
  else {
    pause();
    controller?.abort();
  }
});
defineExpose({ open });
</script>
<template>
  <UiDialog ref="dialog" title="競技場教學" @closing="close">
    <UiPanel title="獨立練習場" :description="hint">
      <p>按步驟操作，或選「全自動演示」。</p>
      <div v-if="arena" class="lobby-practice-stage" aria-label="掩體與練習玩家位置">
        <SceneCovers
          :covers="
            arena.covers
              .map((c) => ({
                ...c,
                x: (c.x - 5) * 2,
                y: (c.y - 65) * 3,
                width: c.width * 2,
                height: c.height * 3,
              }))
              .filter((c) => c.x >= 0 && c.x + c.width <= 100 && c.y >= 0 && c.y + c.height <= 100)
          "
        />
        <UiBadge
          v-for="p in visitors"
          :key="p.id"
          class="lobby-practice-actor"
          :tone="p.id === 'practice-self' ? 'danger' : 'info'"
          :style="{ left: (p.x - 5) * 2 + '%', top: (p.y - 65) * 3 + '%' }"
          >{{ p.name }}</UiBadge
        >
      </div>
      <p v-if="arena?.match"
        >{{ arena.match.phase === 'finished' ? '已結算' : '本局分數' }}：{{
          arena.match.players.map((p) => `${p.name} ${p.score} 分`).join('／')
        }}</p
      >
      <div class="lobby-arena-actions">
        <UiButton
          variant="primary"
          :label="labels[step] || '教學完成'"
          :disabled="pending || automatic || !arena || step === 5"
          @click="run('next')"
        />
        <UiButton
          :label="automatic ? '暫停演示' : '全自動演示'"
          :disabled="pending || !arena || step === 5"
          @click="auto"
        />
        <UiButton
          label="重試教學"
          :disabled="pending"
          @click="
            pause();
            run('start');
          "
        />
        <UiButton label="離開教學" @click="dialog?.close()" />
      </div>
      <StatusSlot
        :message="pending ? '正在執行教學操作…' : message"
        :error="!!message"
        persistent
      />
    </UiPanel>
  </UiDialog>
</template>
