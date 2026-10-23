<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useBluffStore } from '../../stores/bluff';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
const room = useRoomStore(),
  bluff = useBluffStore(),
  state = computed(() => bluff.state);
</script>
<template>
  <details class="vue-bluff-settings-details" open
    ><summary
      >難度 {{ state?.options.levels.join('／') }} 級 · 看身分
      {{ state?.options.roleSeconds }} 秒</summary
    ><div class="vue-bluff-settings"
      ><p>設定僅供房主在開局前調整，修改後自動儲存。</p
      ><fieldset :disabled="!bluff.editable || room.busy"
        ><legend>題目難度（至少一種）</legend
        ><label v-for="level in [1, 2, 3]" :key="level"
          ><input
            v-model="bluff.draft.levels"
            type="checkbox"
            :value="level"
            @change="bluff.queue()"
          />{{ level }} 級</label
        ></fieldset
      ><label
        >看身分時間<select
          v-model.number="bluff.draft.roleSeconds"
          :disabled="!bluff.editable || room.busy"
          @change="bluff.queue()"
          ><option v-for="seconds in [10, 30, 60]" :key="seconds" :value="seconds"
            >{{ seconds }} 秒</option
          ></select
        ></label
      ><StatusSlot
        :message="bluff.settingsPending ? '正在儲存設定…' : bluff.settingsError || ''"
        :error="!!bluff.settingsError" /><UiButton
        v-if="bluff.settingsError && bluff.editable"
        icon="refresh"
        label="重試儲存設定"
        :disabled="room.busy"
        @click="bluff.queue()" /></div
  ></details>
</template>
