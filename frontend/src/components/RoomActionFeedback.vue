<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, defineAsyncComponent } from 'vue';
import { useRoomStore } from '../stores/room';
import {
  createActionFeedbackQueue,
  readActionFeedback,
  type ActionFeedback,
} from '../services/action-feedback';
import UiPanel from './UiPanel.vue';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';
const QuacksGlyph = defineAsyncComponent(() => import('../pages/quacks/QuacksGlyph.vue'));
import type { IngredientColor } from '../contracts/quacks';
import '../styles/action-feedback.scss';
const room = useRoomStore(),
  queue = createActionFeedbackQueue(),
  visible = ref<ActionFeedback[]>([]),
  history = ref<InstanceType<typeof UiDialog> | null>(null);
const events = computed(() => readActionFeedback(room.snapshot?.actionFeedback));
let timer: ReturnType<typeof setTimeout> | undefined,
  identity = '';
function show() {
  if (timer || document.hidden) return;
  const next = queue.next();
  if (!next.length) return;
  visible.value = next;
  timer = setTimeout(() => {
    timer = undefined;
    visible.value = [];
    show();
  }, 4500);
}
watch(
  [
    () => room.scope,
    () => room.code,
    () => room.snapshot?.me,
    () => room.snapshot?.gameRevision,
    events,
  ],
  () => {
    const next =
      room.seat && room.snapshot
        ? `${room.scope}:${room.code}:${room.snapshot.me}:${room.snapshot.gameRevision || 0}`
        : '';
    if (next !== identity) {
      identity = next;
      clearTimeout(timer);
      timer = undefined;
      visible.value = [];
      history.value?.close();
    }
    queue.update(next, events.value, Date.now() - room.clockOffset, document.hidden);
    show();
  },
  { immediate: true },
);
function visibility() {
  if (document.hidden) {
    clearTimeout(timer);
    timer = undefined;
    visible.value = [];
    queue.reset();
  }
}
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  clearTimeout(timer);
  queue.reset();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <Teleport to="body"
    ><aside
      v-if="visible.length"
      class="vue-action-feedback"
      aria-label="遊戲互動回饋"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      ><UiPanel title="桌上互動" tone="raised" density="compact"
        ><UiList
          ><UiListRow v-for="event in visible" :key="event.id"
            ><span
              ><strong>{{ event.actor.name }}</strong> · {{ event.action
              }}<template v-if="event.target">
                → <strong>{{ event.target.name }}</strong></template
              ></span
            ><QuacksGlyph
              v-if="event.item"
              :chip="{ color: event.item.color as IngredientColor, value: event.item.value }"
              :size="28" /></UiListRow></UiList></UiPanel></aside
  ></Teleport>
  <UiButton
    v-if="events.length"
    variant="ghost"
    icon="chat"
    label="近期互動"
    @click="history?.open()"
  />
  <UiDialog ref="history" title="近期互動"
    ><UiList
      ><UiListRow v-for="event in [...events].reverse()" :key="event.id"
        ><span
          ><strong>{{ event.actor.name }}</strong> · {{ event.action
          }}<template v-if="event.target"> → {{ event.target.name }}</template></span
        ><QuacksGlyph
          v-if="event.item"
          :chip="{ color: event.item.color as IngredientColor, value: event.item.value }"
          :size="28" /></UiListRow></UiList
  ></UiDialog>
</template>
