<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { requestJson } from '../services/http';
import { useSessionStore } from '../stores/session';
import { attackEffects, useAttackLoadoutStore, type AttackSlot } from '../stores/attack-loadout';
import AttackArtwork from './AttackArtwork.vue';
import StatusSlot from './StatusSlot.vue';
import UiButton from './UiButton.vue';
import UiChoiceCard from './UiChoiceCard.vue';
import UiField from './UiField.vue';
import UiPanel from './UiPanel.vue';
withDefaults(defineProps<{ showCurrent?: boolean }>(), { showCurrent: false });
const currentRevision = ref({ q: 0, e: 0 });
const store = useAttackLoadoutStore(),
  preview = ref('barrage'),
  revision = ref(0),
  noticeKey = ref(0),
  loadPending = ref(false),
  selection = ref({ ...store.loadout });
async function loadLoadout() {
  noticeKey.value++;
  loadPending.value = true;
  try {
    await store.load();
  } finally {
    loadPending.value = false;
  }
}
onMounted(() => void loadLoadout());
watch(
  () => store.loadout,
  (loadout) => (selection.value = { ...loadout }),
);
const owned = ref<string[]>(['barrage', 'beam']),
  conditions = ref<Record<string, string>>({}),
  ownershipError = ref(''),
  session = useSessionStore();
let ownershipRequest: AbortController | null = null;
async function loadOwnership() {
  ownershipRequest?.abort();
  owned.value = ['barrage', 'beam'];
  conditions.value = {};
  ownershipError.value = '';
  noticeKey.value++;
  if (!session.user?.id) return;
  const request = (ownershipRequest = new AbortController());
  try {
    const data = (await requestJson('/api/achievements', { signal: request.signal })) as {
      bonusRewards: { attacks: string[] };
      achievements: { id: string; description: string }[];
    };
    if (ownershipRequest !== request || request.signal.aborted) return;
    owned.value = data.bonusRewards.attacks;
    conditions.value = Object.fromEntries(data.achievements.map((a) => [a.id, a.description]));
  } catch {
    if (!request.signal.aborted) ownershipError.value = '無法讀取解鎖狀態，請重新開啟選單';
  } finally {
    if (ownershipRequest === request && !request.signal.aborted) noticeKey.value++;
  }
}
watch(() => session.user?.id, loadOwnership, { immediate: true });
onMounted(() => window.addEventListener('achievement-rewards-updated', loadOwnership));
onBeforeUnmount(() => {
  ownershipRequest?.abort();
  window.removeEventListener('achievement-rewards-updated', loadOwnership);
});
const allowed = (id: string) => owned.value.includes(id);

