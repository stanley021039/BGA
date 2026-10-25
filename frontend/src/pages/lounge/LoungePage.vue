<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMediaStore } from '../../stores/media';
import { readLoungeSnapshot } from '../../contracts/lounge';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiIcon from '../../components/UiIcon.vue';
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
    ><section class="vue-lounge" aria-label="共看畫面"
      ><div id="lounge-stage" class="vue-lounge-stage"
        ><div v-if="current?.type !== 'video'" class="vue-lounge-idle"
          ><UiIcon :name="current ? 'sound' : 'video'" /><p>{{
            current
              ? '正在播放「' + current.title + '」'
              : '目前沒有影片。打開聊天室的「媒體」點播，大家一起看。'
          }}</p></div
        ></div
      ></section
    ><template #help
      ><p>場外休憩區沒有遊戲流程，最多 10 人。</p
      ><p
        >影片會顯示在房間中央；從聊天室的「媒體」點播、調整進度。播放控制由房主或管理者操作，背景可從上方功能列更換。</p
      ></template
    >
  </GameRoomPage>
</template>
