<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { readMinimalSnapshot,type MinimalSnapshot } from '../../contracts/minimal';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import MinimalScene from './MinimalScene.vue';
const room=useRoomStore(),state=computed(()=>room.snapshot as MinimalSnapshot|null),setup=computed(()=>!!state.value&&['waiting','finished'].includes(state.value.phase));
const phase=computed(()=>state.value?.interrupted?'本場中止，保留已完成回合':({waiting:'等待開始',drawing:'畫家私人作畫',guessing:'由少到多猜圖',reveal:'本輪揭曉',finished:'本場結束'})[state.value?.phase||'waiting']);
function status(player:RoomPlayer){const value=state.value;return !value?'正在讀取':room.disconnected?'重新連接中':value.phase==='waiting'?'等待開桌':value.phase==='finished'?'本場結束':player.id===value.guesserId?'本輪猜題者':value.readyIds.includes(player.id)?'已完成作畫':'本輪畫家';}
</script>
<template><GameRoomPage type="minimal" title="極簡畫家" description="3–6 人 · 只用直線與封閉圓 · 由少筆畫開始猜" :reader="readMinimalSnapshot" :phase="phase" :round="state?.round?`第 ${state.round}／${state.roundLimit} 輪`:''" :max-players="6" :status="status" :setup="setup" :can-start="(state?.players.length||0)>=3" :start-label="state?.phase==='finished'?'再玩一局':undefined" @start="room.command('start',{})"><MinimalScene v-if="state" :key="room.scope" /><section v-else class="vue-game-panel"><h1>正在讀取極簡畫家房間…</h1></section><template #settings><p>四人以下每人當兩次猜題者，五至六人各一次。每張最多 40 個直線或封閉圓。</p></template><template #help><ol><li>3–6 人輪替當猜題者；其他畫家看到同一秘密詞，猜題者看不到答案。</li><li>只能畫直線與封閉圓，固定黑色筆寬，每個圖形算一筆，最多 40 筆。</li><li>放開後同步私人草稿；完成作畫後不能修改。只剩一位畫家時開始十秒倒數，時間到只採用伺服器接受的圖形。</li><li>由少筆畫到多筆畫逐張猜，每張猜一次；同筆畫依猜題者後的座位順序展示。</li><li>猜中畫家 +2、猜題者 +1；全部猜錯不加分。空白畫作略過，全部空白中性揭曉。</li><li>每輪揭曉保留題目、各圖、筆畫數與猜詞。離席中止本場，只保留已完成回合；最高分可並列。</li></ol><p>草稿僅保存在本分頁，伺服器重啟不續局。腳本夥伴不理解圖片或題目。</p></template></GameRoomPage></template>
