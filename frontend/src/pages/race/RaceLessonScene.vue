<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RaceDomain, RacePoint, RaceRoute } from '../../contracts/race';
import UiButton from '../../components/UiButton.vue';
import RaceTerrainDialog from './RaceTerrainDialog.vue';
import RoomCountdown from '../../components/RoomCountdown.vue';
import StatusSlot from '../../components/StatusSlot.vue';
import RaceBoard from './RaceBoard.vue';
import RaceVehicle from './RaceVehicle.vue';
import RaceDie from './RaceDie.vue';
import { useRaceSelection } from './useRaceSelection';
import { useRacePresentation } from './useRacePresentation';
import { commands, accepts, sizes } from './race-meta';
const props = defineProps<{ model: RaceDomain }>(),
  model = props.model,
  s = computed(() => model.state!),
  board = ref<InstanceType<typeof RaceBoard> | null>(null),
  legend = ref<InstanceType<typeof RaceTerrainDialog> | null>(null),
  commandPanel = ref<HTMLDetailsElement | null>(null),
  selection = useRaceSelection(model),
  presentation = useRacePresentation(model, () => board.value?.svg || null),
  previewPoint = ref<RacePoint | null>(null);
const { car, die, command, commandDie, repairCar, player, cars, selected } = selection;
const enabled = computed(() => model.canAct && !presentation.locked.value && presentation.ready),
  assign = computed(
    () => enabled.value && s.value.phase === 'assign' && !s.value.pending && !s.value.diceCheck,
  ),
  routes = computed(() =>
    enabled.value && s.value.phase === 'move' && !s.value.pending && !s.value.diceCheck
      ? window.RacePaths?.routes(s.value) || new Map<string, RaceRoute>()
      : new Map<string, RaceRoute>(),
  ),
  preview = computed(() =>
    previewPoint.value
      ? routes.value.get(`${previewPoint.value.x}:${previewPoint.value.y}`) || null
      : null,
  ),
  actor = computed(() => s.value.players.find((p) => p.id === s.value.actor));
const instruction = computed(() =>
  presentation.locked.value
    ? presentation.cue.value.length
      ? '事件處理中'
      : '車輛移動中'
    : s.value.phase === 'finished'
      ? '比賽結束'
      : s.value.diceCheck
        ? s.value.diceCheck.title
        : s.value.pending
          ? '碰撞：保留或重擲'
          : s.value.actor !== s.value.me
            ? `${actor.value?.name || '其他車隊'} 正在行動`
            : (
                {
                  assign: selected.value?.moved ? '選擇滑行骰 · 滑行 1 格' : '選擇車輛與移動骰',
                  move: `移動中 · 剩餘 ${s.value.active?.remaining || 0} 點`,
                  bonus: '公路加速機會',
                  airplace: '部署直升機',
                  airshoot: '直升機射擊',
                  shoot: '選擇射擊目標',
                  waiting: '等待房主開始',
                  effects: '處理事件中',
                } as Record<string, string>
              )[s.value.phase] || '等待同步',
);
const tip = computed(() =>
  s.value.pending
    ? '較大車車主可保留碰撞結果，或將兩顆骰子一起重擲一次；重擲後必須接受。'
    : s.value.actor !== s.value.me
      ? '其他車隊正在操作；所有公開車輛、骰子與事件會同步。'
      : (
          {
            assign: '先選可用車輛和移動骰；指令選用，必須消耗另一顆骰子。',
            move: '亮框可多格移動；危險、檢定或道路更新會停下重新選路。',
            bonus: '接受後必須走完加速點數，途中可以離開公路。',
            airplace: '選亮框空格；回合結束時，同格所有車輛都淘汰，包含自己的車。',
            shoot: '射擊前方三格；骰面符合車型才命中。第一輪禁止射擊。',
            airshoot: '射擊後才輪到已選車輛移動。第一輪禁止射擊。',
            finished: '完整結果保留於賽道與紀錄；房主可再比一場。',
          } as Record<string, string>
        )[s.value.phase] || '至少兩支車隊即可開始比賽。',
);
watch([() => s.value.version, () => s.value.phase], () => {
  previewPoint.value = null;
});
async function run(action: string, data: Record<string, unknown> = {}) {
  previewPoint.value = null;
  if (enabled.value) return presentation.run(action, data);
  return false;
}
function point(p: RacePoint) {
  if (!enabled.value || s.value.pending || s.value.diceCheck) return;
  if (s.value.phase === 'move' && routes.value.has(`${p.x}:${p.y}`)) {
    if (s.value.legalMoves.some((m) => m.x === p.x && m.y === p.y))
      void run('move', p as unknown as Record<string, unknown>);
    else
      void run('movePath', { car: s.value.active?.car, version: s.value.version, x: p.x, y: p.y });
  } else if (s.value.phase === 'airplace') void run('airplace', { x: p.x, y: p.y });
}
function chooseCar(id: string) {
  if (!enabled.value || s.value.pending || s.value.diceCheck) return;
  if (s.value.targets.includes(id)) {
    void run('shoot', { target: id });
    return;
  }
  if (assign.value && s.value.available.includes(id)) {
    car.value = id;
    selection.normalize();
    return;
  }
  const c = s.value.cars.find((c) => c.id === id);
  if (c?.x !== null && c?.x !== undefined) point({ x: c.x, y: c.y });
}
function completeCommand() {
  if (commandPanel.value) {
    commandPanel.value.open = false;
    commandPanel.value.querySelector('summary')?.focus({ preventScroll: true });
  }
}
const begin = () =>
  run('begin', {
    car: car.value,
    die: die.value,
    command: command.value,
    commandDie: commandDie.value,
    repairCar: repairCar.value,
  });
