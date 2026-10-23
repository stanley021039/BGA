<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiIcon from '../../components/UiIcon.vue';
import UiPopover from '../../components/UiPopover.vue';
import QuestionEditor from './QuestionEditor.vue';
import QuestionPreview from './QuestionPreview.vue';
import PrepareDialog from './PrepareDialog.vue';
import MajorityTeams from './MajorityTeams.vue';
import MajorityResults from './MajorityResults.vue';
import MajoritySetup from './MajoritySetup.vue';
import { majorityKindLabels } from '../../contracts/majority';
import { useMajorityPresentation } from './useMajorityPresentation';
const room = useRoomStore(),
  game = useMajorityStore(),
  s = computed(() => game.state),
  root = ref<HTMLElement | null>(null),
  live = ref<HTMLElement | null>(null),
  composing = ref(false),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null),
  prepare = ref<InstanceType<typeof PrepareDialog> | null>(null),
  reactor = ref<InstanceType<typeof UiPopover> | null>(null);
const presentation = useMajorityPresentation(root),
  blocked = computed(
    () => !room.connected || room.busy || game.pending || game.uncertain || !!room.terminal,
  ),
  spectator = computed(
    () => !!s.value?.players.find((p) => p.id === s.value?.me)?.waitingForNextRound,
  ),
  name = (id: string | null) =>
    s.value?.players.find((p) => p.id === id)?.name ||
    s.value?.departed.find((p) => p.id === id)?.name ||
    '朋友';
const title = computed(() => {
  const state = s.value;
  if (!state) return '讀取中';
  if (state.phase === 'waiting') return state.cruel ? '殘酷2選1' : '朋友到齊，默契就位。';
  if (state.phase === 'finished' && state.cruel?.solo) return '單人偏好回顧';
  if (state.phase === 'finished')
    return (
      state.winner?.reason || (state.winner?.ids.map(name).join('、') || '本局完成') + ' · 同頻勝出'
    );
  if (state.phase === 'choosing')
    return game.canAsk ? '這一題，你來選。' : name(state.presenterId) + ' 正在挑題目';
  return state.question?.prompt || '一起同頻';
});
async function confirmed(action: string, text: string) {
  const context = game.context;
  if (await confirm.value?.ask(text, action === 'replace' ? '使用一次換題' : '結束作答'))
    if (context === game.context) await game.act(action, {}, context);
}
watch(
  () => game.context,
  () => {
    confirm.value?.cancel();
    reactor.value?.close(false);
  },
);
let disposed = false,
  scrollRevision = 0;
