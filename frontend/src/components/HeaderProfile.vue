<script setup lang="ts">
import { sizedImage } from '../services/image-size';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSessionStore } from '../stores/session';
import { useResource } from '../composables/resource';
import { useMutation } from '../composables/mutation';
import { readAppearance, readCharacterOptions, readSettings } from '../contracts/profile';
import { readUser } from '../contracts/auth';
import { record } from '../services/validation';
import { requestJson } from '../services/http';
import UiButton from './UiButton.vue';
import PlayerAvatar from './PlayerAvatar.vue';
import StatusSlot from './StatusSlot.vue';
const props = defineProps<{ open: boolean }>(),
  session = useSessionStore();
const nickname = ref(session.user?.displayName || ''),
  name = useMutation(),
  appearance = useMutation();
const resource = useResource(async (request) => {
  const [settings, options] = await Promise.all([
    request('/api/profile/settings'),
    request('/api/profile/options'),
  ]);
  return { ...readSettings(settings), ...readCharacterOptions(options) };
});
const selected = computed(() =>
  resource.data.value?.characters.find(
    (character) => character.id === resource.data.value?.appearance.characterId,
  ),
);
const avatar = computed(
  () =>
    selected.value?.expressions[resource.data.value?.appearance.expression || 'neutral'] ||
    selected.value?.expressions.neutral,
);
let stale = false;
function updated(event: Event) {
  if ((event as CustomEvent).detail?.source === 'header-profile') return;
  stale = true;
  if (props.open && !appearance.pending.value) {
    stale = false;
    void resource.load();
  }
}
window.addEventListener('profile-updated', updated);
onBeforeUnmount(() => window.removeEventListener('profile-updated', updated));
watch(
  () => session.user?.displayName,
  (value, previous) => {
    if (!nickname.value || nickname.value === previous) nickname.value = value || '';
  },
);
watch(
  () => props.open,
  (value) => {
    if (
      value &&
      !resource.loading.value &&
      (stale || !resource.data.value || resource.error.value)
    ) {
      stale = false;
      void resource.load();
    }
  },
  { immediate: true },
);
async function saveName() {
  const id = session.user?.id;
  await name.run(async (_request, signal) => {
    const value = nickname.value.trim();
    if (!value || [...value].length > 16 || /[\u0000-\u001f\u007f]/.test(value))
      throw Error('暱稱需為 1–16 字，且不能換行。');
    const user = readUser(
      await requestJson('/api/profile/name', {
        method: 'POST',
        body: { displayName: value },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      }),
    );
    if (session.user?.id !== id) return;
    session.user = user;
    nickname.value = user.displayName;
    window.dispatchEvent(
      new CustomEvent('profile-updated', { detail: { source: 'header-profile' } }),
    );
  }, '暱稱已儲存。');
}
async function select(id: string) {
  const data = resource.data.value,
    account = session.user?.id;
  if (!data || !data.characters.some((character) => character.id === id)) return;
  await appearance.run(async (_request, signal) => {
    const result = await requestJson('/api/profile/appearance', {
      method: 'POST',
      body: { version: 5, characterId: id, expression: 'neutral' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    if (session.user?.id !== account || !resource.data.value) return;
    resource.data.value = {
      ...resource.data.value,
      appearance: readAppearance(record(result).appearance),
    };
    window.dispatchEvent(
      new CustomEvent('profile-updated', { detail: { source: 'header-profile' } }),
    );
  }, '遊戲角色已選用；帳號頭像保持原設定。');
}
</script>
<template>
  <section class="vue-header-profile" aria-label="即時帳號與形象設定"
    ><h2>帳號與形象</h2
    ><form @submit.prevent="saveName"
      ><label
        >玩家暱稱<input
          v-model="nickname"
          type="text"
          maxlength="32"
          autocomplete="nickname"
          required
          :disabled="name.pending.value || session.pending" /></label
      ><UiButton
        type="submit"
        icon="save"
        icon-only
        caption="儲存"
        label="儲存玩家暱稱"
        :pending="name.pending.value"
        :disabled="session.pending" /></form
    ><StatusSlot :message="name.message.value" :error="name.failed.value" /><div
      class="vue-header-character-preview"
      ><PlayerAvatar :name="session.user?.displayName || '我的角色'" :avatar="avatar" /><p
        >遊戲角色 · 變更即儲存</p
      ></div
    ><div class="vue-header-characters" role="group" aria-label="選用遊戲角色"
      ><button
        v-for="character in resource.data.value?.characters || []"
        :key="character.id"
        type="button"
        :disabled="appearance.pending.value"
        :aria-label="'選用' + character.name"
        :aria-pressed="character.id === resource.data.value?.appearance.characterId"
        @click="select(character.id)"
        ><img :src="sizedImage(character.expressions.neutral, 128)" alt="" loading="lazy" /><span>{{
          character.name
        }}</span></button
      ></div
    ><StatusSlot
      :message="
        resource.error.value ||
        (resource.loading.value ? '正在載入角色…' : appearance.message.value)
      "
      :error="!!resource.error.value || appearance.failed.value" /><UiButton
      v-if="resource.error.value"
      icon="refresh"
      label="重試載入角色"
      @click="resource.load()"
  /></section>
</template>
