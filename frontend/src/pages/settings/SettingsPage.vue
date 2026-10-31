<script setup lang="ts">
import CocAiSettings from '../../components/CocAiSettings.vue';
import CocCharacterLibrary from '../../components/CocCharacterLibrary.vue';
import AudioSettings from '../../engines/audio-settings.js';
import PingModel from '../../engines/ping-model.js';

import { sizedImage } from '../../services/image-size';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useProfileStore } from '../../stores/profile';
import { useSessionStore } from '../../stores/session';
import { usePreferencesStore } from '../../stores/preferences';
import { useMutation } from '../../composables/mutation';
import { readSettings, avatarKey } from '../../contracts/profile';
import type { Appearance, Avatar } from '../../contracts/profile';
import { pingTypes, pingWheel } from '../../contracts/pings';
import type { PingPreference, PingType } from '../../contracts/pings';
import { readArtwork } from '../../contracts/libraries';
import { readUser } from '../../contracts/auth';
import { fileBase64 } from '../../services/files';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import FrameChoices from '../../components/FrameChoices.vue';
import FramePreview from '../../components/FramePreview.vue';
import EntrancePreview from '../../components/EntrancePreview.vue';
import OpeningPicker from '../../components/OpeningPicker.vue';
import LobbyBackgroundPicker from '../../components/LobbyBackgroundPicker.vue';
import PingSymbol from '../../components/PingSymbol.vue';
import AttackChoices from '../../components/AttackChoices.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiField from '../../components/UiField.vue';
import UiCheckbox from '../../components/UiCheckbox.vue';
import UiFilePick from '../../components/UiFilePick.vue';
import UiHeading from '../../components/UiHeading.vue';
import UiLink from '../../components/UiLink.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
import ImageChoiceGrid from '../../components/ImageChoiceGrid.vue';
import EntranceChoices from '../../components/EntranceChoices.vue';
import { record, array, text } from '../../services/validation';
import { requestJson } from '../../services/http';
import { entranceEffect, entranceEffects } from '../../services/entrance-effects';

// One settings group per panel; the URL hash keeps the open panel across reloads.
const panels = [
  { id: 'character', label: '角色設定', saved: true },
  { id: 'coc-ai', label: '跑團 AI', saved: false },
  { id: 'coc-characters', label: '調查者角色庫', saved: false },
  { id: 'pings', label: '房間標記', saved: true },
  { id: 'lobby', label: '大廳與開場', saved: false },
  { id: 'barrage', label: '彈幕', saved: false },
  { id: 'media', label: '播放器', saved: false },
  { id: 'entrance', label: '進場特效', saved: false },
  { id: 'attack', label: '攻擊特效', saved: false },
] as const;
type PanelId = (typeof panels)[number]['id'];
const panelFromHash = (): PanelId =>
  panels.find((panel) => '#' + panel.id === window.location.hash)?.id || 'character';
const activePanel = ref<PanelId>(panelFromHash());
const activeSaved = computed(() => panels.find((panel) => panel.id === activePanel.value)?.saved);
const syncPanel = () => (activePanel.value = panelFromHash());
// On narrow screens the nav is a horizontal strip; keep the current item in view.
function revealActiveTab() {
  const link = document.querySelector('#settings-tab-' + activePanel.value),
    nav = link?.parentElement;
  if (!link || !nav || nav.scrollWidth <= nav.clientWidth) return;
  const box = link.getBoundingClientRect(),
    navBox = nav.getBoundingClientRect();
  nav.scrollLeft += box.left - navBox.left - (navBox.width - box.width) / 2;
}
const settingsPanels = ref<HTMLElement | null>(null);
watch(
  activePanel,
  () =>
    void nextTick(() => {
      revealActiveTab();
      if (settingsPanels.value) {
        settingsPanels.value.scrollTop = 0;
        if (settingsPanels.value.getBoundingClientRect().top < 0)
          settingsPanels.value.scrollIntoView({ block: 'start' });
      }
    }),
);
const pingColor = (type: PingType) => PingModel?.colors[type];
const profile = useProfileStore(),
  session = useSessionStore(),
  prefs = usePreferencesStore();
const { pending, message, failed, run } = useMutation();
const nameAction = useMutation();
const { pending: namePending, message: nameMessage, failed: nameFailed } = nameAction;
const settingsNoticeKey = ref(0),
  nameNoticeKey = ref(0),
  avatarUpload = ref<InstanceType<typeof UiFilePick> | null>(null);
