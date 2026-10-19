<script setup lang="ts">
import { ref } from 'vue';
import { useInvitationsStore } from '../stores/invitations';
import { gameTitles } from '../contracts/invitations';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
const invites = useInvitationsStore(), dialog = ref<InstanceType<typeof UiDialog> | null>(null);
function open(source: HTMLElement) { void dialog.value?.open(source); void invites.poll(true); }
</script>
<template><span class="vue-invitation-button"><UiButton icon="invite" icon-only caption="邀請" :label="'房間邀請' + (invites.items.length ? '（' + invites.items.length + '）' : '')" @click="open($event.currentTarget as HTMLElement)" /><span v-if="invites.items.length" class="vue-invitation-count" aria-hidden="true">{{ invites.items.length }}</span></span><UiDialog ref="dialog" title="收到的房間邀請" compact :dismissible="!invites.responding"><StatusSlot :message="invites.responseMessage || invites.error || (invites.loading ? '正在取得邀請…' : '')" :error="invites.responseFailed || !!invites.error" /><div class="vue-invitation-list"><p v-if="!invites.items.length">目前沒有房間邀請。</p><article v-for="item in invites.items" :key="item.id"><h3>{{ item.fromName }} 邀請你一起玩</h3><p>{{ gameTitles[item.type] }} · {{ item.roomName }} · 房號 {{ item.code }}</p><p v-if="!item.canJoin">房間已滿或目前無法加入。</p><div class="vue-invitation-actions"><UiButton icon="check" label="加入房間" :disabled="!item.canJoin || !!invites.responding" @click="invites.respond(item, 'accept')" /><UiButton icon="close" label="婉拒" :disabled="!!invites.responding" @click="invites.respond(item, 'decline')" /></div></article></div><UiButton v-if="invites.error" icon="refresh" label="重新取得邀請" :disabled="invites.loading || !!invites.responding" @click="invites.poll(true)" /></UiDialog></template>
