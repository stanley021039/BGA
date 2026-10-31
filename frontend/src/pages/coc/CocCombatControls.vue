<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CocSnapshot } from '../../contracts/coc';
import UiButton from '../../components/UiButton.vue';
import UiField from '../../components/UiField.vue';
import UiCheckbox from '../../components/UiCheckbox.vue';
const props = defineProps<{ state: CocSnapshot; busy: boolean }>();
const emit = defineEmits<{ command: [data: Record<string, unknown>] }>();
const b = computed(() => props.state.combat!),
  me = computed(() => props.state.heroes.find((h) => h.seat === props.state.me));
const weapon = ref('unarmed'),
  target = ref(''),
  limb = ref('0'),
  shots = ref('1'),
  luck = ref(0),
  rollIndex = ref('0'),
  avoidFumble = ref(false),
  patient = ref('');
const weaponLabels: Record<string, string> = {
  unarmed: '徒手',
  club: '短棍',
  knife: '小刀',
  handgun: '左輪手槍',
  pistol22: '小口徑自動手槍',
  candleFire: '點燃的蠟燭',
};
const weapons = computed(() =>
  ['unarmed', ...(me.value?.equipment || []).filter((id) => id in weaponLabels)].map((id) => ({
    value: id,
    label: weaponLabels[id],
  })),
);
const opponent = computed(() => b.value.monsters.find((m) => m.id === target.value));
const activeWeapon = computed(() => b.value.prepared[props.state.me]?.weapon || 'unarmed');
const actorName = (id: string) =>
  props.state.heroes.find((h) => h.seat === id)?.name ||
  props.state.players.find((p) => p.id === id)?.name ||
  b.value.monsters.find((m) => m.id === id)?.name ||
  '同伴';
