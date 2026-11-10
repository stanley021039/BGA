<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useDecryptoStore } from '../../stores/decrypto';
import type { DecryptoSnapshot } from '../../contracts/decrypto';
import UiPanel from '../../components/UiPanel.vue';
import UiButton from '../../components/UiButton.vue';
import UiField from '../../components/UiField.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
import UiHeading from '../../components/UiHeading.vue';
import UiTabs from '../../components/UiTabs.vue';
import '../../styles/decrypto.scss';
const props = defineProps<{ observer?: DecryptoSnapshot; focus?: string }>();
const room = useRoomStore(),
  game = props.observer ? null : useDecryptoStore(),
  s = computed(() => {
    if (!props.observer) return game!.state!;
    const team = props.observer.teams.findIndex((entry) =>
      entry.members.includes(props.focus || ''),
    );
    return { ...props.observer, myTeam: Math.max(0, team) };
  });
const clues = ref(['', '', '']),
  digits = ref(['', '', '']),
  words = ref(['', '', '', '']);
const context = computed(() =>
  [room.scope, s.value?.roundId, s.value?.turn, s.value?.me].join(':'),
);
watch(context, () => {
  clues.value = ['', '', ''];
  digits.value = ['', '', ''];
  words.value = ['', '', '', ''];
});
const active = computed(
  () => !props.observer && !!s.value && !room.busy && room.connected && !s.value.interrupted,
);
const myRole = computed(() =>
  !s.value
    ? ''
    : s.value.encryptors[s.value.myTeam] === s.value.me
      ? '出題者'
      : s.value.decoders[s.value.myTeam] === s.value.me
        ? '猜碼代表'
        : '隊員',
);
const guessing = computed(() => (s.value?.myTeam === s.value?.turn ? 'decode' : 'intercept'));
const canGuess = computed(
  () =>
    !!s.value &&
    s.value.phase === 'guessing' &&
    s.value.decoders[s.value.myTeam] === s.value.me &&
    !(s.value.round === 1 && guessing.value === 'intercept') &&
    !s.value.guessReady[guessing.value],
);
const selectedDigits = computed(() => digits.value.filter(Boolean));
const duplicateDigits = computed(
  () => new Set(selectedDigits.value).size < selectedDigits.value.length,
);
const validDigits = computed(
  () => !duplicateDigits.value && digits.value.every((d) => ['1', '2', '3', '4'].includes(d)),
);
const latest = computed(() => s.value?.results.at(-1));
const notesId = useId(),
  noteTeam = ref('1');
