<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useBluffStore } from '../../stores/bluff';
import { usePartyActionsStore } from '../../stores/party-actions';
import { bluffRoles } from '../../contracts/bluff';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import UiIcon from '../../components/UiIcon.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import BluffReview from './BluffReview.vue';
import BluffSpeech from './BluffSpeech.vue';
import BluffSettings from './BluffSettings.vue';
const room = useRoomStore(),
  bluff = useBluffStore(),
  actions = usePartyActionsStore(),
  state = computed(() => bluff.state!),
  secretOpen = ref(false),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  reviewId = ref(''),
  live = ref<HTMLElement | null>(null),
  revealCard = ref<HTMLButtonElement | null>(null),
  hideButton = ref<InstanceType<typeof UiButton> | null>(null);
let disposed = false,
  scrollRevision = 0;
const blocked = computed(() => !room.connected || room.busy || actions.pending || !!room.terminal),
  thinker = computed(() => state.value.players.find((p) => p.id === state.value.thinkerId)),
  isThinker = computed(() => state.value.me === state.value.thinkerId);
const publicReview = computed(() => ['reveal', 'finished'].includes(state.value.phase)),
  rankings = computed(() =>
    [...state.value.players].sort((a, b) => Number(b.score) - Number(a.score)),
  );
watch([() => room.scope, () => state.value.roundId, () => state.value.phase], () => {
  secretOpen.value = false;
  confirm.value?.cancel();
});
watch(
  () => bluff.secretVisible,
  (visible) => {
    if (!visible) secretOpen.value = false;
  },
);
watch(
  () => state.value.results.map((r) => r.resultId).join('|'),
  (_, previous) => {
    const old = previous?.split('|').at(-1);
    if (
      !reviewId.value ||
      !state.value.results.some((r) => r.resultId === reviewId.value) ||
      reviewId.value === old
    )
      reviewId.value = state.value.results.at(-1)?.resultId || '';
  },
  { immediate: true },
);
watch([reviewId, publicReview], () => actions.setTarget(publicReview.value ? reviewId.value : ''), {
  immediate: true,
});
watch(
  [
    () => room.scope,
    () => state.value.roundId,
    () => state.value.phase,
    () => (publicReview.value ? reviewId.value : ''),
  ],
  async () => {
    const revision = ++scrollRevision;
    await nextTick();
    if (!disposed && revision === scrollRevision && live.value) live.value.scrollTop = 0;
  },
);

