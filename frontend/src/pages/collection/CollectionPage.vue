<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useProfileStore } from '../../stores/profile';
import { useMusicStore } from '../../stores/libraries';
import { usePreferencesStore } from '../../stores/preferences';
import { useMutation } from '../../composables/mutation';
import { avatarKey, readSettings } from '../../contracts/profile';
import type { Avatar } from '../../contracts/profile';
import ResourcePanel from '../../components/ResourcePanel.vue';
import CollectionCard from '../../components/CollectionCard.vue';
import CollectionUpload from '../../components/CollectionUpload.vue';
import AudioPreview from '../../components/AudioPreview.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiTabs from '../../components/UiTabs.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import FrameChoices from '../../components/FrameChoices.vue';
import EntranceChoices from '../../components/EntranceChoices.vue';
import { entranceEffects } from '../../services/entrance-effects';
import ConfirmDialog from '../../components/ConfirmDialog.vue';

const profile = useProfileStore(),
  music = useMusicStore(),
  prefs = usePreferencesStore();
const { pending, message, failed, run } = useMutation();
const activeAction = ref('');
const names = ['avatars', 'characters', 'music', 'frames', 'entrance'] as const;
type Section = (typeof names)[number];
function sectionFromUrl(): Section {
  const value = new URLSearchParams(location.search).get('section');
  return names.includes(value as Section) ? (value as Section) : 'avatars';
}
const section = ref<Section>(sectionFromUrl());
const filters = reactive({
  avatars: { query: '', source: 'all' },
  characters: { query: '', source: 'all' },
  music: { query: '', source: 'all' },
});
const frameQuery = ref(''),
  frameGroup = ref('all');
const confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const frameGroups = computed(() => [...new Set(prefs.frames.map((f) => f.group || '經典內建'))]);
const characters = computed(() =>
  (profile.data?.characters || []).map((c) => ({
    ...c,
    origin: c.id.startsWith('builtin:') ? 'builtin' : c.owned ? 'mine' : 'shared',
  })),
);
const avatars = computed(() => [
  ...characters.value
    .filter((c) => c.origin === 'builtin')
    .map((c) => ({
      id: c.id,
      name: c.name,
      origin: 'builtin',
      owned: false,
      shared: false,
      author: '',
      url: c.expressions.neutral || '',
      value: { kind: 'character', characterId: c.id, expression: 'neutral' } as Avatar,
    })),
  ...(profile.data?.artworks || []).map((a) => ({
    ...a,
    origin: a.owned ? 'mine' : 'shared',
    value: { kind: 'artwork', artworkId: a.id } as Avatar,
  })),
]);
function matches(name: string, origin: string, key: 'avatars' | 'characters' | 'music') {
  const f = filters[key];
  return (
    (f.source === 'all' || f.source === origin) &&
    name.toLocaleLowerCase().includes(f.query.trim().toLocaleLowerCase())
  );
}
const foundAvatars = computed(() =>
  avatars.value.filter((a) => matches(a.name, a.origin, 'avatars')),
);
const foundCharacters = computed(() =>
  characters.value.filter((c) => matches(c.name, c.origin, 'characters')),
);
const tracks = computed(() =>
  (music.data?.tracks || []).filter((t) =>
    matches(t.title, t.ownerId === music.data?.me ? 'mine' : 'shared', 'music'),
  ),
);
const tabs = computed(() => [
  { id: 'avatars', label: '頭像', count: profile.data ? avatars.value.length + ' 張' : '讀取中…' },
  {
    id: 'characters',
    label: '角色',
    count: profile.data ? characters.value.length + ' 位' : '讀取中…',
  },
  { id: 'music', label: '音樂', count: music.data ? music.data.tracks.length + ' 首' : '讀取中…' },
  { id: 'frames', label: '彈幕框', count: prefs.frames.length + ' 款' },
  { id: 'entrance', label: '進場特效', count: entranceEffects.length + ' 款' },
]);
const duration = (seconds: number) =>
  Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
const originLabel = (origin: string, shared: boolean) =>
  origin === 'builtin'
    ? '內建'
    : origin === 'mine'
      ? shared
        ? '我的 · 已分享'
        : '我的 · 私人'
      : '朋友分享';
