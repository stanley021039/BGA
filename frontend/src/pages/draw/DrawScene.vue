<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import type { PublicDrawSnapshot } from '../../contracts/draw-results';
import { useRoomStore } from '../../stores/room';
import { useDrawResultsStore } from '../../stores/draw-results';
import { record } from '../../services/validation';
import PlayerAvatar from '../../components/PlayerAvatar.vue';
import PlayerName from '../../components/PlayerName.vue';
import UiButton from '../../components/UiButton.vue';
import UiIcon from '../../components/UiIcon.vue';
import '../../styles/draw-scene.scss';
import { readDrawSettings } from '../../contracts/draw-settings';
import StatusSlot from '../../components/StatusSlot.vue';
import ResultCanvas from '../../components/ResultCanvas.vue';
import DrawVote from '../../components/DrawVote.vue';
import DrawHighlights from './DrawHighlights.vue';
const props = defineProps<{ snapshot: DrawSnapshot }>();
const emit = defineEmits<{
  start: [];
  next: [];
  gallery: [id: string];
  review: [id: string];
  settings: [];
}>();
const room = useRoomStore(),
  results = useDrawResultsStore(),
  preview = shallowRef<PublicDrawSnapshot | null>(null),
  loading = ref(false),
  error = ref('');
const artist = computed(() =>
  props.snapshot.players.find((player) => player.id === props.snapshot.presenterId),
);
const rankings = computed(() =>
  [...props.snapshot.players].sort((a, b) => Number(b.score) - Number(a.score)),
);
const winners = computed(() => props.snapshot.winner?.ids || []),
  me = computed(() => props.snapshot.players.find((player) => player.id === props.snapshot.me));
const correctCounts = computed(() => {
  try {
    return record(record(props.snapshot.matchSummary).correctByPlayer);
  } catch {
    return {};
  }
});
const settings = computed(() => readDrawSettings(props.snapshot.options));
const waitingFacts = computed(() => [
  { label: '每輪時間', value: settings.value.seconds + ' 秒／題' },
  { label: '結束條件', value: matchRule.value },
  {
    label: '題目類別',
    value:
      settings.value.topics.length +
      ' 類；' +
      (settings.value.topics.includes('custom') ? '含自訂' : '自訂未選'),
  },
]);
const matchRule = computed(() =>
  settings.value.mode === 'score'
    ? `目標 ${settings.value.score} 分`
    : settings.value.mode === 'rounds'
      ? `共 ${settings.value.rounds} 題輪替`
      : '每人作畫一次',
);
const isArtist = computed(() => props.snapshot.presenterId === props.snapshot.me);
const artistPoints = computed(
  () =>
    props.snapshot.result?.scores.find((player) => player.id === props.snapshot.result?.artist.id)
      ?.roundPoints,
);
const waitingIllustration = '/assets/stitch/draw-waiting.jpg';
function topicIcon(topic: unknown) {
  const icons: Record<string, string> = {
    food: 'gift',
    animals: 'users',
    transport: 'car',
    objects: 'cards',
    people: 'users',
    nature: 'sun',
    places: 'table',
    activities: 'sound',
    meme: 'emoji',
    custom: 'edit',
  };
  return typeof topic === 'string' ? icons[topic] || 'cards' : 'cards';
}
function pointsLabel(value: number | undefined) {
  return typeof value === 'number' ? (value >= 0 ? '+' : '') + value + ' 分' : '—';
}
let generation = 0,
  disposed = false;
