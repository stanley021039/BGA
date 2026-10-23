<script setup lang="ts">
import { computed } from 'vue';
import { useGiftStore } from '../../stores/gift';
import { readGiftSnapshot } from '../../contracts/gift';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import GiftScene from './GiftScene.vue';
const gift = useGiftStore(),
  state = computed(() => gift.state),
  phase = computed(
    () =>
      ({
        waiting: '等待開桌',
        choosing: '選禮與秘密心願',
        delivering: '依序確認收禮',
        reveal: '本輪禮物揭曉',
        finished: '本局結束',
      })[state.value?.phase || 'waiting'],
  );
function status(p: RoomPlayer) {
  const s = state.value;
  if (!s) return '正在讀取';
  return (
    (p.online ? '在線 · ' : '暫時離線 · ') +
    (s.phase === 'choosing'
      ? `送禮${s.gaveIds.includes(p.id) ? '已鎖定' : '未鎖定'} · 心願${s.wishedIds.includes(p.id) ? '已鎖定' : '未鎖定'}`
      : s.phase === 'delivering' && s.delivery?.recipientId === p.id
        ? '正在確認收禮'
        : s.phase === 'finished'
          ? '本局結束'
          : s.phase === 'waiting'
            ? '等待開桌'
            : '查看本輪結果')
  );
}
</script>
<template>
  <GameRoomPage
    type="gift"
    title="誰是送禮王"
    description="3–8 人 · 猜朋友心意，讓送禮與收禮雙分數達標"
    :reader="readGiftSnapshot"
    :poll-ms="1000"
    :phase="phase"
    :round="state?.round ? `第 ${state.round} 輪 · 目標 ${state.target} 分` : ''"
    :max-players="8"
    :status="status"
    :setup="gift.setup"
    :can-start="(state?.players.length || 0) >= 3 && !gift.settingsPending && !gift.settingsError"
    :start-label="state?.phase === 'finished' ? '再玩一局' : '開始送禮'"
    @start="gift.start()"
  >
    <GiftScene v-if="state" /><section v-else class="vue-game-panel"
      ><h1>正在讀取送禮房間…</h1></section
    >
    <template #player-metric="{ player }"
      ><div class="vue-gift-roster-scores"
        ><span
          >送 <strong>{{ player.giveScore }}</strong></span
        ><span
          >收 <strong>{{ player.getScore }}</strong></span
        ></div
      ></template
    >
    <template #settings
      ><details :open="state?.phase === 'waiting'" class="vue-gift-settings"
        ><summary
          >雙分數目標 {{ state?.target }} · 投稿
          {{ state?.customPercent === null ? '依題庫比例' : state?.customPercent + '%' }}</summary
        ><label
          >送禮與收禮共同目標<input
            v-model.number="gift.settingsDraft.target"
            type="number"
            min="8"
            max="30"
            step="1"
            :disabled="!gift.settingsEditable"
            @change="gift.queueSettings()" /></label
        ><label
          >玩家投稿禮物比例<select
            v-model="gift.settingsDraft.customPercent"
            :disabled="!gift.settingsEditable"
            @change="gift.queueSettings()"
            ><option :value="null">依題庫比例</option
            ><option v-for="percent in [0, 25, 50, 75, 100]" :key="percent" :value="percent"
              >{{ percent }}%{{
                percent === 0 ? ' · 只抽內建' : percent === 100 ? ' · 盡量投稿' : ''
              }}</option
            ></select
          ></label
        ><p
          >比例取近似值；投稿不足或尚未輪到重複抽取時，以內建禮物補足。內建題庫包含成人派對題材。</p
        ><a href="/gifts" target="_blank" rel="noopener">查看／投稿自訂禮物 ↗</a
        ><StatusSlot
          :persistent="gift.settingsPending || !!gift.settingsError"
          :message="gift.settingsPending ? '正在儲存設定…' : gift.settingsError || ''"
          :error="!!gift.settingsError" /><UiButton
          v-if="gift.settingsError && gift.settingsEditable"
          icon="refresh"
          label="重試儲存設定"
          @click="gift.queueSettings()" /></details
    ></template>
    <template #help
      ><ol
        ><li
          >3–8
          人。每輪抽玩家人數加一件禮物；每人給其他朋友各選一件不同禮物，同一份不能分給兩位朋友。</li
        ><li
          >依順序選四件不同禮物：最想要 +3、想要 +2、還可以 +1、最不想要 −4；沒標記的禮物
          −1。喜好與送禮都只給自己看，分開鎖定，送出後不能修改。</li
        ><li>大家兩項都完成後，按輪流順序收禮；目前收禮者親自確認，全部確認後才一起結算。</li
        ><li
          >每件禮物同時影響送禮者的送禮分數與收禮者的收禮分數；依明細順序逐件結算，兩條分數最低
          0，可以超過目標分數。</li
        ><li
          >送禮及收禮都達到或超過目標才獲勝；多人同時達標時，兩項加總最高者獲勝，加總相同則並列。否則由房主開始下一輪。</li
        ><li
          >投稿比例是近似值，題庫不足會用內建補足。內建包含成人派對題材；自訂圖片沿用已授權的共用禮物來源。</li
        ><li
          >有人離席時移除未揭曉的送禮與心願；不足三人提前結束。斷線可恢復原座位，伺服器重啟不續局。</li
        ></ol
      ><p
        >操作未確認時先更新房間，查明是否已鎖定；系統不會自動再次送出。腳本夥伴僅供試玩。</p
      ></template
    >
  </GameRoomPage>
</template>
