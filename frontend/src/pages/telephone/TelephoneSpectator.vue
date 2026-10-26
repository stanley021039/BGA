<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { readTelephoneSnapshot, type TelephoneSnapshot } from '../../contracts/telephone';
import { requestJson } from '../../services/http';
import TelephoneCanvas from '../../components/TelephoneCanvas.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import UiButton from '../../components/UiButton.vue';
import UiPanel from '../../components/UiPanel.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import '../../styles/telephone.scss';

const props = defineProps<{ code: string }>(),
  emit = defineEmits<{ leave: [] }>(),
  state = ref<TelephoneSnapshot | null>(null),
  error = ref('正在連接觀戰畫面…'),
  now = ref(Date.now()),
  offset = ref(0),
  phase = computed(() => {
    switch (state.value?.phase) {
      case 'waiting':
        return '等待房主開始';
      case 'prompting':
        return '玩家正在想主題';
      case 'passing':
        return `第 ${state.value.round}／${state.value.roundLimit} 頁傳遞中`;
      case 'finished':
        return state.value.interrupted ? '傳遞中止，查看已送出的頁面' : '本局已結束';
      default:
        return '正在載入房間';
    }
  });
let timer: ReturnType<typeof setTimeout> | null = null,
  clock: ReturnType<typeof setInterval> | null = null,
  controller: AbortController | null = null,
  disposed = false,
  busy = false;

async function refresh() {
  if (disposed || busy || document.hidden) return;
  busy = true;
  controller = new AbortController();
  try {
    const value = await requestJson('/api/telephone/watch?code=' + encodeURIComponent(props.code), {
      signal: controller.signal,
    });
    if (!disposed) {
      state.value = readTelephoneSnapshot(value);
      now.value = Date.now();
      offset.value = now.value - state.value.serverNow;
      error.value = '';
    }
  } catch (cause) {
    if (!disposed && !(cause instanceof DOMException && cause.name === 'AbortError'))
      error.value = cause instanceof Error ? cause.message : '觀戰連線中斷，正在重試。';
  } finally {
    busy = false;
    controller = null;
    if (!disposed && !document.hidden) timer = setTimeout(refresh, 2500);
  }
}
function visibility() {
  if (document.hidden) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (clock) clearInterval(clock);
    clock = null;
    controller?.abort();
  } else {
    if (!clock) clock = setInterval(() => (now.value = Date.now()), 250);
    void refresh();
  }
}
function playerStatus(player: TelephoneSnapshot['players'][number]) {
  if (state.value?.phase === 'waiting') return '等待開始';
  if (state.value?.phase === 'finished') return '已結束';
  if (!player.online) return '暫時離線';
  if (player.ready) return state.value?.phase === 'prompting' ? '主題已送出' : '本頁已送出';
  return state.value?.phase === 'prompting'
    ? '正在想主題'
    : (state.value?.round || 0) % 2
      ? '正在作畫'
      : '正在猜詞';
}
onMounted(() => {
  visibility();
  document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
  disposed = true;
  if (timer) clearTimeout(timer);
  if (clock) clearInterval(clock);
  controller?.abort();
  document.removeEventListener('visibilitychange', visibility);
});
</script>

<template>
  <main class="vue-telephone-spectator" aria-labelledby="telephone-spectator-title">
    <header class="vue-telephone-spectator-heading">
      <div>
        <p>只讀模式 · 不占玩家席位</p>
        <h1 id="telephone-spectator-title">傳情畫意觀戰</h1>
        <p>房間 {{ code }} · {{ phase }}</p>
      </div>
      <UiButton icon="leave" label="離開觀戰" @click="emit('leave')" />
    </header>
    <StatusSlot :message="error" :persistent="!!error" :error="!!state && !!error" />
    <template v-if="state">
      <UiPanel title="本桌玩家" density="compact" class="vue-telephone-spectator-roster">
        <ul>
          <li v-for="player in state.players" :key="player.id">
            <span>{{ player.name }}{{ player.bot ? '（測試夥伴）' : '' }}</span>
            <span>{{ playerStatus(player) }}</span>
          </li>
        </ul>
      </UiPanel>
      <UiPanel
        v-if="['prompting', 'passing'].includes(state.phase)"
        :title="phase"
        density="compact"
        class="vue-telephone-spectator-progress"
      >
        <p
          >作畫 {{ state.options.drawingSeconds }} 秒 · 文字／猜題
          {{ state.options.textSeconds }} 秒</p
        >
        <RoomCountdown
          :deadline="state.deadline"
          :duration="
            (state.phase === 'passing' && state.round % 2
              ? state.options.drawingSeconds
              : state.options.textSeconds) * 1000
          "
          :offset="offset"
          :now="now"
          :epoch="state.stepId || 'spectator'"
          caption="本階段剩餘"
          empty-value="等待開始"
        />
        <p>傳遞中的畫作、題目與草稿會在全局結束後揭曉。</p>
      </UiPanel>
      <UiPanel v-else-if="state.phase === 'waiting'" title="觀戰狀態" density="compact">
        <p>等待房主開始本局。觀戰者不會加入玩家名單，也不能操作遊戲。</p>
      </UiPanel>
      <section v-if="state.phase === 'finished'" class="vue-telephone-spectator-books">
        <UiPanel
          v-for="book in state.books"
          :key="book.ownerId"
          :title="book.ownerName + ' 的傳遞簿'"
          density="compact"
        >
          <ol>
            <li v-for="(page, index) in book.pages" :key="index">
              <strong
                >{{ page.authorName }} · {{ page.kind === 'drawing' ? '畫圖' : '文字' }}</strong
              >
              <p v-if="page.skipped">本頁略過{{ page.timedOut ? ' · 逾時沒有已同步內容' : '' }}</p>
              <TelephoneCanvas
                v-else-if="page.kind === 'drawing'"
                :strokes="page.strokes || []"
                :epoch="book.ownerId + ':' + index"
                :label="book.ownerName + ' 第 ' + (index + 1) + ' 頁畫作'"
              />
              <p v-else>{{ page.text }}</p>
            </li>
          </ol>
        </UiPanel>
      </section>
    </template>
  </main>
</template>