const encoded = encodeURIComponent;
function activate(id: string, updateUrl = true) {
  if (!names.includes(id as Section)) return;
  if (id !== 'music')
    for (const audio of document.querySelectorAll<HTMLAudioElement>('.collection-page audio'))
      audio.pause();
  section.value = id as Section;
  if (updateUrl) {
    const query = new URLSearchParams(location.search);
    query.set('section', id);
    history.replaceState(null, '', location.pathname + '?' + query + location.hash);
  }
}
function popstate() {
  activate(sectionFromUrl(), false);
}
async function refresh() {
  await Promise.all([profile.load(), music.load()]);
}
async function runAction(key: string, operation: Parameters<typeof run>[0], success = '') {
  if (pending.value) return;
  activeAction.value = key;
  try {
    await run(operation, success);
  } finally {
    activeAction.value = '';
  }
}
async function useAvatar(avatar: Avatar) {
  await runAction(
    'avatar:' + avatarKey(avatar),
    async (request) => {
      const current = readSettings(await request('/api/profile/settings'));
      const saved = readSettings(
        await request('/api/profile/settings', { appearance: current.appearance, avatar }),
      );
      if (profile.data) profile.data = { ...profile.data, ...saved };
      window.dispatchEvent(new Event('profile-updated'));
    },
    '頭像已套用。',
  );
}
async function useCharacter(id: string) {
  await runAction(
    'character:' + id,
    async (request) => {
      await request('/api/profile/appearance', {
        version: 5,
        characterId: id,
        expression: 'neutral',
      });
      const saved = readSettings(await request('/api/profile/settings'));
      if (profile.data) profile.data = { ...profile.data, ...saved };
      window.dispatchEvent(new Event('profile-updated'));
    },
    '角色已套用。',
  );
}
async function share(kind: 'avatar' | 'character', id: string, name: string, shared: boolean) {
  if (
    shared &&
    !(await confirmation.value?.ask(
      `停止分享「${name}」？使用這${kind === 'avatar' ? '張頭像' : '位角色'}的朋友會恢復預設圖片。`,
      '停止分享',
    ))
  )
    return;
  await runAction(kind + ':share:' + id, async (request) => {
    await request(
      kind === 'avatar'
        ? `/api/artworks/${encoded(id)}/sharing`
        : `/api/profile/characters/${encoded(id.slice(5))}/sharing`,
      { shared: !shared },
    );
    const loaded = await profile.load();
    message.value =
      (shared ? '已停止分享。' : '已分享給會員。') +
      (loaded ? '' : '清單暫時無法更新，請重新載入。');
  });
}
async function remove(kind: 'avatar' | 'character' | 'music', id: string, name: string) {
  const warning =
    kind === 'music'
      ? '使用它的桌子會停止播放。'
      : kind === 'character'
        ? '所有表情也會刪除，使用它的玩家會恢復預設角色。'
        : '使用它的頭像會回到角色圖片，已建立的角色副本會保留。';
  if (!(await confirmation.value?.ask(`刪除「${name}」？${warning}`, '確認刪除'))) return;
  await runAction(kind + ':delete:' + id, async (request) => {
    const path =
      kind === 'avatar'
        ? `/api/artworks/${encoded(id)}/delete`
        : kind === 'character'
          ? `/api/profile/characters/${encoded(id.slice(5))}/delete`
          : `/api/music/${encoded(id)}/delete`;
    await request(path, {});
    const loaded = await (kind === 'music' ? music.load() : profile.load());
    message.value = '已刪除。' + (loaded ? '' : '清單暫時無法更新，請重新載入。');
    if (kind !== 'music') window.dispatchEvent(new Event('profile-updated'));
  });
}
function frameSelected(id: string) {
  message.value = (prefs.frames.find((f) => f.id === id)?.label || '彈幕框') + '已套用。';
  failed.value = false;
}
onMounted(() => {
  void refresh();
  window.addEventListener('popstate', popstate);
});
onBeforeUnmount(() => {
  window.removeEventListener('popstate', popstate);
  for (const audio of document.querySelectorAll<HTMLAudioElement>('.collection-page audio'))
    audio.pause();
});
</script>

