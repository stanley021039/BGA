<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { isGameType, type GameType } from '../contracts/room';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiField from './UiField.vue';
import StatusSlot from './StatusSlot.vue';

const room = useRoomStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  target = ref<string>(''),
  notice = ref('');
const waiting = computed(() => room.snapshot?.phase === 'waiting');
const pokerFinished = computed(() => room.type === 'poker' && room.snapshot?.phase === 'showdown');
const games = computed(() => {
  const rows = room.snapshot?.roomGames;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is { type: GameType; name: string; min: number; max: number } =>
      row &&
      isGameType(row.type) &&
      typeof row.name === 'string' &&
      Number.isInteger(row.min) &&
      Number.isInteger(row.max),
  );
});
const count = computed(() => room.snapshot?.players.filter((p) => !p.kicked).length || 0);
const selected = computed(() => games.value.find((game) => game.type === target.value));
const tooMany = computed(() => !!selected.value && count.value > selected.value.max);
const hint = computed(() => {
  const game = selected.value;
  if (!game) return '請選擇遊戲';
  if (tooMany.value)
    return `${game.name}最多 ${game.max} 人，目前有 ${count.value} 人，請先調整人數。`;
  if (count.value < game.min)
    return `目前 ${count.value} 人；可先切換，開始遊戲前至少需要 ${game.min} 人。`;
  return `目前 ${count.value} 人；${game.name}支援 ${game.min}–${game.max} 人。`;
});
function open(source: HTMLElement) {
  target.value = room.type;
  notice.value = '';
  void dialog.value?.open(source);
}
async function change() {
  if (
    !room.host ||
    !waiting.value ||
    tooMany.value ||
    !selected.value ||
    target.value === room.type
  )
    return;
  if (!(await room.command('change-game', { targetType: target.value })))
    notice.value = room.message;
}
async function back() {
  if (await room.command('rematch')) dialog.value?.close();
  else notice.value = room.message;
}
watch([() => room.scope, () => room.host, () => room.snapshot?.phase], () => dialog.value?.close());
</script>
<template>
  <UiButton
    v-if="room.host && (waiting || pokerFinished)"
    :label="waiting ? '更換遊戲' : '回等待室換遊戲'"
    :disabled="room.busy || !room.connected"
    @click="open($event.currentTarget as HTMLElement)"
  />
  <UiDialog ref="dialog" title="更換遊戲" compact :dismissible="!room.busy">
    <div class="room-game-switcher">
      <p>保留房間代碼、所有玩家及媒體清單與播放進度。切換後，所有人會自動前往新遊戲的等待室。</p>
      <template v-if="waiting">
        <UiField
          v-model="target"
          label="新遊戲"
          control="select"
          :options="games.map((game) => ({ value: game.type, label: game.name }))"
          :hint="hint"
          :error="tooMany ? hint : ''"
          :disabled="room.busy"
        />
        <UiButton
          variant="primary"
          label="確認切換"
          :pending="room.busy"
          :disabled="!room.connected || !selected || target === room.type || tooMany"
          @click="change"
        />
      </template>
      <UiButton
        v-else-if="pokerFinished"
        variant="primary"
        label="回等待室"
        :pending="room.busy"
        @click="back"
      />
      <StatusSlot :message="notice" :error="!!notice" persistent />
    </div>
  </UiDialog>
</template>
<style scoped>
.room-game-switcher {
  display: grid;
  gap: var(--stitch-space-16);
}
</style>
