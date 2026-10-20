<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useWordsStore } from '../../stores/libraries';
import { useMutation } from '../../composables/mutation';
import { record, text } from '../../services/validation';
import ResourcePanel from '../../components/ResourcePanel.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import UiButton from '../../components/UiButton.vue';
const store = useWordsStore();
const { pending, message, failed, run } = useMutation();
const query = ref(''), topic = ref(''), source = ref('all'), limit = ref(60);
const draft = reactive({ title: '', aliases: '', topic: '', difficulty: 'easy' });
const topics = computed(() => [...(store.data?.topics || []), { id: 'misc', label: '綜合' }]);
const normalized = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('zh-Hant');
const found = computed(() => [...(store.data?.custom || []), ...(store.data?.builtin || [])].filter(word =>
  (!topic.value || word.topic === topic.value) && (source.value === 'all' || (source.value === 'custom') === word.custom) &&
  [word.title, ...word.aliases].some(value => normalized(value).includes(normalized(query.value)))));
async function submit() {
  await run(async request => {
    const result = record(await request('/api/draw/words', { ...draft, aliases: draft.aliases.split(/[，,]/u).map(x => x.trim()).filter(Boolean) }));
    draft.title = draft.aliases = draft.topic = ''; draft.difficulty = 'easy';
    const loaded = await store.load();
    message.value = '已加入「' + text(result.title) + '」' + (loaded ? '' : '；清單暫時無法更新，請重新載入。');
  });
}
onMounted(() => void store.load());
</script>

<template>
  <section class="card resource-compose"><span class="eyebrow">ADD A WORD</span><h1>留一個畫得出來的題目。</h1><p>好友投稿會加入選題池。題目與別名在遊戲揭曉前只給畫者看。</p>
    <form id="wordForm" @submit.prevent="submit" :aria-busy="pending">
      <label>題目（最多 24 字）<input v-model="draft.title" name="title" maxlength="24" required placeholder="例如：腳踏車" :disabled="pending"></label>
      <label>可接受別名（最多 5 個，以逗號分隔）<input v-model="draft.aliases" name="aliases" placeholder="例如：自行車，單車" :disabled="pending"></label>
      <fieldset :disabled="pending"><legend>題材</legend><div class="option-row"><label v-for="item in topics" :key="item.id"><input v-model="draft.topic" type="radio" name="topic" :value="item.id" required><span>{{ item.label }}</span></label></div></fieldset>
      <fieldset :disabled="pending"><legend>難度</legend><div class="option-row"><label v-for="item in [{id:'easy',label:'簡單'},{id:'medium',label:'一般'},{id:'hard',label:'挑戰'}]" :key="item.id"><input v-model="draft.difficulty" type="radio" name="difficulty" :value="item.id"><span>{{ item.label }}</span></label></div></fieldset>
    </form><UiButton stitch variant="primary" type="submit" form="wordForm" class="wide" icon="next" label="加入好友題庫" :pending="pending" :disabled="pending" /><StatusSlot id="wordStatus" class="resource-status" :message="message" :error="failed" />
  </section>
  <ResourcePanel class="card" :loading="store.loading" :error="store.error" :empty="!found.length" empty-label="沒有符合的題目。" @retry="store.load()">
    <template #heading><span class="eyebrow">THE WORD BANK</span><h2>大家的題目</h2><p id="wordCount">{{ store.data ? `${store.data.builtin.length} 個內建題目 · ${store.data.custom.length} 個好友投稿` : '正在讀取題庫…' }}</p></template>
    <template #filters><div class="word-filters"><label>搜尋題目<input id="wordSearch" v-model="query" type="search" placeholder="題目或別名" @input="limit=60"></label><label>題材<select id="wordTopicFilter" v-model="topic" @change="limit=60"><option value="">全部題材</option><option v-for="item in topics" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>來源<select id="wordSourceFilter" v-model="source" @change="limit=60"><option value="all">全部題目</option><option value="builtin">內建題目</option><option value="custom">好友投稿</option></select></label></div></template>
    <template #summary><span id="wordResultCount">{{ found.length }} 題符合條件</span></template>
    <div id="wordList" class="word-list resource-word-list"><article v-for="word in found.slice(0,limit)" :key="`${word.custom}:${word.id || word.title}`"><strong>{{ word.title }}</strong><span>{{ word.topicLabel }} · {{ word.category }} · {{ word.custom ? word.authorName : word.memeKind==='original' ? '本站原創梗圖情境' : '內建' }}<template v-if="word.aliases.length"> · 別名：{{ word.aliases.join('、') }}</template></span></article></div>
    <template #actions><button id="wordMore" type="button" class="button outline" :hidden="found.length<=limit" @click="limit+=60">載入更多</button></template>
  </ResourcePanel>
</template>
