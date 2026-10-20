<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useProfileStore } from '../../stores/profile';
import { useMutation } from '../../composables/mutation';
import { useExpressionSound } from '../../composables/expression-sound';
import { readAppearance } from '../../contracts/profile';
import type { Appearance, Character } from '../../contracts/profile';
import { record, text } from '../../services/validation';
import { fileBase64 } from '../../services/files';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiDialog from '../../components/UiDialog.vue';
import ImageChoiceGrid from '../../components/ImageChoiceGrid.vue';
import ImageSourceField from '../../components/ImageSourceField.vue';
import StatusSlot from '../../components/StatusSlot.vue';

const profile = useProfileStore();
const appearance = ref<Appearance | null>(null),
  savedKey = ref<string | null>(null);
const characters = computed(() => profile.data?.characters || []);
const selected = computed(
  () => characters.value.find((c) => c.id === appearance.value?.characterId) || characters.value[0],
);
const ownArtworks = computed(() => (profile.data?.artworks || []).filter((a) => a.owned));
const key = (value: Appearance | null) =>
  value ? JSON.stringify([value.characterId, value.expression]) : '';
let selectionVersion = 0;
watch(
  () => key(appearance.value),
  () => {
    selectionVersion++;
  },
  { flush: 'sync' },
);
const saveAction = useMutation(),
  sharingAction = useMutation(),
  createAction = useMutation(),
  expressionAction = useMutation();
const { pending: savePending, message: saveMessage, failed: saveFailed } = saveAction;
const { pending: sharePending, message: shareMessage, failed: shareFailed } = sharingAction;
const { pending: createPending, message: createMessage, failed: createFailed } = createAction;
const {
  pending: expressionPending,
  message: expressionMessage,
  failed: expressionFailed,
} = expressionAction;
const createName = ref(''),
  expressionName = ref('');
const createFile = shallowRef<File | null>(null),
  expressionFile = shallowRef<File | null>(null);
const createArtwork = ref<string | null>(null),
  expressionArtwork = ref<string | null>(null);
const createSource = ref<InstanceType<typeof ImageSourceField> | null>(null),
  expressionSource = ref<InstanceType<typeof ImageSourceField> | null>(null);
const createForm = ref<HTMLFormElement | null>(null),
  expressionForm = ref<HTMLFormElement | null>(null),
  templatesOpen = ref(false);
const soundTarget = computed(() => ({
  character: selected.value,
  expression: appearance.value?.expression || 'neutral',
}));
const {
  pending: soundPending,
  message: soundMessage,
  failed: soundFailed,
  file: soundFile,
  input: soundInput,
  sound,
  editable: soundEditable,
  choose: chooseSound,
  upload: uploadSound,
  remove: removeSound,
  preview: previewSound,
} = useExpressionSound(soundTarget, profile.load);
const expressionLabel = (character: Character | undefined, expression: string) =>
  character?.labels[expression] || profile.data?.expressionLabels[expression] || expression;
