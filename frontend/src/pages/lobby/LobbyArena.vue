<script setup lang="ts">
import { archetypeOptions, archetypeNames } from '../../contracts/lobby-arena';
import AttackChoices from '../../components/AttackChoices.vue';
import UiField from '../../components/UiField.vue';
import { nextTick } from 'vue';
import { pickupLabels } from '../../contracts/lobby-pickups';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLobbyStore } from '../../stores/lobby';
import { useGameFocus } from '../../composables/game-focus';
import UiButton from '../../components/UiButton.vue';
import UiDialog from '../../components/UiDialog.vue';
import UiPanel from '../../components/UiPanel.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiList from '../../components/UiList.vue';
import UiListRow from '../../components/UiListRow.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import LobbyArenaPractice from './LobbyArenaPractice.vue';
import '../../styles/lobby-arena.scss';
const lobby = useLobbyStore();
const dialog = ref<InstanceType<typeof UiDialog> | null>(null);
const loadoutDialog = ref<InstanceType<typeof UiDialog> | null>(null),
  loadoutOpen = ref(false),
  clean = ref(false);
const practice = ref<InstanceType<typeof LobbyArenaPractice> | null>(null);
const { focused, toggle } = useGameFocus('vue-lobby-arena-focus');
const arena = computed(() => lobby.snapshot?.arena);
const match = computed(() => arena.value?.match);
const self = computed(() => match.value?.players.find((p) => p.id === lobby.snapshot?.selfId));
const ownTeam = computed(
  () => arena.value?.teams.find((p) => p.id === lobby.snapshot?.selfId)?.team,
);
const playing = computed(
  () => match.value?.phase === 'running' && !!self.value && !self.value.forfeited,
);
const cleanView = computed(() => clean.value && !!self.value && !self.value.forfeited);
watch(
  playing,
  async (active) => {
    if (active) {
      clean.value = true;
      dialog.value?.close();
      loadoutDialog.value?.close();
      await nextTick();
      document.querySelector<HTMLElement>('.lobby-backdrop')?.focus({ preventScroll: true });
    }
  },
  { immediate: true },
);
watch(cleanView, (value) => document.body.classList.toggle('vue-lobby-battle', value), {
  immediate: true,
});
watch(
  () => match.value?.phase,
  (phase, prior) => {
    if (phase === 'finished' && prior === 'running' && self.value && !self.value.forfeited)
      void dialog.value?.open();
  },
);
onBeforeUnmount(() => document.body.classList.remove('vue-lobby-battle'));
const profileValue = computed(
  () => arena.value?.teams.find((p) => p.id === lobby.snapshot?.selfId)?.archetype || 'attack',
);
const formatDamage = (n: number | undefined) =>
  new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const hp = computed(() =>
  ownVisitor.value?.maxHealth
    ? Math.round((100 * (ownVisitor.value.health || 0)) / ownVisitor.value.maxHealth)
    : 0,
);
async function returnLobby() {
  if (playing.value) {
    await lobby.arenaCommand({ action: 'leave', matchId: match.value?.id });
    if (playing.value) return;
  }
  clean.value = false;
  dialog.value?.close();
}
async function editLoadout() {
  loadoutOpen.value = true;
  await nextTick();
  void loadoutDialog.value?.open();
}
const tick = ref(Date.now()),
  receivedAt = ref(Date.now());
