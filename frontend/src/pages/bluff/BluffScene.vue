<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useBluffStore } from '../../stores/bluff';
import { usePartyActionsStore } from '../../stores/party-actions';
import { bluffRoles } from '../../contracts/bluff';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import BluffReview from './BluffReview.vue';
const room = useRoomStore(),
  bluff = useBluffStore(),
  actions = usePartyActionsStore(),
  state = computed(() => bluff.state!),
  secretOpen = ref(false),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  reviewId = ref('');
const blocked = computed(() => !room.connected || room.busy || actions.pending || !!room.terminal),
  thinker = computed(() => state.value.players.find((p) => p.id === state.value.thinkerId)),
  isThinker = computed(() => state.value.me === state.value.thinkerId),
  result = computed(() => state.value.results.find((r) => r.resultId === reviewId.value) || null);
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
  confirm.value?.cancel();
  document.removeEventListener('visibilitychange', visibility);
});
function rank(index: number) {
  return rankings.value.findIndex((p) => p.score === rankings.value[index].score) + 1;
}
</script>
<template>
  <section class="vue-game-panel vue-bluff-stage" aria-labelledby="bluffHeading"
    ><header
      ><small>LISTEN · EXPLAIN · DECIDE</small
      ><h1 id="bluffHeading">{{
        state.phase === 'waiting'
          ? '誰的解釋最可信？'
          : state.phase === 'selecting'
            ? isThinker
              ? '選一題，開始這輪'
              : '等待想想選題'
            : state.phase === 'preparing'
              ? '查看角色，準備口說'
              : state.phase === 'discussion'
                ? '輪流解釋，想想作決定'
                : state.phase === 'reveal'
                  ? '本輪揭曉'
                  : state.interrupted
                    ? '本場中止'
                    : '本場成績'
      }}</h1
      ><p>{{
        thinker && state.round ? `本輪想想：${thinker.name}` : '3–9 人，以自己的語音或面對面聊天。'
      }}</p></header
    >
    <div class="vue-bluff-clock"
      ><RoomCountdown
        v-if="['preparing', 'discussion'].includes(state.phase)"
        :deadline="state.deadline"
        :duration="state.options.roleSeconds * 1000"
        :offset="bluff.offset"
        :epoch="state.roundId || ''"
        :now="bluff.now"
        :caption="state.phase === 'preparing' && bluff.seconds > 0 ? '看身分剩餘' : '看身分已結束'"
        empty-value="0 秒"
        :urgent="state.phase === 'preparing' && bluff.seconds > 0"
      /><p v-else>{{
        state.phase === 'reveal'
          ? result?.correct
            ? '想想找出老實人，分數已更新。'
            : '想想選中瞎掰人，分數已更新。'
          : '每輪一位老實人，其餘解釋者都是瞎掰人。'
      }}</p></div
    >
    <div
      class="vue-bluff-live"
      :class="{ 'is-role': ['preparing', 'discussion'].includes(state.phase) }"
      ><template v-if="state.phase === 'selecting'"
        ><p v-if="!isThinker">等 {{ thinker?.name || '想想' }} 從三張題卡選出這輪題目。</p
        ><div v-else class="vue-bluff-candidates" data-private
          ><UiButton
            v-for="choice in state.choices"
            :key="choice.id"
            icon="help"
            :label="choice.title + '（' + choice.level + ' 級）'"
            :disabled="blocked"
            @click="actions.command('choose', { questionId: choice.id })" /></div
      ></template>
      <template v-else-if="['preparing', 'discussion'].includes(state.phase)"
        ><div class="vue-bluff-prompt"
          ><h2>{{ state.prompt?.title }}</h2
          ><p
            >難度 {{ state.prompt?.level }} ·
            {{
              state.prompt?.hints.length
                ? '類別提示：' + state.prompt.hints.join('／')
                : '沒有類別提示'
            }}</p
          ></div
        >
        <div class="vue-bluff-private-slot" data-private
          ><template v-if="bluff.secretVisible"
            ><UiButton
              icon="lock"
              :label="secretOpen ? '收起我的秘密角色' : '查看我的秘密角色'"
              :aria-expanded="secretOpen"
              :disabled="blocked"
              @click="secretOpen = !secretOpen"
            /><div v-if="secretOpen" class="vue-bluff-private-card"
              ><h3>{{ state.myRole ? bluffRoles[state.myRole] : '' }}</h3
              ><p v-if="state.myRole === 'thinker'">聽完大家說法後，找出老實人。</p
              ><p v-else-if="state.myRole === 'bluffer'">請臨場編出可信的解釋，網站不提供正解。</p
              ><template v-if="state.myRole === 'honest'"
                ><h3>{{ state.secretAnswer }}</h3
                ><p>{{ state.secretExplanation?.detail }}</p></template
              ></div
            ><p v-else>秘密卡預設收起，請勿讓其他人看螢幕。</p></template
          ><div v-else
            ><p
              >看身分時間已結束，秘密卡已收起。{{
                state.phase === 'preparing' ? '正在同步口說階段…' : ''
              }}</p
            ><section
              v-if="state.phase === 'discussion' && Object.keys(state.botStatements).length"
              class="vue-bluff-bots"
              ><h3>腳本夥伴說詞</h3
              ><p v-for="(statement, id) in state.botStatements" :key="id"
                >{{ state.players.find((p) => p.id === id)?.name || 'AI' }} 說：「{{
                  statement
                }}」</p
              ></section
            ></div
          ></div
        >
        <div v-if="state.phase === 'preparing'" class="vue-bluff-actions"
          ><UiButton
            v-if="!state.readyIds.includes(state.me)"
            icon="check"
            label="我已看完角色，準備好了"
            :disabled="blocked || !bluff.secretVisible"
            @click="actions.command('ready')"
          /><p v-else>你已準備，等待其他人或倒數結束。</p
          ><p>{{ state.readyIds.length }}／{{ state.players.length }} 位已準備</p></div
        >
        <div v-else class="vue-bluff-actions"
          ><UiButton label="哦是哦" :disabled="blocked" @click="actions.command('reaction')"
            ><template #icon
              ><img
                class="vue-bluff-reaction-photo"
                src="/assets/bluff-reaction-photo.png"
                alt="" /></template></UiButton
          ><template v-if="!isThinker"
            ><UiButton
              v-if="!state.spokenIds.includes(state.me)"
              icon="check"
              label="我已口頭說明完畢"
              :disabled="blocked"
              @click="actions.command('spoken')"
            /><p v-else>說明已完成，可繼續接受口頭質問。</p></template
          ><template v-else
            ><p
              >剩餘公三小：{{ 2 - state.challenges.length }} 張 · {{ state.spokenIds.length }}／{{
                state.players.length - 1
              }}
              位已說明</p
            ><p v-if="!state.canGuess">等每位解釋者標記說明完畢後，才能確認選擇。</p
            ><div class="vue-bluff-people"
              ><article
                v-for="player in state.players.filter((p) => p.id !== state.me)"
                :key="player.id"
                ><strong>{{ player.name }}</strong
                ><span>{{
                  state.challenges.includes(player.id)
                    ? '已質疑'
                    : state.spokenIds.includes(player.id)
                      ? '已說明'
                      : '尚未說明'
                }}</span
                ><div
                  ><UiButton
                    icon="help"
                    :label="'質疑 ' + player.name + '：公三小'"
                    caption="公三小"
                    :disabled="
                      blocked ||
                      state.challenges.length >= 2 ||
                      state.challenges.includes(player.id)
                    "
                    @click="choosePerson('challenge', player.id, player.name)" /><UiButton
                    icon="check"
                    :label="'選 ' + player.name + ' 為老實人'"
                    caption="選為老實人"
                    :disabled="blocked || !state.canGuess"
                    @click="
                      choosePerson('guess', player.id, player.name)
                    " /></div></article></div></template
        ></div>
      </template>
      <template v-else-if="state.phase === 'finished'"
        ><p v-if="state.interrupted">有人離席，本場中止。保留已完成回合，未完成回合不計分。</p
        ><template v-else-if="state.winner"
          ><h2>最高分 {{ state.winner.score }} 分</h2
          ><p
            >{{ state.winner.names.join('、')
            }}{{ state.winner.names.length > 1 ? ' 並列' : '' }}獲勝</p
          ></template
        ><ol class="vue-bluff-rankings"
          ><li v-for="(player, index) in rankings" :key="player.id"
            ><strong>{{ rank(index) }}. {{ player.name }}</strong
            ><span>{{ player.score }} 分</span></li
          ></ol
        ></template
      >

      <template v-else-if="state.phase === 'waiting'"
        ><img class="vue-game-waiting-art" src="/assets/playful/game-bluff.svg" alt="" /><p
          >每人輪流當一次想想。先邀請朋友，或加入腳本夥伴確認操作流程。</p
        ></template
      >
      <BluffReview
        v-if="publicReview"
        v-model="reviewId"
        :state="state"
        :disabled="blocked"
        @ban="(id) => actions.command('ban', { resultId: id })" /></div
    ><StatusSlot :message="actions.notice" :error="!!actions.notice && !actions.pending" /><div
      class="vue-bluff-retry"
      ><UiButton
        v-if="actions.canRetry"
        icon="refresh"
        label="重試同一操作"
        :disabled="blocked"
        @click="actions.retrySame()"
      /><UiButton
        v-else-if="state.phase === 'reveal' && room.host"
        icon="next"
        label="下一輪"
        :disabled="blocked"
        @click="actions.command('next')"
      /><span v-else-if="state.phase === 'reveal'">等待房主開始下一輪。</span></div
    >
  </section>
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
  ><ConfirmDialog ref="confirm" />
</template>