async function loadPreview() {
  const id = ['reveal', 'finished'].includes(props.snapshot.phase)
      ? props.snapshot.result?.resultId
      : null,
    epoch = ++generation,
    scope = room.scope;
  preview.value = null;
  error.value = '';
  loading.value = !!id;
  if (!id) return;
  try {
    const value = await results.load(id);
    if (!disposed && epoch === generation && scope === room.scope) preview.value = value;
  } catch (cause) {
    if (!disposed && epoch === generation && scope === room.scope)
      error.value = cause instanceof Error ? cause.message : '畫作載入失敗。';
  } finally {
    if (epoch === generation) loading.value = false;
  }
}
watch(
  [() => props.snapshot.phase, () => props.snapshot.result?.resultId, () => room.scope],
  loadPreview,
  { immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  generation++;
});
function rank(index: number) {
  return (
    rankings.value.findIndex(
      (player) => Number(player.score) === Number(rankings.value[index].score),
    ) + 1
  );
}
</script>
<template>
  <RoomWaitingTemplate
    v-if="snapshot.phase === 'waiting'"
    type="draw"
    title="你畫我猜"
    hero-title="朋友集結中，畫筆已備，等房主開畫。"
    description="輪流挑選題目作畫，其他朋友一起猜答案。"
    :art="waitingIllustration"
    art-alt="你畫我猜的畫室插畫"
    :facts="waitingFacts"
    ><template #summary-extra>
      <div class="vue-waiting-ready"
        ><p>{{
          room.host
            ? '你是房主，邀請朋友、調整規則，兩人到齊就能開始。'
            : '入座後可先點就緒，等待房主開始。'
        }}</p
        ><UiButton
          v-if="!room.host"
          variant="secondary"
          icon="check"
          :label="me?.ready ? '已就緒（點擊切換）' : '準備好了！點擊就緒'"
          :aria-pressed="me?.ready === true"
          :pending="room.busy"
          @click="room.command('action', { action: 'ready', ready: !me?.ready })"
      /></div> </template
  ></RoomWaitingTemplate>
  <section
    v-else-if="snapshot.phase === 'choosing'"
    class="vue-draw-scene vue-draw-scene-v2 vue-draw-choosing-v2"
    :class="{ 'is-choosing-artist': isArtist }"
    :data-private="isArtist ? '' : undefined"
    :aria-label="isArtist ? '你的秘密選題' : '等待畫者選題'"
  >
    <template v-if="isArtist">
      <header class="vue-draw-choosing-heading"
        ><span class="vue-draw-scene-badge"><UiIcon name="lock" />只有畫者看得到題目</span
        ><h1>輪到你作畫了！請選擇一張題卡</h1
        ><p>請在 15 秒內完成挑選，選好任一張就會開始作畫。</p></header
      >
      <div class="vue-draw-candidates vue-draw-candidates-v2"
        ><button
          v-for="word in snapshot.candidates"
          :key="word.id || word.title"
          type="button"
          :disabled="room.busy || !word.id"
          :aria-label="
            '選擇題目：' +
            word.title +
            '，' +
            (word.topicLabel || '綜合') +
            '，' +
            [...word.title].length +
            ' 字'
          "
          @click="room.command('action', { action: 'choose', questionId: word.id })"
          ><span class="vue-draw-card-meta"
            ><small>{{ word.topicLabel || '綜合' }} · {{ word.category }}</small
            ><small>{{ [...word.title].length }} 字</small></span
          ><span class="vue-draw-card-symbol"><UiIcon :name="topicIcon(word.topic)" /></span
          ><strong>{{ word.title }}</strong
          ><span class="vue-draw-card-choose">點選作畫<UiIcon name="next" /></span></button
      ></div>
      <p v-if="!snapshot.candidates.length" class="vue-draw-private-notice"
        >正在取得可用題目，請稍候。</p
      >
    </template>
    <div v-else class="vue-draw-await-choice"
      ><span class="vue-draw-await-symbol" aria-hidden="true"
        ><UiIcon name="edit" /><span><UiIcon name="lock" /></span></span
      ><h1>等待畫者選題中…</h1
      ><div class="vue-draw-await-artist"
        ><PlayerAvatar
          :name="artist?.name || '畫者'"
          :avatar="artist?.avatar || null"
          :bot="artist?.bot"
        /><strong>{{ artist?.name || '畫者' }}</strong></div
      ><p>正在挑選本輪題目，畫作開始後就會出現在這裡。準備好猜答案！</p></div
    >
  </section>
  <section
    v-else-if="snapshot.phase === 'reveal'"
    class="vue-draw-scene vue-draw-scene-v2 vue-draw-reveal-v2"
    aria-label="本輪答案與畫作"
  >
    <header class="vue-draw-reveal-heading"
      ><div><UiIcon name="check" /><strong>回合結束！正確答案揭曉</strong></div
      ><small>第 {{ snapshot.round }} 輪</small></header
    >
    <div class="vue-draw-answer-banner"
      ><small>本輪正確答案</small><h1>{{ snapshot.result?.answer || '這輪沒有選定題目' }}</h1
      ><p>{{ snapshot.result?.reason }}</p></div
    >
    <dl class="vue-draw-round-facts"
      ><div
        ><dt>本輪猜中人數</dt
        ><dd>{{
          snapshot.result
            ? snapshot.result.guessedIds.length + ' / ' + snapshot.result.eligibleGuessers + ' 人'
            : '—'
        }}</dd></div
      ><div
        ><dt>完成筆畫</dt
        ><dd>{{ snapshot.result ? snapshot.result.strokeCount + ' 筆' : '—' }}</dd></div
      ><div
        ><dt>畫者本輪得分</dt><dd>{{ pointsLabel(artistPoints) }}</dd></div
      ></dl
    >
    <section class="vue-draw-reveal-art" aria-label="本輪作品展示"
      ><header
        ><h2
          ><UiIcon name="edit" />{{
            snapshot.result?.artist.name || artist?.name || '畫者'
          }}
          的作品</h2
        ><small>本輪畫作</small></header
      ><ResultCanvas v-if="preview" :snapshot="preview" compact /><div
        v-else
        class="vue-draw-result-empty"
        >{{ loading ? '正在讀取本輪畫作…' : '畫作尚未載入。'
        }}<UiButton
          v-if="error"
          variant="secondary"
          icon="refresh"
          label="重新載入畫作"
          @click="loadPreview" /></div
      ><StatusSlot :message="error" :error="!!error"
    /></section>
    <DrawVote :result-id="snapshot.result?.resultId || null" />
    <footer class="vue-draw-scene-actions"
      ><UiButton
        v-if="snapshot.result"
        variant="secondary"
        icon="save"
        label="收藏這幅畫"
        :pending="!!results.view?.savingId"
        @click="emit('gallery', snapshot.result.resultId)"
      /><UiButton
        v-if="snapshot.result"
        variant="secondary"
        icon="share"
        label="分享畫作"
        :disabled="results.busy"
        @click="results.share(snapshot.result.resultId)"
      /><UiButton
        v-if="room.host"
        variant="primary"
        icon="next"
        label="下一位畫者"
        :disabled="room.busy"
        @click="emit('next')"
      /><span v-else>等待下一輪</span></footer
    >
  </section>
  <section
    v-else-if="snapshot.phase === 'finished'"
    class="vue-draw-scene vue-draw-scene-v2 vue-draw-finished-v2"
    aria-label="本局成績"
  >
    <header class="vue-draw-finished-heading"
      ><span class="vue-draw-scene-badge"><UiIcon name="crown" />本局結束</span
      ><h1>今晚的畫猜回顧</h1><p>{{ snapshot.winner?.reason || '每位畫者都已完成。' }}</p></header
    >
    <DrawHighlights :snapshot="snapshot" @review="emit('review', $event)" />
    <section class="vue-draw-final-standings" aria-label="本局排名"
      ><header><h2>本局成績</h2><span>依總分排名 · 同分並列</span></header
      ><ol class="vue-draw-ranking"
        ><li
          v-for="(player, index) in rankings"
          :key="player.id"
          :class="{ 'is-winner': winners.includes(player.id) }"
          ><strong :aria-label="'排名 ' + rank(index)">{{ rank(index) }}</strong
          ><PlayerAvatar :name="player.name" :avatar="player.avatar" :bot="player.bot" /><div
            ><PlayerName :name="player.name" /><small
              >猜中 {{ Number(correctCounts[player.id]) || 0 }} 題{{
                winners.includes(player.id) ? ' · 本局獲勝' : ''
              }}</small
            ></div
          ><strong>{{ player.score }} 分</strong></li
        ></ol
      ></section
    >
    <details v-if="snapshot.result" class="vue-draw-final-art"
      ><summary>最後一幅畫 · {{ snapshot.result.answer || '未選定題目' }}</summary
      ><ResultCanvas v-if="preview" :snapshot="preview" compact /><StatusSlot
        :message="error || (loading ? '正在讀取畫作…' : '')"
        :error="!!error" /><UiButton
        v-if="error"
        variant="secondary"
        icon="refresh"
        label="重新載入畫作"
        @click="loadPreview"
    /></details>
    <footer class="vue-draw-scene-actions"
      ><a class="ui-button" href="/">返回大廳</a
      ><UiButton
        variant="secondary"
        icon="download"
        label="匯出本局畫作集"
        :disabled="results.busy || !results.results.length"
        @click="results.exportAll(true)"
      /><UiButton
        variant="secondary"
        icon="settings"
        label="下一局設定"
        @click="emit('settings')"
      /><UiButton
        v-if="room.host"
        variant="primary"
        icon="replay"
        label="再來一局（同桌再戰）"
        :disabled="snapshot.players.length < 2 || room.busy"
        @click="emit('start')"
      /><span v-else>等待房主再開一局</span></footer
    >
  </section>
</template>