watch(
  () => lobby.snapshot,
  () => {
    tick.value = receivedAt.value = Date.now();
  },
);
const ownVisitor = computed(() =>
  lobby.snapshot?.visitors.find((v) => v.id === lobby.snapshot?.selfId),
);
const pickupNow = computed(() => (lobby.snapshot?.serverNow || 0) + tick.value - receivedAt.value);
const pickupMessage = computed(() => {
  const effects = ownVisitor.value?.pickupEffects;
  if (!effects) return '';
  const parts: string[] = [];
  if (effects.last && effects.last.until > pickupNow.value)
    parts.push('已拾取' + pickupLabels[effects.last.kind]);
  if (effects.speedUntil > pickupNow.value)
    parts.push(`加速 ${Math.ceil((effects.speedUntil - pickupNow.value) / 1000)} 秒`);
  if ((effects.attackUntil || 0) > pickupNow.value)
    parts.push(`劍 +20% · ${Math.ceil(((effects.attackUntil || 0) - pickupNow.value) / 1000)} 秒`);
  if (effects.shieldUntil > pickupNow.value)
    parts.push(`護盾 ${Math.ceil((effects.shieldUntil - pickupNow.value) / 1000)} 秒`);
  if (ownVisitor.value?.hazardKind === 'mud') parts.push('泥沼：移速減半');
  if (ownVisitor.value?.hazardKind === 'embers') parts.push('灼傷中');
  return parts.join(' · ');
});
const seconds = computed(() =>
  Math.max(
    0,
    Math.ceil(((match.value?.remainingMs || 0) - (tick.value - receivedAt.value)) / 1000),
  ),
);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    if (!document.hidden) tick.value = Date.now();
  }, 250);
});
onBeforeUnmount(() => clearInterval(timer));
const teamName = (team: string) => (team === 'red' ? '紅隊' : '藍隊');
const result = computed(() => {
  const m = match.value;
  if (!m || m.phase !== 'finished') return '';
  if (!m.winners.length) return '本局無勝者';
  const names = m.winners.map((id) =>
    m.mode === 'team' ? teamName(id) : m.players.find((p) => p.id === id)?.name || id,
  );
  return names.join('、') + (names.length > 1 ? ' 並列獲勝' : ' 獲勝');
});
const blocked = computed(() =>
  lobby.snapshot?.attacks.some(
    (a) => a.fromId === lobby.snapshot?.selfId && a.hits?.some((h) => h.blocked),
  ),
);
const totals = computed(() => {
  const m = match.value;
  if (!m) return '';
  return m.mode === 'team'
    ? ['red', 'blue']
        .map(
          (t) =>
            `${teamName(t)} ${m.players.filter((p) => p.team === t && !p.forfeited).reduce((n, p) => n + p.score, 0)} 分`,
        )
        .join('／')
    : m.players.map((p) => `${p.name} ${p.score} 分${p.forfeited ? '（棄權）' : ''}`).join('／');
});
const roster = computed(
  () =>
    arena.value?.teams.map((p) => ({
      ...p,
      name:
        lobby.snapshot?.visitors.find((v) => v.id === p.id)?.name ||
        match.value?.players.find((v) => v.id === p.id)?.name ||
        '離線玩家',
    })) || [],
);
const command = (action: string, rest: Record<string, unknown> = {}) =>
  lobby.arenaCommand({ action, ...rest });
