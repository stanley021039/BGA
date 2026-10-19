<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useProfileStore } from '../../stores/profile';
import { useSessionStore } from '../../stores/session';
import { usePreferencesStore } from '../../stores/preferences';
import { useMutation } from '../../composables/mutation';
import { readSettings, avatarKey } from '../../contracts/profile';
import type { Appearance, Avatar } from '../../contracts/profile';
import { readArtwork } from '../../contracts/libraries';
import { readUser } from '../../contracts/auth';
import { fileBase64 } from '../../services/files';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import FramePicker from '../../components/FramePicker.vue';
import FramePreview from '../../components/FramePreview.vue';

const profile = useProfileStore(),
  session = useSessionStore(),
  prefs = usePreferencesStore();
const { pending, message, failed, run } = useMutation();
const nameAction = useMutation();
const { pending: namePending, message: nameMessage, failed: nameFailed } = nameAction;
const nickname = ref(''),
  nameLoading = ref(false),
  nameLoadError = ref('');
const appearance = ref<Appearance | null>(null),
  avatar = ref<Avatar | null>(null);
const barragePicker = ref<InstanceType<typeof FramePicker> | null>(null),
  mediaPicker = ref<InstanceType<typeof FramePicker> | null>(null);
const characters = computed(() => profile.data?.characters || []);
const selected = computed(
  () => characters.value.find((c) => c.id === appearance.value?.characterId) || characters.value[0],
);
const choices = computed(() => [
  ...characters.value.flatMap((character) =>
    Object.entries(character.expressions).map(([expression, url]) => ({
      key: character.id + '|' + expression,
      value: { kind: 'character' as const, characterId: character.id, expression },
      url,
      label:
        character.name +
        ' · ' +
        (character.labels[expression] || profile.data?.expressionLabels[expression] || expression),
    })),
  ),
  ...(profile.data?.artworks || []).map((artwork) => ({
    key: 'artwork:' + artwork.id,
    value: { kind: 'artwork' as const, artworkId: artwork.id },
    url: artwork.url,
    label: (artwork.owned ? '收藏 · ' : artwork.author + ' 分享 · ') + artwork.name,
  })),
]);
const selectedAvatar = computed(
  () =>
    choices.value.find((choice) => avatar.value && choice.key === avatarKey(avatar.value)) ||
    choices.value[0],
);
const selectedExpression = computed({
  get: () => appearance.value?.expression || 'neutral',
  set: (expression) => {
    if (appearance.value) {
      appearance.value.expression = expression;
      unsaved();
    }
  },
});
const avatarChoice = computed({
  get: () => selectedAvatar.value?.key || '',
  set: (key) => {
    const choice = choices.value.find((c) => c.key === key);
    if (choice) {
      avatar.value = { ...choice.value };
      unsaved();
    }
  },
});
const labelForFrame = (id: string) =>
  prefs.frames.find((option) => option.id === id)?.label || '預設';
watch(
  () => profile.data,
  (data) => {
    if (!data || appearance.value) return;
    appearance.value = { ...data.appearance };
    if (!data.characters.some((c) => c.id === appearance.value?.characterId))
      appearance.value = { ...data.defaults };
    if (selected.value && !selected.value.expressions[appearance.value.expression])
      appearance.value.expression = 'neutral';
    avatar.value = { ...data.avatar };
    if (!choices.value.some((c) => c.key === avatarKey(data.avatar)) && choices.value[0])
      avatar.value = { ...choices.value[0].value };
  },
);
function unsaved() {
  failed.value = false;
  message.value = '尚未儲存變更。';
}
function chooseCharacter(id: string) {
  appearance.value = { version: 5, characterId: id, expression: 'neutral' };
  unsaved();
}
async function loadName() {
  nameLoading.value = true;
  nameLoadError.value = '';
  try {
    await session.refresh();
    nickname.value = session.user?.displayName || '';
  } catch (error) {
    nameLoadError.value = error instanceof Error ? error.message : '無法載入暱稱';
  } finally {
    nameLoading.value = false;
  }
}
async function saveName() {
  await nameAction.run(async (request) => {
    const name = nickname.value.trim();
    if (!name || [...name].length > 16 || /[\u0000-\u001f\u007f]/.test(name))
      throw Error('暱稱需為 1–16 字，且不能換行');
    session.user = readUser(await request('/api/profile/name', { displayName: name }));
    nickname.value = session.user.displayName;
    window.dispatchEvent(
      new CustomEvent('profile-updated', { detail: { displayName: session.user.displayName } }),
    );
  }, '暱稱已儲存，大廳與房間名單會更新。');
}
async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  await run(async (request) => {
    const added = {
      ...readArtwork(
        await request('/api/artworks', {
          name: '頭像 · ' + file.name.slice(0, 30),
          mime: file.type,
          base64: await fileBase64(file),
        }),
      ),
      owned: true,
      shared: false,
      author: session.user?.displayName || '',
    };
    if (profile.data)
      profile.data = {
        ...profile.data,
        artworks: [added, ...profile.data.artworks.filter((a) => a.id !== added.id)],
      };
    avatar.value = { kind: 'artwork', artworkId: added.id };
  }, '圖片已加入收藏庫，按儲存後才會套用頭像。');
  input.value = '';
}
async function save() {
  await run(async (request) => {
    if (!appearance.value || !avatar.value) throw Error('請先選擇頭像與角色');
    const result = readSettings(
      await request('/api/profile/settings', {
        appearance: { ...appearance.value },
        avatar: { ...avatar.value },
      }),
    );
    appearance.value = result.appearance;
    avatar.value = result.avatar;
    window.dispatchEvent(new Event('profile-updated'));
  }, '頭像與角色已儲存。');
}
onMounted(() => {
  void profile.load();
  void loadName();
});
</script>

