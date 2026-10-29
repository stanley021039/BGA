<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { lessons, tutorialType } from './registry';
import { useRoomStore } from '../../stores/room';
import { useRaceStore } from '../../stores/race';
import { requestJson } from '../../services/http';
import { record } from '../../services/validation';
import UiPanel from '../../components/UiPanel.vue';
import UiField from '../../components/UiField.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiNotice from '../../components/UiNotice.vue';
import UiHeading from '../../components/UiHeading.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import type { CocSnapshot } from '../../contracts/coc';
import type { RoomSnapshot } from '../../contracts/room';
import '../../styles/tutorial.scss';
const type = tutorialType(location.pathname)!;
const lesson = lessons[type],
  room = useRoomStore(),
  race =
    type === 'thunder'
      ? Object.assign(useRaceStore(), { lesson: true, lessonInlineDice: true })
      : undefined;
interface Tutorial {
  id: string;
  type: string;
  revision: number;
  done: boolean;
  steps: number;
  actor: string | null;
  actorId: string | null;
  suggested: { action: string; label: string } | null;
  snapshot: RoomSnapshot;
  events: { id: number; actor: string; action: string }[];
  canvas?: unknown;
}
const selectedPlayer = ref('');
const current = shallowRef<Tutorial | null>(null),
  mode = ref<'manual' | 'auto' | null>(null),
  paused = ref(false),
  busy = ref(false),
  error = ref('');
let timer: ReturnType<typeof setTimeout> | undefined,
  generation = 0,
  disposed = false,
  detach: (() => void) | undefined;
const requests = new Set<AbortController>();
const query = new URLSearchParams(location.search),
  from = query.get('room') || '';
const exitHref =
  query.get('from') === 'game' && /^[a-f0-9]{6}$/i.test(from)
    ? '/' + (type === 'thunder' ? 'race' : type) + '/' + from.toUpperCase()
    : '/';
