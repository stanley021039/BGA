<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoomStore } from '../../stores/room';
import { usePartyActionsStore } from '../../stores/party-actions';
import { usePreferencesStore } from '../../stores/preferences';
import { useQueuedSave } from '../../composables/queued-save';
import type { MusicQuizSnapshot } from '../../contracts/musicquiz';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import FramePreview from '../../components/FramePreview.vue';
import GameSongClip from '../../components/GameSongClip.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiIcon from '../../components/UiIcon.vue';
import '../../../../public/shared/song-title-zh.js';
import '../../styles/stitch-party-content.scss';
const emit = defineEmits<{ dirty: [value: boolean] }>();
const room = useRoomStore(),
  prefs = usePreferencesStore(),
  actions = usePartyActionsStore(),
  s = computed(() => room.snapshot as MusicQuizSnapshot),
  setup = computed(() => ['waiting', 'finished'].includes(s.value.phase)),
  blocked = computed(() => !room.connected || room.busy || actions.pending),
  dj = computed(() => s.value.players.find((p) => p.id === s.value.djId)),
  me = computed(() => s.value.me === s.value.djId),
  banks = ref<string[]>([]),
  genres = ref<string[]>([]),
  target = ref(10),
  obscure = ref(false),
  custom = ref(''),
  error = ref(''),
  dirty = ref(false);
watch(dirty, (value) => emit('dirty', value));
const settingsSave = useQueuedSave<void>({
  allowed: () => setup.value && room.host && !room.terminal,
  blocked: () => blocked.value,
  save,
  failure: () => actions.notice || error.value,
});
function markSettingsInput(event: Event) {
  // Checkbox v-model commits on change. Rendering on its earlier input event
  // can restore the old checked value before that change handler reads it.
  const type = (event.target as HTMLInputElement | null)?.type;
  if (type !== 'checkbox' && type !== 'radio') dirty.value = true;
}
function queueSettings() {
  dirty.value = true;
  error.value = '';
  settingsSave.enqueue(undefined);
}
async function saveNow() {
  if (!settingsSave.pending.value) settingsSave.enqueue(undefined);
  await settingsSave.flush();
}
watch(
  () => s.value.settings,
  (v) => {
    if (dirty.value || settingsSave.pending.value) return;
    banks.value = [...v.banks];
    genres.value = [...v.genres];
    target.value = v.target;
    obscure.value = v.obscure;
    custom.value = s.value.customSongs
      .map((x) =>
        [x.title, x.artist, x.year, x.videoId, x.introStart, x.highlightStart].join(' | '),
      )
      .join('\n');
  },
  { immediate: true },
);
async function save() {
  try {
    const customSongs = custom.value.trim()
      ? custom.value
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => {
            const a = line.split('|').map((x) => x.trim());
            let videoId = a[3] || '';
            if (videoId.startsWith('https://')) {
              const u = new URL(videoId);
              if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
              else if (['youtube.com', 'www.youtube.com'].includes(u.hostname))
                videoId = u.searchParams.get('v') || '';
            }
            return {
              title: a[0],
              artist: a[1],
              year: Number(a[2]),
              videoId,
              introStart: Number(a[4] || 0),
              highlightStart: Number(a[5] || 60),
              aiGenerated: false,
            };
          })
      : [];
    if (
      await actions.command('configure', {
        banks: [...banks.value],
        genres: [...genres.value],
        target: target.value,
        obscure: obscure.value,
        customSongs,
      })
    ) {
      dirty.value = false;
      error.value = '題庫已儲存';
      return true;
    }
    return false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '題庫格式錯誤';
    return false;
  }
}
const enteredAt = ref(Date.now());
watch(
  () => s.value.roundId + ':' + s.value.phase,
  () => {
    enteredAt.value = Date.now();
  },
);
const now = ref(Date.now()),
  clock = setInterval(() => (now.value = Date.now()), 250);
onBeforeUnmount(() => clearInterval(clock));
const preparing = computed(
  () => ['timeline', 'challenge'].includes(s.value.phase) && now.value < enteredAt.value + 3000,
);
const resultReading = computed(() => now.value < enteredAt.value + 7000);
const phaseGuide = computed(
  () =>
    ({
      waiting: '',
      finished: '',
      pick: '接下來：全員聽8秒前奏，從10個歌名選答案。由DJ按開始。',
      intro:
        '全員選歌名。接下來由DJ聽精華、排列年代；前奏個人判定即時播放音效；歌名與年份最後公開。',
      timeline: me.value
        ? '輪到你：聽精華，把歌放入自己的年代時間軸；同一年放在相鄰任一側都算對。接著其他玩家可插歌。'
        : '現在由DJ排列年代。接下來你有15秒決定是否花1枚標記插歌，請先看看時間軸。',
      challenge: me.value
        ? '其他玩家正在決定是否插歌。接下來揭曉歌名、年份和得卡者。'
        : '15秒內花1枚標記選不同位置，或選「這次不插歌」。DJ放錯且你放對才能取得卡片。',
      reveal: '先看本輪結果。接下來換下一位DJ；房主或本輪DJ按「下一首」才會繼續。',
    })[s.value.phase] || '',
);
const translated = (title: string, language?: string) =>
  (
    window as unknown as {
      SongTitleZh?: { hint: (title: string, language?: string) => string | undefined };
    }
  ).SongTitleZh?.hint(title, language);
