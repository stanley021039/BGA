<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { requestJson } from '../services/http';
import { useSessionStore } from '../stores/session';
import { attackEffects, useAttackLoadoutStore, type AttackSlot } from '../stores/attack-loadout';
import AttackArtwork from './AttackArtwork.vue';
import StatusSlot from './StatusSlot.vue';
import UiButton from './UiButton.vue';
const store = useAttackLoadoutStore(),
  preview = ref('barrage'),
  revision = ref(0);
onMounted(() => void store.load());
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
  }
}
watch(() => session.user?.id, loadOwnership, { immediate: true });
onMounted(() => window.addEventListener('achievement-rewards-updated', loadOwnership));
onBeforeUnmount(() => {
  ownershipRequest?.abort();
  window.removeEventListener('achievement-rewards-updated', loadOwnership);
});
const allowed = (id: string) => owned.value.includes(id);

async function change(slot: AttackSlot, event: Event) {
  const select = event.target as HTMLSelectElement;
  await store.choose(slot, select.value);
  select.value = store.loadout[slot];
}
function play(id: string) {
  preview.value = id;
  revision.value++;
}
</script>
<template>
  <div class="attack-choices"
    ><p>在大廳按 Q、E 向最近玩家施放。兩鍵各冷卻 2 秒；所有效果與數字僅供視覺互動。</p
    ><div class="attack-loadout"
      ><label v-for="slot in ['q', 'e'] as const" :key="slot"
        ><kbd>{{ slot.toUpperCase() }}</kbd> 攻擊特效<select
          :aria-label="slot.toUpperCase() + ' 鍵攻擊特效'"
          :value="store.loadout[slot]"
          :disabled="!store.ready || store.pending"
          @change="change(slot, $event)"
          ><option
            v-for="effect in attackEffects"
            :key="effect.id"
            :value="effect.id"
            :disabled="!allowed(effect.id)"
            >{{ effect.label + (allowed(effect.id) ? '' : '（未解鎖）') }}</option
          ></select
        ></label
      ></div
    ><StatusSlot
      :message="
        ownershipError ||
        store.message ||
        (!store.ready ? '正在讀取攻擊設定…' : store.pending ? '正在儲存…' : '')
      "
      :error="!!store.message || !!ownershipError"
    /><UiButton
      v-if="!store.ready && store.message"
      label="重新讀取攻擊設定"
      @click="store.load()"
    /><div class="attack-preview" aria-label="攻擊特效預覽"
      ><AttackArtwork
        :effect="preview"
        :play-key="revision"
        :from="{ x: 18, y: 65 }"
        :to="{ x: 78, y: 65 }"
      /><span class="attack-preview-label">{{
        attackEffects.find((e) => e.id === preview)?.label
      }}</span></div
    ><div class="attack-effect-grid"
      ><button
        v-for="effect in attackEffects"
        :key="effect.id"
        type="button"
        :aria-label="effect.label + '預覽'"
        :aria-pressed="preview === effect.id"
        @click="play(effect.id)"
        ><span class="attack-color" :style="{ background: effect.color }"></span
        ><span>{{ effect.label }}</span
        ><small>{{ allowed(effect.id) ? '已解鎖・預覽' : '未解鎖・預覽' }}</small
        ><small v-if="effect.achievementId && !allowed(effect.id)">{{
          conditions[effect.achievementId] || '完成對應成就解鎖'
        }}</small></button
      ></div
    ></div
  >
</template>
<style scoped>
.attack-choices {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.attack-choices p {
  margin: 0;
}
.attack-loadout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.attack-loadout label {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.attack-loadout select {
  width: 100%;
  min-width: 0;
}
.attack-loadout kbd {
  font-weight: bold;
}
.attack-preview {
  position: relative;
  height: 200px;
  overflow: hidden;
  border: 1px solid var(--play-line);
  border-radius: 12px;
  background: #10182b;
}
.attack-preview-label {
  position: absolute;
  left: 12px;
  bottom: 12px;
  color: #fff;
  font-size: 14px;
}
.attack-effect-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.attack-effect-grid button {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: start;
  min-height: 44px;
  padding: 10px;
  border: 1px solid var(--play-line);
  border-radius: 8px;
  color: inherit;
  background: var(--play-surface);
  cursor: pointer;
}
.attack-effect-grid button[aria-pressed='true'] {
  outline: 2px solid var(--play-accent);
  outline-offset: -2px;
}
.attack-effect-grid small {
  margin-left: auto;
  white-space: nowrap;
}
.attack-color {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
}
@media (max-width: 600px) {
  .attack-loadout,
  .attack-effect-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
