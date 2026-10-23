<script setup lang="ts">
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useGiftStore } from '../../stores/gift';
import { useRoomStore } from '../../stores/room';
import { giftRankKeys, giftRankLabels } from '../../contracts/gift';
import { useGiftPresentation } from './useGiftPresentation';
import { usePreferencesStore } from '../../stores/preferences';
import GiftArt from './GiftArt.vue';
import UiButton from '../../components/UiButton.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import PlayerAvatar from '../../components/PlayerAvatar.vue';
const stage = ref<HTMLElement | null>(null),
  { focus, replay, stop, achievementNotice } = useGiftPresentation(stage),
  preferences = usePreferencesStore();
const gift = useGiftStore(),
  room = useRoomStore(),
  state = computed(() => gift.state!),
  confirm = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const title = computed(
    () =>
      ({
        waiting: '你知道朋友最想收到什麼嗎？',
        choosing: '選禮物，也說出自己的心願',
        delivering: '大家一起送禮',
        reveal: '大家都收到禮物了！',
        finished: state.value.winner?.ids.length ? '今晚的送禮達人' : '本局結束',
      })[state.value.phase],
  ),
  current = computed(() =>
    state.value.players.find((p) => p.id === state.value.delivery?.recipientId),
  ),
  received = computed(
    () => state.value.result?.entries.filter((e) => e.recipientId === gift.resultRecipient) || [],
  );
const card = (id: string) => state.value.gifts.find((g) => g.id === id),
  name = (id: string) => state.value.players.find((p) => p.id === id)?.name || '已離席的玩家';
