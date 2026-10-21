<script setup lang="ts">
import { computed } from 'vue';
import { useTelephoneStore } from '../../stores/telephone';
import { useRoomStore } from '../../stores/room';
import { readTelephoneSnapshot } from '../../contracts/telephone';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import TelephoneScene from './TelephoneScene.vue';
const telephone = useTelephoneStore(),
  room = useRoomStore(),
  state = computed(() => telephone.state);
const players = computed(() => state.value?.players.filter((player) => !player.kicked).length || 0),
  sourceLabel = computed(
    () =>
      state.value?.sources
        .filter((source) => state.value?.options.sources.includes(source.id))
        .map((source) => source.label)
        .join('＋') || '正在讀取題庫',
  );
const pageCount = computed(
  () =>
    state.value?.roundLimit ||
    (players.value >= 3 ? (players.value % 2 ? players.value - 1 : players.value) : 0),
);
const phase = computed(() =>
  state.value?.phase === 'passing'
    ? '畫圖與猜詞傳遞中'
    : state.value?.phase === 'finished'
      ? state.value.interrupted
        ? '有人離席，傳遞中止'
        : '全部故事揭曉'
      : '等待入座',
);
function status(player: RoomPlayer) {
  const label =
    state.value?.phase === 'passing'
      ? player.ready
        ? '已送出，等待傳頁'
        : '正在完成本頁'
      : state.value?.phase === 'finished'
        ? state.value.interrupted
          ? '傳遞中止 · 回看已送出頁面'
          : '本局結束 · 一起回看故事'
        : '等待開始';
  return player.online ? label : `${label} · 暫時離線`;
}
</script>
<template>
  <GameRoomPage
    type="telephone"
    title="傳情畫意"
    description="3–8 人 · 每頁 90 秒 · 畫圖與猜詞交替，不計個人分數"
    :reader="readTelephoneSnapshot"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／${state.roundLimit} 頁` : ''"
    :max-players="8"
    :show-metrics="false"
    :status="status"
    :setup="telephone.setup"
    :can-start="
      (state?.players.length || 0) >= 3 && !telephone.settingsPending && !telephone.settingsError
    "
    :start-label="state?.phase === 'finished' ? '再傳一場' : '開始傳遞'"
    @start="telephone.start()"
  >
    <TelephoneScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"
      ><h1>正在讀取傳情畫意房間…</h1></section
    >
    <template #settings
      ><details :open="state?.phase === 'waiting'" class="vue-telephone-settings"
        ><summary
          ><span>情境題庫</span><strong>{{ sourceLabel }}</strong></summary
        ><fieldset :disabled="!telephone.settingsEditable || room.busy"
          ><legend>獨立情境題庫（至少一種）</legend
          ><label v-for="source in state?.sources" :key="source.id"
            ><input
              v-model="telephone.sources"
              type="checkbox"
              :value="source.id"
              @change="telephone.queueSources()"
            />{{ source.label }}</label
          ></fieldset
        ><StatusSlot
          :message="telephone.settingsPending ? '正在儲存題庫…' : telephone.settingsError || ''"
          :error="!!telephone.settingsError" /><UiButton
          v-if="telephone.settingsError && telephone.settingsEditable"
          icon="refresh"
          label="重試儲存題庫"
          :disabled="room.busy"
          @click="telephone.queueSources()" /></details
      ><dl class="vue-telephone-room-facts"
        ><div
          ><dt>傳遞頁數</dt
          ><dd>{{ pageCount ? pageCount + ' 頁（依本局入座人數）' : '3–8 人入座後確定' }}</dd></div
        ><div><dt>換頁機制</dt><dd>每頁 90 秒，到時自動傳頁</dd></div
        ><div><dt>揭曉方式</dt><dd>無計分，最後回看完整故事</dd></div></dl
      ></template
    >
    <template #help
      ><ol
        ><li
          >3–8 人，依固定入座順序傳遞；每個人從不同情境題目開始。奇數人傳 n−1 頁、偶數人傳 n
          頁，最後一頁是猜詞。</li
        ><li>畫圖時只看上一頁文字；猜詞時只看上一張圖。傳遞中看不到其他頁面或別人的私人草稿。</li
        ><li>每頁固定 90 秒，全員提早送出也等時間到才換頁。送出或略過後不能修改。</li
        ><li
          >未送出時，時間到採用伺服器已接受的私人草稿；沒有內容標記略過。最後一刻尚未同步的內容不保證納入。</li
        ><li
          >畫作最多 100 筆、3,000 點，每筆最多 256 點；猜詞最多 80
          字。畫布可用滑鼠、觸控，或方向鍵搭配空白鍵操作；幾何工具以兩次空白鍵設定起點與終點。</li
        ><li>最後一起回看完整傳遞簿，不計分或排名。有人離席會中止，只揭曉已送出的頁面。</li></ol
      ><p
        >重新整理不延長期限；本分頁草稿與伺服器私人草稿可供恢復。伺服器重啟不續局；腳本夥伴只用於試玩流程。</p
      ></template
    >
  </GameRoomPage>
</template>
