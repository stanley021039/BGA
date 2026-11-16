<script setup lang="ts">
import { ref, useId, onMounted, onBeforeUnmount } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { attackEffects, fitsAttackSlot } from '../../stores/attack-loadout';
import { entranceEffectGroups } from '../../services/effect-variants';
import { requestJson } from '../../services/http';
import { sceneApiPath } from '../../services/scene-scope';
import LobbyBackdrop from './LobbyBackdrop.vue';
import SceneBotControls from '../../components/SceneBotControls.vue';
import UiButton from '../../components/UiButton.vue';
import UiLink from '../../components/UiLink.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiField from '../../components/UiField.vue';
import UiDialog from '../../components/UiDialog.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const lobby = useLobbyStore(),
  dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const expanded = ref(true),
  controlsId = useId();
const settings = ref({ q: 'barrage', e: 'beam', r: 'guanyin_barrage', entrance: 'classic' }),
  pending = ref(false),
  error = ref('');
const loading = new AbortController();
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
  }
});
onBeforeUnmount(() => loading.abort());
async function command(action: string) {
  if (pending.value) return;
  pending.value = true;
  error.value = '';
  try {
    await requestJson(sceneApiPath('/api/lobby/training'), {
      method: 'POST',
      body: action === 'settings' ? { action, ...settings.value } : { action },
    });
    await lobby.sync();
    if (['settings', 'replay', 'reset'].includes(action)) dialog.value?.close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '訓練操作失敗';
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <LobbyBackdrop :training-loadout="settings" />
  <UiPanel title="特效訓練場" class="training-toolbar" density="compact" tone="translucent">
    <template #actions>
      <UiButton
        :label="expanded ? '收合訓練面板' : '展開訓練面板'"
        :icon="expanded ? 'minimize' : 'expand'"
        icon-only
        :aria-expanded="expanded"
        :aria-controls="controlsId"
        @click="expanded = !expanded"
      />
    </template>
    <div v-show="expanded" :id="controlsId">
      <div class="training-actions">
        <UiButton label="設定" icon="settings" @click="dialog?.open()" />
        <SceneBotControls />
        <UiButton
          label="補滿能量"
          :disabled="pending || !lobby.connected"
          @click="command('refill')"
        />
      </div>
      <StatusSlot :message="error || lobby.attackStatus || lobby.presenceStatus" :error="!!error" />
    </div>
  </UiPanel>
  <UiDialog ref="dialog" title="訓練設定">
    <div class="training-settings">
      <p>Q／E 普通招式、R 大招、C 瞬移。機器人設為「主動攻擊」可測試受擊效果。</p>
      <div class="training-actions">
        <UiButton
          label="重播進場"
          :disabled="pending || !lobby.connected"
          @click="command('replay')"
        />
        <UiButton
          label="重置對戰"
          :disabled="pending || !lobby.connected"
          @click="command('reset')"
        />
        <UiLink href="/" label="返回大廳" />
      </div>
      <UiField
        v-for="slot in ['q', 'e', 'r'] as const"
        :key="slot"
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
      <UiField label="進場特效" control="select" v-model="settings.entrance"
        ><optgroup
          v-for="group in entranceEffectGroups"
          :key="group.original.id"
          :label="group.original.label"
          ><option v-for="effect in group.versions" :key="effect.id" :value="effect.id">{{
            effect.label
          }}</option></optgroup
        ></UiField
      >
      <UiButton
        label="確定設定"
        variant="primary"
        :disabled="pending"
        @click="command('settings')"
      />
    </div>
  </UiDialog>
</template>
<style scoped>
.training-toolbar {
  position: relative;
  margin-block-start: var(--stitch-space-16);
  margin-inline-start: var(--stitch-space-16);
  z-index: 40;
  width: min(360px, calc(100vw - var(--stitch-space-16) * 2));
  max-height: 40dvh;
  overflow: auto;
}
.training-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-16);
}
.training-settings {
  display: grid;
  gap: var(--stitch-space-20);
}
</style>