<template>
  <header class="settings-page-heading"
    ><div
      ><h1>形象設定</h1
      ><p class="settings-intro">頭像顯示在帳號選單；角色用於大廳與遊戲座位，可分別選擇。</p></div
    ><a class="settings-return" href="/">← 返回遊戲大廳</a></header
  >
  <div class="settings-load-slot" role="status"
    ><span v-if="profile.loading">正在載入角色與頭像…</span
    ><template v-else-if="profile.error"
      ><span class="resource-error">{{ profile.error }}</span
      ><UiButton
        stitch
        variant="secondary"
        icon="refresh"
        label="重新載入形象設定"
        @click="profile.load()" /></template
  ></div>
  <div class="settings-l05-layout">
    <div class="settings-account-column">
      <section class="page-panel nickname-panel" aria-labelledby="nickname-heading">
        <header class="settings-card-heading"
          ><h2 id="nickname-heading">我的暱稱</h2><span>1–16 字</span></header
        >
        <label class="settings-account-id" for="nickname-account"
          >登入帳號（唯讀）<input
            id="nickname-account"
            :value="session.user?.username || '讀取中…'"
            readonly
            autocomplete="username"
        /></label>
        <form id="nickname-form" :aria-busy="namePending || nameLoading" @submit.prevent="saveName"
          ><label for="nickname"
            >顯示暱稱<input
              id="nickname"
              v-model="nickname"
              name="displayName"
              type="text"
              maxlength="32"
              autocomplete="nickname"
              required
              aria-describedby="nickname-message"
              :disabled="namePending || nameLoading || !session.user" /></label
          ><UiButton
            id="nickname-save"
            stitch
            variant="secondary"
            type="submit"
            icon="save"
            label="儲存暱稱"
            :pending="namePending"
            :disabled="nameLoading || !session.user" /><StatusSlot
            id="nickname-message"
            :message="nameLoadError || nameMessage"
            :error="!!nameLoadError || nameFailed" /><UiButton
            v-if="nameLoadError"
            stitch
            variant="secondary"
            icon="refresh"
            label="重新載入暱稱"
            @click="loadName"
        /></form>
      </section>
      <section class="page-panel settings-barrage-panel" aria-labelledby="barrage-settings-heading">
        <header class="settings-card-heading"
          ><h2 id="barrage-settings-heading">彈幕外觀</h2><span>設定保存在此瀏覽器</span></header
        >
        <div class="settings-appearance-choice"
          ><p id="settings-barrage-frame-status" role="status" aria-live="polite"
            >目前彈幕框：<strong>{{
              labelForFrame(prefs.barrage?.selected || 'default')
            }}</strong></p
          ><UiButton
            id="settings-barrage-frame"
            stitch
            variant="ghost"
            icon="next"
            label="選擇彈幕框"
            :disabled="!prefs.frames.length"
            @click="barragePicker?.open($event.currentTarget as HTMLElement)"
        /></div>
        <div class="settings-preview-heading">彈幕即時預覽</div
        ><div class="settings-barrage-preview-slot" aria-label="目前使用的彈幕預覽"
          ><FramePreview
            :frame="prefs.barrage?.selected || 'default'"
            :name="nickname || session.user?.displayName || '玩家'"
            message="這一桌好好玩！"
        /></div>
      </section>
      <section
        class="page-panel settings-barrage-panel settings-media-panel"
        aria-labelledby="media-settings-heading"
      >
        <header class="settings-card-heading"
          ><h2 id="media-settings-heading">播放器外觀</h2><span>只影響你的播放器</span></header
        >
        <div class="settings-appearance-choice"
          ><p id="settings-media-frame-status" role="status" aria-live="polite"
            >目前外觀：<strong>{{ labelForFrame(prefs.media) }}</strong></p
          ><UiButton
            id="settings-media-frame"
            stitch
            variant="ghost"
            icon="next"
            label="選擇播放器外觀"
            :disabled="!prefs.frames.length"
            @click="mediaPicker?.open($event.currentTarget as HTMLElement)"
        /></div>
        <div class="settings-preview-heading">播放器外觀即時預覽</div
        ><div
          class="settings-barrage-preview-slot settings-media-preview-slot"
          aria-label="目前使用的播放器外觀預覽"
          ><FramePreview kind="media" :frame="prefs.media" name="播放器" message="我的風格"
        /></div>
      </section>
    </div>
    <form id="settings-form" :aria-busy="pending || profile.loading" @submit.prevent="save">
      <fieldset class="settings-fields" :disabled="pending || !appearance || !avatar">
        <div class="settings-grid">
          <section
            class="page-panel settings-avatar-panel"
            aria-labelledby="avatar-settings-heading"
            ><header class="settings-card-heading"
              ><h2 id="avatar-settings-heading">我的頭像</h2
              ><a href="/collection?section=avatars">前往收藏庫 ↗</a></header
            ><div class="settings-avatar-content"
              ><div class="settings-image-slot"
                ><img
                  v-if="selectedAvatar"
                  id="avatar-preview"
                  class="settings-avatar"
                  :src="selectedAvatar.url"
                  alt="目前選擇的帳號頭像"
                /><span v-else>正在載入頭像…</span></div
              ><div class="settings-avatar-options"
                ><label for="avatar-source">選擇現有角色或圖片</label
                ><select id="avatar-source" v-model="avatarChoice"
                  ><option v-for="choice in choices" :key="choice.key" :value="choice.key">{{
                    choice.label
                  }}</option></select
                ><label class="settings-upload" for="avatar-upload"
                  >上傳頭像<input
                    id="avatar-upload"
                    type="file"
                    accept="image/png,image/gif,image/webp"
                    @change="uploadAvatar" /></label
                ><p class="settings-intro"
                  >PNG、GIF、WebP，每張最多 1 MB。上傳圖片會保存到自己的收藏庫，儲存後套用頭像。</p
                ></div
              ></div
            ></section
          >
          <section
            class="page-panel settings-character-panel"
            aria-labelledby="character-settings-heading"
            ><header class="settings-card-heading"
              ><h2 id="character-settings-heading">遊戲角色</h2
              ><a href="/profile">管理角色與表情 ↗</a></header
            ><div class="settings-selected-character"
              ><div class="settings-character-preview-slot"
                ><img
                  v-if="selected"
                  id="character-preview"
                  class="settings-character"
                  :src="selected.expressions[selectedExpression] || selected.expressions.neutral"
                  :alt="
                    selected.name +
                    '－' +
                    (selected.labels[selectedExpression] ||
                      profile.data?.expressionLabels[selectedExpression] ||
                      selectedExpression)
                  "
                /><span v-else>正在載入角色…</span></div
              ><div
                ><strong>{{ selected?.name || '讀取角色中…' }}</strong
                ><p class="settings-intro"
                  >{{
                    selected?.labels[selectedExpression] ||
                    profile.data?.expressionLabels[selectedExpression] ||
                    selectedExpression
                  }}
                  · 大廳與遊戲座位預覽</p
                ></div
              ></div
            ><div
              id="settings-characters"
              class="settings-characters"
              role="group"
              aria-label="選擇遊戲角色，可捲動查看"
              ><button
                v-for="character in characters"
                :key="character.id"
                type="button"
                :aria-label="'選擇' + character.name"
                :aria-pressed="selected?.id === character.id"
                @click="chooseCharacter(character.id)"
                ><img :src="character.expressions.neutral" alt="" loading="lazy" /><span>{{
                  character.name
                }}</span
                ><span
                  v-if="selected?.id === character.id"
                  class="settings-character-check"
                  aria-hidden="true"
                  >✓</span
                ></button
              ></div
            ><label for="character-expression"
              >預設表情（角色：{{ selected?.name || '讀取中' }}）</label
            ><select id="character-expression" v-model="selectedExpression"
              ><option
                v-for="(_, expression) in selected?.expressions || {}"
                :key="expression"
                :value="expression"
                >{{
                  selected?.labels[expression] ||
                  profile.data?.expressionLabels[expression] ||
                  expression
                }}</option
              ></select
            ></section
          >
        </div>
      </fieldset>
    </form>
  </div>
  <footer class="settings-actions"
    ><div class="settings-save-feedback"
      ><p>頭像與角色需儲存；彈幕與播放器外觀會即時套用。</p
      ><StatusSlot id="settings-message" :message="message" :error="failed" /></div
    ><UiButton
      id="settings-save"
      stitch
      variant="primary"
      form="settings-form"
      type="submit"
      icon="check"
      label="儲存形象設定"
      :pending="pending"
      :disabled="!appearance || !avatar"
  /></footer>
  <FramePicker ref="barragePicker" kind="barrage" /><FramePicker ref="mediaPicker" kind="media" />
</template>
