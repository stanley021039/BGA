<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { GachaResult } from '../contracts/gacha';
import type { GachaEnding } from '../services/gacha-cinematic';
import { attackEffects } from '../stores/attack-loadout';
import GachaCinematic from './GachaCinematic.vue';
import GachaRewardCard from './GachaRewardCard.vue';
import GachaSpotlight from './GachaSpotlight.vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiList from './UiList.vue';
import UiListRow from './UiListRow.vue';
import UiPanel from './UiPanel.vue';

const props = defineProps<{ hosting?: string }>();
type Hosted = { id: string; viewerNames: string[] };
const emit = defineEmits<{ roster: [Hosted | undefined] }>();
type Room = { id: string; name: string };
type View = Room & {
  phase: 'market' | 'settled' | 'back' | 'card' | 'spotlight' | 'summary' | 'closed';
  count: number;
  index: number;
  startedAt: number;
  changedAt: number;
  serverNow: number;
  ending?: GachaEnding;
  item?: GachaResult;
  items?: GachaResult[];
};
const rooms = ref<Room[]>([]);
const view = ref<View>();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const notice = ref('');
let listing: EventSource | undefined;
let viewing: EventSource | undefined;
const otherRooms = computed(() => rooms.value.filter((room) => room.id !== props.hosting));
const attack = computed(() =>
  view.value?.item?.kind === 'attacks'
    ? attackEffects.find((effect) => effect.id === view.value?.item?.id)
    : undefined,
);

function closeViewer() {
  viewing?.close();
  viewing = undefined;
}
function watchRoom(room: Room, event: MouseEvent) {
  const trigger = event.currentTarget;
  closeViewer();
  view.value = undefined;
  notice.value = '正在加入觀戰…';
  const stream = new EventSource('/api/gacha/spectate/' + encodeURIComponent(room.id));
  viewing = stream;
  stream.addEventListener('state', (event: MessageEvent<string>) => {
    if (viewing !== stream) return;
    const current = JSON.parse(event.data) as View;
    if (current.id !== room.id) return;
    view.value = current;
    notice.value = '';
    if (current.phase === 'closed') closeViewer();
  });
  stream.onerror = () => {
    if (viewing !== stream) return;
    notice.value = stream.readyState === EventSource.CLOSED ? '這場觀戰已結束。' : '正在重新連線…';
    view.value = undefined;
  };
  void dialog.value?.open(trigger instanceof HTMLElement ? trigger : undefined);
}
onMounted(() => {
  listing = new EventSource('/api/gacha/spectate');
  listing.addEventListener('state', (event: MessageEvent<string>) => {
    const state = JSON.parse(event.data) as { rooms: Room[]; hosted?: Hosted };
    rooms.value = state.rooms;
    emit('roster', state.hosted);
  });
  listing.onerror = () => {
    rooms.value = [];
    emit('roster', undefined);
  };
});
onBeforeUnmount(() => {
  listing?.close();
  closeViewer();
});
</script>

<template>
  <UiPanel v-if="otherRooms.length" title="抽卡觀戰" density="compact">
    <UiList>
      <UiListRow v-for="room in otherRooms" :key="room.id">
        {{ room.name }}
        <template #actions>
          <UiButton label="觀看" @click="watchRoom(room, $event)" />
        </template>
      </UiListRow>
    </UiList>
  </UiPanel>
  <UiDialog
    ref="dialog"
    :title="view ? view.name + '的抽卡觀戰' : '抽卡觀戰'"
    full-viewport
    @closing="closeViewer"
  >
    <div class="gacha-watch-content">
      <p v-if="notice" role="status">{{ notice }}</p>
      <template v-else-if="view">
        <GachaCinematic
          v-if="view.phase === 'market' || view.phase === 'settled'"
          :key="view.id"
          :name="view.name"
          :chart-id="view.id"
          :ending="view.ending"
          :elapsed-ms="Math.max(0, view.serverNow - view.startedAt)"
          full-viewport
          spectator
        />
        <GachaSpotlight
          v-else-if="view.phase === 'spotlight' && view.item"
          :key="view.index"
          :item="view.item"
          :area="!!attack?.area"
          :attack-id="attack?.variantOf || attack?.id"
          :name="view.name"
          image=""
          :elapsed-ms="Math.max(0, view.serverNow - view.changedAt)"
          spectator
        />
        <div v-else-if="view.phase === 'card' && view.item" class="gacha-watch-single">
          <GachaRewardCard :number="view.index + 1" :item="view.item" prominent spectator />
        </div>
        <div v-else-if="view.phase === 'summary' && view.items" class="gacha-watch-summary">
          <GachaRewardCard
            v-for="(item, index) in view.items"
            :key="index"
            :number="index + 1"
            :item="item"
            compact
            spectator
          />
        </div>
        <UiPanel v-else-if="view.phase === 'back'" title="等待翻牌">
          <p>第 {{ view.index + 1 }}／{{ view.count }} 張，由抽卡者翻牌。</p>
        </UiPanel>
        <p v-else role="status">這場觀戰已結束。</p>
      </template>
    </div>
  </UiDialog>
</template>

<style scoped>
.gacha-watch-content {
  min-inline-size: 0;
  min-block-size: 0;
  block-size: 100%;
  overflow: auto;
}
.gacha-watch-single {
  inline-size: min(100%, 28rem);
  margin-inline: auto;
}
.gacha-watch-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: var(--stitch-gap-controls);
}
</style>