const songLabel = (title: string, language?: string) => {
  const hint = translated(title, language);
  return hint ? title + '；' + hint : title;
};
const canSlot = (i: number) =>
  !blocked.value &&
  !preparing.value &&
  (s.value.phase === 'timeline'
    ? me.value
    : !me.value &&
      s.value.mine.tokens > 0 &&
      s.value.placement !== i &&
      !Object.values(s.value.challenges).includes(i) &&
      !Object.hasOwn(s.value.challenges, s.value.me) &&
      !s.value.passed.includes(s.value.me));
</script>
<template>
  <RoomWaitingTemplate
    v-if="s.phase === 'waiting'"
    type="musicquiz"
    title="猜歌挑戰"
    hero-title="旋律已備，等你聽題。"
    description="1–8 人 · 前奏猜歌與年代排序"
    art="/assets/playful/game-musicquiz.svg"
    :facts="[
      { label: '年代卡目標', value: target + ' 張' },
      { label: '所選題庫', value: banks.length + ' 種' },
      { label: '目前可抽', value: s.availableCount + ' 首' },
    ]"
    ><template #settings><div id="room-waiting-settings-content-musicquiz"></div></template
  ></RoomWaitingTemplate>

  <section
    v-show="s.phase !== 'waiting'"
    class="vue-game-panel vue-musicquiz-stage stitch-music-content"
    ><template v-if="setup"
      ><Teleport
        :to="s.phase === 'waiting' ? '#room-waiting-settings-content-musicquiz' : 'body'"
        :disabled="s.phase !== 'waiting'"
        defer
        ><div class="vue-waiting-music-settings stitch-music-content"
          ><header class="stitch-setup-heading"
            ><div
              ><small>TUNE TIMELINE · 題庫設定</small
              ><h1>{{ s.phase === 'finished' ? '本場結果' : '題庫挑選與競賽規則' }}</h1
              ><p>選取本局的音樂年代題庫，從8秒前奏開始挑戰，再將歌曲排入個人時間軸。</p></div
            ><span class="stitch-host-badge">{{
              room.host ? '房主自訂中' : '全桌共用題庫'
            }}</span></header
          ><p v-if="s.winner">年代冠軍：{{ s.winner.names.join('、') }} · {{ s.winner.score }}張</p
          ><fieldset
            :disabled="!room.host || blocked"
            @input="markSettingsInput"
            @change="queueSettings"
            class="stitch-setup-sheet"
            ><legend><UiIcon name="cards" />語言與分類</legend
            ><div class="mq-banks"
              ><label v-for="bank in s.banks" :key="bank.id" class="mq-bank"
                ><input v-model="banks" type="checkbox" :value="bank.id" /><UiIcon
                  :name="bank.id === 'viral' ? 'star' : bank.id === 'custom' ? 'edit' : 'music'"
                  class="mq-bank-icon"
                /><span class="mq-bank-check" aria-hidden="true">{{
                  banks.includes(bank.id) ? '✓' : '○'
                }}</span
                ><strong>{{ bank.label }}</strong
                ><span class="mq-bank-description">{{
                  bank.id === 'custom'
                    ? '本局匯入的自選歌曲'
                    : bank.id === 'foreign'
                      ? '英文以外的其他外文'
                      : '熱門代表作與經典歌曲'
                }}</span
                ><span class="mq-bank-count">{{ bank.count }} 首</span></label
              ></div
            ><details
              ><summary>曲風篩選</summary
              ><label v-for="genre in s.genres" :key="genre"
                ><input v-model="genres" type="checkbox" :value="genre" />{{ genre }}</label
              ></details
            ><div class="stitch-settings-grid"
              ><label
                >獲勝目標<strong>率先集齊年代卡</strong
                ><input v-model.number="target" type="number" min="3" max="10" /></label
              ><div
                ><small>前奏猜答限制</small
                ><strong>{{ s.settings.introSeconds }} 秒試聽前奏</strong></div
              ><div><small>年代排序規則</small><strong>依年代排列，同年可相鄰</strong></div
              ><div><small>歌王插歌起始標記</small><strong>每人起始 2 枚標記</strong></div></div
            ><label><input v-model="obscure" type="checkbox" />混入冷門挑戰（最多約10%）</label
            ><details
              ><summary>自己的題庫</summary
              ><p>每行：歌名 | 歌手 | 首發年 | YouTube網址或ID | 前奏起點 | 精華起點</p
              ><textarea v-model="custom" rows="4" aria-label="自選歌曲題庫" /></details></fieldset
          ><UiButton
            v-if="room.host && settingsSave.error.value"
            icon="refresh"
            label="重試儲存題庫"
            :disabled="blocked"
            @click="saveNow"
          /><p role="status"
            >目前可抽 {{ s.availableCount }} 首{{
              settingsSave.pending.value
                ? ' · 正在儲存題庫…'
                : dirty
                  ? ' · 儲存未完成，請重試儲存'
                  : ' · 可開始遊戲'
            }}</p
          ></div
        ></Teleport
      ></template
    >
    <template v-else
      ><header
        ><small class="stitch-content-kicker">TUNE TIMELINE · 第 {{ s.round }} 首</small
        ><h1>{{
          s.phase === 'intro'
            ? '前奏10選1'
            : s.phase === 'timeline'
              ? '歌曲精華 · 年代排序'
              : s.phase === 'challenge'
                ? '歌王插歌'
                : s.phase === 'reveal'
                  ? '本輪揭曉'
                  : '準備下一首'
        }}</h1
        ><p>{{
          s.song
            ? s.song.title + ' · ' + s.song.artist + ' · ' + s.song.year
            : '先聽音樂，答案揭曉前隱藏歌名與年份'
        }}</p></header
      ><div class="mq-current-dj" :class="{ 'is-me': me }"
        ><span>{{ me ? '你是本輪 DJ' : '本輪 DJ' }}</span
        ><strong>{{ dj?.name || '等待 DJ' }}</strong></div
      ><aside class="mq-phase-guide" role="status" aria-live="polite"
        ><strong>{{
          preparing
            ? '準備下一環節 · ' + Math.max(1, Math.ceil((enteredAt + 3000 - now) / 1000)) + '秒'
            : '玩法提示'
        }}</strong
        ><p>{{ phaseGuide }}</p></aside
      ><section v-if="s.playback" class="stitch-vinyl-stage" :class="{ 'is-revealed': !!s.song }"
        ><div class="stitch-vinyl-record" aria-hidden="true"><span>♪</span></div
        ><div
          ><small>{{
            s.song ? '歌曲身分揭曉' : s.playback.stage === 'intro' ? '全員前奏挑戰' : '神秘年代卡'
          }}</small
          ><h2
            :title="s.song ? translated(s.song.title, s.song.language) : undefined"
            :data-ui-hint="s.song && translated(s.song.title, s.song.language) ? '' : undefined"
            :tabindex="s.song ? 0 : undefined"
            >{{ s.song?.title || '神秘曲目 #' + s.round }}</h2
          >
          ><p>{{
            s.song
              ? s.song.artist + ' · ' + s.song.year
              : s.playback.seconds + '秒片段 · 歌名與年份待揭曉'
          }}</p></div
        ></section
      ><RoomCountdown
        v-if="s.deadline"
        :deadline="s.deadline"
        :duration="s.phase === 'intro' ? 30000 : s.phase === 'timeline' ? 60000 : 15000"
        :offset="room.clockOffset"
        :now="now"
        :epoch="s.roundId + ':' + s.phase"
        caption="本階段剩餘時間"
        urgent /><GameSongClip
        v-if="s.playback"
        :key="s.roundId + ':' + s.playback.stage"
        :playback="s.playback"
        :active="room.connected && !preparing" />
      <template v-if="s.phase === 'pick'"
        ><UiButton
          v-if="me"
          icon="play"
          label="全員開始聽前奏"
          :disabled="blocked"
          @click="actions.command('listen')" /><p v-else>等待 {{ dj?.name }} 開始播放</p
        ><UiButton
          v-if="s.mine.tokens >= 3"
          label="買歌 · 3枚"
          :disabled="blocked"
          @click="actions.command('buy')"
      /></template>
      <template v-if="s.phase === 'intro'"
        ><p>聽8秒，30秒內選擇；答對 +1前奏分與1枚標記。</p
        ><div v-if="!s.submitted" class="mq-answer-choices"
          ><button
            v-for="choice in s.introChoices"
            :key="choice.id"
            :title="translated(choice.title, choice.language)"
            :aria-label="songLabel(choice.title, choice.language)"
            :data-ui-hint="translated(choice.title, choice.language) ? '' : undefined"
            :disabled="blocked"
            @click="actions.command('guess', { choiceId: choice.id })"
            >{{ choice.title }}</button
          ></div
        ><UiButton
          v-if="!s.submitted"
          label="略過前奏"
          :disabled="blocked"
          @click="actions.command('guess', { pass: true })"
        /><p v-else
          >已選：{{ s.myAnswer?.text || '略過' }} ·
          {{
            s.myAnswer?.titleCorrect === true
              ? '答對'
              : s.myAnswer?.titleCorrect === false
                ? '答錯'
                : '已略過'
          }}
          · 等待大家作答</p
        ></template
      >
      <template v-if="['timeline', 'challenge'].includes(s.phase)"
        ><h2>{{ dj?.name }} 的年代時間軸</h2
        ><div class="mq-timeline"
          ><template v-for="i in (dj?.timeline.length || 0) + 1" :key="i"
            ><UiButton
              :label="
                s.placement === i - 1
                  ? 'DJ放置點'
                  : s.phase === 'timeline'
                    ? '插槽 ' + i + ' · 放在這裡'
                    : '插槽 ' + i + ' · 插歌這裡'
              "
              :disabled="!canSlot(i - 1)"
              :aria-pressed="s.placement === i - 1 || s.challenges[s.me] === i - 1"
              @click="
                actions.command(s.phase === 'timeline' ? 'place' : 'challenge', { slot: i - 1 })
              " /><article
              v-if="dj?.timeline[i - 1]"
              class="mq-timeline-card"
              :title="translated(dj.timeline[i - 1]!.title, dj.timeline[i - 1]!.language)"
              :data-ui-hint="
                translated(dj.timeline[i - 1]!.title, dj.timeline[i - 1]!.language) ? '' : undefined
              "
              tabindex="0"
              ><FramePreview
                portrait
                :frame="dj.musicCardFrame?.id || 'default'"
                :name="String(dj.timeline[i - 1]!.year)"
                :message="dj.timeline[i - 1]!.title"
                :lines="[
                  String(dj.timeline[i - 1]!.year),
                  dj.timeline[i - 1]!.title,
                  dj.timeline[i - 1]!.artist,
                ]" /></article></template></div
        ><UiButton
          v-if="
            s.phase === 'challenge' &&
            !me &&
            !s.passed.includes(s.me) &&
            !Object.hasOwn(s.challenges, s.me)
          "
          label="這次不插歌"
          :disabled="blocked || preparing"
          @click="actions.command('pass')"
      /></template>
      <template v-if="s.phase === 'reveal'"
        ><p v-if="resultReading">請先看結果與聽判定音效，稍後可開始下一首。</p
        ><h2>{{ s.results.at(-1)?.receiverName || '本輪無人' }}取得年代卡</h2
        ><p v-for="answer in s.results.at(-1)?.answers || []" :key="answer.id"
          >{{ answer.name }}：前奏 +{{ answer.bonus }}分</p
        ><UiButton
          v-if="room.host || me"
          icon="next"
          label="下一首"
          :disabled="blocked || resultReading"
          @click="actions.command('next')" /></template
      ><UiButton
        v-if="me && ['pick', 'intro', 'timeline'].includes(s.phase)"
        label="切歌 · 1枚"
        :disabled="blocked || s.mine.tokens < 1"
        @click="actions.command('skip')" /></template
    ><StatusSlot
      :message="settingsSave.error.value || actions.notice || error"
      :error="!!settingsSave.error.value || !!actions.notice" /><UiButton
      v-if="actions.canRetry"
      label="重試同一操作"
      @click="actions.retrySame()"
  /></section>
  <section class="vue-game-panel"
    ><h2>大家的音樂卡</h2
    ><label
      >我的音樂卡外觀<select
        :value="s.players.find((p) => p.id === s.me)?.musicCardFrame?.id || 'default'"
        :disabled="blocked"
        @change="
          actions.command('card-frame', { frameId: ($event.target as HTMLSelectElement).value })
        "
        ><option
          v-for="frame in prefs.frames"
          :key="frame.id"
          :value="frame.id"
          :disabled="!prefs.canUse(frame.id)"
          >{{ frame.label }}</option
        ></select
      ></label
    ><details v-for="player in s.players" :key="player.id" :open="player.id === s.me"
      ><summary
        >{{ player.name }} · {{ player.timeline.length }}張 · 前奏{{ player.bonus }}分 · 標記{{
          player.tokens
        }}</summary
      ><div class="mq-collection-grid"
        ><div
          v-for="card in player.timeline"
          :key="card.id"
          :title="translated(card.title, card.language)"
          :aria-label="songLabel(card.title, card.language)"
          :data-ui-hint="translated(card.title, card.language) ? '' : undefined"
          tabindex="0"
          ><FramePreview
            portrait
            :frame="player.musicCardFrame?.id || 'default'"
            :name="String(card.year)"
            :message="card.title + ' · ' + card.artist"
            :lines="[String(card.year), card.title, card.artist]" /></div></div></details
  ></section>
</template>
