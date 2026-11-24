<script setup lang="ts">
import { computed, ref, useId, onMounted, onBeforeUnmount } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { attackEffects, fitsAttackSlot } from '../../stores/attack-loadout';
import { entranceEffectGroups } from '../../services/effect-variants';
import { randomAttacks, randomEntrance } from '../../services/random-effects';
import { requestJson } from '../../services/http';
import { sceneApiPath } from '../../services/scene-scope';
import LobbyBackdrop from './LobbyBackdrop.vue';
import SceneNpcControls from '../../components/SceneNpcControls.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiField from '../../components/UiField.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import SceneEnergy from '../../components/SceneEnergy.vue';
import { createPanelDrag } from '../../services/panel-drag.js';
import sceneRules from '../../../../public/shared/scene-rules.json';
const lobby = useLobbyStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const expanded = ref(!window.matchMedia('(any-pointer: coarse)').matches),
  controlsId = useId();
const surface = ref<HTMLElement | null>(null),
  position = ref<Record<string, string>>({});
let drag: ReturnType<typeof createPanelDrag> | undefined;
const self = computed(() => lobby.snapshot?.visitors.find((v) => v.id === lobby.snapshot?.selfId));
const maximum = computed(() => self.value?.energyMaximum ?? sceneRules.energy.lobbyMaximum);
const energy = computed(() => self.value?.energy || 0);
const energyFull = computed(() => energy.value >= maximum.value);
const actionStatus = ref(''),
  activeAction = ref('');
onMounted(() => {
  if (surface.value)
    drag = createPanelDrag(surface.value, window, (value) => (position.value = value));
});
const settings = ref({ q: 'barrage', e: 'beam', r: 'guanyin_barrage', entrance: 'classic' }),
  pending = ref(false),
  error = ref('');
const loading = new AbortController();
const loadingSettings = ref(true);
onMounted(async () => {
  try {
    const value = (await requestJson(sceneApiPath('/api/lobby/training'), {
      signal: loading.signal,
    })) as { settings: typeof settings.value };
    if (!loading.signal.aborted)
      settings.value = {
        q: value.settings.q,
        e: value.settings.e,
        r: value.settings.r,
        entrance: value.settings.entrance,
      };
  } catch (e) {
    if (!loading.signal.aborted) error.value = e instanceof Error ? e.message : '無法載入訓練設定';
  } finally {
    if (!loading.signal.aborted) loadingSettings.value = false;
  }
});
onBeforeUnmount(() => {
  loading.abort();
  drag?.dispose();
});
async function command(action: string) {
  if (pending.value) return;
  pending.value = true;
  activeAction.value = action;
  actionStatus.value = '';
  error.value = '';
  try {
    await requestJson(sceneApiPath('/api/lobby/training'), {
      method: 'POST',
      body: action === 'settings' ? { action, ...settings.value } : { action },
    });
    await lobby.sync();
    if (action === 'refill') actionStatus.value = '能量已補滿，可施放大招';
    if (['settings', 'replay', 'reset'].includes(action)) dialog.value?.close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '訓練操作失敗';
  } finally {
    pending.value = false;
    activeAction.value = '';
  }
}
function randomize() {
  if (pending.value || loadingSettings.value) return;
  settings.value = {
    ...randomAttacks(settings.value),
    entrance: randomEntrance(settings.value.entrance),
  };
}
</script>
<template>
  <LobbyBackdrop :training-loadout="settings" />
  <div
    ref="surface"
    class="training-window"
    :class="{ 'is-collapsed': !expanded }"
    :style="position"
    @click.stop
    @pointerdown="drag?.start($event)"
    @pointermove="drag?.move($event)"
    @pointerup="drag?.end($event)"
    @pointercancel="drag?.end($event)"
    @lostpointercapture="drag?.end($event)"
  >
    <UiPanel title="特效訓練場" class="training-toolbar" density="hud" tone="translucent">
      <template #actions>
        <div class="training-window-actions">
          <UiButton
            label="拖曳訓練視窗，方向鍵可移動，Home 還原位置"
            icon="dragHandle"
            icon-only
            data-panel-drag
            @keydown="drag?.key($event)"
          />
          <UiButton
            :label="expanded ? '收合訓練面板' : '展開訓練面板'"
            :icon="expanded ? 'minimize' : 'expand'"
            icon-only
            :aria-expanded="expanded"
            :aria-controls="controlsId"
            @click="expanded = !expanded"
          />
        </div>
      </template>
      <div v-show="expanded" :id="controlsId" class="training-tools">
        <div class="training-quick-actions" role="group" aria-label="訓練管理">
          <UiButton label="招式設定" icon="settings" @click="dialog?.open()" />
          <SceneNpcControls caption="陪練／Boss" />
        </div>
        <div class="training-energy" role="group" aria-label="能量補給">
          <div class="training-energy-meter">
            <div class="training-energy-label"
              ><span>大招能量</span><strong>{{ energy }}／{{ maximum }}</strong></div
            >
            <SceneEnergy :visitor="self" :connected="lobby.connected" size="panel" />
          </div>
          <UiButton
            label="補滿能量"
            :caption="energyFull ? '能量已滿' : '補滿能量'"
            icon="refresh"
            variant="primary"
            :pending="pending && activeAction === 'refill'"
            :disabled="pending || !lobby.connected || energyFull"
            @click="command('refill')"
          />
        </div>
        <StatusSlot
          :message="error || actionStatus || lobby.attackStatus || lobby.presenceStatus"
          :error="!!error"
        />
      </div>
    </UiPanel>
  </div>
  <UiDialog ref="dialog" title="訓練設定">
    <div class="training-settings">
      <p>Q／E 普通招式、R 大招、C 瞬移。機器人設為「主動攻擊」可測試受擊效果。</p>
      <div class="training-quick-actions" role="group" aria-label="訓練快捷操作">
        <UiButton
          label="隨機配招與進場"
          :disabled="pending || loadingSettings"
          @click="randomize"
        />
        <UiButton
          label="重播進場"
          icon="replay"
          :disabled="pending || !lobby.connected"
          @click="command('replay')"
        />
        <UiButton
          label="重置對戰"
          icon="refresh"
          :disabled="pending || !lobby.connected"
          @click="command('reset')"
        />
      </div>
      <div class="training-loadout-grid">
        <UiField
          v-for="slot in ['q', 'e', 'r'] as const"
          :key="slot"
          :class="{ 'training-wide-field': slot === 'r' }"
          :label="slot === 'r' ? 'R 大招' : slot.toUpperCase() + ' 普通招式'"
          control="select"
          v-model="settings[slot]"
          ><option
            v-for="effect in attackEffects.filter((e) => fitsAttackSlot(slot, e.id))"
            :key="effect.id"
            :value="effect.id"
            >{{ effect.label }}</option
          ></UiField
        >
        <UiField
          class="training-wide-field"
          label="進場特效"
          control="select"
          v-model="settings.entrance"
          ><optgroup
            v-for="group in entranceEffectGroups"
            :key="group.original.id"
            :label="group.original.label"
            ><option v-for="effect in group.versions" :key="effect.id" :value="effect.id">{{
              effect.label
            }}</option></optgroup
          ></UiField
        >
      </div>
      <UiButton
        label="確定設定"
        variant="primary"
        :disabled="pending"
        @click="command('settings')"
      />
      <UiLink href="/" label="返回大廳" />
    </div>
  </UiDialog>