watch(
  () => s.value?.myTeam,
  (t) => {
    if (t !== undefined) noteTeam.value = String(1 - t);
  },
  { immediate: true },
);
const stage = computed(() =>
  s.value?.phase === 'clues'
    ? 0
    : s.value?.phase === 'guessing' || s.value?.phase === 'reveal'
      ? s.value.turn === 1 && s.value.phase === 'reveal'
        ? 3
        : s.value.turn + 1
      : 3,
);
const phaseHint = computed(() => {
  const v = s.value;
  if (!v) return '';
  if (v.interrupted) return '本場已中止，可由房主返回等待室重新分隊。';
  if (props.observer && v.phase === 'clues') return '等待兩隊準備線索。';
  if (props.observer && v.phase === 'guessing') return '雙方鎖定答案後一起揭曉。';
  if (v.phase === 'clues')
    return v.secretCode && !v.clueReady[v.myTeam]
      ? '輪到你出題：依密碼順序，用三條線索描述本隊詞卡。'
      : v.clueReady[v.myTeam]
        ? '線索已鎖定，等待另一隊完成。'
        : '本輪由 ' + name(v.encryptors[v.myTeam]) + ' 出題；你可以先查看本隊詞卡。';
  if (v.phase === 'guessing')
    return canGuess.value
      ? guessing.value === 'decode'
        ? '輪到你確認本隊答案；先與隊友討論，再鎖定三位密碼。'
        : '輪到你截碼：對照公開筆記，推理對手的三位密碼。'
      : v.round === 1 && v.myTeam !== v.turn
        ? '第一輪先聽線索，不進行截碼；留意揭曉後的筆記。'
        : v.guessReady[guessing.value]
          ? '答案已鎖定，等待雙方完成後一起揭曉。'
          : '與隊友討論，由 ' + name(v.decoders[v.myTeam]) + ' 確認答案。';
  if (v.phase === 'reveal') return '比較線索、猜碼與正確密碼；完整一輪後才判定勝負。';
  if (v.phase === 'tiebreak') return '淨分相同：兩隊秘密猜對方四個關鍵詞，多者勝。';
  return v.phase === 'finished' ? '本場完成。展開通訊紀錄，回看雙方線索如何被破解。' : '';
});
const name = (id: string) => s.value?.players.find((p) => p.id === id)?.name || '等待玩家';
async function sendClues() {
  await game?.act('clues', { clues: clues.value.slice() });
}
async function sendGuess() {
  if (!active.value || !canGuess.value || !validDigits.value) return;
  await game?.act(guessing.value, { digits: digits.value.map(Number) });
}
const digitOptions = [
  { value: '', label: '請選' },
  ...[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) })),
];
</script>
<template>
  <div v-if="s" class="decrypto-scene" :data-phase="s.phase">
    <div class="decrypto-summary"
      ><UiBadge>{{ s.teams[s.myTeam].name }} · {{ observer ? '觀戰視角' : myRole }}</UiBadge
      ><span v-if="s.round">第 {{ s.round }}／8 輪</span
      ><span v-if="s.round === 1">第一輪不截碼</span></div
    >
    <ol v-if="s.phase !== 'waiting'" class="decrypto-flow" aria-label="本輪流程"
      ><li
        v-for="(label, i) in ['準備線索', '白隊通訊', '黑隊通訊', '本輪結算']"
        :key="i"
        :aria-current="stage === i ? 'step' : undefined"
        ><UiBadge :tone="stage === i ? 'primary' : i < stage ? 'success' : 'neutral'"
          >{{ i + 1 }} · {{ label }}</UiBadge
        ></li
      ></ol
    >
    <div class="decrypto-teams decrypto-scoreboards">
      <UiPanel
        v-for="(team, t) in s.teams"
        :key="t"
        :title="
          team.name +
          (observer
            ? t === s.myTeam
              ? '（跟隨中）'
              : ''
            : t === s.myTeam
              ? '（本隊）'
              : '（對手）')
        "
        density="compact"
      >
        <div class="decrypto-summary"
          ><UiBadge tone="success">截碼成功 {{ team.interceptions }}／2</UiBadge
          ><UiBadge tone="danger">溝通失誤 {{ team.failures }}／2</UiBadge></div
        >
        <p class="decrypto-members">{{
          team.members
            .filter((id) => s.players.some((p) => p.id === id))
            .map(name)
            .join('、') || '等待加入'
        }}</p>
        <span v-if="s.phase !== 'waiting' && s.phase !== 'finished'"
          >出題：{{ name(s.encryptors[t]) }} · 猜碼代表：{{ name(s.decoders[t]) }}</span
        >
        <UiButton
          v-if="!observer && s.phase === 'waiting'"
          :label="t === s.myTeam ? '目前隊伍' : '加入' + team.name"
          :disabled="
            !active ||
            t === s.myTeam ||
            team.members.filter((id) => s.players.some((p) => p.id === id)).length >= 4
          "
          @click="game?.act('team', { team: t })"
        />
      </UiPanel>
    </div>
    <UiPanel v-if="s.phase === 'waiting'" class="decrypto-waiting" title="準備秘密通訊">
      <p>4–8 人，兩隊各 2–4 人。每人輪流出題；其他隊友一起討論，由本輪猜碼代表確認答案。</p>
      <p>房間聊天全桌可見，請勿貼出秘密關鍵詞或密碼。</p>
      <div id="room-waiting-settings-decrypto"></div>
    </UiPanel>
    <template v-else>
      <UiPanel
        class="decrypto-secret"
        :title="
          s.phase === 'finished' && !s.interrupted
            ? '雙方關鍵詞'
            : observer
              ? '關鍵詞'
              : '本隊秘密關鍵詞'
        "
        density="compact"
      >
        <div
          v-for="(team, t) in s.keywords"
          :key="t"
          class="decrypto-keyword-group"
          :aria-label="s.teams[t].name + '關鍵詞'"
        >
          <template v-if="team.length"
            ><p v-if="s.phase === 'finished'" class="decrypto-members">{{ s.teams[t].name }}</p
            ><div class="decrypto-keywords"
              ><UiPanel
                v-for="(word, i) in team"
                :key="i"
                as="div"
                tone="subtle"
                density="compact"
                class="decrypto-word-card"
                ><UiBadge counter>{{ i + 1 }} 號</UiBadge><strong>{{ word }}</strong></UiPanel
              ></div
            ></template
          >
          <p v-else class="decrypto-private-note">{{ s.teams[t].name }}的 4 個關鍵詞未公開</p>
        </div>
      </UiPanel>
      <UiPanel v-if="s.phase === 'clues'" class="decrypto-action" title="準備三條線索">
        <template v-if="s.secretCode && !s.clueReady[s.myTeam]">
          <p class="decrypto-instruction">{{ phaseHint }}</p>
          <UiPanel tone="subtle" density="compact" class="decrypto-code-card"
            ><span>只有你看得到的密碼</span
            ><strong class="decrypto-code">{{ s.secretCode.join('－') }}</strong></UiPanel
          >
          <form class="decrypto-form" @submit.prevent="sendClues">
            <UiField
              v-for="(digit, i) in s.secretCode"
              :key="i"
              v-model="clues[i]"
              :label="`線索 ${i + 1} · 對應 ${digit} 號「${s.keywords[s.myTeam][digit - 1]}」`"
              maxlength="40"
              required
              :disabled="!active"
            />
            <p>只用詞義聯想，不可直說、翻譯、諧音或暗號。不能重用線索；送出後不能修改。</p>
            <UiButton
              type="submit"
              variant="primary"
              label="確認三條線索"
              :disabled="!active || clues.some((c) => !c.trim())"
            />
          </form>
        </template>
        <p v-else>{{
          s.clueReady[s.myTeam]
            ? '本隊線索已鎖定，等待另一隊。'
            : '等待 ' + name(s.encryptors[s.myTeam]) + ' 準備線索。'
        }}</p>
        <p
          >白隊 {{ s.clueReady[0] ? '已鎖定' : '準備中' }} · 黑隊
          {{ s.clueReady[1] ? '已鎖定' : '準備中' }}</p
        >
      </UiPanel>
      <UiPanel
        v-if="s.phase === 'guessing'"
        class="decrypto-action"
        :title="s.teams[s.turn].name + '通訊'"
      >
        <p class="decrypto-instruction">{{ phaseHint }}</p>
        <UiList
          ><UiListRow v-for="(clue, i) in s.clues[s.turn]" :key="i"
            >線索 {{ i + 1 }} · {{ clue }}</UiListRow
          ></UiList
        >
        <form v-if="canGuess" class="decrypto-form" @submit.prevent="sendGuess">
          <UiHeading :level="3">{{
            guessing === 'decode' ? '本隊解碼' : '截取對方密碼'
          }}</UiHeading>
          <p>與隊友討論後確認三位密碼，三個數字不能重複。雙方都鎖定前，對手看不到你的答案。</p>
          <div class="decrypto-digits"
            ><UiField
              v-for="(_, i) in digits"
              :key="i"
              v-model="digits[i]"
              control="select"
              :label="'第 ' + (i + 1) + ' 位'"
              :options="digitOptions"
              :disabled="!active"
          /></div>
          <p v-if="duplicateDigits" role="status">三個數字不能重複。</p>
          <UiButton
            type="submit"
            variant="primary"
            :label="guessing === 'decode' ? '鎖定解碼答案' : '鎖定截碼答案'"
            :disabled="!active || !validDigits"
          />
        </form>
        <p v-if="s.myGuess">本隊已送出：{{ s.myGuess.join('－') }}</p>
        <p
          >隊內答案 {{ s.guessReady.decode ? '已鎖定' : '等待中' }} · 對手截碼
          {{ s.round === 1 ? '本輪不進行' : s.guessReady.intercept ? '已鎖定' : '等待中' }}</p
        >
      </UiPanel>
      <UiPanel
        v-if="s.phase === 'reveal' && latest"
        class="decrypto-action"
        :title="s.teams[latest.team].name + '揭曉'"
      >
        <p class="decrypto-code">正確密碼 {{ latest.code.join('－') }}</p
        ><p
          >隊內猜碼 {{ latest.decode.join('－') }} ·
          {{ latest.decoded ? '猜中' : '溝通失誤 +1' }}</p
        >
        <p>{{
          latest.intercept
            ? `對手截碼 ${latest.intercept.join('－')} · ${latest.intercepted ? '截碼成功 +1' : '未截中'}`
            : '第一輪不截碼'
        }}</p>
        <p>雙方都完成本輪才判定勝負。</p
        ><UiButton
          v-if="!observer && room.host"
          variant="primary"
          :label="s.turn === 0 ? '繼續黑隊通訊' : '完成本輪'"
          :disabled="!active"
          @click="game?.act('next')"
        /><p v-else>等待房主繼續。</p>
      </UiPanel>
      <UiPanel v-if="s.phase === 'tiebreak'" class="decrypto-action" title="平手決勝：猜對方關鍵詞">
        <p
          >淨分相同，各隊秘密猜四個詞，不計順序。相同詞只計一次；目前採完整詞比對（忽略空白、標點與大小寫），同義詞請用你認為的完整名稱。仍同分則共同獲勝。</p
        >
        <form
          v-if="s.decoders[s.myTeam] === s.me && !s.tieReady[s.myTeam]"
          class="decrypto-form"
          @submit.prevent="game?.act('keywords', { words: words.slice() })"
        >
          <UiField
            v-for="(_, i) in words"
            :key="i"
            v-model="words[i]"
            :label="'猜測 ' + (i + 1)"
            maxlength="40"
            :disabled="!active"
          />
          <UiButton type="submit" variant="primary" label="鎖定四個詞" :disabled="!active" /> </form
        ><p v-else>{{
          s.tieReady[s.myTeam] ? '本隊已鎖定，等待對方。' : '請與隊友討論，由猜碼代表送出。'
        }}</p>
      </UiPanel>
      <UiPanel
        v-if="s.phase === 'finished'"
        class="decrypto-action"
        :tone="s.interrupted ? 'surface' : 'raised'"
        :title="
          s.interrupted
            ? '本場中止'
            : s.winner?.names.join('、') + (s.winner?.teams.length === 2 ? '共同獲勝' : '獲勝')
        "
      >
        <p>{{
          s.interrupted
            ? '有人離席，保留已揭曉紀錄；返回等待室後可重新開局。'
            : '判定方式：' + s.winner?.reason
        }}</p>
        <p v-if="s.winner?.keywordHits"
          >關鍵詞猜中數：白隊 {{ s.winner.keywordHits[0] }} · 黑隊 {{ s.winner.keywordHits[1] }}</p
        >
        <UiButton
          v-if="room.gameManager"
          variant="primary"
          icon="replay"
          label="返回等待室"
          :pending="room.busy"
          :disabled="!room.connected"
          @click="room.command('rematch', {})"
        />
        <p v-else>等待房主或管理者返回等待室。</p>
      </UiPanel>
      <UiPanel class="decrypto-history" title="公開線索筆記" density="compact"
        ><UiTabs
          v-model="noteTeam"
          :items="
            s.teams.map((t, i) => ({
              id: String(i),
              label: t.name + (i === s.myTeam ? '（本隊）' : '（對手）'),
            }))
          "
          label="選擇隊伍的公開線索"
          :panel-prefix="notesId"
          :id-prefix="notesId + '-tab'"
        /><div
          :id="notesId + '-' + noteTeam"
          role="tabpanel"
          :aria-labelledby="notesId + '-tab-' + noteTeam"
          tabindex="0"
          class="decrypto-notes-body"
          ><p v-if="!s.results.some((r) => r.team === Number(noteTeam))"
            >還沒有公開線索。第一輪揭曉後，系統會依正確編號累積在這裡。</p
          ><UiList v-else
            ><UiListRow v-for="(entries, i) in s.history[Number(noteTeam)]" :key="i"
              ><UiBadge counter>{{ i + 1 }} 號</UiBadge
              ><span>{{ entries.join('、') || '尚無公開線索' }}</span></UiListRow
            ></UiList
          ></div
        ></UiPanel
      >
      <details v-if="s.results.length" class="decrypto-review"
        ><summary>已揭曉通訊紀錄（{{ s.results.length }}）</summary
        ><UiList
          ><UiListRow v-for="r in s.results" :key="r.round + ':' + r.team"
            >第 {{ r.round }} 輪 {{ s.teams[r.team].name }} · {{ r.clues.join('／') }} →
            {{ r.code.join('－') }} · {{ r.decoded ? '隊內猜中' : '溝通失誤' }} ·
            {{ r.intercepted ? '被截碼' : '未被截碼' }}</UiListRow
          ></UiList
        ></details
      >
    </template>
  </div>
</template>