<template>
  <div class="collection-heading"
    ><h1>收藏庫</h1
    ><UiButton legacy
      id="collection-refresh"
      class="page-button"
      icon="refresh"
      icon-only
      label="重新整理"
      :pending="profile.loading || music.loading"
      @click="refresh"
  /></div>
  <p>管理自己的頭像、角色、音樂與彈幕框，也能選用朋友分享的收藏。</p>
  <StatusSlot
    id="collection-message"
    :message="pending ? '正在處理…' : profile.error || music.error || message"
    :error="!pending && (failed || !!profile.error || !!music.error)"
  />
  <UiTabs
    id="collection-tabs"
    class="collection-tabs"
    :items="tabs"
    :model-value="section"
    label="收藏類型"
    id-prefix="collection-tab"
    panel-prefix="section"
    @update:model-value="activate"
  />
  <ResourcePanel
    v-show="section === 'avatars'"
    id="section-avatars"
    class="collection-section"
    role="tabpanel"
    aria-labelledby="collection-tab-avatars"
    :loading="profile.loading && !profile.data"
    :error="profile.data ? '' : profile.error"
    @retry="profile.load()"
  >
    <template #heading><h2>頭像</h2></template>
    <template #filters
      ><div class="collection-tools"
        ><input
          id="avatars-search"
          v-model="filters.avatars.query"
          placeholder="搜尋頭像"
          aria-label="搜尋頭像"
        /><select id="avatars-filter" v-model="filters.avatars.source" aria-label="頭像來源篩選"
          ><option value="all">全部</option
          ><option value="mine">我的</option
          ><option value="shared">朋友分享</option
          ><option value="builtin">內建</option></select
        ><a href="/studio?from=collection&amp;section=avatars">網頁繪製頭像</a></div
      ></template
    >
    <template #summary>{{ foundAvatars.length }} 張頭像</template>
    <details class="collection-editor"
      ><summary>上傳圖片</summary
      ><CollectionUpload id="avatar-upload" kind="avatar" :reload="profile.load"
    /></details>
    <div id="avatars-grid" class="collection-grid"
      ><CollectionCard
        v-for="item in foundAvatars"
        :key="item.id"
        :title="item.name"
        :image="item.url"
        :metadata="originLabel(item.origin, item.shared)"
        avatar
        :selected="!!profile.data && avatarKey(item.value) === avatarKey(profile.data.avatar)"
      >
        <UiButton legacy
          label="設為頭像"
          icon="check"
          icon-only
          :disabled="pending"
          :pending="activeAction === 'avatar:' + avatarKey(item.value)"
          @click="useAvatar(item.value)"
        /><UiLink label="預覽原圖" icon="expand" icon-only :href="item.url" />
        <template v-if="item.owned"
          ><UiLink
            label="繪圖編輯"
            icon="edit"
            icon-only
            :href="'/studio?artwork=' + encoded(item.id) + '&from=collection'" /><UiButton legacy
            :label="item.shared ? '停止分享' : '分享給會員'"
            :icon="item.shared ? 'lock' : 'users'"
            icon-only
            :disabled="pending"
            :pending="activeAction === 'avatar:share:' + item.id"
            @click="share('avatar', item.id, item.name, item.shared)" /><UiButton legacy
            label="刪除"
            icon="remove"
            icon-only
            :disabled="pending"
            :pending="activeAction === 'avatar:delete:' + item.id"
            @click="remove('avatar', item.id, item.name)"
        /></template> </CollectionCard
      ><p v-if="!foundAvatars.length" class="collection-empty">沒有符合的頭像。</p></div
    >
  </ResourcePanel>
  <ResourcePanel
    v-show="section === 'characters'"
    id="section-characters"
    class="collection-section"
    role="tabpanel"
    aria-labelledby="collection-tab-characters"
    :loading="profile.loading && !profile.data"
    :error="profile.data ? '' : profile.error"
    @retry="profile.load()"
  >
    <template #heading><h2>角色</h2></template>
    <template #filters
      ><div class="collection-tools"
        ><input
          id="characters-search"
          v-model="filters.characters.query"
          placeholder="搜尋角色"
          aria-label="搜尋角色"
        /><select
          id="characters-filter"
          v-model="filters.characters.source"
          aria-label="角色來源篩選"
          ><option value="all">全部</option
          ><option value="mine">我的</option
          ><option value="shared">朋友分享</option
          ><option value="builtin">內建</option></select
        ><a href="/studio?from=collection&amp;section=characters">網頁繪製角色</a></div
      ></template
    >
    <template #summary>{{ foundCharacters.length }} 位角色</template>
    <details class="collection-editor"
      ><summary>上傳角色主圖</summary
      ><CollectionUpload id="character-upload" kind="character" :reload="profile.load"
    /></details>
    <details class="collection-editor"
      ><summary>用收藏圖片建立角色</summary
      ><CollectionUpload
        id="character-create"
        kind="from-artwork"
        :artworks="profile.data?.artworks"
        :reload="profile.load"
      /><p
        >先繪製或上傳圖片到頭像收藏，再選圖片建立角色；表情可在角色卡片的「預覽／表情」中新增。</p
      ></details
    >
    <div id="characters-grid" class="collection-grid"
      ><CollectionCard
        v-for="item in foundCharacters"
        :key="item.id"
        :title="item.name"
        :image="item.expressions.neutral"
        :metadata="
          originLabel(item.origin, item.shared) +
          ' · ' +
          Object.keys(item.expressions).length +
          ' 種表情'
        "
        :selected="profile.data?.appearance.characterId === item.id"
      >
        <UiButton legacy
          label="使用角色"
          icon="check"
          icon-only
          :disabled="pending"
          :pending="activeAction === 'character:' + item.id"
          @click="useCharacter(item.id)"
        /><UiLink
          label="預覽／表情"
          icon="expand"
          icon-only
          :href="'/profile?character=' + encoded(item.id)"
        />
        <template v-if="item.owned"
          ><UiButton legacy
            :label="item.shared ? '停止分享' : '分享給會員'"
            :icon="item.shared ? 'lock' : 'users'"
            icon-only
            :disabled="pending"
            :pending="activeAction === 'character:share:' + item.id"
            @click="share('character', item.id, item.name, item.shared)" /><UiButton legacy
            label="刪除"
            icon="remove"
            icon-only
            :disabled="pending"
            :pending="activeAction === 'character:delete:' + item.id"
            @click="remove('character', item.id, item.name)"
        /></template> </CollectionCard
      ><p v-if="!foundCharacters.length" class="collection-empty">沒有符合的角色。</p></div
    >
  </ResourcePanel>
  <ResourcePanel
    v-show="section === 'music'"
    id="section-music"
    class="collection-section"
    role="tabpanel"
    aria-labelledby="collection-tab-music"
    :loading="music.loading && !music.data"
    :error="music.data ? '' : music.error"
    @retry="music.load()"
  >
    <template #heading><h2>音樂</h2></template>
    <template #filters
      ><div class="collection-tools"
        ><input
          id="music-search"
          v-model="filters.music.query"
          placeholder="搜尋音樂"
          aria-label="搜尋音樂"
        /><select id="music-filter" v-model="filters.music.source" aria-label="音樂來源篩選"
          ><option value="all">全部</option
          ><option value="mine">我的</option
          ><option value="shared">朋友分享</option></select
        ></div
      ></template
    >
    <template #summary>{{ tracks.length }} 首音樂</template>
    <details class="collection-editor"
      ><summary>上傳音樂</summary
      ><CollectionUpload id="music-upload" kind="music" :reload="music.load"
    /></details>
    <p>上傳後所有會員都可在遊戲桌選曲播放，也可在收藏庫試聽。請分享你有權公開播放的音樂。</p>
    <div id="music-grid" class="collection-grid"
      ><CollectionCard
        v-for="item in tracks"
        :key="item.id"
        :title="item.title"
        :metadata="item.author + ' · ' + duration(item.duration) + ' · 會員共用'"
        ><template #preview
          ><AudioPreview :src="'/assets/music/' + encoded(item.id)" :title="item.title" /></template
        ><UiButton legacy
          v-if="item.ownerId === music.data?.me || music.data?.admin"
          label="刪除"
          icon="remove"
          icon-only
          :disabled="pending"
          :pending="activeAction === 'music:delete:' + item.id"
          @click="remove('music', item.id, item.title)" /></CollectionCard
      ><p v-if="!tracks.length" class="collection-empty">沒有符合的音樂。</p></div
    >
  </ResourcePanel>
  <ResourcePanel
    v-show="section === 'frames'"
    id="section-frames"
    class="collection-section"
    role="tabpanel"
    aria-labelledby="collection-tab-frames"
  >
    <template #heading><h2>彈幕框</h2></template>
    <template #filters
      ><div class="collection-tools"
        ><input
          id="frames-search"
          v-model="frameQuery"
          type="search"
          placeholder="搜尋彈幕框"
          aria-label="搜尋彈幕框"
        /><select id="frames-filter" v-model="frameGroup" aria-label="彈幕框風格"
          ><option value="all">全部風格</option
          ><option v-for="group in frameGroups" :key="group">{{ group }}</option></select
        ><label class="barrage-frame-motion"
          ><input
            id="frames-motion"
            type="checkbox"
            :checked="prefs.motion?.enabled !== false && !prefs.motion?.reduced"
            :disabled="prefs.motion?.reduced"
            @change="prefs.setMotion(($event.target as HTMLInputElement).checked)"
          />播放動態效果（共用設定）</label
        ></div
      ></template
    >
    <template #summary
      ><span>{{
        prefs.motion?.reduced
          ? '依裝置的減少動態設定顯示靜態框飾。'
          : '點選即套用至這個瀏覽器的遊戲彈幕。'
      }}</span></template
    >
    <p>4 款經典與 20 款全新動態框，全部可直接使用。</p
    ><FrameChoices legacy
      id="frames-grid"
      :query="frameQuery"
      :group="frameGroup"
      @select="frameSelected"
    />
  </ResourcePanel>
  <ResourcePanel
    v-show="section === 'entrance'"
    id="section-entrance"
    class="collection-section"
    role="tabpanel"
    aria-labelledby="collection-tab-entrance"
  >
    <template #heading><h2>進場特效</h2></template>
    <template #summary
      ><span>{{
        prefs.motion?.reduced || prefs.motion?.enabled === false
          ? '目前關閉動態效果，預覽不會播放；選擇仍會套用。'
          : '點選即套用並預覽；進入好友大廳時，大家都會看到你的進場特效。'
      }}</span></template
    >
    <EntranceChoices />
  </ResourcePanel>
  <ConfirmDialog legacy ref="confirmation" />
</template>
