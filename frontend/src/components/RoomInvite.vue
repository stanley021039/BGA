<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoomStore } from '../stores/room';
import { useRequests } from '../composables/requests';
import { gamePath } from '../contracts/room';
import { record, text } from '../services/validation';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import StatusSlot from './StatusSlot.vue';
const room = useRoomStore(), requests = useRequests(), dialog = ref<InstanceType<typeof UiDialog> | null>(null), origin = ref(location.origin), notice = ref('');
const link = computed(() => origin.value + '/' + gamePath(room.type) + '/' + room.code);
void requests.request('/api/info').then(value => { const preferred = text(record(value).preferred); if (preferred) { const url = new URL(preferred); if (['https:', 'http:'].includes(url.protocol)) origin.value = url.origin; } }).catch(() => { /* Current origin remains a usable invitation. */ });
async function open(source: HTMLElement) { notice.value = ''; await dialog.value?.open(source); try { await navigator.clipboard.writeText(link.value); notice.value = '邀請連結已複製。'; } catch { notice.value = '可選取下方連結，手動複製給朋友。'; } }
</script>
<template><UiButton icon="share" icon-only caption="邀請" label="邀請朋友加入這桌" :disabled="!room.seat" @click="open($event.currentTarget as HTMLElement)" /><UiDialog ref="dialog" title="邀請朋友" compact><label>這桌的邀請連結<input :value="link" readonly @focus="($event.target as HTMLInputElement).select()"></label><p>朋友登入後可直接加入；房間代碼為 {{ room.code }}。</p><StatusSlot :message="notice" /></UiDialog></template>
