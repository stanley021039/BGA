<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useMajorityStore } from '../../stores/majority';
import { useRoomStore } from '../../stores/room';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import GameSongClip from '../../components/GameSongClip.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
const game = useMajorityStore(),
  room = useRoomStore(),
  s = computed(() => game.state!),
  t = computed(() => s.value.tournament!),
  live = ref<HTMLElement | null>(null),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  blocked = computed(
    () => !room.connected || room.busy || game.pending || game.uncertain || !!room.terminal,
  ),
  name = (id: string) =>
    s.value.players.find((p) => p.id === id)?.name ||
    s.value.departed.find((p) => p.id === id)?.name ||
    '已離席玩家';
const revealed = computed(() => ['reveal', 'finished'].includes(s.value.phase));
const voters = (i: number) =>
  revealed.value
    ? Object.entries(s.value.answers)
        .filter(([, a]) => a === i)
        .map(([id]) => id)
    : [];
const totalVotes = computed(() => Object.keys(s.value.answers).length);
const percent = (i: number) =>
  totalVotes.value ? Math.round((voters(i).length / totalVotes.value) * 100) : 0;
const isMajority = (i: number) =>
  revealed.value && voters(i).some((id) => (s.value.result?.gains[id] || 0) > 0);
let disposed = false,
  revision = 0;