async function choosePerson(action: 'challenge' | 'guess', id: string, name: string) {
  if (blocked.value) return;
  const scope = room.scope,
    round = state.value.roundId;
  const allowed = () =>
    scope === room.scope &&
    round === state.value.roundId &&
    state.value.phase === 'discussion' &&
    isThinker.value &&
    !blocked.value &&
    state.value.players.some((p) => p.id === id) &&
    id !== state.value.me &&
    (action === 'guess'
      ? state.value.canGuess
      : state.value.challenges.length < 2 && !state.value.challenges.includes(id));
  if (!allowed()) return;
  const message =
    action === 'challenge'
      ? `對 ${name} 打出公三小？揭曉時，瞎掰人 -1、你 +1；老實人則你 -3。`
      : `確定選 ${name} 為老實人？將立即揭曉與計分。`;
  if (
    (await confirm.value?.ask(message, action === 'challenge' ? '確認質疑' : '確認選擇')) &&
    allowed()
  )
    await actions.command(action, {
      targetId: id,
      ...(action === 'guess' ? { confirmed: true } : {}),
    });
}
// The concealed card is itself the reveal control; move focus between the card
// and its hide button so keyboard users can flip it back and forth in place.
async function revealSecret() {
  if (blocked.value || !bluff.secretVisible) return;
  secretOpen.value = true;
  await nextTick();
  (hideButton.value?.$el as HTMLElement | undefined)?.focus();
}
async function hideSecret() {
  secretOpen.value = false;
  await nextTick();
  revealCard.value?.focus();
}
function visibility() {
  if (document.hidden) {
    secretOpen.value = false;
    confirm.value?.cancel();
  }
}
watch(
  () => room.connected,
  (value) => {
    if (!value) {
      secretOpen.value = false;
      confirm.value?.cancel();
    }
  },
);
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  disposed = true;
  scrollRevision++;
  confirm.value?.cancel();
  document.removeEventListener('visibilitychange', visibility);
});
const heading = computed(() =>
  room.disconnected
    ? '房間連線中斷，正在重試…'
    : {
        waiting: '等待朋友一起開場',
        selecting: isThinker.value ? '選一題，開始這輪' : '等待想想選題',
        preparing: '查看角色，準備口說',
        discussion: isThinker.value ? '輪流解釋，想想作決定' : '輪流解釋與質問',
        reveal: '本輪揭曉',
        finished: state.value.interrupted ? '本場中止' : '本場成績',
      }[state.value.phase],
);
const explainers = computed(() =>
  state.value.players.filter((p) => p.id !== state.value.thinkerId),
);
function rank(index: number) {
  return rankings.value.findIndex((p) => p.score === rankings.value[index].score) + 1;
}
</script>
<template>
  <RoomWaitingTemplate
    v-if="state.phase === 'waiting'"
    type="bluff"
    title="瞎掰王"
    hero-title="誰的解釋最可信？"
    description="3–9 人 · 每人輪流當一次想想"
    art="/assets/playful/game-bluff.svg"
    :facts="[
      { label: '題目難度', value: state.options.levels.join('／') + ' 級' },
      { label: '看身分時間', value: state.options.roleSeconds + ' 秒' },
      { label: '入座人數', value: state.players.length + '／9 人' },
    ]"
    ><template #settings><BluffSettings /></template
  ></RoomWaitingTemplate>

  <section v-else class="vue-bluff-screen" :data-phase="state.phase" aria-labelledby="bluffHeading">
    <header class="vue-bluff-game-info"
      ><div><h1>瞎掰王</h1><p>3–9 人 · 講話轉字幕、外部語音或面對面口說</p></div
      ><span class="vue-bluff-state-badge">{{
        thinker && state.round ? '本輪想想：' + thinker.name : '等待朋友集結'
      }}</span></header
    >
    <section class="vue-bluff-stage"
      ><header class="vue-bluff-stage-heading"
        ><h2 id="bluffHeading">{{ heading }}</h2></header
      >
      <div
        ref="live"
        class="vue-bluff-live"
        :class="{
          'is-selecting': state.phase === 'selecting',
        }"
      >
        <template v-if="state.phase === 'selecting'"
          ><p class="vue-bluff-select-notice">{{
            isThinker
              ? '本輪想想：' + thinker?.name + ' · 私人三選一'
              : '本輪想想：' + (thinker?.name || '想想')
          }}</p
          ><div v-if="isThinker" class="vue-bluff-candidates" data-private
            ><article
              v-for="choice in state.choices"
              :key="choice.id"
              class="vue-bluff-question-card"
              ><span class="vue-bluff-level" :data-level="choice.level"
                >難度 {{ choice.level }} 級</span
              ><h3>{{ choice.title }}</h3
              ><UiButton
                stitch
                variant="primary"
                label="選擇此題"
                :aria-label="'選擇題目：' + choice.title"
                :disabled="blocked"
                :pending="actions.pending"
                @click="actions.command('choose', { questionId: choice.id })" /></article></div
          ><div v-else class="vue-bluff-waiting-choice"
            ><strong>等 {{ thinker?.name || '想想' }} 從三張題卡選出這輪題目。</strong
            ><p>只有本輪想想可以查看與選擇題卡。</p></div
          ></template
        >
        <template v-else-if="['preparing', 'discussion'].includes(state.phase)"
          ><div class="vue-bluff-prompt"
            ><h3>{{ state.prompt?.title }}</h3
            ><p
              >難度 {{ state.prompt?.level }} ·
              {{
                state.prompt?.hints.length
                  ? '類別提示：' + state.prompt.hints.join('／')
                  : '沒有類別提示'
              }}</p
            ></div
          >
          <div v-if="state.phase === 'preparing'" class="vue-bluff-role-grid"
            ><div class="vue-bluff-private-slot" data-private
              ><button
                v-if="!bluff.secretVisible || !secretOpen"
                ref="revealCard"
                type="button"
                class="vue-bluff-private-card is-concealed"
                data-ui-hint
                :aria-label="
                  bluff.secretVisible
                    ? '查看我的秘密角色：點卡片翻開，請勿讓其他人看螢幕'
                    : '看身分已結束，秘密卡已收起'
                "
                aria-expanded="false"
                :disabled="blocked || !bluff.secretVisible"
                @click="revealSecret"
                ><UiIcon name="lock" class="vue-bluff-private-lock" /><strong>{{
                  bluff.secretVisible ? '點卡片查看我的秘密角色' : '看身分已結束'
                }}</strong
                ><span>{{
                  bluff.secretVisible
                    ? '秘密卡預設收起，請勿讓其他人看螢幕。'
                    : '看身分時間已結束，秘密卡已收起。正在同步口說階段…'
                }}</span></button
              ><article
                v-else
                class="vue-bluff-private-card"
                :data-role="state.myRole"
                aria-label="我的秘密角色"
                ><UiButton
                  ref="hideButton"
                  stitch
                  icon-only
                  variant="ghost"
                  icon="lock"
                  class="vue-bluff-private-hide"
                  label="收起我的秘密角色"
                  aria-expanded="true"
                  @click="hideSecret"
                /><span class="vue-bluff-role-badge">我的秘密角色</span
                ><h3>{{ state.myRole ? bluffRoles[state.myRole] : '' }}</h3
                ><p v-if="state.myRole === 'thinker'">聽完大家說法後，找出老實人。</p
                ><p v-else-if="state.myRole === 'bluffer'">請臨場編出可信的解釋，網站不提供正解。</p
                ><template v-else-if="state.myRole === 'honest'"
                  ><strong>{{ state.secretAnswer }}</strong
                  ><p>{{ state.secretExplanation?.detail }}</p
                  ><details
                    v-if="
                      state.secretExplanation?.example || state.secretExplanation?.clarification
                    "
                    class="vue-bluff-private-extra"
                    ><summary>口說參考</summary
                    ><p v-if="state.secretExplanation?.example"
                      >例子：{{ state.secretExplanation.example }}</p
                    ><p v-if="state.secretExplanation?.clarification"
                      >易混淆：{{ state.secretExplanation.clarification }}</p
                    ></details
                  ></template
                ></article
              ></div
            ><div class="vue-bluff-prepare-controls"
              ><div class="vue-bluff-clock"
                ><RoomCountdown
                  :deadline="state.deadline"
                  :duration="state.options.roleSeconds * 1000"
                  :offset="bluff.offset"
                  :epoch="state.roundId || ''"
                  :now="bluff.now"
                  :caption="bluff.seconds > 0 ? '看身分剩餘' : '看身分已結束'"
                  empty-value="0 秒"
                  :urgent="bluff.seconds <= 5" /></div
              ><p>{{ state.readyIds.length }}／{{ state.players.length }} 位已準備</p
              ><UiButton
                stitch
                variant="primary"
                icon="check"
                :label="
                  state.readyIds.includes(state.me)
                    ? '已準備，等待其他人'
                    : '我已看完角色，準備好了'
                "
                :pending="actions.pending"
                :disabled="blocked || !bluff.secretVisible || state.readyIds.includes(state.me)"
                @click="actions.command('ready')" /></div
          ></div>
          <template v-else
            ><p class="vue-bluff-role-ended">看身分時間已結束，秘密卡已收起。</p
            ><div class="vue-bluff-discussion-grid"
              ><div class="vue-bluff-discussion-left"
                ><template v-if="isThinker"
                  ><p class="vue-bluff-progress"
                    >剩餘公三小：{{ 2 - state.challenges.length }} 張 ·
                    {{ state.spokenIds.length }}／{{ explainers.length }} 位已說明</p
                  ><p v-if="!state.canGuess" class="vue-bluff-instruction"
                    >等每位解釋者標記說明完畢後，才能確認選擇。</p
                  ><div class="vue-bluff-people"
                    ><article v-for="player in explainers" :key="player.id"
                      ><div class="vue-bluff-person-copy"
                        ><strong>{{ player.name }}</strong
                        ><span>{{
                          state.challenges.includes(player.id)
                            ? '已質疑'
                            : state.spokenIds.includes(player.id)
                              ? '已說明'
                              : '尚未說明'
                        }}</span></div
                      ><div class="vue-bluff-person-actions"
                        ><UiButton
                          stitch
                          variant="secondary"
                          icon="help"
                          :label="'質疑 ' + player.name + '：公三小'"
                          caption="公三小"
                          :disabled="
                            blocked ||
                            state.challenges.length >= 2 ||
                            state.challenges.includes(player.id)
                          "
                          @click="choosePerson('challenge', player.id, player.name)" /><UiButton
                          stitch
                          variant="primary"
                          icon="check"
                          :label="'選 ' + player.name + ' 為老實人'"
                          caption="選為老實人"
                          :disabled="blocked || !state.canGuess"
                          @click="
                            choosePerson('guess', player.id, player.name)
                          " /></div></article></div></template
                ><div v-else class="vue-bluff-speech-slot"
                  ><strong>{{
                    state.spokenIds.includes(state.me)
                      ? '說明已完成，可繼續接受口頭質問。'
                      : '輪到你說明時，請向同桌口頭解釋。'
                  }}</strong
                  ><UiButton
                    stitch
                    variant="primary"
                    icon="check"
                    :label="state.spokenIds.includes(state.me) ? '已完成說明' : '我已口頭說明完畢'"
                    :pending="actions.pending"
                    :disabled="blocked || state.spokenIds.includes(state.me)"
                    @click="actions.command('spoken')" /></div></div
              ><aside class="vue-bluff-discussion-right"
                ><BluffSpeech :state="state" :blocked="blocked" /><UiButton
                  stitch
                  variant="secondary"
                  label="哦是哦"
                  :disabled="blocked"
                  @click="actions.command('reaction')"
                  ><template #icon
                    ><img
                      class="vue-bluff-reaction-photo"
                      src="/assets/bluff-reaction-photo.webp"
                      alt="" /></template></UiButton
                ><section v-if="Object.keys(state.botStatements).length" class="vue-bluff-bots"
                  ><h3>腳本夥伴說詞</h3
                  ><p v-for="(statement, id) in state.botStatements" :key="id"
                    >{{ state.players.find((p) => p.id === id)?.name || 'AI' }} 說：「{{
                      statement
                    }}」</p
                  ></section
                ></aside
              ></div
            ></template
          ></template
        >
        <template v-else-if="state.phase === 'finished'"
          ><section class="vue-bluff-match-result"
            ><h3 v-if="state.interrupted">有人離席，本場中止。保留已完成回合，未完成回合不計分。</h3
            ><h3 v-else-if="state.winner"
              >最高分 {{ state.winner.score }} 分 · {{ state.winner.names.join('、')
              }}{{ state.winner.names.length > 1 ? ' 並列' : '' }}獲勝</h3
            ><ol class="vue-bluff-rankings"
              ><li v-for="(player, index) in rankings" :key="player.id"
                ><strong>{{ rank(index) }}. {{ player.name }}</strong
                ><span>{{ player.score }} 分</span></li
              ></ol
            ></section
          ></template
        >
        <BluffReview
          v-if="publicReview"
          v-model="reviewId"
          :state="state"
          :disabled="blocked"
          @ban="(id) => actions.command('ban', { resultId: id })"
        /><BluffSettings v-if="state.phase === 'finished'" /> </div
      ><footer class="vue-bluff-bottom"
        ><span>{{
          state.phase === 'reveal'
            ? '本輪分數已更新'
            : state.phase === 'finished'
              ? '已完成回合可繼續查看'
              : '請使用自己的語音或面對面口說'
        }}</span
        ><div v-if="state.phase === 'finished'" id="bluff-start-slot"></div
        ><UiButton
          v-else-if="state.phase === 'reveal' && room.host"
          stitch
          variant="primary"
          icon="next"
          label="下一輪"
          :disabled="blocked"
          :pending="actions.pending"
          @click="actions.command('next')"
        /><span v-else-if="state.phase === 'reveal'">等待房主開始下一輪。</span></footer
      ></section
    >
    <div class="vue-bluff-feedback"
      ><StatusSlot
        :message="actions.notice"
        :error="!!actions.notice && !actions.pending" /><UiButton
        v-if="actions.canRetry"
        stitch
        variant="secondary"
        icon="refresh"
        label="重試同一操作"
        :disabled="blocked"
        @click="actions.retrySame()" /></div
  ></section>
  <Teleport to="body"
    ><div
      v-if="bluff.liveReactions.length"
      class="vue-bluff-reactions"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      data-game-focus-overlay
      ><div v-for="event in bluff.liveReactions" :key="event.id">{{ event.name }} 質疑你</div></div
    ></Teleport
  ><ConfirmDialog ref="confirm" stitch />
</template>
