<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoomStore } from '../../stores/room';
import { readMusicQuizSnapshot, type MusicQuizSnapshot } from '../../contracts/musicquiz';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import MusicQuizScene from './MusicQuizScene.vue';
const dirty = ref(false),
  room = useRoomStore(),
  s = computed(() => room.snapshot as MusicQuizSnapshot | null),
  setup = computed(() => !!s.value && ['waiting', 'finished'].includes(s.value.phase)),
  phase = computed(
    () =>
      ({
        waiting: '等待開桌',
        pick: 'DJ準備',
        intro: '前奏10選1',
        timeline: '年代排序',
        challenge: '歌王插歌',
        reveal: '本輪揭曉',
        finished: '本場結果',
      })[s.value?.phase || 'waiting'],
  );
function status(p: RoomPlayer) {
  return (
    (p.id === s.value?.djId ? '本輪DJ · ' : '') +
    (Array.isArray(p.timeline) ? p.timeline.length : 0) +
    '張 · 前奏' +
    (p.bonus || 0) +
    '分'
  );
}
</script>
<template>
  <GameRoomPage
    type="musicquiz"
    score-label="張"
    title="猜歌挑戰"
    description="8秒前奏10選1 · 歌曲年代排序 · 歌王插歌"
    :reader="readMusicQuizSnapshot"
    :phase="phase"
    :round="s?.round ? '第 ' + s.round + ' 首' : ''"
    :max-players="8"
    :status="status"
    :setup="setup"
    :can-start="!dirty && !!s && s.availableCount >= s.players.length + 2"
    @start="room.command('start', {})"
    ><MusicQuizScene v-if="s" :key="room.scope" @dirty="dirty = $event" /><template #settings
      ><p v-if="s?.phase !== 'waiting'"
        >在中央選擇題庫並儲存設定。大家共用題庫，音量各自調整。</p
      ></template
    ><template #help
      ><ol
        ><li
          >1–8人，前奏播放8秒，30秒內從10個歌名選1個。每人只能提交一次；答對
          +1前奏分、+1歌王標記（最多5枚），略過不扣分。提交後播放個人答對／答錯音效；年份與年代排序結果最後揭曉。</li
        ><li
          >聽30秒精華，DJ在60秒內放入年代時間軸。同年相鄰兩側皆可；逾時放最前方。DJ放對即得卡，全員放錯則棄牌。</li
        ><li
          >其他玩家有15秒花1枚標記插歌，每人一次，位置不能和DJ或其他挑戰者重複，也可放棄。DJ錯而你對才取得卡片；多人正確時先提交者優先。</li
        ><li
          >先達目標卡數獲勝；題庫用完依卡數排名，同分並列。前奏分獨立列出，不併入卡數。開局1張卡、2枚標記；DJ放牌前可花1枚切歌，聽歌前任何人可花3枚買歌。大家都能看音樂卡及外觀。</li
        ><li>優先原生音檔，尚無音檔才提供影片備援。切點尚未逐首聽校。</li></ol
      ></template
    ></GameRoomPage
  >
</template>
