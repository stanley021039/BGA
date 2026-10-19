<script setup lang="ts">
import { computed } from 'vue';
import { useQuacksStore } from '../../stores/quacks';
import { readQuacksSnapshot } from '../../contracts/quacks';
import type { RoomPlayer } from '../../contracts/room';
import GameRoomPage from '../../components/GameRoomPage.vue';
import UiButton from '../../components/UiButton.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import QuacksScene from './QuacksScene.vue';
const game = useQuacksStore(),
  state = computed(() => game.state),
  stageNames: Record<string, string> = {
    drawing: '同步抽藥',
    reserves: '暫存藥材決定',
    prepare: '必要效果',
    witches: '結算前女巫',
    essence: '調製特效藥',
    bonus: '獎勵骰',
    effects: '藥材效果選擇',
    'effects-confirm': '確認藥材效果',
    rewards: '領取格位獎勵',
    shopping: '購物與補瓶',
  };
const phase = computed(() =>
  state.value?.interrupted
    ? '本場已中止'
    : state.value?.phase === 'brewing' || state.value?.phase === 'settlement'
      ? stageNames[state.value.stage || ''] || '處理效果'
      : {
          waiting: '等待開局',
          patients: '選擇病患',
          fortune: '親自抽占卜牌',
          'round-intro': '準備下一回合',
          between: '本輪完成',
          finished: '九回合完成',
        }[state.value?.phase as 'waiting'] || '正在讀取',
);
function status(player: RoomPlayer) {
  const p = state.value?.recipes.find((p) => p.id === player.id);
  return p
    ? (p.exploded
        ? '爆炸 · '
        : p.stopped
          ? '已停止 · '
          : p.chosen
            ? '等待同步揭曉 · '
            : p.ready
              ? '本階段完成 · '
              : '') +
        (p.hidden
          ? '進度未公開'
          : '第 ' +
            (p.position ?? 0) +
            ' 格 · 白色 ' +
            (p.white ?? 0) +
            '／' +
            (p.threshold ?? 7)) +
        ' · 藥袋 ' +
        p.bagCount +
        ' · 水滴 ' +
        p.droplet +
        ' · 鼠尾 ' +
        p.rat
    : '等待讀取';
}
</script>
<template>
  <GameRoomPage
    type="quacks"
    title="郎中闖江湖"
    description="2–8 人 · 九回合同步煮藥 · 基本版、草藥女巫與煉金術士"
    :reader="readQuacksSnapshot"
    :poll-ms="1200"
    :phase="phase"
    :round="state?.round ? `第 ${state.round}／9 回合` : ''"
    :max-players="8"
    :status="status"
    :setup="game.setup"
    :can-start="(state?.players.length || 0) >= 2 && !game.settingsPending && !game.settingsError"
    :start-label="state?.phase === 'finished' ? '再玩一局' : '開始煮藥'"
    @start="game.start()"
    ><template #player-metric="{ player }"
      ><strong>{{ player.score }}</strong
      ><span>分數</span
      ><span>寶石 {{ state?.recipes.find((p) => p.id === player.id)?.rubies || 0 }}</span></template
    ><QuacksScene v-if="state" /><section v-else class="vue-game-panel"
      ><h1>正在讀取郎中房間…</h1></section
    ><template #settings
      ><details class="vue-quacks-settings"
        ><summary
          >{{ state?.options.witches ? '草藥女巫' : '基本版'
          }}{{ state?.options.alchemists ? '＋煉金術士' : '' }} ·
          {{ state?.options.hiddenProgress ? '隱藏進度' : '公開進度' }}</summary
        ><fieldset :disabled="!game.editableSettings"
          ><legend>開局選項</legend
          ><label
            ><input
              v-model="game.draft.witches"
              type="checkbox"
              @change="game.queueSettings()"
            />草藥女巫</label
          ><label
            ><input
              v-model="game.draft.alchemists"
              type="checkbox"
              @change="game.queueSettings()"
            />煉金術士</label
          ><label
            ><input
              v-model="game.draft.hiddenProgress"
              type="checkbox"
              @change="game.queueSettings()"
            />隱藏他人大釜進度</label
          ></fieldset
        ><p>各色書面可在舞台「藥典」選擇；全桌採用最後一次選擇。開始後鎖定。</p
        ><StatusSlot
          :message="
            game.settingsPending
              ? '正在儲存設定…'
              : game.settingsError || (game.settingsSaved ? '設定已儲存。' : '')
          "
          :error="!!game.settingsError" /><UiButton
          v-if="game.settingsError && game.editableSettings"
          icon="refresh"
          label="重試儲存設定"
          @click="game.queueSettings()" /></details></template
    ><template #help
      ><ol
        ><li
          >2–8
          人一起玩九輪；每色藥材書獨立選面，全桌採用最後一次真人選擇。可加入草藥女巫、煉金術士、隱藏他人進度；開始後鎖定設定。</li
        ><li
          >起始玩家輪流親自點占卜牌。每次所有仍在抽藥者選抽或停，才一起揭曉；必要效果先處理完才進入下一次。</li
        ><li
          >白色炸彈總數值超過實際門檻才爆炸；藥水瓶可在爆炸前收回最後一片白色炸彈，女巫可能提供其他救援。第六輪多一片白色1。</li
        ><li
          >停止或爆炸後處理暫存、女巫、特效藥、獎勵骰、藥材、格位獎勵、購物與補瓶。爆炸通常選得分或購物，部分保護仍可兩者兼得；最遠且符合資格的所有玩家親自擲骰。</li
        ><li
          >每份一般或獨立預算各買最多兩片不同顏色；可取消尚未用於後續效果的購買。黃色第二輪、紫色第三輪解鎖，預算不跨輪。</li
        ><li
          >第九輪不再買片；普通可用預算5金幣換1分、紅寶石2顆換1分、未用女巫幣各2分，特效藥直接換分。最高分，再比最後大釜位置，可以並列。</li
        ><li
          >藥袋公開總數，真人每回合只能查看一次自己的內容快照，關閉不退款；私人效果、預抽藥材不給別人看。隱藏他人大釜時，爆炸或結算才公開。</li
        ><li
          >購物全員完成後伺服器等待2秒自動準備下一輪，第九輪保留九份結果；動畫可跳過，遵從共用減少動態及音效設定，刷新不補播。有人離席會中止並保留已完成回合，重連不延長流程，伺服器重啟不續局。</li
        ></ol
      ><p>此數位版藥材供應不限，背面試管大釜尚未加入；病患可重複選。腳本夥伴僅供試玩。</p></template
    ></GameRoomPage
  >
</template>