watch([() => room.scope, () => s.value?.round, () => s.value?.phase], async () => {
  composing.value = false;
  const revision = ++scrollRevision;
  await nextTick();
  if (!disposed && revision === scrollRevision && live.value) live.value.scrollTop = 0;
});
async function submitAnswer() {
  if (composing.value || blocked.value || game.expired) return;
  await game.answer();
}
onBeforeUnmount(() => {
  disposed = true;
  scrollRevision++;
  confirm.value?.cancel();
});
</script>
<template>
  <RoomWaitingTemplate
    v-if="s && s.phase === 'waiting'"
    type="majority"
    :title="
      s.tournament?.mode === 'music'
        ? '猜歌2選1'
        : s.tournament?.mode === 'scenario'
          ? '情境2選1'
          : s.cruel
            ? '殘酷2選1'
            : '同頻俱樂部'
    "
    hero-title="朋友到齊，默契就位。"
    description="一起選題、回答，看看誰與你最同頻。"
    art="/assets/playful/game-majority.svg"
    :facts="[
      {
        label: s.tournament ? '淘汰賽規模' : '本局題數',
        value: s.tournament
          ? s.tournament.size + ' 強 · ' + s.roundLimit + ' 場'
          : s.roundLimit + ' 題',
      },
      { label: '開局人數', value: s.players.length + ' 人' },
      {
        label: '計分玩法',
        value: s.tournament
          ? '秘密投票 · 多數晉級'
          : s.cruel?.solo
            ? '單人偏好回顧'
            : s.cruel?.rules === 'teams'
              ? '兩人一隊'
              : s.cruel
                ? '殘酷2選1'
                : '同頻回答',
      },
    ]"
    ><template #hero-actions
      ><UiButton
        v-if="!s.cruel && !s.tournament"
        icon="book"
        :label="`預備題目（我 ${s.ownQueue.length}/5）`"
        :disabled="blocked"
        @click="prepare?.open($event.currentTarget as HTMLElement)" /></template
    ><template #summary-extra><MajorityTeams /></template
    ><template #settings><MajoritySetup /></template
  ></RoomWaitingTemplate>

  <section v-else-if="s" ref="root" class="vue-majority-scene" :data-phase="s.phase"
    ><header class="vue-majority-scene-heading"
      ><small
        >{{
          s.cruel
            ? '殘酷2選1'
            : s.question
              ? majorityKindLabels[s.question.type]
              : '不考知識，只考默契'
        }}<template v-if="s.round"> · 第 {{ s.round }} / {{ s.roundLimit }} 題</template></small
      ><h1>{{ title }}</h1></header
    >
    <div class="vue-majority-clock-slot"
      ><RoomCountdown
        :deadline="s.phase === 'answering' ? s.deadline : null"
        :duration="120000"
        :offset="game.offset"
        :now="game.clock"
        :epoch="game.context"
        caption="本題作答時間"
        :empty-value="
          s.phase === 'review'
            ? '等待分組確認'
            : s.phase === 'reveal'
              ? '本題已揭曉'
              : s.phase === 'finished'
                ? '本局結束'
                : '準備中'
        "
        urgent
      /><span>{{ s.answeredIds.length }} / {{ s.participantIds.length }} 人交卷</span></div
    >
    <div ref="live" class="vue-majority-live">
      <template v-if="s.phase === 'choosing'"
        ><p v-if="spectator">你會從下一題開始參與，現在可以先準備題目。</p
        ><template v-else-if="game.canAsk"
          ><div class="vue-majority-tabs"
            ><UiButton
              label="自動抽題"
              :variant="game.source === 'bank' ? 'primary' : 'secondary'"
              :aria-pressed="game.source === 'bank'"
              @click="game.source = 'bank'" /><UiButton
              label="自己出題"
              :variant="game.source === 'custom' ? 'primary' : 'secondary'"
              :aria-pressed="game.source === 'custom'"
              @click="game.source = 'custom'" /></div
          ><template v-if="game.source === 'bank'"
            ><div class="vue-majority-pick-fields"
              ><label
                >題型<select v-model="game.kind" :disabled="blocked || game.topic === 'cruel'"
                  ><option v-for="(label, key) in majorityKindLabels" :key="key" :value="key">{{
                    label
                  }}</option></select
                ></label
              ><label
                >今天聊什麼？<select
                  v-model="game.topic"
                  :disabled="blocked"
                  @change="game.changeTopic()"
                  ><option v-for="topic in s.topics" :key="topic.id" :value="topic.id">{{
                    topic.label
                  }}</option></select
                ></label
              ></div
            ><div class="vue-majority-candidates"
              ><article
                v-for="(question, i) in s.candidates.filter(
                  (q) => q.type === game.kind && q.topic === game.topic,
                )"
                :key="question.id || i"
                ><QuestionPreview :question="question" compact
                  ><UiButton
                    icon="check"
                    variant="primary"
                    label="使用這題"
                    :disabled="blocked"
                    @click="
                      game.act('ask', { questionId: question.id })
                    " /></QuestionPreview></article></div
            ><p v-if="!s.candidates.some((q) => q.type === game.kind && q.topic === game.topic)"
              >按下方「抽三題」取得這個分類的候選題。</p
            ></template
          ><form v-else id="majority-custom-form" @submit.prevent="game.askCustom()"
            ><QuestionEditor
              :draft="game.custom"
              :topics="s.topics"
              :disabled="blocked" /></form></template
        ><p v-else>等待出題人選題；你也會一起回答。</p></template
      >
      <template v-else-if="s.phase === 'answering'"
        ><p v-if="!game.participant">{{
          s.cruel ? '本局已開始，下一局一起參與。' : '本題已開始，下一題一起參與。'
        }}</p
        ><template v-if="s.question"
          ><div
            v-if="s.question.type !== 'blank'"
            class="vue-majority-answer-options"
            :class="{
              'has-three': s.question.type === 'three',
              'has-images': s.question.images.length > 0,
            }"
            ><button
              v-for="(option, i) in s.question.options"
              :key="i"
              type="button"
              :aria-pressed="(s.ownAnswer ?? game.choice) === i"
              :disabled="blocked || !game.participant || s.ownAnswer !== null || game.expired"
              :class="{ 'is-selected': (s.ownAnswer ?? game.choice) === i }"
              @click="game.choice = i"
              ><span>{{ String.fromCharCode(65 + i) }}</span
              ><img
                v-if="s.question.images[i]"
                :src="s.question.images[i]"
                :alt="option"
                width="420"
                height="270"
              /><strong>{{ option }}</strong
              ><span class="vue-majority-choice-mark"
                ><UiIcon
                  v-if="(s.ownAnswer ?? game.choice) === i"
                  :name="s.ownAnswer !== null ? 'lock' : 'check'"
                /><span v-if="(s.ownAnswer ?? game.choice) === i" class="ui-sr-only">{{
                  s.ownAnswer !== null ? '已鎖定' : '已選擇'
                }}</span></span
              ></button
            ></div
          ><form
            v-else-if="s.ownAnswer === null && game.participant"
            id="majority-answer-form"
            @submit.prevent="submitAnswer"
            ><label
              >你覺得最多人會想到什麼？<input
                v-model="game.draft"
                maxlength="60"
                required
                autocomplete="off"
                :disabled="blocked || game.expired"
                @compositionstart="composing = true"
                @compositionend="composing = false"
                @keydown.enter="
                  ($event.isComposing || composing || $event.keyCode === 229) &&
                  $event.preventDefault()
                "
                placeholder="一個簡短、具體的答案" /></label></form
          ><p v-if="s.ownAnswer !== null" class="vue-majority-banner"
            >答案已鎖定：{{
              typeof s.ownAnswer === 'number' ? s.question.options[s.ownAnswer] : s.ownAnswer
            }}。等大家一起揭曉。</p
          ></template
        ><MajorityTeams
      /></template>
      <template v-else-if="s.phase === 'review' || s.phase === 'reveal'"
        ><div class="vue-majority-spotlight"
          ><p v-if="presentation.focus.value"
            ><strong>{{ presentation.focus.value.label }}</strong> ·
            {{ presentation.focus.value.count }} 人選擇</p
          ></div
        ><MajorityResults :focus-id="presentation.focusId.value" /><div
          v-if="s.phase === 'reveal' && !s.cruel"
          class="vue-majority-actions"
          ><UiButton icon="replay" label="重播答案焦點" @click="presentation.replay()" /><UiButton
            v-if="presentation.focus.value"
            label="略過演出"
            @click="presentation.stop()" /></div
        ><div v-if="s.phase === 'review' && room.host" class="vue-majority-merge"
          ><label
            >將這組<select v-model="game.mergeFrom" :disabled="blocked"
              ><option v-for="group in s.groups" :key="group.id" :value="group.id"
                >{{ group.label }}（{{ group.count }} 人）</option
              ></select
            ></label
          ><label
            >合併到<select v-model="game.mergeTo" :disabled="blocked"
              ><option v-for="group in s.groups" :key="group.id" :value="group.id"
                >{{ group.label }}（{{ group.count }} 人）</option
              ></select
            ></label
          ><UiButton
            icon="check"
            label="合併答案"
            :disabled="
              blocked || !game.mergeFrom || !game.mergeTo || game.mergeFrom === game.mergeTo
            "
            @click="game.act('merge', { from: game.mergeFrom, to: game.mergeTo })"
          /><p>{{
            game.mergeFrom && game.mergeFrom === game.mergeTo
              ? '請選擇兩個不同答案組。'
              : s.normalization
          }}</p></div
        ></template
      >
      <template v-else-if="s.phase === 'finished'"
        ><MajorityTeams /><div v-if="!s.cruel?.solo" class="vue-majority-standings"
          ><p
            v-for="player in [...s.players]
              .filter((p) => !p.waitingForNextRound)
              .sort((a, b) => b.score - a.score)"
            :key="player.id"
            ><strong>{{ player.name }}</strong
            ><span>{{ player.score }} 分</span></p
          ></div
        ><MajorityResults :recap="!!s.cruel" /></template
    ></div>
    <div class="vue-majority-feedback"
      ><StatusSlot
        :message="
          game.message ||
          (game.expired && s.phase === 'answering' ? '時間已到，等待伺服器結算。' : '')
        "
        :error="game.failed"
      /><UiButton
        v-if="game.uncertain"
        icon="refresh"
        label="更新狀態後再操作"
        :disabled="room.busy"
        @click="game.refresh()"
      /><p v-if="presentation.achievementNotice.value" role="status"
        >{{ presentation.achievementNotice.value }} <a href="/achievements">查看收藏冊</a></p
      ></div
    >
    <footer class="vue-majority-footer"
      ><div class="vue-majority-primary-actions"
        ><div v-if="s.phase === 'finished'" id="majority-next-settings"></div
        ><div v-if="s.phase === 'finished'" id="majority-replay-slot"></div
        ><template v-if="s.phase === 'choosing'"
          ><UiButton
            v-if="game.canAsk && game.source === 'bank'"
            icon="shuffle"
            variant="primary"
            :label="s.candidates.length ? '再抽三題' : '抽三題'"
            :disabled="blocked"
            @click="game.act('draw', { topic: game.topic, type: game.kind })" /><UiButton
            v-else-if="game.canAsk"
            type="submit"
            form="majority-custom-form"
            icon="send"
            variant="primary"
            label="送出題目"
            :disabled="blocked" /><UiButton
            v-else-if="room.host"
            icon="next"
            label="換下一位出題"
            :disabled="blocked"
            @click="game.act('pass')" /></template
        ><template v-if="s.phase === 'answering' && game.participant"
          ><UiButton
            v-if="s.ownAnswer === null"
            icon="lock"
            variant="primary"
            label="鎖定答案"
            :disabled="
              blocked ||
              game.expired ||
              composing ||
              (s.question?.type === 'blank' ? !game.draft.trim() : game.choice === null)
            "
            @click="submitAnswer" /><UiButton
            v-else
            icon="undo"
            label="收回答案"
            :disabled="blocked || game.expired"
            @click="game.act('withdraw')" /><UiButton
            v-if="s.cruel"
            icon="refresh"
            :label="s.cruel.skipRemaining ? '換一題（剩 1 次）' : '換題已用完'"
            :disabled="blocked || game.expired || !s.cruel.canReplace"
            @click="confirmed('replace', '使用本局唯一一次換題？目前尚未有人交卷。')" /><UiButton
            v-if="room.host && !s.cruel"
            label="提前結束作答"
            :disabled="blocked"
            @click="confirmed('close', '提前結束本題？未交卷的朋友本題不計分。')" /></template
        ><template v-if="s.phase === 'review' && room.host"
          ><UiButton
            icon="undo"
            label="還原原始分組"
            :disabled="blocked"
            @click="game.act('resetGroups')" /><UiButton
            icon="check"
            variant="primary"
            label="確認計分"
            :disabled="blocked"
            @click="game.act('score')" /></template
        ><UiButton
          v-if="s.phase === 'reveal' && (room.host || s.presenterId === s.me)"
          icon="next"
          variant="primary"
          :label="s.round >= s.roundLimit ? '查看本局結果' : '開始下一題'"
          :disabled="blocked"
          @click="game.act('next')" /></div
      ><div v-if="!s.cruel && s.phase !== 'finished'" class="vue-majority-social"
        ><UiButton
          icon="book"
          :label="`預備題目（我 ${s.ownQueue.length}/5）`"
          :disabled="blocked"
          @click="prepare?.open($event.currentTarget as HTMLElement)" /><UiButton
          variant="secondary"
          icon="emoji"
          :label="'表情互動 · 全桌預備 ' + s.queueCount + ' 題'"
          :aria-expanded="!!reactor?.visible"
          aria-controls="majority-game-reactions"
          aria-haspopup="dialog"
          :disabled="blocked"
          @click="reactor?.open($event.currentTarget as HTMLElement)" /></div
    ></footer>
    <div class="vue-majority-reactions" aria-hidden="true"
      ><p v-for="reaction in game.reactions" :key="reaction.id"
        >{{ reaction.emoji }} <small>{{ name(reaction.player) }}</small></p
      ></div
    >
    <UiPopover id="majority-game-reactions" ref="reactor" title="同頻表情互動"
      ><div class="vue-majority-reaction-buttons"
        ><button
          v-for="emoji in ['👍', '❤️', '😂', '😮', '😭', '🔥', '👏', '🤔']"
          :key="emoji"
          type="button"
          :aria-label="'送出 ' + emoji"
          :disabled="blocked"
          @click="game.act('react', { emoji })"
          >{{ emoji }}</button
        ></div
      ></UiPopover
    ><ConfirmDialog ref="confirm" />
  </section>
  <PrepareDialog ref="prepare" />
</template>
