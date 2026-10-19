<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { canManagePlayers, kickEffect, mayKickPlayer, maySetPlayerRole, myRoomRole, playerRoomRole } from '../contracts/room';
import type { RoomPlayer } from '../contracts/room';
import UiDialog from './UiDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import UiButton from './UiButton.vue';
import PlayerName from './PlayerName.vue';
import StatusSlot from './StatusSlot.vue';
import '../styles/room.scss';
defineProps<{ stitch?: boolean }>();
const room = useRoomStore(), dialog = ref<InstanceType<typeof UiDialog> | null>(null), confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const message = ref(''), failed = ref(false), allowed = computed(() => canManagePlayers(room.snapshot));
const players = computed(() => (room.snapshot?.players || []).filter(player => !player.kicked));
let confirmationGuard: (() => boolean) | null = null;
function roleLabel(player: RoomPlayer) { const role = room.snapshot && playerRoomRole(player, room.snapshot); return player.bot ? '電腦' : role === 'host' ? '房主' : role === 'manager' ? '管理者' : '一般玩家'; }
function currentPlayer(id: string) { return room.snapshot?.players.find(player => player.id === id); }
function open(event: MouseEvent) { if (!allowed.value || room.busy) return; message.value = ''; failed.value = false; void dialog.value?.open(event.currentTarget as HTMLElement); }
async function confirm(message: string, label: string, guard: () => boolean): Promise<boolean> {
  if (confirmationGuard || !guard()) return false;
  confirmationGuard = guard;
  try { return !!await confirmation.value?.ask(message, label) && guard(); }
  finally { confirmationGuard = null; }
}
async function run(route: string, data: Record<string, unknown>, success: string) {
  const scope = room.scope;
  message.value = ''; failed.value = false;
  const accepted = await room.command(route, data);
  if (scope === room.scope) { message.value = accepted ? success : room.message; failed.value = !accepted && room.failed; }
  return accepted;
}
async function setRole(player: RoomPlayer) {
  if (!maySetPlayerRole(currentPlayer(player.id), room.snapshot)) return;
  const role = room.snapshot && playerRoomRole(player, room.snapshot) === 'manager' ? 'member' : 'manager';
  await run('room-role', { playerId: player.id, role }, role === 'manager' ? '已設為管理者。' : '已改為一般玩家。');
}
async function kick(player: RoomPlayer) {
  const scope = room.scope, state = room.snapshot; if (!state) return;
  const guard = () => scope === room.scope && !room.busy && mayKickPlayer(currentPlayer(player.id), room.snapshot);
  if (!await confirm(`即將踢出：${player.name}\n${kickEffect(state)}\n對方會收到被踢出通知，原本的連線將失效。`, '確認踢出', guard)) return;
  await run('kick', { playerId: player.id, confirmed: true }, '已踢出玩家。');
}
async function transfer(player: RoomPlayer) {
  const scope = room.scope;
  const guard = () => scope === room.scope && room.type === 'draw' && !room.busy && maySetPlayerRole(currentPlayer(player.id), room.snapshot);
  if (!await confirm(`移交房主給「${player.name}」？對方將取得開始遊戲、設定和房間管理權限。`, '移交房主', guard)) return;
  await run('action', { action: 'transfer-host', playerId: player.id }, '房主已移交。');
}
async function dissolve() {
  const scope = room.scope, epoch = room.snapshot?.canvasEpoch;
  const guard = () => scope === room.scope && room.type === 'draw' && room.host && !room.busy && epoch === room.snapshot?.canvasEpoch;
  if (!await confirm('確定要解散這桌？所有朋友會離開房間；已記錄的對局與私人收藏會保留。', '解散房間', guard)) return;
  const accepted = await run('draw/dissolve', { confirmed: true, canvasEpoch: epoch }, '房間已解散。');
  if (scope === room.scope && (accepted || room.terminal === 'closed')) { room.forget(); room.dispose(); location.assign('/'); }
}
watch(() => room.snapshot, () => {
  if (!allowed.value) { confirmation.value?.cancel(); dialog.value?.close(); }
  else if (confirmationGuard && !confirmationGuard()) confirmation.value?.cancel();
});
watch(() => room.scope, () => { confirmation.value?.cancel(); dialog.value?.close(); message.value = ''; failed.value = false; });
onBeforeUnmount(() => confirmation.value?.cancel());
</script>
<template>
  <UiButton :stitch="stitch" variant="secondary" class="vue-room-manage-trigger" icon="users" :icon-only="!stitch" label="房間管理" :disabled="!allowed || room.busy" @click="open" />
  <UiDialog :stitch="stitch" ref="dialog" title="房間管理" :dismissible="!room.busy"><p>{{ myRoomRole(room.snapshot) === 'host' ? '房主可設定房間管理者，並踢出其他玩家。房間角色不影響網站帳戶權限。' : '管理者可踢出一般玩家；房主與其他管理者的角色由房主設定。' }}</p><div class="vue-room-management-list"><article v-for="player in players" :key="player.id" class="vue-room-management-row"><div><PlayerName :name="player.name" /><small>{{ roleLabel(player) }}{{ player.id === room.snapshot?.me ? ' · 你' : '' }}{{ player.online ? '' : ' · 暫時離線' }}</small></div><div class="vue-room-management-actions"><UiButton v-if="room.type === 'draw' && maySetPlayerRole(player, room.snapshot)" icon="crown" icon-only :label="'移交房主給' + player.name" :disabled="room.busy" @click="transfer(player)" /><UiButton v-if="maySetPlayerRole(player, room.snapshot)" icon="users" icon-only :label="(room.snapshot && playerRoomRole(player, room.snapshot) === 'manager' ? '改為一般玩家：' : '設為管理者：') + player.name" :disabled="room.busy" @click="setRole(player)" /><UiButton v-if="mayKickPlayer(player, room.snapshot)" icon="remove" icon-only :label="'踢出：' + player.name" :disabled="room.busy" @click="kick(player)" /></div></article></div><StatusSlot :message="room.busy ? '處理中…' : message" :error="failed" /><footer class="vue-room-management-actions"><slot name="invite" /><UiButton v-if="room.type === 'draw' && room.host" icon="leave" label="解散房間" :disabled="room.busy" @click="dissolve" /></footer></UiDialog>
  <ConfirmDialog ref="confirmation" />
</template>