</template>
<style scoped>
.training-window {
  position: fixed;
  top: calc(var(--stitch-space-20) * 4);
  left: var(--stitch-space-16);
  z-index: 40;
  width: min(440px, calc(100dvw - var(--stitch-space-32)));
  max-height: calc(100dvh - var(--stitch-space-16));
  overflow: auto;
}
.training-window.is-collapsed {
  width: min(320px, calc(100dvw - var(--stitch-space-32)));
}
.training-window :deep(.ui-panel-heading) {
  touch-action: none;
  cursor: grab;
}
.training-window-actions {
  display: flex;
  gap: var(--stitch-space-8);
}
.training-tools {
  display: grid;
  gap: var(--stitch-space-16);
}
.training-quick-actions,
.training-loadout-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-16);
}
.training-quick-actions > :deep(.ui-button) {
  width: 100%;
  min-width: 0;
  height: 100%;
}
.training-wide-field {
  grid-column: 1 / -1;
}
.training-energy {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--stitch-space-16);
  align-items: center;
}
.training-energy-meter {
  display: grid;
  gap: var(--stitch-space-8);
}
.training-energy-label {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--stitch-space-8);
  font-size: var(--stitch-text-label);
}
.training-energy-label strong {
  font-variant-numeric: tabular-nums;
}
@media (max-width: 480px) {
  .training-loadout-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.training-settings {
  display: grid;
  gap: var(--stitch-space-20);
}
@media (max-width: 1180px) {
  .training-window {
    top: auto;
    bottom: calc(9rem + env(safe-area-inset-bottom, 0px));
  }
}
@media (max-width: 1180px) and (max-height: 500px) and (orientation: landscape) {
  .training-window {
    left: calc(var(--stitch-space-20) * 7);
    bottom: var(--stitch-space-16);
    width: min(440px, calc(100dvw - var(--stitch-space-20) * 14));
    max-height: calc(100dvh - var(--stitch-space-16) * 10);
  }
}
</style>
