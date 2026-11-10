<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMediaStore } from '../../stores/media';
import { readLoungeSnapshot } from '../../contracts/lounge';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import LoungeStage from './LoungeStage.vue';
// 場外休憩區 (#277): no match, only shared media, backgrounds and chat.
const room = useRoomStore(),
  media = useMediaStore(),
  current = computed(() => media.snapshot?.current || null);
function status(player: RoomPlayer) {
  return room.disconnected ? '重新連接中' : player.id === room.snapshot?.host ? '房主' : '休憩中';
}
</script>
<template>
  <GameRoomPage
    type="lounge"
    title="場外休憩區"
    description="1–10 人 · 不開局，一起看影片、聽歌、聊天"
    :reader="readLoungeSnapshot"
    phase=""
    :phase-row="false"
    :max-players="10"
    :status="status"
    :setup="false"
    :can-start="false"
    :show-metrics="false"
    panels-open
    media-stage="#lounge-stage"
    ><LoungeStage :title="current?.title" :video="current?.type === 'video'" />
    <template #help>
      ><p>房主或管理者可在聊天室的「媒體」點播及調整進度。背景可從上方功能列更換。</p></template
    >
  </GameRoomPage>
</template>