const dice = computed(() => race?.state?.diceCheck);
const outcomes = computed(() =>
  !current.value?.done
    ? []
    : current.value.snapshot.players.flatMap((p) => {
        let value = '';
        if (type === 'coc') {
          const snapshot = current.value!.snapshot as CocSnapshot;
          const hero = snapshot.heroes.find((h) => h.seat === p.id);
          value = `${snapshot.clues.length} 項已發現線索${hero ? ` · HP ${hero.hp}/${hero.maxHp} · SAN ${hero.san}` : ''}`;
        } else if (typeof p.giveScore === 'number' && typeof p.getScore === 'number')
          value = `送禮 ${p.giveScore} 分 · 收禮 ${p.getScore} 分`;
        else if (typeof p.stack === 'number') value = p.stack.toLocaleString() + ' 籌碼';
        else if (type === 'musicquiz' && Array.isArray(p.timeline))
          value = p.timeline.length + ' 張年代卡';
        else if (typeof p.score === 'number') value = p.score + ' 分';
        else if (typeof p.focus === 'number') value = '剩餘專注 ' + p.focus;
        else if (typeof p.turns === 'number') value = '已行動 ' + p.turns + ' 次';
        return value ? [{ id: p.id, name: p.name, value }] : [];
      }),
);
const running = computed(() => mode.value === 'auto' && !paused.value && !current.value?.done);
const guide = computed(() =>
  current.value?.done
    ? '主要流程已完成。比較畫面中的結果與規則，再試一次不同選擇。'
    : current.value?.actorId === current.value?.snapshot.me
      ? '輪到你練習：' +
        (current.value?.suggested?.label || '查看結果') +
        '。在下方原本的介面操作，也可請教學示範這一步。'
      : `接著觀察${current.value?.actor || '教學夥伴'}${current.value?.suggested?.label || '處理結果'}，再輪到你操作。`,
);
function stop() {
  clearTimeout(timer);
  timer = undefined;
}
function parse(value: unknown): Tutorial {
  const r = record(value);
  if (
    typeof r.id !== 'string' ||
    !Number.isSafeInteger(r.revision) ||
    typeof r.done !== 'boolean' ||
    r.type !== type ||
    !Array.isArray(r.events)
  )
    throw Error('教學資料格式不正確');
  return { ...r, snapshot: lesson.reader(r.snapshot) } as unknown as Tutorial;
}
function publish(value: unknown, adopt = true) {
  const v = parse(value);
  if (adopt && room.snapshot && room.snapshot.me !== v.snapshot.me) room.scope++;
  selectedPlayer.value = v.snapshot.me;
  current.value = v;
  if (adopt) {
    room.snapshot = v.snapshot;
    room.clockOffset = Date.now() - v.snapshot.serverNow;
    room.lastReceivedAt = Date.now();
  }
  return v;
}
async function send(path: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const c = new AbortController();
  requests.add(c);
  const timeout = setTimeout(() => c.abort(), 12000);
  try {
    return await requestJson('/api/tutorial/' + path, {
      method: path.startsWith('state?') ? 'GET' : 'POST',
      ...(path.startsWith('state?') ? {} : { body }),
      signal: signal ? AbortSignal.any([c.signal, signal]) : c.signal,
    });
  } finally {
    clearTimeout(timeout);
    requests.delete(c);
  }
}
function schedule() {
  stop();
  if (disposed || !running.value || document.hidden || error.value) return;
  const token = generation;
  timer = setTimeout(() => {
    if (!disposed && token === generation && !document.hidden) void step();
  }, 1400);
}
async function transport(
  route: string,
  body?: Record<string, unknown>,
  options?: { signal?: AbortSignal },
) {
  if (!current.value) throw Error('請先開始教學');
  if (route === 'state') return current.value.snapshot;
  if (route === 'draw/snapshot') return current.value.canvas;
  if (route === 'action' && body?.action === 'card-frame') return current.value.snapshot;
  if (mode.value === 'auto') throw Error('自動演示中，請先切換手動模式');
  if (!['action', 'telephone/draft', 'draw/stroke'].includes(route))
    throw Error('此功能不在教學練習範圍，請返回正式遊戲使用');
  if (busy.value) throw Error('請等待前一步完成');
  const token = generation,
    v = current.value;
  busy.value = true;
  try {
    const result = await send(
      'action',
      { id: v.id, revision: v.revision, requestId: crypto.randomUUID(), route, body },
      options?.signal,
    );
    if (disposed || token !== generation) throw new DOMException('教學已切換', 'AbortError');
    publish(result, false);
    return current.value.snapshot;
  } finally {
    if (token === generation) busy.value = false;
  }
}
async function start(next: 'manual' | 'auto') {
  if (busy.value) return;
  generation++;
  stop();
  for (const c of requests) c.abort();
  detach?.();
  busy.value = true;
  error.value = '';
  paused.value = false;
  mode.value = next;
  current.value = null;
  const token = generation;
  try {
    const result = await send('start', { type });
    if (disposed || token !== generation) return;
    detach = room.installTutorial(type, lesson.reader, transport);
    publish(result);
    schedule();
  } catch (e) {
    if (!disposed) error.value = e instanceof Error ? e.message : '教學載入失敗，請重試。';
  } finally {
    if (token === generation) busy.value = false;
  }
}
async function step() {
  if (!current.value || busy.value || current.value.done) return;
  busy.value = true;
  error.value = '';
  const token = generation,
    v = current.value;
  try {
    const result = await send('step', {
      id: v.id,
      revision: v.revision,
      requestId: crypto.randomUUID(),
    });
    if (!disposed && token === generation) publish(result);
  } catch (e) {
    if (!disposed && token === generation) {
      error.value = e instanceof Error ? e.message : '演示暫停，請重試';
      paused.value = true;
    }
  } finally {
    if (token === generation) {
      busy.value = false;
      schedule();
    }
  }
}
async function recover() {
  if (!current.value || busy.value) return;
  busy.value = true;
  const token = generation;
  try {
    const value = await send('state?id=' + encodeURIComponent(current.value.id), {});
    if (!disposed && token === generation) {
      publish(value);
      error.value = '';
    }
  } catch (e) {
    if (!disposed) {
      error.value = e instanceof Error ? e.message : '讀取失敗，請重新開始';
      paused.value = true;
    }
  } finally {
    if (token === generation) busy.value = false;
  }
}
function pause() {
  paused.value = !paused.value;
  if (paused.value) stop();
  else {
    error.value = '';
    void recover().then(schedule);
  }
}
async function changePlayer() {
  if (!current.value || busy.value || room.busy) return;
  busy.value = true;
  generation++;
  stop();
  for (const c of requests) c.abort();
  const token = generation,
    v = current.value;
  try {
    const result = await send('perspective', {
      id: v.id,
      revision: v.revision,
      playerId: selectedPlayer.value,
    });
    if (!disposed && token === generation) {
      publish(result);
      error.value = '';
    }
  } catch (e) {
    if (!disposed) error.value = e instanceof Error ? e.message : '請重新選擇角色';
  } finally {
    if (token === generation) busy.value = false;
  }
}
function visibility() {
  if (document.hidden) {
    stop();
    paused.value = true;
  }
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  stop();
  for (const c of requests) c.abort();
  requests.clear();
  detach?.();
  document.removeEventListener('visibilitychange', visibility);
  if (current.value)
    void fetch('/api/tutorial/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.value.id }),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
});
</script>
<template>
  <main class="vue-tutorial" :data-tutorial-game="type" :data-tutorial-mode="mode || 'choose'">
    <header class="vue-tutorial-header"
      ><div
        ><UiHeading :level="1" kind="page">{{ lesson.title }} · 試玩教學</UiHeading
        ><p>獨立練習桌 · 教學暫停計時 · 不計成就與正式分數</p></div
      ><UiLink :href="exitHref" label="離開教學"
    /></header>
    <UiPanel v-if="!current" title="選擇練習方式" :description="lesson.goal">
      <div class="vue-tutorial-modes"
        ><UiButton
          label="自己手動操作"
          icon="edit"
          :pending="busy && mode === 'manual'"
          :disabled="busy"
          @click="start('manual')" /><UiButton
          label="全自動演示"
          icon="play"
          :pending="busy && mode === 'auto'"
          :disabled="busy"
          @click="start('auto')"
      /></div>
      <p>{{
        type === 'coc'
          ? '手動模式使用正式遊戲的調查與檢定操作；也可逐步示範。自動模式會完成一次基本流程，隨時可暫停。'
          : '手動模式使用原本遊戲的操作；教學夥伴的步驟可以逐步觀看。自動模式會示範一輪主要流程，隨時可暫停。'
      }}</p>
      <UiLink
        v-if="type === 'thunder'"
        href="/race?learn=1&amp;detail=1"
        label="雷霆之路完整章節與指定任務"
      />
    </UiPanel>
    <UiNotice
      v-if="type === 'musicquiz'"
      message="使用自製教學旋律；卡片年份是假設範例，僅供年代排序練習。"
      persistent
    />
    <UiNotice
      v-if="type === 'coc'"
      message="COC 獨立教學：沿用實際規則引擎；主持文字為教學示範，不連接 AI、不使用 API 額度。只有一位教學調查者，不加入 AI 隊友。"
      persistent
    />
    <UiNotice v-if="error" tone="danger" :message="error" persistent /><UiButton
      v-if="error && current"
      label="重新讀取目前教學"
      :pending="busy"
      @click="recover"
    />
    <div v-if="current" class="vue-tutorial-layout">
      <UiPanel
        class="vue-tutorial-coach"
        :title="current.done ? '完成本次練習' : '目前第 ' + (current.steps + 1) + ' 步'"
        :description="lesson.goal"
        aria-label="試玩教學提示"
      >
        <UiPanel v-if="dice" :title="dice.title" :description="dice.condition" density="compact">
          <p v-if="dice.result">{{ dice.result.faces.join(' · ') }} · {{ dice.result.text }}</p>
          <UiButton
            v-if="dice.status === 'awaiting'"
            label="擲骰"
            :disabled="
              mode === 'auto' || busy || (!!dice.owner && dice.owner !== current.snapshot.me)
            "
            @click="race?.run('rollDice', { check: dice.id })"
          />
          <UiButton
            v-if="dice.status === 'rolling'"
            label="查看擲骰結果"
            :disabled="mode === 'auto' || busy"
            @click="step"
          />
          <UiButton
            v-if="dice.status === 'result'"
            label="確認擲骰結果"
            :disabled="
              mode === 'auto' || busy || (!!dice.owner && dice.owner !== current.snapshot.me)
            "
            @click="race?.run('acceptDice', { check: dice.id })"
          />
        </UiPanel>
        <UiField
          v-if="mode === 'manual'"
          v-model="selectedPlayer"
          label="切換扮演角色（僅限這張教學桌）"
          control="select"
          :disabled="busy || room.busy"
          :options="current.snapshot.players.map((p) => ({ value: p.id, label: p.name }))"
          @change="changePlayer"
        />
        <p v-if="mode === 'manual'">{{
          type === 'coc'
            ? '正式冒險每人控制自己的調查者；已發現線索與房間角色卡會分享給同伴。'
            : '教學可切換角色；正式遊戲只能看自己的秘密資訊。'
        }}</p
        ><p role="status">{{ guide }}</p>
        <UiList v-if="outcomes.length" aria-label="本次教學結果"
          ><UiListRow v-for="row in outcomes" :key="row.id"
            ><strong>{{ row.name }}</strong> · {{ row.value }}</UiListRow
          ></UiList
        >
        <details
          ><summary>本次會學到什麼</summary
          ><ol
            ><li v-for="point in lesson.points" :key="point">{{ point }}</li></ol
          ></details
        >

        <div class="vue-tutorial-controls"
          ><UiButton
            v-if="mode === 'auto' && !current.done"
            :label="paused ? '繼續演示' : '暫停演示'"
            :icon="paused ? 'play' : 'pause'"
            @click="pause"
          />
          <UiButton
            v-if="mode === 'manual' && !current.done"
            :label="
              current.actorId === current.snapshot.me
                ? '示範這一步'
                : '觀看' + current.actor + '的下一步'
            "
            icon="next"
            :pending="busy"
            @click="step"
          />
          <UiButton
            label="重新練習"
            icon="refresh"
            :disabled="busy"
            @click="start(mode || 'manual')"
          />
          <UiButton
            :label="mode === 'auto' ? '切換手動練習' : '切換自動演示'"
            :disabled="busy"
            @click="start(mode === 'auto' ? 'manual' : 'auto')"
          />
        </div>
        <UiList aria-label="教學互動動態"
          ><UiListRow v-for="event in current.events.slice(-3)" :key="event.id"
            ><strong>{{ event.actor }}</strong> · {{ event.action }}</UiListRow
          ></UiList
        >
        <UiList v-if="type === 'coc' && current.done" aria-label="本次公開線索">
          <UiListRow v-for="clue in (current.snapshot as CocSnapshot).clues" :key="clue.id"
            ><strong>{{ clue.title }}</strong
            ><p>{{ clue.text }}</p></UiListRow
          >
        </UiList>
      </UiPanel>
      <section
        class="vue-tutorial-board"
        :inert="mode === 'auto' || current.done || busy"
        aria-label="教學遊戲操作畫面"
      >
        <component :is="lesson.scene" v-if="type === 'thunder'" :model="race" />
        <component
          :is="lesson.scene"
          v-else-if="type === 'draw'"
          :snapshot="current.snapshot as DrawSnapshot"
          :canvas="current.canvas"
        />
        <component :is="lesson.scene" v-else />
      </section>
    </div>
  </main>
</template>
