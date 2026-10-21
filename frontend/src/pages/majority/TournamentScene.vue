<script setup lang="ts">
import { computed } from 'vue';
import { useMajorityStore } from '../../stores/majority';
import { useRoomStore } from '../../stores/room';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import GameSongClip from '../../components/GameSongClip.vue';
import '../../styles/stitch-party-content.scss';
const game = useMajorityStore(),
  room = useRoomStore(),
  s = computed(() => game.state!),
  t = computed(() => s.value.tournament!),
  blocked = computed(() => !room.connected || room.busy || game.pending || game.uncertain),
  name = (id: string) => s.value.players.find((p) => p.id === id)?.name || '已離席玩家';
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
</script>
<template>
  <section class="vue-game-panel stitch-club-content"
    ><small class="stitch-content-kicker">FREQUENCY CLUB · 同頻對決</small
    ><h1>{{ t.mode === 'music' ? '猜歌2選1' : '情境2選1' }} · {{ t.stage }}強 · 第{{ t.pair }}組</h1
    ><p v-if="['waiting', 'finished'].includes(s.phase)"
      >每場猜大家會選哪一項；選到多數 +1分，平手不加分。</p
    ><template v-else
      ><aside class="stitch-duel-banner" role="status"
        ><strong>{{ revealed ? '本場揭曉' : '秘密投票中' }}</strong
        ><span>{{
          revealed ? '選擇、票數與得分一起公開' : '猜大家會選哪一項；揭曉前不公開其他人的選擇'
        }}</span></aside
      ><h2>{{ s.question?.prompt }}</h2
      ><div class="vue-tournament-pair"
        ><article
          v-for="(entry, i) in s.question?.entries || []"
          :key="entry.id"
          :class="{ 'is-my-choice': s.ownAnswer === i, 'is-majority': isMajority(i) }"
          ><header class="stitch-option-heading"
            ><strong>選項 {{ i === 0 ? 'A' : 'B' }}</strong
            ><span v-if="s.ownAnswer === i">✓ 我的選擇</span
            ><span v-if="isMajority(i)">多數 +1分</span></header
          ><img v-if="entry.image" :src="entry.image" alt="" /><h3>{{ entry.label }}</h3
          ><p>{{ entry.detail }}</p
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
            :label="
              s.ownAnswer === i ? '已選擇此項' : game.choice === i ? '已挑選，請鎖定' : '選這一項'
            "
            :disabled="blocked || s.ownAnswer !== null"
            :aria-pressed="game.choice === i"
            @click="game.choice = i"
          /><template v-if="revealed"
            ><div class="stitch-vote-result"
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
            ></template
          ></article
        ></div
      ><template v-if="s.phase === 'answering'"
        ><UiButton
          v-if="s.ownAnswer === null"
          icon="lock"
          label="鎖定答案"
          :disabled="blocked || game.choice === null"
          @click="game.answer()" /><UiButton
          v-else
          icon="undo"
          label="收回答案"
          :disabled="blocked"
          @click="game.act('withdraw')" /><UiButton
          v-if="room.host"
          label="提前結束作答"
          :disabled="blocked"
          @click="game.act('close')" /></template
      ><UiButton
        v-if="s.phase === 'reveal' && (room.host || s.presenterId === s.me)"
        icon="next"
        :label="s.round >= s.roundLimit ? '查看冠軍' : '下一組'"
        :disabled="blocked"
        @click="game.act('next')" /></template
    ><template v-if="t.champion"
      ><h2>🏆 冠軍：{{ t.champion.label }}</h2
      ><p>{{ t.champion.detail }}</p></template
    ><h2>玩家排行</h2
    ><ol
      ><li v-for="player in t.ranking" :key="player.id"
        >第{{ player.rank }}名 · {{ player.name }} · {{ player.score }}分</li
      ></ol
    ><details v-if="t.entryRanking.length"
      ><summary>所有選項最終排行</summary
      ><ol
        ><li v-for="entry in t.entryRanking" :key="entry.id"
          >第{{ entry.rank }}名 · {{ entry.label }}</li
        ></ol
      ></details
    ><StatusSlot :message="game.message" :error="game.failed" /><UiButton
      v-if="game.uncertain"
      label="更新後再操作"
      @click="game.refresh()"
  /></section>
</template>
<style scoped>
.vue-tournament-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.vue-tournament-pair article {
  padding: 16px;
  border: 2px solid var(--ui-line, currentColor);
  border-radius: 16px;
  min-width: 0;
}
.vue-tournament-pair img {
  max-width: 100%;
  max-height: 220px;
}
.vue-tournament-pair audio {
  max-width: 100%;
}
@media (max-width: 650px) {
  .vue-tournament-pair {
    grid-template-columns: 1fr;
  }
}
</style>
