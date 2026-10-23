<script setup lang="ts">
import { ref } from 'vue';
import { useInvitationsStore } from '../stores/invitations';
import { gameTitles } from '../contracts/invitations';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import '../styles/approved-lobby.scss';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
const invites = useInvitationsStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null);
function open(source: HTMLElement) {
  void dialog.value?.open(source);
  void invites.poll(true);
}
</script>
<template>
  <span class="vue-invitation-button"
    ><UiButton
      variant="ghost"
      icon="invite"
      icon-only
      caption="邀請"
      :label="'房間邀請' + (invites.items.length ? '（' + invites.items.length + '）' : '')"
      @click="open($event.currentTarget as HTMLElement)"
    /><span v-if="invites.items.length" class="vue-invitation-count" aria-hidden="true">{{
      invites.items.length
    }}</span></span
  >
  <UiDialog
    ref="dialog"
    class="vue-approved-inbox"
    title="收到的房間邀請"
    compact
    :dismissible="!invites.responding"
  >
    <p class="vue-inbox-intro">好友邀請進桌通知</p>
    <StatusSlot
      :message="
        invites.responseMessage || invites.error || (invites.loading ? '正在取得邀請…' : '')
      "
      :error="invites.responseFailed || !!invites.error"
    />
    <div class="vue-invitation-list vue-inbox-list" :aria-busy="invites.loading">
      <div v-if="!invites.items.length" class="vue-inbox-empty"
        ><span class="vue-inbox-empty-icon"><UiIcon name="mail" /></span
        ><strong>{{
          invites.loading
            ? '正在取得房間邀請…'
            : invites.error
              ? '房間邀請暫時無法載入。'
              : '目前沒有房間邀請。'
        }}</strong
        ><p>{{
          invites.error
            ? '請重新取得邀請，稍後仍可繼續處理。'
            : '當好友向你發送遊戲入座邀請時，將會即時顯示在此處。'
        }}</p></div
      >
      <article v-for="item in invites.items" :key="item.id"
        ><h3>{{ item.fromName }} 邀請你一起玩</h3
        ><p>{{ gameTitles[item.type] }} · {{ item.roomName }} · 房號 {{ item.code }}</p
        ><p v-if="!item.canJoin">房間已滿或目前無法加入。</p
        ><div class="vue-invitation-actions"
          ><UiButton
            variant="primary"
            icon="check"
            label="加入房間"
            :disabled="!item.canJoin || !!invites.responding"
            @click="invites.respond(item, 'accept')" /><UiButton
            variant="secondary"
            icon="close"
            label="婉拒"
            :disabled="!!invites.responding"
            @click="invites.respond(item, 'decline')" /></div
      ></article>
    </div>
    <footer class="vue-inbox-footer"
      ><UiButton
        v-if="invites.error"
        variant="secondary"
        icon="refresh"
        label="重新取得邀請"
        :disabled="invites.loading || !!invites.responding"
        @click="invites.poll(true)" /><UiButton
        variant="contrast"
        label="關閉邀請"
        caption="關閉"
        :disabled="!!invites.responding"
        @click="dialog?.close()"
    /></footer>
  </UiDialog>
</template>