const groups = computed(() =>
  [
    {
      id: 'builtin-characters',
      title: '內建角色',
      items: characters.value.filter((c) => c.id.startsWith('builtin:')),
      empty: '',
    },
    {
      id: 'my-characters',
      title: '我的作品',
      items: characters.value.filter((c) => c.owned),
      empty: '還沒有作品。可以上傳圖片，或使用下方繪圖工具。',
    },
    {
      id: 'shared-characters',
      title: '好友分享',
      items: characters.value.filter((c) => c.id.startsWith('user:') && !c.owned),
      empty: '目前沒有好友分享的角色。',
    },
  ].map((group) => ({
    ...group,
    items: group.items.map((c) => ({
      id: c.id,
      label: c.name,
      url: c.expressions.neutral || '',
      ariaLabel: '選擇' + c.name + '，' + c.source,
      caption:
        Object.keys(c.expressions).length +
        ' 種表情' +
        (c.id.startsWith('user:')
          ? c.owned
            ? c.shared
              ? ' · 已分享'
              : ' · 僅自己可選'
            : ' · ' + c.source
          : ''),
    })),
  })),
);
const expressions = computed(() =>
  Object.entries(selected.value?.expressions || {}).map(([id, url]) => ({
    id,
    url,
    label: expressionLabel(selected.value, id),
    ariaLabel: '顯示' + expressionLabel(selected.value, id) + '表情',
  })),
);
watch(
  () => profile.data,
  (data) => {
    if (!data) return;
    if (savedKey.value !== null) {
      if (
        appearance.value &&
        !data.characters.some((c) => c.id === appearance.value?.characterId)
      ) {
        appearance.value = { ...data.appearance };
        saveMessage.value = '原角色已無法使用，已切換為可用角色；請重新保存。';
      }
      return;
    }
    appearance.value = { ...data.appearance };
    savedKey.value = key(appearance.value);
    const query = new URLSearchParams(location.search),
      requested = data.characters.find((c) => c.id === query.get('character'));
    if (requested) {
      const expression = query.get('expression') || 'neutral';
      appearance.value = {
        version: 5,
        characterId: requested.id,
        expression: requested.expressions[expression] ? expression : 'neutral',
      };
    }
    const artwork = ownArtworks.value.find((a) => a.id === query.get('artwork'));
    if (artwork) {
      createArtwork.value = expressionArtwork.value = artwork.id;
      templatesOpen.value = true;
      saveMessage.value = `已選擇圖庫作品「${artwork.name}」。可建立主角色，或選擇自己的角色新增表情。`;
    }
  },
);
function chooseCharacter(id: string) {
  appearance.value = { version: 5, characterId: id, expression: 'neutral' };
  saveMessage.value = '已選擇角色，按「保存角色」才會套用。';
  saveFailed.value = false;
}
function chooseExpression(expression: string) {
  if (appearance.value) appearance.value = { ...appearance.value, expression };
  saveMessage.value = '已選擇表情，按「保存角色」才會套用。';
  saveFailed.value = false;
}
async function save(): Promise<boolean> {
  return saveAction.run(async (request) => {
    if (!appearance.value) throw Error('請先選擇角色');
    const draft = { ...appearance.value },
      epoch = selectionVersion;
    const result = readAppearance(
      record(await request('/api/profile/appearance', draft)).appearance,
    );
    savedKey.value = key(result);
    if (profile.data) profile.data = { ...profile.data, appearance: result };
    if (epoch === selectionVersion) {
      appearance.value = result;
      saveMessage.value = '角色已保存，遊戲座位會更新。';
    } else saveMessage.value = '角色已保存，已保留目前的選擇。';
    window.dispatchEvent(new Event('profile-updated'));
  });
}
async function toggleSharing() {
  const character = selected.value;
  if (!character?.owned) return;
  await sharingAction.run(async (request) => {
    await request(`/api/profile/characters/${encodeURIComponent(character.id.slice(5))}/sharing`, {
      shared: !character.shared,
    });
    const loaded = await profile.load();
    shareMessage.value =
      (character.shared ? '已停止分享；選用這位角色的好友會恢復預設角色。' : '已分享到好友圖庫。') +
      (loaded ? '' : '圖庫暫時無法更新，請重新載入。');
  });
}
async function imagePayload(artworkId: string | null, file: File | null) {
  if (artworkId) return { artworkId };
  if (!file) throw Error('請選擇不超過 4 MB 的圖片');
  if (file.type && !['image/png', 'image/gif', 'image/webp'].includes(file.type))
    throw Error('僅接受 PNG、GIF 或 WebP 圖片');
  return { mime: file.type, base64: await fileBase64(file, 4 * 1024 * 1024) };
}
async function createCharacter(): Promise<boolean> {
  let ready = false;
  const completed = await createAction.run(async (request) => {
    const epoch = selectionVersion,
      image = await imagePayload(createArtwork.value, createFile.value);
    const result = record(
      await request('/api/profile/characters', { name: createName.value, ...image }),
    );
    const id = text(result.id);
    if (!id) throw Error('伺服器未回傳新角色資料，請重新載入圖庫確認。');
    createName.value = '';
    createSource.value?.clear();
    ready = await profile.load();
    if (ready && epoch === selectionVersion)
      appearance.value = { version: 5, characterId: id, expression: 'neutral' };
    createMessage.value = '主角色已建立' + (ready ? '' : '；圖庫暫時無法更新，請重新載入後選取。');
    saveMessage.value = '主角色已建立。可繼續新增表情；按「保存角色」後會顯示在遊戲座位。';
  });
  return completed && ready;
}
async function addExpression(): Promise<boolean> {
  let ready = false;
  const completed = await expressionAction.run(async (request) => {
    const character = selected.value;
    if (!character?.owned) throw Error('請先選擇自己的角色');
    const epoch = selectionVersion,
      image = await imagePayload(expressionArtwork.value, expressionFile.value);
    const result = record(
      await request(`/api/profile/characters/${encodeURIComponent(character.id.slice(5))}/emotes`, {
        name: expressionName.value.trim(),
        ...image,
      }),
    );
    const expression = text(result.expression);
    if (!expression) throw Error('伺服器未回傳新表情資料，請重新載入圖庫確認。');
    expressionName.value = '';
    expressionSource.value?.clear();
    ready = await profile.load();
    if (ready && epoch === selectionVersion && appearance.value?.characterId === character.id)
      appearance.value = { ...appearance.value, expression };
    expressionMessage.value =
      '表情圖片已新增' + (ready ? '' : '；圖庫暫時無法更新，請重新載入後選取。');
    saveMessage.value = '表情已新增到角色。若要將它設為預設外觀，再按「保存角色」。';
  });
  return completed && ready;
}
const createDraft = computed(
  () => !!(createName.value.trim() || createFile.value || createArtwork.value),
);
const expressionDraft = computed(
  () => !!(expressionName.value.trim() || expressionFile.value || expressionArtwork.value),
);
const anyPending = computed(
  () =>
    savePending.value ||
    sharePending.value ||
    createPending.value ||
    expressionPending.value ||
    soundPending.value,
);
const dirty = computed(
  () =>
    savedKey.value !== null &&
    (key(appearance.value) !== savedKey.value ||
      createDraft.value ||
      expressionDraft.value ||
      !!soundFile.value ||
      anyPending.value),
);
const leaveDialog = ref<InstanceType<typeof UiDialog> | null>(null),
  leavePending = ref(false),
  leaveMessage = ref('');
