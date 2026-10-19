<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useCommunityStore } from '../../stores/community';
import { useMutation } from '../../composables/mutation';
import { gameNames, typeNames, statusNames, safeIssueUrl } from '../../contracts/community';
import { submitIssue } from '../../services/community-submission';
import ResourcePanel from '../../components/ResourcePanel.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import UiButton from '../../components/UiButton.vue';

const store = useCommunityStore();
const { pending, message, failed, run } = useMutation();
const tab = ref(
  new URLSearchParams(location.search).get('tab') === 'questions' ? 'questions' : 'issues',
);
const query = ref(''),
  category = ref(''),
  status = ref('all'),
  limit = ref(30);
const issue = reactive({ game: 'general', title: '', body: '' });
const question = reactive({
  pack: '朋友共編',
  topic: '',
  type: 'two',
  prompt: '',
  options: ['', '', ''],
});
const replies = reactive<Record<string, string>>({});
const topics = computed(() => store.data?.topics || []);
const categories = computed(() =>
  tab.value === 'issues'
    ? Object.entries(gameNames).map(([id, label]) => ({ id, label }))
    : topics.value,
);
const search = (values: string[]) =>
  values.join(' ').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase());
const issues = computed(() =>
  (store.data?.issues || []).filter(
    (x) =>
      (status.value === 'all' || x.status === status.value) &&
      (!category.value || x.game === category.value) &&
      search([x.title, x.body, x.name]),
  ),
);
const questions = computed(() =>
  (store.data?.questions || []).filter(
    (x) => (!category.value || x.topic === category.value) && search([x.prompt, x.pack, x.author]),
  ),
);
const count = computed(() =>
  tab.value === 'issues' ? issues.value.length : questions.value.length,
);
const date = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '時間不明' : d.toLocaleString('zh-TW');
};
watch(
  () => store.data,
  (data) => {
    if (data && !question.topic)
      question.topic = data.topics.find((t) => t.id !== 'cruel')?.id || '';
  },
);
watch(tab, (value) => {
  category.value = '';
  limit.value = 30;
  history.replaceState(null, '', '/community?tab=' + value);
});

async function refresh(success: string) {
  message.value = success + ((await store.load()) ? '' : '；清單暫時無法更新，請重新載入。');
}
async function publishIssue() {
  await run(async (request) => {
    if (await submitIssue(request, { ...issue }, 'ah-issue-submit')) {
      issue.game = 'general';
      issue.title = issue.body = '';
      await refresh('留言與 GitHub Issue 已建立');
    } else message.value = 'GitHub 結果尚待確認，管理者處理後可用同一表單查詢。';
  });
}
async function publishQuestion() {
  await run(async (request) => {
    await request('/api/community/questions', {
      ...question,
      name: store.data?.name || '朋友',
      options:
        question.type === 'blank' ? [] : question.options.slice(0, question.type === 'two' ? 2 : 3),
    });
    question.prompt = '';
    question.options = ['', '', ''];
    await refresh('已加入共用題庫');
  });
}
async function comment(id: string) {
  await run(async (request) => {
    if (
      await submitIssue(request, { id, action: 'comment', body: replies[id] }, 'ah-comment-' + id)
    ) {
      replies[id] = '';
      await refresh('回覆已同步到 GitHub');
    } else message.value = 'GitHub 結果尚待確認，管理者處理後可用同一表單查詢。';
  });
}
async function changeStatus(id: string, nextStatus: string) {
  await run(async (request) => {
    if (await submitIssue(request, { id, action: 'status', status: nextStatus }, 'ah-status-' + id))
      await refresh('留言狀態已更新');
    else message.value = 'GitHub 結果尚待確認，管理者處理後可用同一表單查詢。';
  });
}
function save(id: string) {
  try {
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem('ah-question-favorites') || '[]');
    } catch {
      saved = [];
    }
    const ids = Array.isArray(saved)
      ? saved.filter((value): value is string => typeof value === 'string')
      : [];
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem('ah-question-favorites', JSON.stringify(ids));
    failed.value = false;
    message.value = '已收藏，出題時可從「我的收藏」挑選';
  } catch {
    failed.value = true;
    message.value = '瀏覽器暫時無法儲存收藏，請檢查儲存空間設定。';
  }
}
onMounted(() => void store.load());
</script>