const resultRolls = computed(() =>
  b.value.resolution?.rolls.length
    ? b.value.resolution.rolls
    : b.value.resolution?.roll
      ? [b.value.resolution.roll]
      : [],
);
const fumbled = computed(() => resultRolls.value.some((r) => r.level === -1));
watch(
  () => b.value.resolution?.id,
  () => {
    luck.value = 0;
    rollIndex.value = '0';
    avoidFumble.value = false;
  },
);
watch(
  () => b.value.monsters.map((m) => m.id).join(','),
  () => {
    if (!b.value.monsters.some((m) => m.id === target.value))
      target.value = b.value.monsters[0]?.id || '';
  },
  { immediate: true },
);
watch(
  () => [target.value, opponent.value?.limbs.join(',')].join(':'),
  () => {
    if (opponent.value?.limbs.length && !opponent.value.limbs[Number(limb.value)])
      limb.value = String(opponent.value.limbs.findIndex((n) => n > 0));
  },
);
function command(command: string, extra: Record<string, unknown> = {}) {
  emit('command', { command, ...extra });
}
</script>
<template>
  <div v-if="state.combat" class="coc-combat">
    <h3>戰鬥 · 第 {{ b.round }} 回合</h3>
    <p>擲骰由伺服器自動完成。骰值、彈藥與已接受的傷害會隨操作保存。</p>
    <div class="coc-opponents"
      ><p v-for="monster in b.monsters" :key="monster.id"
        >{{ monster.name }}：<span v-if="monster.limbs.length"
          >實體觸肢 {{ monster.limbs.filter((n) => n > 0).length }}／5</span
        ><span v-else
          >體力 {{ monster.hp }}／{{ monster.maxHp
          }}{{
            monster.kind === 'dissolver' ? (monster.corporeal ? ' · 實體化' : ' · 非實體') : ''
          }}</span
        ></p
      ></div
    >
    <template v-if="b.injury"
      ><p>{{ actorName(b.injury.actor) }}：{{ b.injury.reason }}</p
      ><div v-if="b.injury.actor === state.me && me" class="coc-combat-actions">
        <UiButton
          v-if="me.luck >= 30 && ['dead', 'dying'].includes(me.condition)"
          :label="'花費全部 ' + me.luck + ' 幸運避免死亡，下個場景歸隊'"
          icon="shield"
          :disabled="busy"
          @click="command('escapeDeath')"
        />
        <UiButton
          v-if="me.luck >= 20 && me.hp < me.maxHp && me.condition !== 'dead'"
          label="花費 20 幸運，恢復 1d6 體力"
          icon="healing"
          :disabled="busy"
          @click="command('scratch')"
        />
        <UiButton
          v-if="me.condition === 'unconscious' && me.luck >= 2 ** me.consciousLuckRounds"
          :label="'花費 ' + 2 ** me.consciousLuckRounds + ' 幸運保持清醒一回合'"
          icon="shield"
          :disabled="busy"
          @click="command('stayConscious')"
        />
        <UiButton
          v-if="['dead', 'dying'].includes(me.condition) && !me.blazeUsed"
          label="最後一搏：完成一次行動後永久死亡"
          icon="attack-up"
          variant="danger"
          :disabled="busy"
          @click="command('blazeGlory')"
        />
        <UiButton
          label="接受目前傷勢"
          icon="check"
          :disabled="busy"
          @click="command('acceptInjury')"
        /> </div
      ><p v-else>等待受傷者決定如何處理。</p></template
    >
    <template v-else-if="b.resolution"
      ><p>{{ actorName(b.resolution.actor) }} 的結果已保存。</p
      ><p v-for="(roll, index) in resultRolls" :key="index"
        >{{ index + 1 }}：{{ roll.roll }}／{{ roll.target }} ·
        {{ ['失敗', '一般成功', '困難成功', '極難成功', '大成功'][Math.max(0, roll.level)]
        }}{{ roll.level === -1 ? '（大失敗）' : '' }}</p
      ><p v-if="b.resolution.attack"
        >敵方攻擊 {{ b.resolution.attack.roll }}／{{ b.resolution.attack.target }}</p
      ><p v-if="b.resolution.defense"
        >對方判定 {{ b.resolution.defense.roll }}／{{ b.resolution.defense.target }}</p
      ><p v-if="b.resolution.poison"
        >毒性判定 {{ b.resolution.poison.roll }}／{{ b.resolution.poison.target }}</p
      ><div v-if="b.resolution.actor === state.me" class="coc-combat-fields">
        <UiField
          v-if="resultRolls.length > 1"
          v-model="rollIndex"
          label="要調整的骰次"
          control="select"
          :options="
            resultRolls.map((_, i) => ({ value: String(i), label: '第 ' + (i + 1) + ' 骰' }))
          "
        />
        <UiField
          v-model.number="luck"
          label="支出幸運值（0 表示不用）"
          type="number"
          min="0"
          :max="me?.luck || 0"
        />
        <UiCheckbox
          v-if="fumbled"
          v-model="avoidFumble"
          label="另外支出 10 幸運避免大失敗後果；攻擊仍然失敗"
          :disabled="(me?.luck || 0) < 10"
        />
        <UiButton
          label="接受並結算結果"
          icon="check"
          variant="primary"
          :disabled="busy"
          @click="
            command('accept', {
              resultId: b.resolution.id,
              luck,
              rollIndex: Number(rollIndex),
              avoidFumble,
            })
          "
        /> </div
      ><p v-else>等待這位玩家接受結果。</p></template
    >
    <template v-else-if="b.waiting"
      ><p>輪到 {{ actorName(b.waiting.actor) }}。</p
      ><template v-if="b.waiting.actor === state.me">
        <div v-if="b.waiting.kind === 'prepare'" class="coc-combat-fields"
          ><UiField
            v-model="weapon"
            label="宣告本回合使用的武器"
            control="select"
            :options="weapons"
          /><UiButton
            label="確認武器並加入先攻順序"
            icon="check"
            :disabled="busy"
            @click="command('prepare', { weapon })"
          /><p>有準備的槍械與「迅速拔槍」依規則使用敏捷加成；之後換武器需要一回合。</p></div
        >
        <div v-else-if="b.waiting.kind === 'defend'" class="coc-combat-actions"
          ><p
            >{{
              actorName(b.waiting.monster)
            }}
            正在攻擊你。閃避同級成功時勝出，反擊同級成功時攻擊方勝出。</p
          ><UiButton
            label="閃避，並自動擲雙方骰"
            icon="shield"
            :disabled="busy"
            @click="command('defend', { response: 'dodge' })" /><UiButton
            label="反擊，並自動擲雙方骰"
            icon="attack-up"
            :disabled="busy"
            @click="command('defend', { response: 'fightBack' })"
        /></div>
        <template v-else
          ><p
            >使用武器：{{ weaponLabels[activeWeapon]
            }}<span v-if="['handgun', 'pistol22'].includes(activeWeapon)">
              · 已裝填 {{ me?.ammunition.loaded }}／6，備彈 {{ me?.ammunition.reserve }}</span
            ></p
          ><div class="coc-combat-fields">
            <UiField
              v-model="target"
              label="攻擊目標"
              control="select"
              :options="b.monsters.map((m) => ({ value: m.id, label: m.name }))"
            />
            <UiField
              v-if="opponent?.limbs.length"
              v-model="limb"
              label="實體觸肢"
              control="select"
              :options="
                opponent.limbs
                  .map((hp, i) => ({
                    value: String(i),
                    label: '第 ' + (i + 1) + ' 條 · ' + hp + ' HP',
                  }))
                  .filter((o) => opponent!.limbs[Number(o.value)] > 0)
              "
            />
            <UiField
              v-if="['handgun', 'pistol22'].includes(activeWeapon)"
              v-model="shots"
              label="本回合射擊次數"
              control="select"
              :options="[
                { value: '1', label: '一發' },
                { value: '2', label: '兩發（每發一顆懲罰骰）' },
                { value: '3', label: '三發（每發一顆懲罰骰）' },
              ]"
            />
            <UiButton
              label="攻擊並自動擲骰"
              icon="attack-up"
              variant="primary"
              :disabled="busy || !target"
              @click="
                command('attack', {
                  weapon: activeWeapon,
                  target,
                  limb: Number(limb),
                  shots: Number(shots),
                })
              "
            /> </div
          ><div class="coc-combat-actions"
            ><UiButton
              v-if="b.kind === 'soup-slime'"
              label="花一回合歸還黑書"
              icon="book"
              :disabled="busy"
              @click="command('returnBook')" />
            <UiButton
              v-if="b.kind === 'soup-slime'"
              label="投擲黑書，嘗試使守衛吞下黑液"
              icon="attack-up"
              :disabled="busy"
              @click="command('poisonBook')" />
            <UiButton
              v-if="b.kind === 'soup-guardian' && me?.held"
              label="掙脫守衛的纏繞（力量對抗）"
              icon="next"
              :disabled="busy"
              @click="command('breakFree')" /><UiButton
              v-if="me?.equipment.some((id) => ['handgun', 'pistol22'].includes(id))"
              label="重新裝彈（一回合）"
              icon="refresh"
              :disabled="busy || me.ammunition.loaded >= 6 || me.ammunition.reserve <= 0"
              @click="command('reload')" /><UiButton
              label="脫離戰鬥，退到場景外緣（一回合）"
              icon="next"
              :disabled="busy"
              @click="command('escape')" /><UiButton
              label="觀察並防守一回合"
              icon="shield"
              :disabled="busy"
              @click="command('wait')"
          /></div>
          <div class="coc-combat-fields"
            ><UiField
              v-model="weapon"
              label="換用武器／排除故障"
              control="select"
              :options="weapons" /><UiButton
              label="備妥這項武器（一回合）"
              icon="settings"
              :disabled="busy"
              @click="command('readyWeapon', { weapon })" /><UiField
              v-model="patient"
              label="急救對象"
              control="select"
              :options="[
                { value: '', label: '選擇受傷同伴' },
                ...state.heroes
                  .filter((h) => h.condition !== 'dead' && h.hp < h.maxHp)
                  .map((h) => ({ value: h.seat, label: h.name })),
              ]" /><UiButton
              label="嘗試急救（一回合）"
              icon="healing"
              :disabled="busy || !patient"
              @click="command('firstAid', { target: patient })"
          /></div>
          <div v-if="b.kind === 'hill'" class="coc-combat-actions"
            ><p>救援進度 {{ b.dig }}／6 人次回合。</p
            ><UiButton
              v-if="!b.foundDuncan"
              label="搜尋被埋住的 Duncan（一回合）"
              icon="ping-look"
              :disabled="busy"
              @click="command('findDuncan')" /><UiButton
              v-else
              label="搬開岩石救援（一人次回合）"
              icon="users"
              :disabled="busy"
              @click="command('dig')" /></div
        ></template> </template
    ></template>
  </div>
</template>
<style scoped>
.coc-combat {
  display: grid;
  gap: var(--stitch-space-12);
  min-inline-size: 0;
}
.coc-combat p,
.coc-combat h3 {
  margin: 0;
}
.coc-opponents {
  max-block-size: 8rem;
  overflow: auto;
  scrollbar-gutter: stable;
}
.coc-combat-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-12);
  align-items: end;
}
.coc-combat-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-12);
  align-items: center;
}
.coc-combat-actions p {
  flex-basis: 100%;
}
@media (max-width: 760px) {
  .coc-combat-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