function focusStage() {
  if (playing.value)
    document.querySelector<HTMLElement>('.lobby-backdrop')?.focus({ preventScroll: true });
}
function start(mode: string) {
  void command('start', { mode, matchId: match.value?.id || null });
}
</script>
<template>
  <UiButton
    icon="shield"
    caption="對戰"
    label="大廳對戰"
    :disabled="!lobby.connected || !arena"
    @click="dialog?.open()"
  />
  <UiDialog ref="dialog" title="大廳對戰" @closed="focusStage">
    <div class="lobby-arena-content">
      <UiPanel
        v-if="!playing && !(cleanView && match?.phase === 'finished')"
        title="60 秒命中挑戰"
        description="每次施放命中同一玩家得 1 分，多段不重複。個人 PK 限兩人；團隊戰每隊最多 8 人，無友傷。"
      >
        <p
          >先選隊報名，再由任一報名者開始。旁觀者不參賽；開始後鎖定名單。斷線可重連，主動退出算棄權。新局會回滿血並清除狀態。</p
        >
        <div class="lobby-arena-actions">
          <UiButton
            label="加入紅隊"
            :aria-pressed="ownTeam === 'red'"
            :disabled="playing || lobby.arenaPending"
            @click="command('team', { team: 'red' })"
          />
          <UiButton
            label="加入藍隊"
            :aria-pressed="ownTeam === 'blue'"
            :disabled="playing || lobby.arenaPending"
            @click="command('team', { team: 'blue' })"
          />
          <UiButton
            label="取消報名"
            :disabled="playing || !ownTeam || lobby.arenaPending"
            @click="command('team', { team: null })"
          />
        </div>
        <UiField
          label="角色類型"
          control="select"
          :model-value="profileValue"
          :options="archetypeOptions"
          :disabled="playing || lobby.arenaPending"
          @update:model-value="(value) => command('archetype', { archetype: value })"
        />
        <UiButton label="設定 Q／E 招式" icon="settings" @click="editLoadout" />
        <UiList aria-label="報名玩家">
          <UiListRow v-for="p in roster" :key="p.id"
            ><UiBadge :tone="p.team === 'red' ? 'danger' : 'info'">{{ teamName(p.team) }}</UiBadge>
            {{ p.name }}</UiListRow
          >
          <UiListRow v-if="!roster.length">尚無玩家報名，選隊即可加入。</UiListRow>
        </UiList>
        <div class="lobby-arena-actions">
          <UiButton
            variant="primary"
            label="開始個人 PK"
            :disabled="
              !ownTeam || roster.length !== 2 || match?.phase === 'running' || lobby.arenaPending
            "
            @click="start('pk')"
          />
          <UiButton
            label="開始團隊戰"
            :disabled="
              !ownTeam ||
              !roster.some((p) => p.team === 'red') ||
              !roster.some((p) => p.team === 'blue') ||
              match?.phase === 'running' ||
              lobby.arenaPending
            "
            @click="start('team')"
          />
          <UiButton label="試玩教學" @click="practice?.open()" />
        </div>
      </UiPanel>
      <UiPanel v-if="match" title="本局戰況">
        <p
          >{{ match.mode === 'pk' ? '個人 PK' : '團隊戰' }} ·
          {{ match.phase === 'running' ? `剩餘 ${seconds} 秒` : result }}</p
        >
        <UiList
          ><UiListRow v-for="p in match.players" :key="p.id"
            >{{ teamName(p.team) }} · {{ p.name }}：{{ p.score }} 分{{
              p.forfeited ? '（棄權）' : ''
            }}</UiListRow
          ></UiList
        >
        <UiPanel v-if="match.phase === 'finished'" title="傷害比較" density="compact"
          ><div class="lobby-arena-results"
            ><table aria-label="本局玩家總傷害與總承傷"
              ><thead
                ><tr><th>玩家／類型</th><th>總傷害</th><th>總承傷</th></tr></thead
              ><tbody
                ><tr v-for="p in match.players" :key="p.id"
                  ><th scope="row"
                    >{{ p.name
                    }}<span v-if="p.archetype"> · {{ archetypeNames[p.archetype] }}</span></th
                  ><td>{{ formatDamage(p.damageDealt) }}</td
                  ><td>{{ formatDamage(p.damageTaken) }}</td></tr
                ><tr v-if="match.mode === 'team'" v-for="team in ['red', 'blue']" :key="team"
                  ><th scope="row">{{ teamName(team) }}合計</th
                  ><td>{{
                    formatDamage(
                      match.players
                        .filter((p) => p.team === team)
                        .reduce((n, p) => n + (p.damageDealt || 0), 0),
                    )
                  }}</td
                  ><td>{{
                    formatDamage(
                      match.players
                        .filter((p) => p.team === team)
                        .reduce((n, p) => n + (p.damageTaken || 0), 0),
                    )
                  }}</td></tr
                ></tbody
              ></table
            ></div
          ><p>承傷含陷阱，統計減傷後的實際扣血量，不計超額傷害。</p></UiPanel
        >
        <p v-if="match.phase === 'running' && seconds === 0">時間已到，正在等待伺服器結算。</p>
        <div class="lobby-arena-actions"
          ><UiButton label="回到場景" @click="dialog?.close()" /><UiButton
            v-if="playing"
            variant="danger"
            label="本局棄權"
            :pending="lobby.arenaPending"
            @click="command('leave', { matchId: match.id })"
        /></div>
      </UiPanel>
      <UiPanel
        v-if="!cleanView"
        title="掩體規則"
        description="開局由伺服器抽選不對稱地圖；石牆阻擋參賽者行走，點地面會繞路，四邊仍能穿越。"
      >
        <p
          >可擋連射能量彈、十字光線、藍黑／紅黑半月劍氣與尾獸砲。其他招式可穿透掩體。每段命中時重新判定；每側
          X 牆凹處保留至少兩個角色的空間。泥沼減速 50%；餘燼每秒灼傷 5% 最大血量。</p
        >
        <p
          >關閉面板後，以 WASD／方向鍵移動、Q／E 攻擊、R
          瞬移；手機使用「角色操作」。分數僅限本局。</p
        >
      </UiPanel>
      <UiPanel
        v-if="!cleanView"
        title="隨機道具"
        description="走近即可自動拾取，不需要點擊。每 8～12 秒生成一個，場上最多三個，30 秒未撿會消失。"
      >
        <UiList
          ><UiListRow>補血包：恢復最大血量 25%；滿血或禁止回復時不會消耗。</UiListRow
          ><UiListRow>加速鞋：移動速度提高 50%，持續 6 秒。</UiListRow
          ><UiListRow>護盾球：受到的傷害減少 30%，持續 6 秒。</UiListRow
          ><UiListRow
            >攻擊之劍：傷害提高 20%，持續 6 秒；攻擊型持劍合計提高 40%。</UiListRow
          ></UiList
        >
        <p
          >同類效果只刷新時間，不疊加。對戰中只有參賽者能撿；新局、結束或棄權會清除本局效果，死亡重生也會清除。</p
        >
      </UiPanel>
      <StatusSlot :message="lobby.arenaStatus" :error="!!lobby.arenaStatus" persistent />
    </div>
  </UiDialog>
  <LobbyArenaPractice ref="practice" />
  <UiDialog ref="loadoutDialog" title="開局招式配裝" @closed="loadoutOpen = false"
    ><AttackChoices v-if="loadoutOpen" /><p
      >只可選擇已解鎖招式。開始後鎖定本局 Q／E；中途變更設定會留到下一局。</p
    ></UiDialog
  >
  <Teleport to="body">
    <UiPanel
      v-if="match || focused || pickupMessage"
      :class="{ 'is-battle': cleanView }"
      class="lobby-arena-hud"
      density="compact"
      aria-label="大廳對戰即時戰況"
    >
      <p v-if="match"
        >{{
          match.phase === 'running'
            ? `${match.mode === 'pk' ? '個人 PK' : '團隊戰'} · ${seconds} 秒`
            : result
        }}<span v-if="self">
          · 你 {{ self.score }} 分{{ self.forfeited ? '（棄權）' : '' }}</span
        ></p
      >
      <UiBadge v-if="cleanView" tone="info">HP {{ hp }}%</UiBadge>
      <p v-if="pickupMessage" role="status">{{ pickupMessage }}</p>
      <p v-if="match">{{ totals }}</p
      ><p v-if="blocked" role="status">攻擊被掩體或對戰隔離阻擋</p>
      <div class="lobby-arena-actions"
        ><UiButton
          v-if="cleanView"
          icon="leave"
          icon-only
          :label="playing ? '本局棄權並返回大廳' : '返回大廳'"
          @click="returnLobby" /><UiButton label="戰況" @click="dialog?.open()" /><UiButton
          :label="focused ? '退出專注全螢幕（Esc）' : '專注全螢幕'"
          :aria-pressed="focused"
          @click="toggle"
      /></div>
    </UiPanel>
  </Teleport>
</template>
