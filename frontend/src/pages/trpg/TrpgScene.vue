<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, ref, watch } from 'vue';
import { useTrpgStore } from '../../stores/trpg';
import { useRoomStore } from '../../stores/room';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import TrpgResult from './TrpgResult.vue';
const trpg = useTrpgStore(),
  room = useRoomStore(),
  state = computed(() => trpg.state!),
  composing = ref(false),
  latest = computed(() => state.value.results.at(-1));
const readiness = computed(() =>
  state.value.phase === 'planning'
    ? `已準備 ${state.value.readyCount}／${state.value.players.length} · ` +
      (state.value.players
        .filter((p) => !p.ready)
        .map((p) => p.name)
        .join('、') || '全員就緒') +
      (state.value.readyCount < state.value.players.length ? ' 尚未準備' : '')
    : '每幕輪流領隊，所有人都能參與行動。',
);
const skill = computed(() =>
  trpg.draft.stance === 'assist' &&
  trpg.currentApproach?.skill === state.value.roles[trpg.me?.role || '']?.skill
    ? 2
    : 0,
);
watch([() => state.value.sceneId, () => state.value.phase], () => {
  composing.value = false;
});
function input(event: Event) {
  if (composing.value) return;
  const target = event.target as HTMLInputElement;
  trpg.changeNote(target.value);
  target.value = trpg.draft.note;
}
</script>
<template>
  <RoomWaitingTemplate
    v-if="state.phase === 'waiting'"
    type="trpg"
    title="霧港跑團"
    hero-title="冒險就此出發"
    description="1–6 人合作冒險 · 六幕原創故事"
    art="/assets/playful/game-trpg.svg"
    :facts="[
      { label: '冒險', value: state.adventure },
      { label: '篇幅', value: '六幕短篇' },
      { label: '角色', value: trpg.me?.roleName || '尚未選擇' },
    ]"
  />

  <section v-else class="vue-game-panel vue-trpg-stage" aria-labelledby="trpgHeading"
    ><header
      ><h1 id="trpgHeading">{{ state.winner?.title || state.adventure }}</h1
      ><p>規則主持 · 不連 AI、不消耗 token</p></header
    ><div class="vue-trpg-resources" aria-label="隊伍資源"
      ><span
        >線索 <strong>{{ state.clues }}／5</strong></span
      ><span
        >危機 <strong>{{ state.danger }}</strong
        ><small>目標 ≤7</small></span
      ><span
        >補給 <strong>{{ state.supplies }}</strong></span
      ></div
    >
    <div class="vue-trpg-body"
      ><section class="vue-trpg-story" aria-label="目前故事與結果"
        ><ol class="vue-trpg-route" aria-label="冒險路線"
          ><li
            v-for="(zone, index) in ['渡口與市場', '鐘匠與潮階', '燈塔鐘室']"
            :key="zone"
            :aria-current="state.scene?.zone === index ? 'step' : undefined"
            >{{ zone }}</li
          ></ol
        ><h2>{{ state.scene?.title || '先選角色，再邀朋友出發' }}</h2
        ><p>{{
          state.winner?.text ||
          state.scene?.text ||
          '每個角色都能選任何解法。可獨自試玩，也能邀朋友或加入腳本夥伴，一起把失落的鐘聲帶回霧港。'
        }}</p>
        <section v-if="state.phase === 'planning'" class="vue-trpg-approach-help"
          ><h3>{{ trpg.isLeader ? '你的解法' : '領隊決定解法' }}</h3
          ><template v-if="trpg.isLeader && trpg.currentApproach"
            ><p>{{ trpg.currentApproach.description }}</p
            ><dl
              ><div
                ><dt>難度</dt><dd>{{ trpg.currentApproach.difficulty }}</dd></div
              ><div
                ><dt>補給成本</dt><dd>{{ trpg.currentApproach.cost }}</dd></div
              ><div
                ><dt>你的專長</dt><dd>＋{{ skill }}</dd></div
              ><div
                ><dt>成功線索</dt><dd>＋{{ trpg.currentApproach.reward }}</dd></div
              ><div
                ><dt>受挫危機</dt><dd>＋{{ trpg.currentApproach.risk }}</dd></div
              ></dl
            ><p>差 1–2：線索 ＋1、危機 ＋1；受挫仍前進，並失去最多 1 補給。</p></template
          ><p v-else
            >領隊：{{ trpg.leader?.name }}。協助最多兩人各花 1 專注提供 ＋1；整備恢復 1 專注，上限
            3。</p
          ></section
        >
        <TrpgResult v-if="latest" :result="latest" /><details class="vue-trpg-journal"
          ><summary>旅途手記 · 已完成 {{ state.results.length }}／6 幕</summary
          ><p v-if="!state.results.length">檢定揭曉後，結果與每個人的行動會保留於這裡。</p
          ><TrpgResult v-for="result in state.results" :key="result.sceneId" :result="result"
        /></details>
      </section>
      <section class="vue-trpg-controls" aria-label="你的選擇"
        ><h2>{{
          state.phase === 'planning'
            ? trpg.isLeader
              ? '你是本幕領隊'
              : '你的角色行動'
            : state.phase === 'reveal'
              ? '檢定已揭曉'
              : state.phase === 'finished'
                ? '一起完成旅途'
                : '準備出發'
        }}</h2
        ><template v-if="state.phase === 'planning'"
          ><label v-if="trpg.isLeader" for="trpgApproach"
            >選擇解法<select
              id="trpgApproach"
              v-model="trpg.draft.approach"
              :disabled="!trpg.editable"
              ><option
                v-for="approach in state.approaches"
                :key="approach.id"
                :value="approach.id"
                :disabled="approach.cost > state.supplies"
                >{{ approach.name }} · 難度 {{ approach.difficulty }} · 補給
                {{ approach.cost }}</option
              ></select
            ></label
          ><label for="trpgStance"
            >{{ trpg.isLeader ? '你的準備' : '隊友行動'
            }}<select id="trpgStance" v-model="trpg.draft.stance" :disabled="!trpg.editable"
              ><option value="assist" :disabled="!trpg.isLeader && !trpg.me?.focus">{{
                trpg.isLeader ? '全心帶隊（不扣專注）' : '協助領隊（最多兩人各花 1 專注 ＋1）'
              }}</option
              ><option value="recover">{{
                trpg.isLeader ? '整備（專注 ＋1，本幕不使用專長）' : '整備（專注 ＋1，上限 3）'
              }}</option></select
            ></label
          ><label for="trpgNote"
            >一句角色行動（選填）<input
              id="trpgNote"
              :value="trpg.draft.note"
              :disabled="!trpg.editable"
              autocomplete="off"
              placeholder="我把繩索交給隊友，先確認下一段路。"
              aria-describedby="trpgNoteCount"
              @input="input"
              @compositionstart="composing = true"
              @compositionend="
                composing = false;
                input($event);
              " /></label
          ><p id="trpgNoteCount">{{ [...trpg.draft.note].length }}／160 字 · 不能換行</p
          ><p>{{
            trpg.dirty ? '尚有行動待送出；更新後才能檢定。' : '你的行動已送出；仍可在檢定前修改。'
          }}</p></template
        >
        <template v-else-if="state.phase === 'reveal'"
          ><p>{{
            trpg.isLeader
              ? '你是本幕領隊，可以帶大家前往下一幕。'
              : '等待 ' + (trpg.leader?.name || '領隊') + ' 帶大家前往下一幕。'
          }}</p
          ><p>每個骰值與角色行動都已保留於旅途手記。</p></template
        ><template v-else-if="state.phase === 'finished'"
          ><h3>{{ state.winner?.restored ? '鐘聲回到霧港' : '帶著約定回港' }}</h3
          ><p
            >線索 {{ state.clues }}／5，危機 {{ state.danger }}（目標不超過
            7）。沒有玩家因受挫被淘汰。</p
          ><p>可在房間設定重新選角色，再由房主開始下一場。</p></template
        ><template v-else
          ><p>先在房間設定選擇你的角色，再由房主開始冒險。</p
          ><p>1–6 人皆可玩；腳本夥伴用來試玩流程。</p></template
        >
      </section></div
    >
    <div class="vue-trpg-status"
      ><p>{{ readiness }}</p
      ><StatusSlot
        :persistent="trpg.pending || trpg.canRetry || trpg.dirty"
        :message="trpg.notice"
        :error="trpg.failed" /></div
    ><footer class="vue-trpg-actions"
      ><UiButton
        v-if="state.phase === 'planning'"
        icon="check"
        :label="state.myPlan ? '更新我的行動' : '準備好了'"
        :pending="trpg.pending"
        :disabled="!trpg.editable || composing || !trpg.dirty"
        @click="trpg.plan()"
      /><UiButton
        v-if="state.phase === 'planning' && trpg.isLeader"
        icon="play"
        label="擲骰檢定"
        :disabled="!trpg.editable || composing || trpg.dirty || !state.canResolve"
        @click="trpg.resolve()"
      /><UiButton
        v-if="state.phase === 'reveal' && trpg.isLeader"
        icon="next"
        label="前往下一幕"
        :pending="trpg.pending"
        :disabled="!room.connected || room.busy"
        @click="trpg.next()"
      /><UiButton
        v-if="trpg.canRetry"
        icon="refresh"
        label="重試同一操作"
        :disabled="room.busy"
        @click="trpg.retrySame()"
      /><span v-if="state.phase === 'planning' && trpg.isLeader && !state.canResolve"
        >等所有隊友準備好，才能擲骰。</span
      ></footer
    >
  </section>
</template>