watch([() => room.scope, () => s.value.question?.id, () => s.value.phase], async () => {
  const current = ++revision;
  confirm.value?.cancel();
  await nextTick();
  if (!disposed && current === revision && live.value) live.value.scrollTop = 0;
});
async function closeAnswering() {
  const context = game.context;
  if (blocked.value || !room.host || s.value.phase !== 'answering') return;
  if (
    await confirm.value?.ask(
      '提前結束本場投票？未交卷的朋友本場不計分；無人投票時不能結算。',
      '結束投票',
    )
  ) {
    if (context === game.context && room.host && !blocked.value)
      await game.act('close', {}, context);
  }
}
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  confirm.value?.cancel();
});
</script>
<template>
  <section class="vue-majority-scene vue-tournament-scene" :data-phase="s.phase">
    <header class="vue-majority-scene-heading"
      ><small
        >{{ t.mode === 'music' ? '猜歌2選1' : '情境2選1' }} · {{ t.stage }}強 · 第
        {{ t.pair }} 組</small
      ><h1>{{
        s.phase === 'finished' ? '本局結果' : s.question?.prompt || '秘密投票中'
      }}</h1></header
    >
    <div class="vue-majority-clock-slot"
      ><RoomCountdown
        :deadline="s.phase === 'answering' ? s.deadline : null"
        :duration="120000"
        :offset="game.offset"
        :now="game.clock"
        :epoch="game.context"
        caption="本場作答時間"
        :empty-value="s.phase === 'finished' ? '本局結束' : '本場揭曉'"
        urgent
      /><span>{{ s.answeredIds.length }} / {{ s.participantIds.length }} 人交卷</span></div
    >
    <div ref="live" class="vue-majority-live">
      <template v-if="s.phase !== 'finished'"
        ><p class="vue-majority-banner">{{
          revealed ? '選擇、票數與得分一起公開。' : '猜大家會選哪一項；揭曉前不公開其他人的選擇。'
        }}</p
        ><p v-if="s.phase === 'answering' && !game.participant" class="vue-majority-banner"
          >本場已開始，請等待下一場或下一局參與。</p
        >
        <div class="vue-tournament-pair"
          ><article
            v-for="(entry, i) in s.question?.entries || []"
            :key="entry.id"
            :class="{ 'is-my-choice': s.ownAnswer === i, 'is-majority': isMajority(i) }"
            ><header class="vue-tournament-option-heading"
              ><strong>選項 {{ i === 0 ? 'A' : 'B' }}</strong
              ><span v-if="s.ownAnswer === i">✓ 我的選擇</span
              ><span v-if="isMajority(i)">多數 +1 分</span></header
            ><img v-if="entry.image" :src="entry.image" :alt="entry.label" /><h2>{{
              entry.label
            }}</h2
            ><p v-if="entry.detail">{{ entry.detail }}</p
            ><GameSongClip
              v-if="entry.audioUrl"
              :key="s.question?.id + ':' + i"
              :active="room.connected"
              :playback="{
                provider: 'audio',
                url: entry.audioUrl,
                start: 0,
                seconds: entry.audioSeconds || 30,
                stage: 'highlight',
              }"
            /><UiButton
              v-if="s.phase === 'answering'"
              stitch
              :variant="game.choice === i || s.ownAnswer === i ? 'primary' : 'secondary'"
              :label="
                s.ownAnswer === i ? '已選擇此項' : game.choice === i ? '已挑選，請鎖定' : '選這一項'
              "
              :disabled="blocked || !game.participant || game.expired || s.ownAnswer !== null"
              :aria-pressed="(s.ownAnswer ?? game.choice) === i"
              @click="game.choice = i"
            />
            <div v-if="revealed" class="vue-tournament-vote-result"
              ><strong>{{ voters(i).length }}票 · {{ percent(i) }}%</strong
              ><meter
                min="0"
                max="100"
                :value="percent(i)"
                :aria-label="entry.label + ' 得票率'"
              /><p v-for="id in voters(i)" :key="id"
                ><strong>{{ name(id) }}{{ id === s.me ? '（你）' : '' }}</strong
                ><span>{{
                  (s.result?.gains[id] || 0) > 0 ? '+' + s.result!.gains[id] + '分' : '未得分'
                }}</span></p
              ><p v-if="!voters(i).length">沒有人選擇</p></div
            ></article
          ></div
        >
        <p v-if="revealed && s.result?.reason" class="vue-majority-banner">{{
          s.result.reason
        }}</p></template
      >
      <template v-else
        ><section v-if="t.champion" class="vue-tournament-champion"
          ><h2>冠軍：{{ t.champion.label }}</h2
          ><img v-if="t.champion.image" :src="t.champion.image" :alt="t.champion.label" /><p
            v-if="t.champion.detail"
            >{{ t.champion.detail }}</p
          ></section
        ><p v-else class="vue-majority-banner">{{
          s.winner?.reason || '本局已結束，以下保留實際完成的排行。'
        }}</p></template
      >
      <section class="vue-majority-standings"
        ><h2>玩家排行</h2
        ><ol
          ><li v-for="player in t.ranking" :key="player.id"
            ><strong>第 {{ player.rank }} 名 · {{ player.name }}</strong
            ><span>{{ player.score }} 分</span></li
          ></ol
        ></section
      >
      <details v-if="t.entryRanking.length" class="vue-tournament-entry-ranking"
        ><summary>所有選項最終排行</summary
        ><ol
          ><li v-for="entry in t.entryRanking" :key="entry.id"
            >第 {{ entry.rank }} 名 · {{ entry.label }}</li
          ></ol
        ></details
      >
    </div>
    <div class="vue-majority-feedback"
      ><StatusSlot
        :message="
          game.message ||
          (game.expired && s.phase === 'answering' ? '時間已到，等待伺服器確認投票進度。' : '')
        "
        :error="game.failed" /><UiButton
        v-if="game.uncertain"
        stitch
        icon="refresh"
        label="更新狀態後再操作"
        :disabled="room.busy || !room.connected"
        @click="game.refresh()"
    /></div>
    <footer class="vue-majority-footer"
      ><div class="vue-majority-primary-actions"
        ><div v-if="s.phase === 'finished'" id="majority-next-settings"></div
        ><div v-if="s.phase === 'finished'" id="majority-replay-slot"></div
        ><template v-else-if="s.phase === 'answering'"
          ><UiButton
            v-if="s.ownAnswer === null"
            stitch
            variant="primary"
            icon="lock"
            label="鎖定答案"
            :pending="game.pending"
            :disabled="blocked || !game.participant || game.choice === null || game.expired"
            @click="game.answer()" /><UiButton
            v-else
            stitch
            icon="undo"
            label="收回答案"
            :disabled="blocked || game.expired"
            @click="game.act('withdraw')" /><UiButton
            v-if="room.host"
            stitch
            label="提前結束作答"
            :disabled="blocked"
            @click="closeAnswering" /></template
        ><UiButton
          v-if="s.phase === 'reveal' && (room.host || s.presenterId === s.me)"
          stitch
          variant="primary"
          icon="next"
          :label="s.round >= s.roundLimit ? '查看冠軍' : '下一組'"
          :disabled="blocked"
          @click="game.act('next')" /></div
      ><p class="vue-tournament-footer-note">{{
        t.mode === 'music'
          ? '試聽由你主動播放；投票猜全桌偏好。'
          : '每場選到唯一多數 +1 分；平票不加分。'
      }}</p></footer
    >
    <ConfirmDialog ref="confirm" stitch />
  </section>
</template>
