<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useAthleteStore } from '../../stores/second-wind';
import UiField from '../../components/UiField.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const room = useRoomStore(),
  athlete = useAthleteStore();
const saved = computed(() => athlete.state?.options?.racerSet || 'second-wind');
const selected = ref(saved.value);
const editable = computed(() => room.settingsManager && athlete.setup && !room.busy);
const error = ref('');
watch(
  () => `${room.scope}:${saved.value}`,
  () => {
    selected.value = saved.value;
    error.value = '';
  },
);
watch(
  () => room.settingsManager,
  (value) => {
    if (!value) {
      selected.value = saved.value;
      error.value = '';
    }
  },
);
async function save() {
  if (!editable.value || selected.value === saved.value) return;
  error.value = '';
  if (!(await room.command('settings', { racerSet: selected.value })))
    error.value = '牌庫設定未儲存，請重試。';
}
</script>
<template>
  <UiField
    v-model="selected"
    control="select"
    label="角色牌庫"
    :disabled="!editable"
    :options="[
      { value: 'second-wind', label: 'Second Wind：36 名角色' },
      { value: 'base', label: '初代本體：36 名角色' },
      { value: 'mixed', label: '本體＋Second Wind：72 名角色' },
    ]"
    hint="賽道維持 Second Wind；修改並儲存後於下一局使用。"
  />
  <UiButton
    label="儲存牌庫設定"
    :disabled="!editable || selected === saved"
    :pending="room.busy"
    @click="save"
  />
  <StatusSlot :message="room.busy ? '正在儲存設定…' : error" :error="!!error" />
</template>
