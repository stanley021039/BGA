<script setup lang="ts">
import { useQuacksStore } from '../../stores/quacks';
import StatusSlot from '../../components/StatusSlot.vue';
import UiButton from '../../components/UiButton.vue';
const game = useQuacksStore();
</script>
<template>
  <div class="vue-quacks-setup-options">
    <fieldset :disabled="!game.editableSettings">
      <legend class="sr-only">開局選項</legend>
      <label class="vue-quacks-setup-option">
        <input v-model="game.draft.witches" type="checkbox" @change="game.queueSettings()" />
        <span
          ><strong>加入草藥女巫擴充</strong
          ><small>每人三枚女巫幣，各種能力一局使用一次。</small></span
        >
      </label>
      <label class="vue-quacks-setup-option">
        <input v-model="game.draft.alchemists" type="checkbox" @change="game.queueSettings()" />
        <span><strong>加入煉金術士擴充</strong><small>三選一病患與特效藥燒瓶。</small></span>
      </label>
      <label class="vue-quacks-setup-option">
        <input v-model="game.draft.hiddenProgress" type="checkbox" @change="game.queueSettings()" />
        <span
          ><strong>隱藏他人大釜進度</strong><small>其他人的進度在爆炸或結算時才公開。</small></span
        >
      </label>
    </fieldset>
    <StatusSlot
      :persistent="game.settingsPending || !!game.settingsError"
      :message="game.settingsPending ? '正在儲存設定…' : game.settingsError"
      :error="!!game.settingsError"
    />
    <UiButton
      v-if="game.settingsError && game.editableSettings"
      icon="refresh"
      label="重試儲存設定"
      @click="game.queueSettings()"
    />
  </div>
</template>
