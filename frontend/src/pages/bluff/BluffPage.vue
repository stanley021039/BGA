<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useBluffStore } from '../../stores/bluff';
import { readBluffSnapshot } from '../../contracts/bluff';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import BluffScene from './BluffScene.vue';
const room = useRoomStore(),
  bluff = useBluffStore(),
  state = computed(() => bluff.state);
const phase = computed(() =>
  state.value?.interrupted
    ? '有人離席，本場中止'
    : {
        waiting: '等待開始',
        selecting: '想想三選一抽題',
        preparing: '查看秘密角色',
        discussion: '輪流解釋與質問',
        reveal: '本輪揭曉',
        finished: '本場結束',
      }[state.value?.phase || 'waiting'],
);
function status(player: RoomPlayer) {
  const s = state.value;
  if (!s) return '正在讀取';
  if (room.disconnected) return '重新連接中';
  if (s.phase === 'waiting') return '等待開桌';
  if (s.phase === 'finished') return '本場結束';
  return (
    (player.id === s.thinkerId ? '想想 · ' : '') +
    (s.challenges.includes(player.id)
      ? '被質疑：公三小'
      : s.spokenIds.includes(player.id)
        ? '說明完畢'
        : s.readyIds.includes(player.id)
          ? '已準備'
          : s.phase === 'preparing'
            ? '看角色'
            : s.phase === 'selecting'
              ? '選題中'
              : '討論中')
  );
}
</script>
<template>
  <GameRoomPage
    type="bluff"
    title="瞎掰王"
    description="3–9 人 · 外部語音或面對面口說 · 每人輪流當一次想想"
    :reader="readBluffSnapshot"
    :poll-ms="1500"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 輪` : ''"
    :max-players="9"
    :status="status"
    :setup="bluff.setup"
    :can-start="(state?.players.length || 0) >= 3 && !bluff.settingsPending && !bluff.settingsError"
    :start-label="state?.phase === 'finished' ? '再玩一局' : undefined"
    @start="bluff.start()"
  >
    <BluffScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取瞎掰王房間…</h1></section
    >
    <template #settings
      ><details class="vue-bluff-settings-details"
        ><summary
          >難度 {{ state?.options.levels.join('／') }} 級 · 看身分
          {{ state?.options.roleSeconds }} 秒</summary
        ><div class="vue-bluff-settings"
          ><p>設定僅供房主在開局前調整，修改後自動儲存。</p
          ><fieldset :disabled="!bluff.editable || room.busy"
            ><legend>題目難度（至少一種）</legend
            ><label v-for="level in [1, 2, 3]" :key="level"
              ><input
                v-model="bluff.draft.levels"
                type="checkbox"
                :value="level"
                @change="bluff.queue()"
              />{{ level }} 級</label
            ></fieldset
          ><label
            >看身分時間<select
              v-model.number="bluff.draft.roleSeconds"
              :disabled="!bluff.editable || room.busy"
              @change="bluff.queue()"
              ><option v-for="seconds in [10, 30, 60]" :key="seconds" :value="seconds"
                >{{ seconds }} 秒</option
              ></select
            ></label
          ><StatusSlot
            :message="
              bluff.settingsPending
                ? '正在儲存設定…'
                : bluff.settingsError || (bluff.settingsSaved ? '設定已儲存。' : '')
            "
            :error="!!bluff.settingsError" /><UiButton
            v-if="bluff.settingsError && bluff.editable"
            icon="refresh"
            label="重試儲存設定"
            :disabled="room.busy"
            @click="bluff.queue()" /></div></details
    ></template>
    <template #help
      ><ol
        ><li>3–9 人，每人起始 3 分，輪流當一次想想。請使用自己的語音或面對面討論，網站不錄音。</li
        ><li
          >想想私下三選一題名與難度，選定後全員查看自己的秘密角色。秘密卡預設收合，只有老實人收到正解與詳細解釋；到期收起，或全員準備後提前進入口說。</li
        ><li>其餘玩家輪流口頭解釋，說完按「說明完畢」。想想聽完所有人後，確認選一位老實人。</li
        ><li
          >選中老實人，雙方各加題目難度；選中瞎掰人，只有被選者加難度。每輪兩張「公三小」不可重複：質疑瞎掰人，對方
          -1、想想 +1；質疑老實人，想想 -3。</li
        ><li
          >揭曉後可查看正解、詳細解釋及查證來源；該輪真人玩家可投票禁題，過半數後全站持久禁用。AI
          不投票。</li
        ><li
          >口說時可按「哦是哦」送出文字反應與原音效，每五秒一次，依共用音效設定。最後五秒有短提示，不依角色改音色。</li
        ><li
          >最高分可並列，分數可為負。離席中止並保留已完成回合；斷線可恢復席位，伺服器重啟不續局。腳本夥伴不理解口說。</li
        ></ol
      ></template
    >
  </GameRoomPage>
</template>