<template>
  <div class="eyebrow">MADE BY FRIENDS</div>
  <h1 id="pageTitle">{{ tab === 'issues' ? '把想法留給朋友。' : '大家一起，擴充同頻題庫。' }}</h1>
  <p id="pageIntro" class="community-intro">{{
    tab === 'issues'
      ? '像 issue 一樣記錄問題與建議，附上遊戲標籤、回覆及處理狀態。'
      : '找一題、存成自己的清單，或寫下大家有感的台灣生活問題。'
  }}</p>
  <div class="tabs" role="group" aria-label="共編內容">
    <button
      id="issuesTab"
      :class="{ on: tab === 'issues' }"
      :aria-pressed="tab === 'issues'"
      :disabled="pending"
      @click="tab = 'issues'"
      >留言板</button
    >
    <button
      id="questionsTab"
      :class="{ on: tab === 'questions' }"
      :aria-pressed="tab === 'questions'"
      :disabled="pending"
      @click="tab = 'questions'"
      >自選題庫</button
    >
  </div>
  <section class="card resource-compose community-compose">
    <label for="nickname">登入暱稱</label
    ><input
      id="nickname"
      :value="store.data?.name || ''"
      readonly
      placeholder="正在讀取會員資料…"
    />
    <form
      v-if="tab === 'issues'"
      id="issueForm"
      :aria-busy="pending"
      @submit.prevent="publishIssue"
    >
      <fieldset :disabled="pending || !store.data">
        <div class="fields"
          ><label
            >標題<input
              id="issueTitle"
              v-model="issue.title"
              required
              maxlength="100"
              placeholder="問題、建議、想玩的新功能" /></label
          ><label
            >遊戲標籤<select id="issueGame" v-model="issue.game"
              ><option v-for="(label, id) in gameNames" :key="id" :value="id">{{
                label
              }}</option></select
            ></label
          ></div
        >
        <label
          >內容<textarea
            id="issueBody"
            v-model="issue.body"
            required
            maxlength="3000"
            placeholder="發生了什麼？希望怎麼調整？"
          ></textarea>
        </label>
        <p class="small">送出後，標題與內容會公開到 stanley021039/BGA 的 GitHub Issues。</p>
      </fieldset>
    </form>
    <form v-else id="questionForm" :aria-busy="pending" @submit.prevent="publishQuestion">
      <fieldset :disabled="pending || !store.data">
        <div class="fields"
          ><label
            >題庫名稱<input
              id="pack"
              v-model="question.pack"
              maxlength="40"
              required
              placeholder="例如：我們的下班日常" /></label
          ><label
            >分類<select id="questionTopic" v-model="question.topic"
              ><option
                v-for="topic in topics.filter((t) => t.id !== 'cruel')"
                :key="topic.id"
                :value="topic.id"
                >{{ topic.label }}</option
              ></select
            ></label
          ></div
        >
        <label
          >題型<select id="questionType" v-model="question.type"
            ><option v-for="(label, id) in typeNames" :key="id" :value="id">{{
              label
            }}</option></select
          ></label
        >
        <label
          >題目<textarea
            id="questionPrompt"
            v-model="question.prompt"
            required
            maxlength="160"
          ></textarea>
        </label>
        <div id="questionOptions" class="community-options"
          ><p v-if="question.type === 'blank'" class="small"
            >填空題請問具體的單一答案，讓朋友容易同頻。</p
          ><label
            v-for="index in question.type === 'blank' ? 0 : question.type === 'two' ? 2 : 3"
            :key="index"
            >選項 {{ ['A', 'B', 'C'][index - 1]
            }}<input v-model="question.options[index - 1]" required maxlength="60" /></label
        ></div>
        <p class="small">不設定標準答案。新增的題目會保存於主機，所有朋友都能挑選或隨機抽到。</p>
      </fieldset>
    </form>
    <UiButton
      stitch
      variant="primary"
      type="submit"
      :form="tab === 'issues' ? 'issueForm' : 'questionForm'"
      class="wide"
      :disabled="!store.data"
      :pending="pending"
      :label="tab === 'issues' ? '建立留言' : '加入共用題庫'"
      icon="add"
    />
    <StatusSlot class="resource-status" :message="message" :error="failed" />
  </section>
  <ResourcePanel
    class="browse"
    :loading="store.loading"
    :error="store.error"
    :empty="!count"
    @retry="store.load()"
  >
    <template #heading
      ><h2>{{ tab === 'issues' ? '大家的留言' : '共用題庫' }}</h2></template
    >
    <template #filters>
      <div
        v-show="tab === 'issues'"
        id="issueStatusFilters"
        class="ui-control-row"
        role="group"
        aria-label="留言處理狀態篩選"
        ><button
          v-for="(label, value) in { ...statusNames, all: '全部' }"
          :key="value"
          type="button"
          class="button outline"
          :aria-pressed="status === value"
          :disabled="pending"
          @click="
            status = String(value);
            limit = 30;
          "
          >{{ label }}</button
        ></div
      >
      <div class="fields"
        ><input
          id="search"
          v-model="query"
          placeholder="搜尋標題、題目或題庫名稱"
          aria-label="搜尋"
          :disabled="pending"
          @input="limit = 30"
        /><select
          id="filter"
          v-model="category"
          aria-label="分類篩選"
          :disabled="pending"
          @change="limit = 30"
          ><option value="">全部分類</option
          ><option v-for="item in categories" :key="item.id" :value="item.id">{{
            item.label
          }}</option></select
        ></div
      >
    </template>
    <template #summary
      ><span id="resultCount"
        >{{ count }} {{ tab === 'issues' ? '則留言' : '道題目' }}</span
      ></template
    >
    <div id="items">
      <template v-if="tab === 'issues'">
        <article v-for="item in issues.slice(0, limit)" :key="item.id" class="issue-item">
          <div class="issue-meta"
            ><span class="ui-badge tag">{{ gameNames[item.game] || '其他' }}</span
            ><span class="ui-badge tag" :class="item.status">{{
              statusNames[item.status] || '待處理'
            }}</span
            ><span>{{ item.name }} · {{ date(item.at) }}</span></div
          >
          <h3>{{ item.title }}</h3
          ><a
            v-if="safeIssueUrl(item.githubUrl)"
            :href="safeIssueUrl(item.githubUrl)"
            target="_blank"
            rel="noopener noreferrer"
            >查看 GitHub Issue ↗</a
          ><p class="issue-body">{{ item.body }}</p>
          <details
            ><summary>{{ item.comments.length }} 則回覆</summary
            ><div class="comments"
              ><div v-for="(reply, index) in item.comments" :key="index" class="comment"
                ><b>{{ reply.name }}</b
                ><small> · {{ date(reply.at) }}</small
                ><div>{{ reply.body }}</div></div
              ></div
            ><form class="comment-form" @submit.prevent="comment(item.id)"
              ><input
                v-model="replies[item.id]"
                maxlength="1000"
                required
                placeholder="留下回覆"
                :aria-label="'回覆 ' + item.title"
                :disabled="pending"
              /><button class="button outline" :disabled="pending" :aria-busy="pending"
                >送出</button
              ></form
            ></details
          >
          <div
            v-if="store.data?.admin && safeIssueUrl(item.githubUrl)"
            class="ui-control-row issue-status-actions"
            ><button
              v-for="(label, value) in statusNames"
              v-show="value !== item.status"
              :key="value"
              type="button"
              class="quiet"
              :disabled="pending"
              @click="changeStatus(item.id, String(value))"
              >標記{{ label }}</button
            ></div
          >
        </article>
      </template>
      <template v-else>
        <article v-for="item in questions.slice(0, limit)" :key="item.id" class="library-item"
          ><div class="issue-meta"
            ><span class="ui-badge tag">{{ typeNames[item.type] }}</span
            ><span>{{ topics.find((t) => t.id === item.topic)?.label || '日常' }}</span
            ><span>{{ item.pack || '內建生活題庫' }} · {{ item.author || 'Afterhours' }}</span></div
          ><h3>{{ item.prompt }}</h3
          ><p>{{ item.options.join(' ／ ') || '大家各自填一個答案' }}</p
          ><div class="library-actions"
            ><button class="quiet" :disabled="pending" @click="save(item.id)"
              >收藏到我的清單 ♡</button
            ></div
          ></article
        >
      </template>
    </div>
    <template #actions
      ><button
        id="more"
        class="button outline"
        :hidden="count <= limit"
        :disabled="pending"
        @click="limit += 30"
        >載入更多</button
      ></template
    >
  </ResourcePanel>
</template>
