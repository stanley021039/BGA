<script setup lang="ts">
import { computed } from 'vue';
import { usePokerStore } from '../../stores/poker';
import { useRoomStore } from '../../stores/room';
import { readPokerSnapshot } from '../../contracts/poker';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import PokerScene from './PokerScene.vue';
const poker = usePokerStore(),
  room = useRoomStore(),
  state = computed(() => poker.state);
const phases = {
  waiting: '等待開桌',
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '轉牌',
  river: '河牌',
  showdown: '本手已結算',
};
function status(player: RoomPlayer) {
  const s = state.value,
    index = s?.players.findIndex((p) => p.id === player.id),
    labels: string[] = [];
  if (index === s?.button) labels.push('莊家 D');
  if (index === s?.turn && poker.active) labels.push('目前行動');
  if (player.kicked) labels.push('已離席，電腦接手');
  else if (!player.online) labels.push('暫時離線');
  if (s?.phase !== 'waiting' && player.folded)
    labels.push(
      Array.isArray(player.cards) && !player.cards.length
        ? s?.phase === 'showdown'
          ? '本手未入局'
          : '下一手入局'
        : '棄牌',
    );
  else if (s?.phase !== 'waiting' && player.stack === 0) labels.push('ALL IN');
  if (typeof player.bet === 'number' && player.bet)
    labels.push('本街 ' + player.bet.toLocaleString());
  if (player.action && !labels.includes(String(player.action))) labels.push(String(player.action));
  return labels.join(' · ') || '準備入座';
}
</script>
<template>
  <GameRoomPage
    type="poker"
    title="德州撲克"
    description="2–6 人 · 盲注 10／20 · 純娛樂虛擬籌碼"
    :reader="readPokerSnapshot"
    :poll-ms="900"
    :phase="phases[state?.phase || 'waiting']"
    :round="state?.hand ? `第 ${state.hand} 手` : '等待發牌'"
    :max-players="6"
    :status="status"
    :setup="poker.setup"
    :can-start="(state?.players.filter((p) => p.stack > 0).length || 0) >= 2"
    :start-label="state?.hand ? '發下一手' : undefined"
    @start="room.command('start', {})"
    ><PokerScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取牌桌…</h1></section
    >
    <template #settings
      ><dl class="vue-poker-settings"
        ><div><dt>買入</dt><dd>2,000 虛擬籌碼</dd></div
        ><div><dt>盲注</dt><dd>10／20</dd></div
        ><div><dt>行動時間</dt><dd>45 秒</dd></div></dl
      ><UiButton legacy
        v-if="poker.me?.stack === 0 && poker.setup"
        label="補充 2,000 籌碼"
        icon="add"
        :pending="poker.pending"
        :disabled="!poker.canRebuy"
        @click="poker.rebuy()"
      /><p class="vue-poker-casual">只玩虛擬籌碼，享受朋友牌局。</p></template
    >
    <template #help
      ><ol
        ><li
          >2–6 位玩家，起始 2,000 虛擬籌碼，盲注固定
          10／20。每手開始時重新隨機選莊；兩人局由莊家下小盲。可在本手進行中入座，下一手才拿牌。</li
        ><li
          >每人兩張私人底牌，五張公共牌依翻牌／轉牌／河牌公開。攤牌時用七張牌中的最佳五張比較；其他玩家棄牌時直接派彩，不公開其底牌。</li
        ><li
          >輪到自己可棄牌、無需補注時過牌，或跟注所需籌碼。加注輸入的是「本街加注至」，不是額外加多少；最低幅度依上一個完整加注決定。</li
        ><li
          >ALL IN 可用全部剩餘籌碼跟注或加注；短額 ALL IN 不一定重新開放已行動者加注。介面依伺服器
          canRaise 顯示合法操作。</li
        ><li
          >每次行動 45 秒；真人逾時時，沒有需跟注則過牌，否則棄牌。腳本夥伴依既有規則自動操作。</li
        ><li
          >主池與邊池按各玩家本手總投入分層，棄牌者不能爭奪池內籌碼；平手分池的餘數依莊家後座位順序處理。畫面列出分層投入與伺服器實際聚合派彩，不以底池金額當成淨獲利。</li
        ><li>本手結束後由房主發下一手。籌碼用完，可在等待或結算時補充 2,000。</li
        ><li
          >進行中離席或被移除的席位由電腦接手，仍可能參與本手派彩；其他玩家可繼續。斷線可恢復原座位；伺服器重啟不恢復進行中的房間。</li
        ></ol
      ><p
        >下注介面不自動重送操作。連線結果不確定時會先更新牌桌，再由你依當前狀態選擇，避免重複下注。結算演出可跳過或重播，所有結果一直保留可讀。</p
      ></template
    >
  </GameRoomPage>
</template>
