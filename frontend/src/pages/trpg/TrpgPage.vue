<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useTrpgStore } from '../../stores/trpg';
import { useRoomStore } from '../../stores/room';
import { readTrpgSnapshot } from '../../contracts/trpg';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import UiField from '../../components/UiField.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import TrpgScene from './TrpgScene.vue';
const trpg = useTrpgStore(),
  room = useRoomStore(),
  state = computed(() => trpg.state),
  confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const phase = computed(
    () =>
      ({
        waiting: '等待出發',
        planning: '一起準備角色行動',
        reveal: '檢定結果，準備下一幕',
        finished: '冒險結束',
      })[state.value?.phase || 'waiting'],
  ),
  offline = computed(
    () =>
      state.value?.players.filter((p) => trpg.mayRest(p.id) || trpg.mayRemoveLeader(p.id)) || [],
  );
function status(player: RoomPlayer) {
  return `${player.roleName || '冒險者'} · 專注 ${player.focus ?? 3}／3${player.id === state.value?.leaderId ? ' · 本幕領隊' : ''}${player.offline ? ' · 離線' : ''}${player.ready ? ' · 已準備' : state.value?.phase === 'planning' ? ' · 尚未準備' : ''}`;
}
let guard: (() => boolean) | null = null;
async function handleOffline(id: string) {
  if (guard || room.busy) return;
  const scope = room.scope,
    scene = state.value?.sceneId,
    p = state.value?.players.find((p) => p.id === id);
  if (!p) return;
  const remove = trpg.mayRemoveLeader(id);
  guard = () =>
    scope === room.scope &&
    scene === state.value?.sceneId &&
    !room.busy &&
    (remove ? trpg.mayRemoveLeader(id) : trpg.mayRest(id));
  try {
    if (!guard()) return;
    const ok = await confirmation.value?.ask(
      remove
        ? `移除離線領隊「${p.name}」並交棒？本幕會保留，但所有人需要重新準備。`
        : `讓「${p.name}」本幕休息？不會代替其擲骰，也不會恢復或消耗其專注。`,
      remove ? '移除並交棒' : '本幕休息',
    );
    if (ok && guard()) await (remove ? trpg.removeLeader(id) : trpg.rest(id));
  } finally {
    guard = null;
  }
}
watch(
  () => room.snapshot,
  () => {
    if (guard && !guard()) confirmation.value?.cancel();
  },
);
function visibility() {
  if (document.hidden) confirmation.value?.cancel();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  confirmation.value?.cancel();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <GameRoomPage
    type="trpg"
    title="霧港跑團"
    description="1–8 人合作冒險 · 六幕原創故事 · 規則主持，沒有倒數"
    :reader="readTrpgSnapshot"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／6 幕` : '準備出發'"
    :max-players="8"
    :show-metrics="false"
    :status="status"
    :setup="trpg.setup"
    :can-start="(state?.players.length || 0) >= 1"
    :start-label="state?.phase === 'finished' ? '再來一場' : '開始冒險'"
    @start="trpg.start()"
    ><TrpgScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取霧港跑團房間…</h1></section
    >
    <template #settings
      ><div v-if="trpg.setup" class="vue-trpg-role"
        ><UiField
          id="trpgRole"
          label="你的角色"
          control="select"
          v-model="trpg.role"
          :disabled="!trpg.roleEditable"
          ><option v-for="(value, id) in state?.roles" :key="id" :value="id"
            >{{ value.name }} · {{ value.description }}</option
          ></UiField
        ><UiButton
          label="選擇角色"
          icon="check"
          :disabled="!trpg.roleEditable || trpg.role === trpg.me?.role"
          @click="trpg.chooseRole()"
        /><p>角色可以重複；每個角色都能選擇所有解法。</p></div
      ><div v-else class="vue-trpg-role-current"
        >你的角色：{{ trpg.me?.roleName }} ·
        {{ state?.roles[trpg.me?.role || '']?.description }}</div
      ></template
    >
    <template #side-actions
      ><section v-if="offline.length" class="vue-game-panel vue-trpg-offline"
        ><h3>離線席位</h3><p>離線滿 15 秒且尚未準備，房主可確認處理。</p
        ><UiButton
          v-for="player in offline"
          :key="player.id"
          :label="player.name + (player.id === state?.leaderId ? '：移除並交棒' : '：本幕休息')"
          :disabled="room.busy"
          @click="handleOffline(player.id)" /></section
    ></template>
    <template #help
      ><ol
        ><li
          >1–8
          人，六幕原創故事「霧港鐘聲」。每幕換一位領隊；第一位隨機決定，其後按入座順序輪替。角色可重複，沒有玩家淘汰。</li
        ><li
          >每人起始專注 3、隊伍補給 4。領隊選觀察（難度 6、補給 1）、交涉（難度 7、補給
          0）或冒險（難度 8、補給 0）。成功線索分別 ＋1、＋1、＋2。</li
        ><li
          >符合領隊角色專長 ＋2；最多兩位隊友按入座順序各花 1 專注提供
          ＋1，其餘協助者不扣專注。整備恢復 1 專注（上限 3）；領隊整備時，本幕不使用專長。</li
        ><li
          >所有人先準備行動，領隊才擲骰。伺服器 d6 加專長與協助；達難度成功，差 1–2 為線索 ＋1、危機
          ＋1，更低則受挫：危機增加解法風險，並失去最多 1 補給。每種結果仍然推進故事。</li
        ><li
          >本幕可更新自己的行動；選填角色描述最多 160
          字、不能換行，只供隊友在揭曉後閱讀，不參與規則判定。</li
        ><li
          >六幕後線索至少 5、危機不超過
          7，就找回鐘聲；其他結果帶著約定回港。完整骰值、資源變化與隊友行動保留於旅途手記。</li
        ><li
          >沒有倒數催促。房主可讓滿 15
          秒且未準備的離線隊友休息，不代擲骰或消耗專注；離線領隊可移除並交棒，全桌重新準備。本幕一般離席仍由目前隊伍繼續。</li
        ></ol
      ><p
        >這是原創規則主持與腳本試玩夥伴，不連接 AI、不消耗
        token。伺服器重啟不恢復冒險進度；已記錄歷史仍可回看。</p
      ></template
    > </GameRoomPage
  ><ConfirmDialog ref="confirmation" />
</template>