async function change(slot: AttackSlot, value: string | number | null | undefined) {
  selection.value[slot] = String(value ?? '');
  noticeKey.value++;
  try {
    await store.choose(slot, selection.value[slot]);
  } finally {
    selection.value = { ...store.loadout };
    noticeKey.value++;
  }
}
function play(id: string) {
  preview.value = id;
  revision.value++;
}
</script>
<template>
  <div class="attack-choices"
    ><div
      v-if="showCurrent"
      class="attack-current-previews"
      role="group"
      aria-label="目前攻擊特效預覽"
    >
      <UiPanel
        v-for="slot in ['q', 'e'] as const"
        :key="slot"
        :title="slot.toUpperCase() + ' 鍵目前特效'"
        :description="
          store.ready
            ? attackEffects.find((effect) => effect.id === store.loadout[slot])?.label
            : '正在讀取攻擊設定…'
        "
      >
        <div class="attack-preview" :aria-label="slot.toUpperCase() + ' 鍵目前特效預覽'">
          <AttackArtwork
            v-if="store.ready"
            :effect="store.loadout[slot]"
            :play-key="currentRevision[slot]"
            :from="{ x: 18, y: 65 }"
            :to="{ x: 78, y: 65 }"
          />
        </div>
        <UiButton
          icon="play"
          :label="'重播 ' + slot.toUpperCase() + ' 鍵目前特效'"
          :disabled="!store.ready"
          @click="currentRevision[slot]++"
        />
      </UiPanel> </div
    ><p>在大廳按 Q、E 向最近玩家施放。兩鍵各冷卻 2 秒；所有效果與數字僅供視覺互動。</p
    ><div class="attack-loadout"
      ><UiField
        v-for="slot in ['q', 'e'] as const"
        :key="slot"
        control="select"
        :label="slot.toUpperCase() + ' 鍵攻擊特效'"
        :model-value="selection[slot]"
        :disabled="!store.ready || store.pending"
        @update:model-value="change(slot, $event)"
        ><option
          v-for="effect in attackEffects"
          :key="effect.id"
          :value="effect.id"
          :disabled="!allowed(effect.id)"
          >{{ effect.label + (allowed(effect.id) ? '' : '（未解鎖）') }}</option
        ></UiField
      ></div
    ><div class="attack-feedback"
      ><StatusSlot
        :message="
          ownershipError ||
          store.message ||
          (!store.ready ? '正在讀取攻擊設定…' : store.pending ? '正在儲存…' : '')
        "
        :notice-key="noticeKey"
        :persistent="loadPending || store.pending || (!store.ready && !!store.message)"
        :error="!!store.message || !!ownershipError" /><div class="attack-retry-slot"
        ><UiButton
          v-if="!store.ready && store.message"
          icon="refresh"
          icon-only
          label="重新讀取攻擊設定"
          :pending="loadPending"
          @click="loadLoadout" /></div></div
    ><div class="attack-preview" aria-label="攻擊特效預覽"
      ><AttackArtwork
        :effect="preview"
        :play-key="revision"
        :from="{ x: 18, y: 65 }"
        :to="{ x: 78, y: 65 }"
      /><span class="attack-preview-label">{{
        attackEffects.find((e) => e.id === preview)?.label
      }}</span></div
    ><div class="attack-effect-grid" role="group" aria-label="攻擊特效預覽選擇"
      ><UiChoiceCard
        v-for="effect in attackEffects"
        :key="effect.id"
        :label="effect.label + '預覽' + (allowed(effect.id) ? '' : '（未解鎖）')"
        :selected="preview === effect.id"
        @click="play(effect.id)"
        ><template #label
          ><span class="attack-effect-heading"
            ><span
              class="attack-color"
              :style="{ background: effect.color }"
              aria-hidden="true"
            ></span
            ><span class="ui-choice-label">{{ effect.label }}</span></span
          ><span class="attack-effect-detail">{{
            allowed(effect.id) ? '已解鎖・預覽' : '未解鎖・預覽'
          }}</span
          ><span v-if="effect.achievementId && !allowed(effect.id)" class="attack-effect-detail">{{
            conditions[effect.achievementId] || '完成對應成就解鎖'
          }}</span></template
        ><template #selection
          ><span class="ui-choice-state" aria-hidden="true">{{
            preview === effect.id ? '✓ 正在預覽' : ''
          }}</span></template
        ></UiChoiceCard
      ></div
    ></div
  >
</template>
<style scoped>
.attack-choices {
  display: grid;
  gap: var(--stitch-gap-controls);
  min-inline-size: 0;
}
.attack-choices p {
  margin: 0;
}
.attack-current-previews {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--stitch-gap-controls);
  min-inline-size: 0;
}
.attack-loadout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-gap-controls);
}
.attack-feedback {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--stitch-control-height);
  align-items: start;
  gap: var(--stitch-gap-inline);
  min-inline-size: 0;
}
.attack-retry-slot {
  min-block-size: var(--stitch-control-height);
}
.attack-preview {
  position: relative;
  block-size: 200px;
  overflow: hidden;
  border: var(--stitch-border);
  border-radius: var(--stitch-radius-panel);
  background: var(--stitch-artwork-preview-bg);
}
.attack-preview-label {
  position: absolute;
  inset-inline-start: var(--stitch-space-12);
  inset-block-end: var(--stitch-space-12);
  color: var(--stitch-artwork-preview-ink);
  font-size: var(--stitch-text-hint);
}
.attack-effect-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-gap-controls);
  padding: var(--stitch-space-8);
}
.attack-effect-heading {
  display: flex;
  align-items: center;
  gap: var(--stitch-gap-label);
}
.attack-effect-detail {
  font-size: var(--stitch-text-hint);
  line-height: var(--stitch-line-height-body);
}
.attack-color {
  inline-size: var(--stitch-space-12);
  block-size: var(--stitch-space-12);
  flex: none;
  border-radius: var(--stitch-radius-pill);
}
@media (max-width: 600px) {
  .attack-loadout,
  .attack-effect-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
