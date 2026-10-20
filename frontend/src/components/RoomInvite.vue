<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { useRequests } from '../composables/requests';
import { gamePath } from '../contracts/room';
import { record, text } from '../services/validation';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
import { useInvitationsStore } from '../stores/invitations';
import { useSessionStore } from '../stores/session';
import PlayerAvatar from './PlayerAvatar.vue';
import UiTabs from './UiTabs.vue';
defineProps<{ stitch?: boolean }>();
const room = useRoomStore(),
  requests = useRequests(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  origin = ref(location.origin),
  notice = ref('');
const invites = useInvitationsStore(),
  session = useSessionStore(),
  opened = ref(false);
const tab = ref('online'),
  prefix = useId();
const link = computed(() => origin.value + '/' + gamePath(room.type) + '/' + room.code);
void requests
  .request('/api/info')
  .then((value) => {
    const preferred = text(record(value).preferred);
    if (preferred) {
      const url = new URL(preferred);
      if (['https:', 'http:'].includes(url.protocol)) origin.value = url.origin;
    }
  })
  .catch(() => {
    /* Current origin remains a usable invitation. */
  });
async function online(scope: number) {
  if (!session.user)
    try {
      await session.refresh();
    } catch {
      if (opened.value && scope === room.scope)
        notice.value = '線上邀請暫時無法載入，可重新整理或手動複製連結。';
      return;
    }
  if (opened.value && scope === room.scope && session.user) invites.openSender(room.code);
}
function reload() {
  if (!invites.senderOpen || !session.user) void online(room.scope);
  else void invites.loadCandidates();
}
async function open(source: HTMLElement) {
  const scope = room.scope,
    url = link.value;
  opened.value = true;
  notice.value = '';
  await dialog.value?.open(source);
  void online(scope);
  try {
    const copy = navigator.clipboard?.writeText(url);
    if (!copy) throw Error();
    await copy;
    if (opened.value && scope === room.scope) notice.value = '邀請連結已複製。';
  } catch {
    if (opened.value && scope === room.scope) notice.value = '可選取下方連結，手動複製給朋友。';
  }
}
function close() {
  opened.value = false;
  invites.closeSender();
}
watch(
  () => [room.scope, room.terminal],
  () => {
    close();
    dialog.value?.close();
  },
);
onBeforeUnmount(close);
</script>
<template>
  <UiButton
    :stitch="stitch"
    variant="secondary"
    class="vue-room-invite-trigger"
    icon="invite"
    :icon-only="!stitch"
    :caption="stitch ? '邀請朋友' : '邀請'"
    label="邀請朋友加入這桌"
    :disabled="!room.seat"
    @click="open($event.currentTarget as HTMLElement)"
  />
  <UiDialog :stitch="stitch" ref="dialog" title="邀請朋友" compact @closing="close">
    <UiTabs
      v-model="tab"
      :items="[
        { id: 'online', label: '線上朋友' },
        { id: 'link', label: '邀請連結' },
      ]"
      label="邀請方式"
      :id-prefix="prefix + '-tab'"
      :panel-prefix="prefix + '-panel'"
    />
    <StatusSlot :message="notice" />
    <div
      v-show="tab === 'online'"
      :id="prefix + '-panel-online'"
      role="tabpanel"
      :aria-labelledby="prefix + '-tab-online'"
      class="vue-room-invite-panel"
    >
      <StatusSlot
        :message="invites.candidateLoading ? '正在取得線上朋友…' : invites.candidateMessage"
        :error="invites.candidateFailed"
      />
      <div class="vue-invitation-list"
        ><article v-for="person in invites.users" :key="person.id"
          ><PlayerAvatar :name="person.name" :avatar="person.avatar" /><strong>{{
            person.name
          }}</strong
          ><UiButton
            icon="invite"
            :label="person.pending ? '已邀請' : '邀請'"
            :disabled="person.pending || !invites.canInvite"
            :pending="invites.sending.has(person.id)"
            @click="invites.send(person)" /></article
      ></div>
      <UiButton
        icon="refresh"
        label="重新取得線上朋友"
        :disabled="invites.candidateLoading"
        @click="reload"
      />
    </div>
    <div
      v-show="tab === 'link'"
      :id="prefix + '-panel-link'"
      role="tabpanel"
      :aria-labelledby="prefix + '-tab-link'"
      class="vue-room-invite-panel"
      ><label
        >這桌的邀請連結<input
          :value="link"
          readonly
          @focus="($event.target as HTMLInputElement).select()" /></label
      ><p>朋友登入後可直接加入；房間代碼為 {{ room.code }}。</p></div
    >
  </UiDialog>
</template>