let nextUrl: string | null = null,
  allowLeave = false,
  leaveGeneration = 0;
function leave() {
  const url = nextUrl;
  if (!url) return;
  nextUrl = null;
  allowLeave = true;
  leaveDialog.value?.close();
  location.assign(url);
}
async function saveAndLeave() {
  if (leavePending.value || !nextUrl) return;
  const epoch = leaveGeneration,
    active = () => nextUrl !== null && epoch === leaveGeneration;
  leavePending.value = true;
  leaveMessage.value = '正在儲存…';
  try {
    let complete = !anyPending.value;
    if (complete && createDraft.value)
      complete = !!createForm.value?.reportValidity() && (await createCharacter());
    if (!active()) return;
    if (complete && expressionDraft.value)
      complete = !!expressionForm.value?.reportValidity() && (await addExpression());
    if (!active()) return;
    if (complete && soundFile.value) complete = await uploadSound();
    if (!active()) return;
    if (complete && key(appearance.value) !== savedKey.value) complete = await save();
    if (!active()) return;
    if (complete && !dirty.value) leave();
    else leaveMessage.value = '尚未儲存完成。請完成必填欄位，或回到頁面查看錯誤後重試。';
  } catch (error) {
    if (active())
      leaveMessage.value = error instanceof Error ? error.message : '儲存失敗，已保留目前頁面。';
  } finally {
    leavePending.value = false;
  }
}
function interceptLink(event: MouseEvent) {
  const link =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.hasAttribute('download') ||
    (link.target && link.target !== '_self') ||
    !dirty.value
  )
    return;
  const url = new URL(link.href, location.href);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.origin === location.origin &&
      url.pathname === location.pathname &&
      url.search === location.search)
  )
    return;
  event.preventDefault();
  leaveGeneration++;
  nextUrl = url.href;
  leaveMessage.value = '';
  void leaveDialog.value?.open(link);
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!allowLeave && dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
function pageShow() {
  allowLeave = false;
  nextUrl = null;
}
function cancelLeave() {
  leaveGeneration++;
  nextUrl = null;
}
onMounted(() => {
  void profile.load();
  document.addEventListener('click', interceptLink);
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('pageshow', pageShow);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', interceptLink);
  window.removeEventListener('beforeunload', beforeUnload);
  window.removeEventListener('pageshow', pageShow);
});
</script>
<template>
  <div class="page-heading profile-heading">
    <div class="kicker">YOUR LOOK / YOUR SEAT</div>
    <h1>我的角色</h1>
    <p>選用內建角色、好友分享的作品，或親手畫一張。</p>
  </div>
  <div class="profile-load-slot" role="status">
    <span v-if="profile.loading">正在載入角色圖庫…</span>
    <template v-else-if="profile.error">
      <span class="resource-error">{{ profile.error }}</span>
      <UiButton stitch icon="refresh" label="重新載入角色圖庫" @click="profile.load()" />
    </template>
  </div>
  <div class="profile-layout">
    <section class="profile-preview-card" aria-labelledby="profile-preview-title">
      <h2 id="profile-preview-title">角色預覽</h2>
      <div class="profile-preview-image">
        <img
          v-if="selected"
          id="preview"
          :src="
            selected.expressions[appearance?.expression || 'neutral'] ||
            selected.expressions.neutral
          "
          :alt="
            selected.name + '－' + expressionLabel(selected, appearance?.expression || 'neutral')
          "
        />
        <span v-else>正在載入角色…</span>
      </div>
      <p class="profile-preview-name">{{ selected?.name || '選擇今晚的角色' }}</p>
      <section class="profile-expression-section" aria-labelledby="profile-expression-title">
        <h3 id="profile-expression-title">表情</h3>
        <div id="expressions" class="profile-expression-choices">
          <UiButton
            v-for="expression in expressions"
            :key="expression.id"
            stitch
            variant="secondary"
            :label="expression.label"
            :aria-pressed="appearance?.expression === expression.id"
            @click="chooseExpression(expression.id)"
          />
        </div>
      </section>
      <footer class="profile-preview-actions">
        <UiButton
          id="save"
          stitch
          variant="primary"
          icon="save"
          label="保存角色"
          :pending="savePending"
          :disabled="!appearance"
          @click="save"
        />
        <UiLink
          id="open-studio"
          class="profile-studio-link"
          icon="edit"
          label="開啟我的繪畫圖庫"
          href="/studio"
        />
        <StatusSlot id="message" :message="saveMessage" :error="saveFailed" />
      </footer>
      <section
        v-if="appearance?.expression !== 'neutral' && (soundEditable || sound)"
        id="expression-sound"
        class="expression-sound"
        aria-labelledby="expression-sound-heading"
        ><h3 id="expression-sound-heading">表情音效</h3
        ><p id="expression-sound-description"
          >「{{ expressionLabel(selected, appearance?.expression || '') }}」{{
            soundEditable
              ? '送出時可播放一段音效。音效會隨分享角色一起供好友使用。'
              : '的音效由角色作者設定。'
          }}</p
        ><div class="expression-sound-actions"
          ><span id="expression-sound-duration">{{
            sound
              ? `已設定 ${(sound.durationMs / 1000).toFixed(2).replace(/0$/, '')} 秒音效`
              : '尚未設定音效'
          }}</span
          ><UiButton
            stitch
            v-if="sound"
            id="preview-expression-sound"
            icon="sound"
            label="試聽音效"
            :disabled="soundPending"
            @click="previewSound" /><UiButton
            stitch
            v-if="soundEditable && sound"
            id="remove-expression-sound"
            icon="remove"
            label="移除音效"
            :pending="soundPending"
            @click="removeSound" /></div
        ><form
          v-if="soundEditable"
          id="upload-expression-sound"
          class="expression-sound-upload"
          :aria-busy="soundPending"
          @submit.prevent="uploadSound"
          ><label
            >選擇音檔<input
              id="expression-sound-file"
              ref="soundInput"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus"
              :disabled="soundPending"
              @change="
                chooseSound(($event.target as HTMLInputElement).files?.[0] || null)
              " /></label
          ><UiButton
            stitch
            id="save-expression-sound"
            type="submit"
            icon="upload"
            label="上傳音效"
            :pending="soundPending"
          /><p>最多 10 秒、10 MB；超過 10 秒請先縮短。可用格式依瀏覽器支援。</p></form
        ><StatusSlot id="expression-sound-status" :message="soundMessage" :error="soundFailed"
      /></section>
    </section>
    <section class="profile-gallery-card" aria-labelledby="profile-gallery-title">
      <header class="profile-gallery-heading">
        <h2 id="profile-gallery-title">角色圖庫</h2>
        <p>好友分享的角色可以直接選用；只有作者能編輯自己的作品。</p>
      </header>
      <section
        v-for="group in groups"
        :key="group.id"
        class="preset-section"
        :aria-labelledby="group.id + '-title'"
      >
        <h3 :id="group.id + '-title'">{{ group.title }}</h3>
        <ImageChoiceGrid
          :id="group.id"
          :items="group.items"
          :model-value="selected?.id || ''"
          @update:model-value="chooseCharacter"
        />
        <p v-if="!group.items.length && group.empty" class="gallery-empty">{{ group.empty }}</p>
      </section>
      <div v-if="selected?.owned" id="sharing-controls" class="sharing-controls"
        ><span>{{
          selected.shared ? '好友可在圖庫選用這位角色與表情。' : '目前只有你可以選用這位角色。'
        }}</span
        ><UiButton
          stitch
          id="toggle-sharing"
          :icon="selected.shared ? 'lock' : 'users'"
          :label="selected.shared ? '停止分享' : '分享給會員'"
          :pending="sharePending"
          @click="toggleSharing" /></div
      ><StatusSlot
        v-if="selected?.owned || shareMessage"
        :message="shareMessage"
        :error="shareFailed"
      />
    </section>
  </div>
  <details
    :open="templatesOpen"
    class="artist-templates"
    @toggle="templatesOpen = ($event.target as HTMLDetailsElement).open"
    ><summary
      ><span>上傳自己的角色與表情</span
      ><span class="profile-upload-plus" aria-hidden="true">＋</span></summary
    ><p
      >主角色與表情可使用 PNG、GIF、WebP；不限制像素尺寸，每張最多 4
      MB。可以拖放檔案，略過選檔視窗。</p
    >
    <div class="profile-upload-grid">
      <section class="upload-group"
        ><h3>A. 主角色</h3><p>先建立一位角色，主圖片會作為平常顯示的外觀。</p
        ><form
          id="create-character"
          ref="createForm"
          class="character-upload"
          :aria-busy="createPending"
          @submit.prevent="createCharacter"
          ><label
            >角色名稱<input
              id="character-name"
              v-model="createName"
              maxlength="32"
              required
              placeholder="我的角色"
              :disabled="createPending" /></label
          ><ImageSourceField
            ref="createSource"
            v-model:file="createFile"
            v-model:artwork-id="createArtwork"
            input-id="character-file"
            label="主角色圖片"
            :artworks="ownArtworks"
            :disabled="createPending" /><UiButton
            stitch
            type="submit"
            variant="primary"
            label="建立主角色"
            icon="add"
            :pending="createPending" /><StatusSlot
            :message="createMessage"
            :error="createFailed" /></form
      ></section>
      <section class="upload-group"
        ><h3>B. 新增表情</h3
        ><p id="emote-target">{{
          selected?.owned
            ? `正在為「${selected.name}」新增表情（最多 15 個）。`
            : '先從「我的作品」選擇自己的角色。'
        }}</p
        ><form
          v-show="selected?.owned"
          id="upload-expression"
          ref="expressionForm"
          class="character-upload"
          :aria-busy="expressionPending"
          @submit.prevent="addExpression"
          ><label
            >表情名稱（最長 20 字）<input
              id="expression-name"
              v-model="expressionName"
              maxlength="20"
              required
              placeholder="例如：開心大笑"
              :disabled="expressionPending" /></label
          ><ImageSourceField
            ref="expressionSource"
            v-model:file="expressionFile"
            v-model:artwork-id="expressionArtwork"
            input-id="expression-file"
            label="表情圖片"
            :artworks="ownArtworks"
            :disabled="expressionPending" /><UiButton
            stitch
            type="submit"
            variant="primary"
            label="新增表情"
            icon="add"
            :pending="expressionPending" /><StatusSlot
            :message="expressionMessage"
            :error="expressionFailed" /></form
      ></section>
    </div>
  </details>
  <UiDialog
    ref="leaveDialog"
    title="角色檔案尚未儲存"
    compact
    @closing="cancelLeave"
    @closed="cancelLeave"
    ><p>要先儲存變更再離開嗎？</p><StatusSlot :message="leaveMessage" /><div
      class="vue-confirm-actions"
      ><UiButton
        stitch
        label="儲存後離開"
        icon="save"
        :pending="leavePending"
        @click="saveAndLeave" /><UiButton
        stitch
        label="不儲存離開"
        :disabled="leavePending"
        @click="leave" /><UiButton
        stitch
        label="繼續編輯"
        :disabled="leavePending"
        @click="leaveDialog?.close()" /></div
  ></UiDialog>
</template>