watch(
  [
    () => room.scope,
    () => state.value.round,
    () => state.value.phase,
    () => state.value.delivery?.recipientId,
    () => !!state.value.ownAssignments,
    () => !!state.value.ownRanking,
  ],
  () => confirm.value?.cancel(),
);
async function lock(kind: 'give' | 'wish') {
  const scope = room.scope,
    round = state.value.round,
    body = JSON.stringify(kind === 'give' ? gift.assignments : gift.likes);
  if (
    await confirm.value?.ask(
      kind === 'give'
        ? '鎖定送給每位朋友的禮物？送出後不能修改。'
        : '鎖定四個心願順位？送出後不能修改。',
      '鎖定' + (kind === 'give' ? '送禮' : '心願'),
    )
  )
    if (
      scope === room.scope &&
      round === state.value.round &&
      body === JSON.stringify(kind === 'give' ? gift.assignments : gift.likes)
    )
      await gift.action(kind);
}
function visibility() {
  if (document.hidden) confirm.value?.cancel();
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility));
</script>
<template>
  <RoomWaitingTemplate
    v-if="state.phase === 'waiting'"
    type="gift"
    title="送禮達人"
    hero-title="朋友集結中，禮物已備，等你送出。"
    description="3–8 人 · 猜朋友心意，讓送禮與收禮雙分數達標。"
    art="/assets/playful/game-gift.svg"
    :facts="[
      { label: '雙分數共同目標', value: state.target + ' 分' },
      {
        label: '玩家投稿禮物比例',
        value: state.customPercent === null ? '依題庫比例' : state.customPercent + '%',
      },
      { label: '開局人數', value: state.players.length + '／8 人；至少 3 人' },
    ]"
  />

  <section v-else ref="stage" class="vue-game-panel vue-gift-stage"
    ><header
      ><small>GIVE A LITTLE · KNOW EACH OTHER</small><h1>{{ title }}</h1
      ><p
        >送禮與收禮分數都達
        {{ state.target }}
        分以上才能獲勝，多人同時達標時兩項加總最高者勝；每件禮物逐件結算，分數最低
        0、可超過目標。</p
      ></header
    >
    <div class="vue-gift-live">
      <template v-if="state.phase === 'choosing'">
        <section class="vue-gift-summaries" aria-label="自己的秘密送禮與心願摘要" data-private
          ><div
            ><h2>送禮{{ state.ownAssignments ? ' · 已鎖定' : ' · 尚未鎖定' }}</h2
            ><ul
              ><li v-for="person in gift.recipients" :key="person.id"
                ><strong>{{ person.name }}</strong
                ><span>{{ card(gift.chosen[person.id] || '')?.title || '尚未選擇' }}</span></li
              ></ul
            ></div
          ><div
            ><h2>心願{{ state.ownRanking ? ' · 已鎖定' : ' · 尚未鎖定' }}</h2
            ><ol
              ><li v-for="(key, index) in giftRankKeys" :key="key"
                ><strong>{{ giftRankLabels[key] }}</strong
                ><span>{{ card(gift.ranking[index] || '')?.title || '尚未選擇' }}</span></li
              ></ol
            ></div
          ></section
        >
        <nav class="vue-gift-tabs" aria-label="本輪任務"
          ><UiButton legacy
            label="送禮給朋友"
            :aria-pressed="gift.panel === 'give'"
            @click="gift.panel = 'give'" /><UiButton legacy
            label="我的心願"
            :aria-pressed="gift.panel === 'wish'"
            @click="gift.panel = 'wish'"
        /></nav>
        <section class="vue-gift-choice-area"
          ><template v-if="gift.panel === 'give'"
            ><h2>送給 {{ name(gift.recipient) }} 的禮物</h2
            ><div class="vue-gift-tabs" role="group" aria-label="選擇收禮朋友"
              ><button
                v-for="person in gift.recipients"
                :key="person.id"
                type="button"
                :aria-pressed="gift.recipient === person.id"
                @click="gift.recipient = person.id"
                >{{ person.name }}{{ gift.chosen[person.id] ? ' ✓' : '' }}</button
              ></div
            ><p>{{
              state.ownAssignments
                ? '送禮已鎖定，可切換朋友查看。'
                : '每位朋友選一件不同禮物；選用別人的禮物會移交給目前朋友，再點一次可取消。'
            }}</p
            ><div class="vue-gift-card-grid"
              ><button
                v-for="value in state.gifts"
                :key="value.id"
                type="button"
                :disabled="!gift.canEdit || !!state.ownAssignments"
                :aria-pressed="gift.chosen[gift.recipient] === value.id"
                :aria-label="'送給' + name(gift.recipient) + '：' + value.title"
                @click="gift.chooseGift(value.id)"
                ><GiftArt :gift="value" /><strong>{{ value.title }}</strong
                ><small>{{
                  gift.chosen[gift.recipient] === value.id
                    ? '✓ 已選給這位朋友'
                    : gift.recipients.find((p) => gift.chosen[p.id] === value.id)
                      ? '已選給 ' +
                        name(gift.recipients.find((p) => gift.chosen[p.id] === value.id)!.id)
                      : value.category
                }}</small></button
              ></div
            ></template
          >
          <template v-else
            ><h2>依順序選四個心願</h2
            ><p
              >{{
                state.ownRanking
                  ? '心願已鎖定。'
                  : gift.likes.length < 4
                    ? '下一順位：' + giftRankLabels[giftRankKeys[gift.likes.length]!]
                    : '四件已選好；再點已選禮物可取消並重新排序。'
              }}
              沒標記的禮物 −1 分。</p
            ><div class="vue-gift-card-grid"
              ><button
                v-for="value in state.gifts"
                :key="value.id"
                type="button"
                :disabled="!gift.canEdit || !!state.ownRanking"
                :aria-pressed="gift.ranking.includes(value.id)"
                :aria-label="
                  value.title +
                  (gift.ranking.includes(value.id)
                    ? '，' + giftRankLabels[giftRankKeys[gift.ranking.indexOf(value.id)]!]
                    : '，選為下一順位')
                "
                @click="gift.chooseWish(value.id)"
                ><GiftArt :gift="value" /><strong>{{ value.title }}</strong
                ><small>{{
                  gift.ranking.includes(value.id)
                    ? '✓ ' + giftRankLabels[giftRankKeys[gift.ranking.indexOf(value.id)]!]
                    : value.category
                }}</small></button
              ></div
            ></template
          >
        </section>
      </template>
      <section v-else-if="state.phase === 'delivering' && state.delivery" class="vue-gift-delivery"
        ><div class="vue-gift-current"
          ><PlayerAvatar
            v-if="current"
            :name="current.name"
            :avatar="current.avatar"
            :bot="current.bot"
          /><h2
            >{{ current?.name }} 正在收禮 · {{ state.delivery.index + 1 }}／{{
              state.delivery.total
            }}</h2
          ></div
        ><p
          >所有人確認收禮後才結算分數。{{
            current?.id === state.me
              ? '請看過收到的禮物，再按下方確認。'
              : '等待 ' + current?.name + ' 確認收禮。'
          }}</p
        ><div class="vue-gift-delivery-grid"
          ><article
            v-for="(entry, index) in state.delivery.entries"
            :key="entry.giverId + ':' + index"
            ><strong>{{ name(entry.giverId) }} 送來</strong
            ><GiftArt v-if="card(entry.giftId)" :gift="card(entry.giftId)!" /><h3>{{
              card(entry.giftId)?.title || '禮物'
            }}</h3
            ><p>{{ giftRankLabels[entry.rank] }}</p></article
          ></div
        ></section
      >
      <section v-else class="vue-gift-review"
        ><h2 v-if="state.winner">{{
          state.winner.ids.length ? state.winner.ids.map(name).join('、') : state.winner.reason
        }}</h2
        ><section v-if="state.result" class="vue-gift-spotlight" aria-label="焦點禮物演出"
          ><template v-if="focus"
            ><GiftArt v-if="card(focus.giftId)" :gift="card(focus.giftId)!" /><p
              >{{ name(focus.giverId) }} 送給 {{ name(focus.recipientId) }}「{{
                card(focus.giftId)?.title
              }}」 · {{ giftRankLabels[focus.rank] }}</p
            ><UiButton legacy icon="close" label="跳過演出" @click="stop" /></template
          ><template v-else
            ><p>本輪 {{ state.result.entries.length }} 件禮物已揭曉，完整明細都在下方。</p
            ><UiButton legacy
              icon="replay"
              label="重播焦點禮物"
              :disabled="!preferences.motion?.enabled || preferences.motion?.reduced"
              @click="replay" /></template></section
        ><p v-if="achievementNotice" role="status"
          >{{ achievementNotice }} <a href="/achievements">查看收藏冊</a></p
        ><div class="vue-gift-score-grid" aria-label="全員送禮與收禮總分"
          ><article v-for="person in state.players" :key="person.id"
            ><strong>{{ person.name }}{{ person.id === state.me ? ' · 你' : '' }}</strong
            ><span>送禮 {{ person.giveScore }}／{{ state.target }}</span
            ><meter
              min="0"
              :max="state.target"
              :value="person.giveScore"
              :aria-label="person.name + '送禮分數'" /><span
              >收禮 {{ person.getScore }}／{{ state.target }}</span
            ><meter
              min="0"
              :max="state.target"
              :value="person.getScore"
              :aria-label="person.name + '收禮分數'" /></article></div
        ><template v-if="state.result"
          ><h2>第 {{ state.result.round }} 輪完整收禮明細</h2
          ><div class="vue-gift-tabs" role="group" aria-label="選擇查看的收禮者"
            ><button
              v-for="person in state.players"
              :key="person.id"
              type="button"
              :aria-pressed="gift.resultRecipient === person.id"
              @click="gift.resultRecipient = person.id"
              >{{ person.name }}</button
            ></div
          ><article
            v-for="(entry, index) in received"
            :key="entry.giverId + ':' + index"
            class="vue-gift-result-entry"
            ><GiftArt v-if="card(entry.giftId)" :gift="card(entry.giftId)!" /><div
              ><strong
                >{{ name(entry.giverId) }} 送了「{{ card(entry.giftId)?.title || '禮物' }}」</strong
              ><p>{{ giftRankLabels[entry.rank] }}</p
              ><small
                >送禮者結算後 {{ entry.giveAfter }} 分 · 收禮者結算後 {{ entry.getAfter }} 分</small
              ></div
            ><b :class="{ 'is-negative': entry.points < 0 }"
              >{{ entry.points > 0 ? '+' : '' }}{{ entry.points }}</b
            ></article
          ><details
            ><summary>查看這位朋友的四個心願</summary
            ><ul
              ><li v-for="key in giftRankKeys" :key="key"
                >{{ giftRankLabels[key] }}：{{
                  card(state.result.rankings[gift.resultRecipient]?.[key] || '')?.title ||
                  '沒有紀錄'
                }}</li
              ></ul
            ></details
          ></template
        ><p v-else>本場提前結束，尚無已完成回合的結果。</p></section
      >
    </div>
    <div class="vue-gift-feedback"
      ><p v-if="state.phase === 'choosing'"
        >全桌送禮 {{ state.gaveIds.length }}／{{ state.players.length }} · 心願
        {{ state.wishedIds.length }}／{{ state.players.length }}</p
      ><p v-else>{{
        state.phase === 'delivering'
          ? '看完禮物後，由目前收禮者確認。'
          : '每份心意都會計入送禮與收禮兩條分數。'
      }}</p
      ><StatusSlot :message="gift.notice" :error="gift.uncertain"
    /></div>
    <footer class="vue-gift-actions"
      ><template v-if="state.phase === 'choosing'"
        ><UiButton legacy
          icon="lock"
          :label="state.ownAssignments ? '送禮已鎖定' : '鎖定送禮'"
          :disabled="!gift.canGive"
          :pending="room.busy"
          @click="lock('give')" /><UiButton legacy
          icon="lock"
          :label="state.ownRanking ? '心願已鎖定' : '鎖定心願'"
          :disabled="!gift.canWish"
          :pending="room.busy"
          @click="lock('wish')" /></template
      ><UiButton legacy
        v-else-if="state.phase === 'delivering'"
        icon="check"
        :label="current?.id === state.me ? '確認收禮' : '等待 ' + current?.name + ' 確認'"
        :disabled="current?.id !== state.me || room.busy || !room.connected || gift.uncertain"
        :pending="room.busy"
        @click="gift.action('accept')" /><UiButton legacy
        v-else-if="state.phase === 'reveal'"
        icon="next"
        label="開始下一輪"
        :disabled="!room.host || room.busy || !room.connected || gift.uncertain"
        :pending="room.busy"
        @click="gift.action('next')" /><span v-else>{{
        state.phase === 'finished' ? '由房主按房間設定中的再玩一局。' : '邀請朋友入座，由房主開始。'
      }}</span
      ><UiButton legacy
        v-if="gift.uncertain"
        icon="refresh"
        label="更新並確認操作結果"
        :pending="gift.refreshing"
        :disabled="room.busy"
        @click="gift.refresh()"
    /></footer> </section
  ><ConfirmDialog legacy ref="confirm" />
</template>
