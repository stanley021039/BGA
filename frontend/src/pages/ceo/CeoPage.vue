<script setup lang="ts">
import { computed } from 'vue';
import { useCeoStore } from '../../stores/ceo';
import { readCeoSnapshot } from '../../contracts/ceo';
import GameRoomPage from '../../components/GameRoomPage.vue';
import RoomWaitingTemplate from '../../components/RoomWaitingTemplate.vue';
import CeoScene from './CeoScene.vue';
const ceo = useCeoStore();
const phase = computed(() =>
  ceo.state?.phase === 'finished'
    ? ceo.state.interrupted
      ? '本局已中止'
      : '本局結束'
    : ceo.state?.phase === 'playing'
      ? '集團經營'
      : '等待開桌',
);
</script>
<template>
  <GameRoomPage
    type="ceo"
    title="王牌執行長"
    description="3–6 人 · 收購公司、持股與股利 · 本站替代牌庫試玩版"
    :reader="readCeoSnapshot"
    :phase="phase"
    :round="ceo.game ? `第 ${ceo.game.round} 輪` : ''"
    :max-players="6"
    :actor-id="ceo.game?.turnId"
    :show-metrics="false"
    :status="(p) => (p.id === ceo.game?.turnId ? '正在行動' : p.online ? '在線' : '暫時離線')"
    setup-target="#ceo-restart-settings"
    :setup="ceo.setup"
    :can-start="(ceo.state?.players.filter((p) => !p.kicked).length || 0) >= 3"
    :start-label="ceo.state?.phase === 'finished' ? '再玩一局' : '開始經營'"
    @start="ceo.start()"
  >
    <RoomWaitingTemplate
      v-if="ceo.state?.phase === 'waiting'"
      flow
      type="ceo"
      title="王牌執行長"
      description="每回合收購公司、買進他人股票或發放股利，讓自己的投資組合獲得最高總分。"
      :facts="[
        { label: '人數', value: '3–6 人' },
        { label: '起始現金', value: '30 元' },
        { label: '牌庫', value: '48 張本站替代公司' },
        { label: '終局', value: '公開資產 100 後再兩輪' },
      ]"
      notice="替代牌庫的卡片與原版不同；可加入電腦玩家試玩。"
    >
      <template #art><strong>1st CEO</strong></template>
    </RoomWaitingTemplate>
    <CeoScene v-else-if="ceo.state" />
    <p v-else>正在讀取執行長房間…</p>
    <template #settings><p>3–6 人；本局使用明確標示的本站替代牌庫。</p></template>
    <template #help>
      <ol>
        <li>每人起始 30 元與自家 7 張股票。每回合三選一：收購公司、買進他人一張股票、發放股利。</li>
        <li
          >收購支付公司資產加市場附加費；標示「棄最左卡」的格子購買後會移除剩餘市場最左卡。卡面資產立即增加，增減牌僅本人查看，終局才計入。</li
        >
        <li
          >買股按發行集團下一張售價，錢付給發行者；股票不能轉售。發股利由銀行按自己集團收入 ×
          各人持股數支付給所有持有人。</li
        >
        <li>有玩家公開資產達 100，當輪結束後再進行兩輪。最後一輪禁止買股。</li>
        <li
          >終局依包含 NPC 的六集團資產排名，每股值 50／40／30／20／10／0
          分；並列取所占名次平均。加上逐公司條件分及現金（最多 50 分），最高總分可並列獲勝。</li
        >
        <li
          >本站暫用版市場耗盡也啟動相同倒數，這是待驗收的替代規則。伺服器重啟不續局；有人離席則中止，斷線可重連。</li
        >
      </ol>
      <p>操作結果未確認時先更新房間，必要時使用「重試同一操作」，避免送出另一筆操作。</p>
    </template>
  </GameRoomPage>
</template>