const usedCommand = computed(() => {
  if (!player.value?.commandUsed) return '';
  const event = s.value.events.filter((e) => e.kind === 'command' && e.owner === s.value.me).at(-1);
  return commands.find((c) => c.id === event?.command)?.label || '';
});
</script>
<template>
  <section
    v-if="model.state"
    class="vue-race-scene race-stage vue-race-lesson-scene"
    :data-lesson-highlight="model.lessonFocus"
    :aria-busy="model.busy || presentation.locked.value"
  >
    <header class="vue-race-racebar"
      ><div
        ><span class="vue-race-round">第 {{ s.round || '—' }} 輪</span
        ><strong>{{ instruction }}</strong></div
      ><div class="vue-race-roadbonus"
        >公路骰 <RaceDie v-if="s.roadDie" :value="s.roadDie" /><b v-else>—</b></div
      ><UiButton stitch label="地形圖例" icon="help" @click="legend?.open()"
    /></header>
    <div id="boardScroll" class="vue-race-track-shell"
      ><RaceBoard
        v-if="presentation.visual.value"
        ref="board"
        :state="s"
        :visual="presentation.visual.value"
        :routes="routes"
        :enabled="enabled && !s.pending && !s.diceCheck"
        :preview="preview"
        :goal="model.lessonGoal"
        :annotations="model.lessonAnnotations"
        @point="point"
        @car="chooseCar"
        @preview="previewPoint = $event" /><div
        v-if="presentation.cue.value.length"
        class="vue-race-cue"
        role="status"
        ><p v-for="event in presentation.cue.value" :key="event.id">{{ event.text }}</p
        ><UiButton
          stitch
          label="略過事件提示"
          icon="skip_next"
          @click="presentation.skipCue()" /></div
      ><div v-if="presentation.focus.value && s.winner" class="vue-race-focus" role="status"
        ><strong>⚑ {{ s.winner.name }}</strong
        ><p>{{ s.winner.reason }}</p
        ><UiButton
          stitch
          label="略過演出"
          icon="skip_next"
          @click="presentation.stopFocus()" /></div
    ></div>
    <div class="vue-race-dashboard"
      ><div class="vue-race-garage"
        ><h2>你的車隊</h2
        ><div class="vue-race-cars"
          ><button
            v-for="c in cars"
            :key="c.id"
            type="button"
            :disabled="!assign || !s.available.includes(c.id)"
            :aria-pressed="assign && car === c.id"
            :class="{ selected: assign && car === c.id }"
            @click="
              car = c.id;
              selection.normalize();
            "
            ><svg viewBox="-30 -23 60 46" aria-hidden="true">
              <RaceVehicle
                :size="c.size"
                :color="player?.color || '#9d7655'"
                :disabled="c.damage.length >= 2"
              /></svg
            ><strong>{{ sizes[c.size] }}{{ c.burning ? ' ♨' : '' }}</strong
            ><span>{{
              c.dead
                ? '已淘汰'
                : c.damage.length >= 2
                  ? '需維修'
                  : c.x === null
                    ? '起跑區'
                    : c.moved
                      ? '已行動'
                      : '可行動'
            }}</span
            ><span :aria-label="c.damage.length + ' 個損傷'" class="vue-race-damage">{{
              '●'.repeat(c.damage.length) + '○'.repeat(2 - c.damage.length)
            }}</span></button
          ></div
        ></div
      >
      <div class="vue-race-decision"
        ><div class="vue-race-dice"
          ><h2>移動骰</h2
          ><div
            ><button
              v-for="(d, i) in player?.dice || []"
              :key="i"
              type="button"
              :disabled="!assign || d.used || (!!command && i === commandDie)"
              :aria-pressed="die === i"
              :aria-label="`第 ${i + 1} 顆，${d.value} 點${d.used ? '，已使用' : command && i === commandDie ? '，指令用' : die === i ? '，已選取' : ''}`"
              :class="{ selected: die === i, spent: d.used, reserved: command && i === commandDie }"
              @click="
                die = i;
                selection.normalize();
              "
              ><span v-if="die === i" class="vue-race-die-check" aria-hidden="true">✓</span
              ><RaceDie
                :value="d.value"
                :color="player?.color"
                :variant="s.players.findIndex((entry) => entry.id === player?.id)"
              /><small>{{
                d.used ? '已使用' : command && i === commandDie ? '指令用' : '第 ' + (i + 1) + ' 顆'
              }}</small></button
            ><span v-if="!player?.dice.length">本輪擲骰後公開</span></div
          ></div
        >
        <details ref="commandPanel" class="vue-race-command"
          ><summary>{{
            player?.commandUsed
              ? '本輪指令已使用' + (usedCommand ? '：' + usedCommand : '')
              : commands.find((c) => c.id === command)?.label || '指令（選用）'
          }}</summary
          ><div class="vue-race-command-fields"
            ><label
              >本輪指令<select
                aria-label="本輪指令"
                :value="command"
                :disabled="!assign || player?.commandUsed"
                @change="selection.selectCommand(($event.target as HTMLSelectElement).value)"
                ><option value="">不使用指令</option
                ><option
                  v-for="c in commands"
                  :key="c.id"
                  :value="c.id"
                  :disabled="!!selection.reason(c.id)"
                  >{{ c.label
                  }}{{ selection.reason(c.id) ? '（' + selection.reason(c.id) + '）' : '' }}</option
                ></select
              ></label
            ><label
              >另一顆指令骰<select
                aria-label="另一顆指令骰"
                :value="commandDie"
                :disabled="!assign || !command"
                @change="
                  selection.selectCommandDie(Number(($event.target as HTMLSelectElement).value))
                "
                ><option v-if="!command" :value="-1">請先選擇指令</option
                ><option
                  v-for="(d, i) in player?.dice || []"
                  :key="i"
                  :value="i"
                  :disabled="d.used || !accepts(command, d.value)"
                  >第 {{ i + 1 }} 顆 · {{ d.value }} 點{{ d.used ? '（已使用）' : '' }}</option
                ></select
              ></label
            ><label v-if="command === 'repair'"
              >維修目標<select aria-label="維修目標" v-model="repairCar" :disabled="!assign"
                ><option
                  v-for="c in cars.filter((c) => !c.dead && c.damage.length)"
                  :key="c.id"
                  :value="c.id"
                  >{{ sizes[c.size] }} · {{ c.damage.length }} 損傷</option
                ></select
              ></label
            ><UiButton stitch label="完成指令設定" icon="check" @click="completeCommand" /></div
        ></details> </div
      ><div class="vue-race-actions"
        ><RoomCountdown
          :deadline="model.lesson || ['waiting', 'finished'].includes(s.phase) ? null : s.deadline"
          :duration="90000"
          :offset="model.offset"
          :now="model.now"
          :epoch="s.code + ':' + s.deadline"
          :caption="model.lesson ? '教學暫停計時' : s.actor === s.me ? '你的操作時間' : '等待操作'"
          urgent
        /><div class="vue-race-main-actions"
          ><template v-if="s.pending && !s.diceCheck"
            ><UiButton
              stitch
              label="保留結果"
              icon="check"
              :disabled="!enabled"
              @click="run('slam', { reroll: false })" /><UiButton
              stitch
              label="重擲骰子"
              icon="refresh"
              :disabled="!enabled"
              @click="run('slam', { reroll: true })" /></template
          ><UiButton
            stitch
            v-else-if="s.phase === 'assign' && !s.diceCheck"
            :label="selected?.moved ? '滑行 1 格' : '確認出發'"
            variant="primary"
            icon="play_arrow"
            :pending="model.busy"
            :disabled="!assign || !car || die < 0"
            @click="begin"
          /><template v-else-if="s.phase === 'bonus' && !s.diceCheck"
            ><UiButton
              stitch
              :label="'加速 +' + s.roadDie"
              icon="bolt"
              :disabled="!enabled"
              @click="run('bonus', { use: true })" /><UiButton
              stitch
              label="略過加速"
              icon="skip_next"
              :disabled="!enabled"
              @click="run('bonus', { use: false })" /></template
          ><template v-else-if="['shoot', 'airshoot'].includes(s.phase) && !s.diceCheck"
            ><div class="vue-race-targets"
              ><UiButton
                stitch
                v-for="id in s.targets"
                :key="id"
                :label="
                  (s.players.find((p) => p.id === s.cars.find((c) => c.id === id)?.owner)?.name ||
                    '殘骸') +
                  ' ' +
                  sizes[s.cars.find((c) => c.id === id)?.size || 0]
                "
                icon="target"
                :disabled="!enabled"
                @click="run('shoot', { target: id })" /></div
            ><UiButton
              stitch
              label="略過射擊"
              icon="skip_next"
              :disabled="!enabled"
              @click="run('shoot')" /></template
          ><span v-else>{{
            presentation.locked.value
              ? '等待演出完成…'
              : s.diceCheck
                ? '請看擲骰視窗'
                : s.phase === 'move'
                  ? '選擇賽道亮框移動'
                  : s.phase === 'airplace'
                    ? '點擊亮框空格部署'
                    : s.phase === 'finished'
                      ? '等待房主開始下一場'
                      : '等候目前車隊'
          }}</span></div
        ></div
      ></div
    >
    <div class="vue-race-feedback"
      ><p>{{
        preview
          ? `${preview.path.length} 格 · 消耗 ${preview.cost} 點。${preview.warnings.join('；') || '優先繞開已知危險。'}`
          : tip
      }}</p
      ><StatusSlot
        :message="presentation.ready ? model.notice : '賽道元件未完成載入，請重新整理後再操作。'"
        :error="model.failed || !presentation.ready"
    /></div>
    <section
      v-if="s.phase === 'finished' && s.winner && !presentation.locked.value"
      class="vue-race-winner"
      ><h2>⚑ {{ s.winner.name }}{{ s.winner.id ? ' 獲勝！' : '' }}</h2
      ><p>{{ s.winner.reason }}</p
      ><UiButton stitch label="重播結算演出" icon="replay" @click="presentation.replay()"
    /></section>
    <details class="vue-race-log"
      ><summary>比賽紀錄 · {{ s.log[0] || '準備就緒' }}</summary
      ><ol
        ><li v-for="(line, i) in s.log" :key="i">{{ line }}</li></ol
      ><p>{{
        s.finishAt !== null
          ? '終點已出現，第一輛抵達的車獲勝。'
          : '通過前段會接新道路、移除後段；落在後段的車輛淘汰。'
      }}</p></details
    >
    <RaceTerrainDialog ref="legend" />
  </section>
</template>
