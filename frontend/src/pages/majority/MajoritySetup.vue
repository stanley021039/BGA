<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import type { MajorityOptions } from '../../contracts/majority';
import UiIcon from '../../components/UiIcon.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import '../../styles/stitch-party-content.scss';
const room = useRoomStore(),
  game = useMajorityStore();
const tournament = computed(() => ['music', 'scenario'].includes(game.settings.mode));
const modes: { id: MajorityOptions['mode']; icon: string; title: string; text: string }[] = [
  {
    id: 'majority',
    icon: 'users',
    title: '一般同頻',
    text: '輪流挑題、秘密作答，再確認答案分組；多數答案得分。',
  },
  {
    id: 'cruel',
    icon: 'cards',
    title: '殘酷2選1',
    text: '圖片二選一，雙人組隊或個人挑戰；固定十題。',
  },
  {
    id: 'music',
    icon: 'sound',
    title: '猜歌2選1',
    text: '從歌曲候選池抽選、兩兩投票；多數晉級，選出本桌冠軍。',
  },
  {
    id: 'scenario',
    icon: 'chat',
    title: '情境2選1',
    text: '比較生活、職場與各種情境；秘密投票，逐場選出冠軍。',
  },
];
function selectMode(id: MajorityOptions['mode']) {
  if (!game.editable || room.busy || game.uncertain) return;
  if (game.settings.mode !== id) {
    game.settings.mode = id;
    game.queue();
  }
}
</script>
<template>
  <section class="stitch-setup-sheet stitch-club-setup">
    <header class="stitch-setup-heading"
      ><div
        ><small>FREQUENCY CLUB</small><h1>選擇今晚的玩法</h1
        ><p>四種對決，找到這一桌的共同頻率。</p></div
      ><span class="stitch-host-badge">{{
        game.editable ? '房主自訂中' : '本局設定'
      }}</span></header
    >
    <fieldset :disabled="!game.editable || room.busy || game.uncertain">
      <legend><UiIcon name="settings" />四種對決模式</legend>
      <div class="stitch-mode-grid">
        <button
          v-for="(mode, index) in modes"
          :key="mode.id"
          type="button"
          class="stitch-mode-card"
          :class="{ 'is-selected': game.settings.mode === mode.id }"
          :aria-pressed="game.settings.mode === mode.id"
          @click="selectMode(mode.id)"
        >
          <span class="stitch-mode-icon"><UiIcon :name="mode.icon" /></span>
          <span class="stitch-mode-eyebrow">MODE {{ 'ABCD'[index] }}</span
          ><span class="stitch-mode-selected" aria-hidden="true"
            ><UiIcon v-if="game.settings.mode === mode.id" name="check"
          /></span>
          <strong>{{ mode.title }}</strong
          ><span>{{ mode.text }}</span>
        </button>
      </div>
    </fieldset>
    <fieldset v-if="tournament">
      <legend><UiIcon name="cards" />隨機候選池</legend>
      <div class="stitch-pool-grid">
        <button
          v-for="n in [8, 16, 32, 64, 128, 256]"
          :key="n"
          type="button"
          :aria-pressed="game.settings.bracketSize === n"
          :class="{ 'is-selected': game.settings.bracketSize === n }"
          :disabled="
            !game.editable ||
            room.busy ||
            game.uncertain ||
            n >
              (game.state?.tournament?.themes.find((t) => t.id === game.settings.theme)?.count || 0)
          "
          @click="
            game.settings.bracketSize = n;
            game.queue();
          "
          ><strong>{{ n }} 候選</strong><span>{{ n - 1 }} 場對決</span
          ><span v-if="game.settings.bracketSize === n">✓ 當前選擇</span></button
        >
      </div>
      <label
        >主題<select
          v-model="game.settings.theme"
          :disabled="!game.editable || room.busy || game.uncertain"
          @change="game.queue()"
          ><option
            v-for="theme in game.state?.tournament?.themes || []"
            :key="theme.id"
            :value="theme.id"
            >{{ theme.label }} · {{ theme.count }}項</option
          ></select
        ></label
      >
      <p class="stitch-setup-note"
        >隨機抽出候選，兩兩投票。每場選到多數 +1分；只有 1 人選另一邊時該人
        -1分；平票抽籤晉級、不加分。</p
      >
    </fieldset>
    <fieldset v-else :disabled="!game.editable || room.busy || game.uncertain">
      <legend><UiIcon name="settings" />競賽參數</legend>
      <div v-if="game.settings.mode === 'cruel'" class="stitch-settings-grid">
        <label
          >計分玩法<select v-model="game.settings.cruelRules" @change="game.queue()"
            ><option value="teams">雙人組隊（4／6／8人）</option
            ><option value="individual">個人玩法（1–12人）</option></select
          ></label
        >
        <label v-if="game.settings.cruelRules === 'individual'"
          >多人時得分方式<select v-model="game.settings.cruelScoring" @change="game.queue()"
            ><option value="majority">多數得分</option
            ><option value="minority">少數得分</option></select
          ></label
        >
        <p class="stitch-setup-note">固定十題；真正單人只記錄選擇。</p>
      </div>
      <div v-else class="stitch-settings-grid">
        <label
          >本局題數<input
            v-model.number="game.settings.rounds"
            type="number"
            min="3"
            max="30"
            @change="game.queue()"
        /></label>
        <label
          >玩家投稿候選比例<select v-model="game.settings.customPercent" @change="game.queue()"
            ><option :value="null">依題庫比例</option
            ><option v-for="value in [0, 25, 50, 75, 100]" :key="value" :value="value"
              >{{ value }}%</option
            ></select
          ></label
        >
        <p class="stitch-setup-note">投稿不足時以內建題補足；手動與預備題不受比例限制。</p>
      </div>
    </fieldset>
    <StatusSlot
      :persistent="game.settingsPending || !!game.settingsError"
      :message="game.settingsPending ? '正在儲存設定…' : game.settingsError || '修改後自動儲存。'"
      :error="!!game.settingsError"
    />
    <UiButton
      v-if="game.settingsError && game.editable"
      icon="refresh"
      label="重試儲存設定"
      :disabled="room.busy"
      @click="game.queue()"
    />
  </section>
</template>