watch(
  pending,
  (value, previous) => {
    if (previous && !value) settingsNoticeKey.value++;
  },
  { flush: 'sync' },
);
const nickname = ref(''),
  nameLoading = ref(false),
  nameLoadError = ref('');
watch(
  [namePending, nameLoading],
  (values, previous) => {
    if (values.some((value, index) => previous[index] && !value)) nameNoticeKey.value++;
  },
  { flush: 'sync' },
);
const appearance = ref<Appearance | null>(null),
  avatar = ref<Avatar | null>(null),
  pingChoices = ref<Partial<Record<PingType, PingPreference>>>({});
const selectedPings = ref<PingType[]>(pingTypes.slice(0, 5));
function togglePing(type: PingType) {
  selectedPings.value = selectedPings.value.includes(type)
    ? selectedPings.value.filter((item) => item !== type)
    : selectedPings.value.length < 5
      ? [...selectedPings.value, type]
      : selectedPings.value;
  unsaved();
}
const pingLabels: Record<PingType, string> = {
  ping: '這裡',
  attention: '注意',
  question: '疑問',
  help: '幫忙',
  look: '看這裡',
  angry: '生氣',
  sleep: '睡覺',
  speechless: '無言',
  surprised: '驚訝',
  admire: '崇拜',
};
const pingIcons: Record<PingType, string> = {
  ping: 'ping',
  attention: 'ping-attention',
  question: 'ping-question',
  help: 'ping-help',
  look: 'ping-look',
  angry: 'ping-angry',
  sleep: 'ping-sleep',
  speechless: 'ping-speechless',
  surprised: 'ping-surprised',
  admire: 'ping-admire',
};
const ownedVoices = ref<string[]>([]);
const soundChoices = computed(() => [
  ...pingTypes.slice(0, 5).map((type) => ({
    key: 'effect:ping-' + type,
    label: '內建 · ' + pingLabels[type],
    locked: false,
  })),
  ...[
    ['amazing', '太神啦'],
    ['bad', '他很壞'],
    ['card-check', '窩咬驗牌'],
    ['sleep', '那我也要睡了啦'],
    ['look', '讓我看看'],
    ['legacy', '傳承精神'],
    ['no-bluff', '不要瞎掰'],
    ['cry', '你在哭哦'],
    ['coward', '俗仔'],
    ['goodnight', '晚安'],
    ['senior', '野獸前輩'],
    ['practice', '菜就多練'],
    ['huh', '蛤'],
    ['what', '靠北三小'],
  ].map(([name, label]) => ({
    key: 'effect:ping-voice-' + name,
    label: '語音 · ' + label,
    locked: !ownedVoices.value.includes('ping-voice-' + name),
  })),
  ...characters.value.flatMap((character) =>
    Object.entries(character.sounds).map(([expression, sound]) => ({
      locked: false,
      key: 'sound:' + sound.url.split('?')[0],
      label: character.name + ' · ' + (character.labels[expression] || expression),
      durationMs: sound.durationMs,
    })),
  ),
]);
function pingSoundValue(type: PingType) {
  const choice = pingChoices.value[type];
  if (!choice || !Object.hasOwn(choice, 'sound')) return 'default';
  if (choice.sound === null) return 'silent';
  return choice.sound && 'effect' in choice.sound
    ? 'effect:' + choice.sound.effect
    : 'sound:' + choice.sound?.url.split('?')[0];
}
function changePingIcon(type: PingType, value: string) {
  if (!pingTypes.includes(value as PingType)) return;
  const choice = { ...pingChoices.value[type], iconType: value as PingType };
  delete choice.imageUrl;
  pingChoices.value = { ...pingChoices.value, [type]: choice };
  unsaved();
}
function changePingSound(type: PingType, key: string) {
  if (soundChoices.value.find((item) => item.key === key)?.locked) {
    message.value = '需先取得對應成就音效或兌換 Ping 獎勵。';
    return;
  }
  const choice: PingPreference = { ...pingChoices.value[type] };
  if (key === 'default') delete choice.sound;
  else if (key === 'silent') choice.sound = null;
  else if (key.startsWith('effect:')) choice.sound = { effect: key.slice(7) };
  else {
    const sound = soundChoices.value.find((item) => item.key === key);
    if (sound && 'durationMs' in sound && typeof sound.durationMs === 'number')
      choice.sound = { url: key.slice(6), durationMs: sound.durationMs };
  }
  pingChoices.value = { ...pingChoices.value, [type]: choice };
  unsaved();
}
function previewPing(type: PingType) {
  const selected = pingChoices.value[type]?.sound;
  if (selected === null) return;
  if (selected && 'url' in selected) AudioSettings?.playExpression(selected);
  else
    AudioSettings?.playEffect?.(
      selected?.effect || 'ping-' + (pingTypes.slice(0, 5).includes(type) ? type : 'ping'),
    );
}
function resetPings() {
  pingChoices.value = {};
  selectedPings.value = pingTypes.slice(0, 5);
  unsaved();
}
const entranceLabel = computed(
  () => entranceEffects.find((effect) => effect.id === entranceEffect.value)?.label || '',
);
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
    pingChoices.value = structuredClone(data.pings);
    selectedPings.value = pingWheel(data.pings);
    if (!choices.value.some((c) => c.key === avatarKey(data.avatar)) && choices.value[0])
      avatar.value = { ...choices.value[0].value };
  },
);
function unsaved() {
  failed.value = false;
  message.value = '尚未儲存變更。';
  settingsNoticeKey.value++;
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
async function uploadAvatar(file: File | null) {
  if (!file) return;
  try {
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
  } finally {
    avatarUpload.value?.clear();
  }
}
async function save() {
  await run(async (request) => {
    if (!appearance.value || !avatar.value) throw Error('請先選擇頭像與角色');
    if (selectedPings.value.length !== 5) throw Error('請選滿五種常用標記');
    for (const type of pingTypes) {
      const choice = { ...pingChoices.value[type] };
      delete choice.wheelSlot;
      const index = selectedPings.value.indexOf(type);
      if (index >= 0) choice.wheelSlot = index;
      pingChoices.value[type] = choice;
    }
    const result = readSettings(
      await request('/api/profile/settings', {
        appearance: { ...appearance.value },
        avatar: { ...avatar.value },
        pings: pingChoices.value,
      }),
    );
    appearance.value = result.appearance;
    avatar.value = result.avatar;
    pingChoices.value = result.pings;
    window.dispatchEvent(new Event('profile-updated'));
  }, '角色與房間標記設定已儲存。');
}
onMounted(() => {
  window.addEventListener('hashchange', syncPanel);
  revealActiveTab();
  void profile.load();
  void requestJson('/api/achievements')
    .then((data) => {
      ownedVoices.value = array(record(record(data).bonusRewards).sounds).map((value) =>
        text(value),
      );
    })
    .catch(() => {});
  void loadName();
});

onBeforeUnmount(() => window.removeEventListener('hashchange', syncPanel));
</script>
<template>
  <header class="settings-page-heading"
    ><div
      ><UiHeading :level="1" kind="page">個人化設定</UiHeading
      ><p class="settings-intro"
        >依分類切換設定；頭像顯示在帳號選單，角色用於大廳與遊戲座位。</p
      ></div
    ><UiLink
      class="settings-return"
      href="/"
      icon="previous"
      label="返回遊戲大廳"
      variant="ghost" /></header
  ><div class="settings-load-slot" role="status"
    ><span v-if="profile.loading">正在載入角色與頭像…</span
    ><template v-else-if="profile.error"
      ><span class="resource-error">{{ profile.error }}</span
      ><UiButton
        variant="secondary"
        icon="refresh"
        label="重新載入個人化設定"
        @click="profile.load()" /></template></div
  ><div class="settings-layout"
    ><nav class="settings-nav" aria-label="設定分類">
      <a
        v-for="panel in panels"
        :id="'settings-tab-' + panel.id"
        :key="panel.id"
        :href="'#' + panel.id"
        :aria-controls="'settings-panel-' + panel.id"
        :aria-current="activePanel === panel.id ? 'page' : undefined"
        >{{ panel.label }}</a
      > </nav
    ><div
      ref="settingsPanels"
      class="settings-panels"
      :class="{
        'settings-panels-auto': [
          'attack',
          'barrage',
          'media',
          'entrance',
          'coc-ai',
          'coc-characters',
        ].includes(activePanel),
      }"
      tabindex="0"
      role="region"
      aria-label="個人化設定內容"
      ><section
        v-if="activePanel === 'coc-ai'"
        id="settings-panel-coc-ai"
        class="settings-panel"
        aria-labelledby="settings-tab-coc-ai"
        ><CocAiSettings /></section
      ><section
        v-if="activePanel === 'coc-characters'"
        id="settings-panel-coc-characters"
        class="settings-panel"
        aria-labelledby="settings-tab-coc-characters"
        ><CocCharacterLibrary /></section
      ><section
        v-show="activePanel === 'character'"
        id="settings-panel-character"
        class="settings-panel settings-panel-character"
        aria-labelledby="settings-tab-character"
        ><div class="settings-panel-columns"
          ><div class="settings-panel-stack"
            ><UiPanel class="nickname-panel" title="我的暱稱" note="1–16 字">
              <UiField
                id="nickname-account"
                class="settings-account-id"
                label="登入帳號（唯讀）"
                :model-value="session.user?.username || '讀取中…'"
                readonly
                autocomplete="username"
              />
              <form
                id="nickname-form"
                :aria-busy="namePending || nameLoading"
                @submit.prevent="saveName"
                ><UiField
                  id="nickname"
                  v-model="nickname"
                  label="顯示暱稱"
                  name="displayName"
                  type="text"
                  maxlength="32"
                  autocomplete="nickname"
                  required
                  aria-describedby="nickname-message"
                  :disabled="namePending || nameLoading || !session.user" /><UiButton
                  id="nickname-save"
                  variant="secondary"
                  type="submit"
                  icon="save"
                  label="儲存暱稱"
                  :pending="namePending"
                  :disabled="nameLoading || !session.user" /><StatusSlot
                  id="nickname-message"
                  :message="nameLoadError || nameMessage"
                  :notice-key="nameNoticeKey"
                  :persistent="!!nameLoadError"
                  :error="!!nameLoadError || nameFailed" /><UiButton
                  v-if="nameLoadError"
                  variant="secondary"
                  icon="refresh"
                  label="重新載入暱稱"
                  @click="loadName"
              /></form> </UiPanel
            ><fieldset class="settings-fields" :disabled="pending || !appearance || !avatar"
              ><UiPanel class="settings-avatar-panel" title="頭像設定"
                ><template #actions><a href="/collection?section=avatars">前往收藏庫 ↗</a></template
                ><div class="settings-avatar-content"
                  ><div class="settings-image-slot"
                    ><img
                      v-if="selectedAvatar"
                      id="avatar-preview"
                      class="settings-avatar"
                      :src="sizedImage(selectedAvatar.url, 256)"
                      alt="目前選擇的帳號頭像"
                    /><span v-else>正在載入頭像…</span></div
                  ><div class="settings-avatar-options"
                    ><UiField
                      id="avatar-source"
                      v-model="avatarChoice"
                      control="select"
                      label="選擇現有角色或圖片"
                      :options="
                        choices.map((choice) => ({ value: choice.key, label: choice.label }))
                      "
                    /><UiFilePick
                      class="settings-upload"
                      ref="avatarUpload"
                      input-id="avatar-upload"
                      label="上傳頭像"
                      accept="image/png,image/gif,image/webp"
                      :current="selectedAvatar?.label || '尚未設定頭像'"
                      :disabled="pending || !appearance || !avatar"
                      @change="uploadAvatar"
                    />
                    <p class="settings-intro"
                      >PNG、GIF、WebP，每張最多 1
                      MB。上傳圖片會保存到自己的收藏庫，儲存後套用頭像。</p
                    ></div
                  ></div
                ></UiPanel
              ></fieldset
            ></div
          ><fieldset class="settings-fields" :disabled="pending || !appearance || !avatar"
            ><UiPanel class="settings-character-panel" title="遊戲角色"
              ><template #actions><a href="/profile">管理角色與表情 ↗</a></template
              ><div class="settings-selected-character"
                ><div class="settings-character-preview-slot"
                  ><img
                    v-if="selected"
                    id="character-preview"
                    class="settings-character"
                    :src="
                      sizedImage(
                        selected.expressions[selectedExpression] || selected.expressions.neutral,
                        512,
                      )
                    "
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
              ><ImageChoiceGrid
                id="settings-characters"
                class="settings-characters"
                role="group"
                aria-label="選擇遊戲角色，可捲動查看"
                :items="
                  characters.map((character) => ({
                    id: character.id,
                    label: character.name,
                    url: character.expressions.neutral,
                    ariaLabel: '選擇' + character.name,
                  }))
                "
                :model-value="selected?.id || ''"
                :disabled="pending || !appearance || !avatar"
                @update:model-value="chooseCharacter"
              />
              <UiField
                id="character-expression"
                v-model="selectedExpression"
                control="select"
                :label="`預設表情（角色：${selected?.name || '讀取中'}）`"
                ><option
                  v-for="(_, expression) in selected?.expressions || {}"
                  :key="expression"
                  :value="expression"
                  >{{
                    selected?.labels[expression] ||
                    profile.data?.expressionLabels[expression] ||
                    expression
                  }}</option
                ></UiField
              ></UiPanel
            ></fieldset
          ></div
        ></section
      ><section
        v-show="activePanel === 'pings'"
        id="settings-panel-pings"
        class="settings-panel settings-panel-pings"
        aria-labelledby="settings-tab-pings"
        ><fieldset class="settings-fields" :disabled="pending || !appearance || !avatar"
          ><UiPanel
            class="settings-pings-panel"
            title="房間標記"
            description="挑選五個常用標記，依順序放入中央、上、左、下、右；每個標記的圖示、音效可分開選。語音需先取得成就獎勵或兌換。"
            ><template #actions
              ><UiButton
                class="settings-pings-reset"
                label="全部恢復預設"
                icon="refresh"
                @click="resetPings"
              /> </template
            ><UiList class="settings-pings-list"
              ><UiListRow v-for="type in pingTypes" :key="type" class="settings-ping-row"
                ><span
                  class="settings-ping-preview"
                  :style="{ color: pingColor(pingChoices[type]?.iconType || type) }"
                  ><PingSymbol
                    :icon="pingIcons[pingChoices[type]?.iconType || type]"
                    :image="pingChoices[type]?.iconType ? undefined : pingChoices[type]?.imageUrl"
                  />{{ pingLabels[type] }}</span
                ><UiCheckbox
                  class="settings-ping-common"
                  label="常用"
                  :model-value="selectedPings.includes(type)"
                  :disabled="selectedPings.length === 5 && !selectedPings.includes(type)"
                  @update:model-value="togglePing(type)"
                />
                <UiField
                  label="圖示"
                  control="select"
                  :aria-label="pingLabels[type] + '標記圖示'"
                  :model-value="
                    pingChoices[type]?.iconType || (pingChoices[type]?.imageUrl ? 'custom' : type)
                  "
                  @update:model-value="changePingIcon(type, String($event))"
                >
                  <option
                    v-if="pingChoices[type]?.imageUrl && !pingChoices[type]?.iconType"
                    value="custom"
                    disabled
                    >既有自訂圖片</option
                  >
                  <option v-for="icon in pingTypes" :key="icon" :value="icon">{{
                    pingLabels[icon]
                  }}</option>
                </UiField>
                <UiField
                  label="音效"
                  control="select"
                  :aria-label="pingLabels[type] + '標記音效'"
                  :model-value="pingSoundValue(type)"
                  @update:model-value="changePingSound(type, String($event))"
                  ><option value="default">原本音效</option><option value="silent">靜音</option
                  ><option
                    v-for="choice in soundChoices"
                    :key="choice.key"
                    :value="choice.key"
                    :disabled="choice.locked"
                    >{{ (choice.locked ? '🔒 ' : '') + choice.label }}</option
                  ></UiField
                ><UiButton
                  class="settings-ping-play"
                  icon="play"
                  caption="試聽"
                  :disabled="pingSoundValue(type) === 'silent'"
                  :label="'試聽' + pingLabels[type] + '標記音效'"
                  @click="previewPing(type)"
                /> </UiListRow></UiList
            ><p class="settings-intro"
              >內建標記音效可直接使用；成就語音須先達成條件或輸入對應兌換碼。</p
            ></UiPanel
          ></fieldset
        ></section
      ><section
        v-show="activePanel === 'lobby'"
        id="settings-panel-lobby"
        class="settings-panel settings-panel-lobby"
        aria-labelledby="settings-tab-lobby"
        ><UiPanel class="settings-background-panel" title="大廳與開場" note="選擇後立即套用"
          ><LobbyBackgroundPicker /><OpeningPicker /></UiPanel></section
      ><section
        v-show="activePanel === 'attack'"
        id="settings-panel-attack"
        class="settings-panel settings-panel-attack"
        aria-labelledby="settings-tab-attack"
        ><UiPanel
          class="settings-attack-panel"
          title="攻擊特效"
          description="設定 Q／E 普通招式與 R 多人招式。"
          note="選擇後立即套用"
          ><template #actions><a href="/collection?section=attack">前往收藏庫 ↗</a></template
          ><AttackChoices v-if="activePanel === 'attack'" show-current /></UiPanel></section
      ><section
        v-show="activePanel === 'barrage'"
        id="settings-panel-barrage"
        class="settings-panel settings-panel-barrage"
        aria-labelledby="settings-tab-barrage"
        ><UiPanel
          class="settings-barrage-panel"
          title="彈幕外觀"
          note="點選即套用，設定保存在此瀏覽器"
        >
          <p
            id="settings-barrage-frame-status"
            class="settings-frame-status"
            role="status"
            aria-live="polite"
          >
            目前彈幕框：<strong>{{ labelForFrame(prefs.barrage?.selected || 'default') }}</strong>
          </p>
          <div
            v-if="activePanel === 'barrage'"
            class="settings-current-preview"
            aria-label="目前彈幕外觀預覽"
          >
            <FramePreview
              :frame="prefs.barrage?.selected || 'default'"
              :name="nickname || session.user?.displayName || '玩家'"
              message="這一桌好好玩！"
            />
          </div>
          <FrameChoices
            v-if="activePanel === 'barrage'"
            class="settings-frame-choices"
            tabindex="0"
            kind="barrage"
          /> </UiPanel></section
      ><section
        v-show="activePanel === 'media'"
        id="settings-panel-media"
        class="settings-panel settings-panel-media"
        aria-labelledby="settings-tab-media"
        ><UiPanel
          class="settings-barrage-panel settings-media-panel"
          title="播放器外觀"
          note="點選即套用，設定保存在此瀏覽器"
        >
          <p
            id="settings-media-frame-status"
            class="settings-frame-status"
            role="status"
            aria-live="polite"
          >
            目前外觀：<strong>{{ labelForFrame(prefs.media) }}</strong>
          </p>
          <div
            v-if="activePanel === 'media'"
            class="settings-current-preview settings-current-media-preview"
            aria-label="目前播放器外觀預覽"
          >
            <FramePreview kind="media" :frame="prefs.media" name="播放器" message="我的風格" />
          </div>
          <FrameChoices
            v-if="activePanel === 'media'"
            class="settings-frame-choices"
            tabindex="0"
            kind="media"
          /> </UiPanel></section
      ><section
        v-show="activePanel === 'entrance'"
        id="settings-panel-entrance"
        class="settings-panel settings-panel-entrance"
        aria-labelledby="settings-tab-entrance"
        ><UiPanel
          class="settings-barrage-panel settings-entrance-panel"
          title="進場特效"
          note="點選即套用，設定保存在此瀏覽器"
        >
          <template #actions><a href="/collection?section=entrance">前往收藏庫 ↗</a></template>
          <p
            id="settings-entrance-status"
            class="settings-frame-status"
            role="status"
            aria-live="polite"
          >
            目前特效：<strong>{{ entranceLabel }}</strong>
          </p>
          <div
            v-if="activePanel === 'entrance'"
            class="settings-current-preview settings-current-entrance-preview"
            aria-label="目前進場特效預覽"
          >
            <EntrancePreview
              :effect="entranceEffect"
              :image="selected?.expressions.neutral || '/assets/characters/traveler-neutral.png'"
              :name="nickname || session.user?.displayName || '玩家'"
            />
          </div>
          <EntranceChoices
            v-if="activePanel === 'entrance'"
            class="settings-entrance-choices"
            tabindex="0"
          /> </UiPanel></section></div></div
  ><form
    id="settings-form"
    aria-label="角色與房間標記設定"
    :aria-busy="pending || profile.loading"
    @submit.prevent="save"
  ></form
  ><footer v-show="activeSaved" class="settings-actions"
    ><div class="settings-save-feedback"
      ><p>頭像、遊戲角色與房間標記一起儲存；暱稱請按「儲存暱稱」，其他分類會即時套用。</p
      ><StatusSlot
        id="settings-message"
        :message="message"
        :error="failed"
        :notice-key="settingsNoticeKey" /></div
    ><UiButton
      id="settings-save"
      variant="primary"
      form="settings-form"
      type="submit"
      icon="check"
      label="儲存設定"
      :pending="pending"
      :disabled="!appearance || !avatar || selectedPings.length !== 5"
  /></footer>
</template>
