<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from 'vue';
import UiPanel from './UiPanel.vue';
import UiButton from './UiButton.vue';
import UiField from './UiField.vue';
import UiCheckbox from './UiCheckbox.vue';
import UiTabs from './UiTabs.vue';
import StatusSlot from './StatusSlot.vue';
import CocSkillMatrix from './CocSkillMatrix.vue';
import { requestJson } from '../services/http';
import { readCocLibrary, readCocCharacter, readCocDraft } from '../contracts/coc';
import type { CocCatalog, CocCharacter, CocDraft } from '../contracts/coc';
const props = defineProps<{ selectable?: boolean }>();
const emit = defineEmits<{ selected: [id: string] }>();
const catalog = ref<CocCatalog | null>(null),
  characters = ref<CocCharacter[]>([]),
  selected = ref<CocCharacter | null>(null),
  draft = ref<CocDraft | null>(null);
const name = ref('新的調查者'),
  archetype = ref('adventurer'),
  core = ref('DEX'),
  occupation = ref('investigator'),
  step = ref('background');
const pending = ref(false),
  message = ref(''),
  failed = ref(false),
  notice = ref(0);
const build = computed(() => catalog.value?.archetypes.find((a) => a.id === archetype.value));
const career = computed(() =>
  catalog.value?.occupations.find((a) => a.id === draft.value?.occupation),
);
const pickedArchetype = computed(() =>
  catalog.value?.archetypes.find((a) => a.id === draft.value?.archetype),
);
const categories = [
  { id: 'occupation', label: '職業' },
  { id: 'archetype', label: '原型' },
  { id: 'interest', label: '興趣' },
];
const backgroundFields = [
  { id: 'description', label: '外觀' },
  { id: 'belief', label: '信念' },
  { id: 'person', label: '重要之人' },
  { id: 'place', label: '重要地點' },
  { id: 'possession', label: '珍愛之物' },
  { id: 'trait', label: '性格' },
  { id: 'connection', label: '調查緣由（在阿卡姆的住處，以及與同伴的關係）' },
];
const equipmentLabels: Record<string, string> = {
  notebook: '筆記本',
  flashlight: '手電筒',
  firstAidKit: '急救包',
  club: '短棍',
  knife: '小刀',
  handgun: '手槍',
  camera: '相機',
  rope: '繩索',
  toolkit: '工具箱',
};
watch(archetype, () => {
  core.value = build.value?.cores[0] || 'DEX';
});
const skillRows = computed(() => catalog.value?.skills.filter((s) => s.id !== 'mythos') || []);
const matrixRows = computed(() =>
  (selected.value?.continued ? catalog.value?.skills || [] : skillRows.value).map((skill) => ({
    id: skill.id,
    name: skill.name,
    base: base(skill.id),
    total: selected.value?.continued
      ? Number(draft.value?.skills?.[skill.id] || 0)
      : total(skill.id),
    points: Object.fromEntries(
      categories.map((k) => [k.id, Number(draft.value?.allocations[k.id]?.[skill.id] || 0)]),
    ),
    allowed: Object.fromEntries(categories.map((k) => [k.id, !!allowed(k.id, skill.id)])),
  })),
);
function allocate(kind: string, id: string, value: string | number | null | undefined) {
  if (!draft.value || selected.value?.continued || pending.value || !allowed(kind, id)) return;
  draft.value.allocations[kind][id] = Number(value || 0);
}
function allowed(kind: string, id: string) {
  return (
    kind === 'interest' ||
    (kind === 'occupation'
      ? id === 'credit' || career.value?.skills.includes(id)
      : pickedArchetype.value?.skills.includes(id))
  );
}
function base(id: string) {
  const s = catalog.value?.skills.find((s) => s.id === id);
  if (!s || !draft.value) return 0;
  return typeof s.base === 'number'
    ? s.base
    : s.base === 'EDU'
      ? draft.value.attributes.EDU
      : Math.floor(draft.value.attributes.DEX / 2);
}
function total(id: string) {
  return (
    base(id) +
    categories.reduce((sum, k) => sum + Number(draft.value?.allocations[k.id]?.[id] || 0), 0)
  );
}
function used(kind: string) {
  return Object.values(draft.value?.allocations[kind] || {}).reduce(
    (sum, v) => sum + Number(v || 0),
    0,
  );
}
function pick(character: CocCharacter) {
  selected.value = character;
  draft.value = structuredClone(toRaw(character.draft));
  step.value = 'background';
  message.value = '';
}
function toggleTalent(id: string, on: boolean) {
  if (!draft.value) return;
  draft.value.talents = on
    ? [...draft.value.talents, id]
    : draft.value.talents.filter((v) => v !== id);
}
function toggleEquipment(id: string, on: boolean) {
  if (!draft.value) return;
  draft.value.equipment = on
    ? [...draft.value.equipment, id]
    : draft.value.equipment.filter((v) => v !== id);
}
async function run(job: () => Promise<void>) {
  if (pending.value) return;
  pending.value = true;
  message.value = '';
  failed.value = false;
  try {
    await job();
  } catch (e) {
    failed.value = true;
    message.value = e instanceof Error ? e.message : '無法完成角色操作';
  } finally {
    pending.value = false;
    notice.value++;
  }
}
async function load() {
  const data = readCocLibrary(await requestJson('/api/coc/characters'));
  catalog.value = data.catalog;
  characters.value = data.characters;
}
function create(pregen = false) {
  void run(async () => {
    const character = readCocCharacter(
      await requestJson('/api/coc/characters/create', {
        method: 'POST',
        body: {
          requestId: crypto.randomUUID(),
          name: name.value,
          archetype: archetype.value,
          core: core.value,
          occupation: occupation.value,
          pregen,
        },
      }),
    );
    await load();
    pick(character);
    message.value = pregen
      ? '預設角色已加入你的角色庫，可直接帶入冒險。'
      : '能力值由伺服器擲骰並保存；請繼續完成背景、天賦與技能。';
  });
}
function save(ready: boolean) {
  void run(async () => {
    if (!selected.value || !draft.value) return;
    const d = draft.value;
    const character = readCocCharacter(
      await requestJson('/api/coc/characters/save', {
        method: 'POST',
        body: {
          requestId: crypto.randomUUID(),
          id: selected.value.id,
          revision: selected.value.revision,
          character: {
            name: d.name,
            age: d.age,
            talents: d.talents,
            background: d.background,
            equipment: d.equipment,
            allocations: d.allocations,
            ready,
          },
        },
      }),
    );
    await load();
    selected.value = character;
    draft.value = structuredClone(character.draft);
    message.value = ready ? '角色已完成，可選入冒險。' : '草稿已儲存。';
  });
}
function suggest() {
  void run(async () => {
    if (!selected.value || !draft.value) return;
    const suggestion = readCocDraft(
      await requestJson('/api/coc/characters/suggest', {
        method: 'POST',
        body: { id: selected.value.id },
      }),
    );
    draft.value.allocations = suggestion.allocations;
    message.value = '建議點數已填入，可調整後儲存；尚未變更你的角色。';
  });
}
onMounted(() => void run(load));
</script>
<template>
  <div class="coc-library">
    <UiPanel title="我的調查者" note="私人角色庫；冒險使用獨立副本">
      <p>角色在冒險中的傷勢、消耗與成長會留在該冒險，不會覆蓋這裡的原卡。</p>
      <div class="coc-library-list" tabindex="0" aria-label="角色清單">
        <div v-for="character in characters" :key="character.id" class="coc-library-row">
          <span
            >{{ character.name }} ·
            {{
              character.continued ? '倖存者紀錄' : character.status === 'ready' ? '已完成' : '草稿'
            }}</span
          >
          <UiButton
            :label="'檢視或編輯' + character.name"
            caption="編輯"
            icon="edit"
            :disabled="pending"
            @click="pick(character)"
          />
          <UiButton
            v-if="props.selectable"
            :label="'使用' + character.name"
            caption="選擇"
            icon="check"
            :disabled="pending || character.status !== 'ready'"
            @click="emit('selected', character.id)"
          />
        </div>
        <p v-if="!characters.length">尚無角色。可選擇預設角色，或依步驟自訂。</p>
      </div>
    </UiPanel>
    <UiPanel v-if="catalog" title="建立角色" note="能力值擲骰後固定，選擇與點數可在儲存前檢視">
      <div class="coc-fields">
        <UiField v-model="name" label="角色名稱" maxlength="80" :disabled="pending" />
        <UiField
          v-model="occupation"
          label="職業／預設角色類型"
          control="select"
          :options="catalog.occupations.map((v) => ({ value: v.id, label: v.name }))"
          :disabled="pending"
        />
        <UiField
          v-model="archetype"
          label="英雄原型（自訂）"
          control="select"
          :options="catalog.archetypes.map((v) => ({ value: v.id, label: v.name }))"
          :disabled="pending"
        />
        <UiField
          v-model="core"
          label="核心能力（自訂）"
          control="select"
          :options="(build?.cores || []).map((v) => ({ value: v, label: catalog!.attributes[v] }))"
          :disabled="pending"
        />
      </div>
      <div class="coc-actions"
        ><UiButton
          label="使用預設角色"
          icon="users"
          :pending="pending"
          @click="create(true)" /><UiButton
          label="擲骰並自訂角色"
          icon="cards"
          variant="primary"
          :pending="pending"
          @click="create(false)"
      /></div>
      <p>{{ catalog.support }}</p>
    </UiPanel>
    <UiPanel
      v-if="catalog && selected && draft"
      :title="draft.name"
      :note="
        '版本 ' +
        selected.revision +
        ' · ' +
        Math.floor((draft.attributes.CON + draft.attributes.SIZ) / 5) +
        ' HP（Pulp）'
      "
    >
      <dl class="coc-attributes"
        ><div v-for="(value, id) in draft.attributes" :key="id"
          ><dt>{{ catalog.attributes[id] }}</dt
          ><dd>{{ value }} / {{ Math.floor(value / 2) }} / {{ Math.floor(value / 5) }}</dd></div
        ><div
          ><dt>幸運</dt><dd>{{ draft.luck }}</dd></div
        ></dl
      >
      <template v-if="selected.continued"
        ><p>這是冒險後另存的倖存者紀錄。傷勢、理智、物品與成長保持原狀，不重新配點。</p
        ><p
          >體力 {{ selected.sheet?.hp }}／{{ selected.sheet?.maxHp }} · 理智
          {{ selected.sheet?.san }} · 魔力 {{ selected.sheet?.mp }} · 幸運 {{ draft.luck }}</p
        ><p>配點欄保留原始分配；總值包含冒險成長，不再重新分配。</p>
        <CocSkillMatrix :rows="matrixRows" readonly /> </template
      ><template v-else
        ><UiTabs
          v-model="step"
          :items="[
            { id: 'background', label: '1 背景與天賦' },
            { id: 'skills', label: '2 技能點數' },
            { id: 'review', label: '3 檢視與完成' },
          ]"
          label="角色建立步驟"
          panel-prefix="coc-build" />
        <div
          v-show="step === 'background'"
          id="coc-build-background"
          role="tabpanel"
          class="coc-build-slot"
        >
          <div class="coc-fields"
            ><UiField v-model="draft.name" label="角色名稱" maxlength="80" /><UiField
              v-model.number="draft.age"
              label="年齡（15–90）"
              type="number"
              min="15"
              max="90"
          /></div>
          <div class="coc-fields"
            ><UiField
              v-for="field in backgroundFields"
              :key="field.id"
              v-model="draft.background[field.id]"
              :label="field.label"
              control="textarea"
              maxlength="500"
              rows="2"
          /></div>
          <p>選擇兩項天賦（{{ draft.talents.length }} / 2）</p>
          <div class="coc-fields"
            ><UiCheckbox
              v-for="talent in catalog.talents"
              :key="talent.id"
              :model-value="draft.talents.includes(talent.id)"
              :label="talent.name + '：' + talent.effect"
              :disabled="!draft.talents.includes(talent.id) && draft.talents.length >= 2"
              @update:model-value="toggleTalent(talent.id, $event === true)"
          /></div>
          <p>起始裝備（本篇主持人允許攜帶的常規物品）</p>
          <div class="coc-fields"
            ><UiCheckbox
              v-for="(label, id) in equipmentLabels"
              :key="id"
              :label="label"
              :model-value="draft.equipment.includes(id)"
              @update:model-value="toggleEquipment(id, $event === true)"
          /></div>
        </div>
        <div
          v-show="step === 'skills'"
          id="coc-build-skills"
          role="tabpanel"
          class="coc-build-slot"
        >
          <p
            >{{ career?.name }}：{{ career?.formula }}；信用評級
            {{ career?.credit.join('–') }}。原型未用完的點數可放棄。</p
          >
          <div class="coc-budget-grid">
            <UiPanel
              v-for="kind in categories"
              :key="kind.id"
              density="compact"
              :title="kind.label + '點數'"
              :class="{ 'coc-over-budget': used(kind.id) > selected.budgets[kind.id] }"
              ><div class="coc-budget-body">
                <p class="coc-remaining">剩餘 {{ selected.budgets[kind.id] - used(kind.id) }}</p>
                <progress
                  :value="Math.min(used(kind.id), selected.budgets[kind.id])"
                  :max="Math.max(1, selected.budgets[kind.id])"
                  :aria-label="kind.label + '已用點數'"
                />
                <p>{{ used(kind.id) }} / {{ selected.budgets[kind.id] }} 已用</p>
                <p class="coc-budget-hint">{{
                  used(kind.id) > selected.budgets[kind.id]
                    ? '已超額，請減少分配'
                    : '依表格分配可用點數'
                }}</p></div
              >
            </UiPanel>
          </div>
          <div class="coc-actions"
            ><UiButton label="採用建議技能分配" icon="check" :disabled="pending" @click="suggest"
          /></div>
          <CocSkillMatrix :rows="matrixRows" :pending="pending" @allocate="allocate" />
        </div>
        <div
          v-show="step === 'review'"
          id="coc-build-review"
          role="tabpanel"
          class="coc-build-slot"
        >
          <p
            >核心能力：{{ catalog.attributes[draft.core] }}；職業：{{ career?.name }}；天賦：{{
              draft.talents.map((id) => catalog!.talents.find((t) => t.id === id)?.name).join('、')
            }}。</p
          >
          <p>伺服器會驗證職業／原型點數來源、信用評級與背景。未用完的原型點數會放棄。</p>
          <p>裝備：{{ draft.equipment.map((id) => equipmentLabels[id] || id).join('、') }}</p>
        </div>
        <div class="coc-actions"
          ><UiButton
            label="儲存草稿"
            icon="save"
            :pending="pending"
            @click="save(false)" /><UiButton
            label="完成角色"
            icon="check"
            variant="primary"
            :pending="pending"
            @click="save(true)" /></div
      ></template>
    </UiPanel>
    <StatusSlot :message="message" :error="failed" :notice-key="notice" persistent />
  </div>
</template>
<style scoped>
.coc-library,
.coc-build-slot {
  display: grid;
  gap: var(--stitch-space-16);
  min-inline-size: 0;
}
.coc-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-16);
}
.coc-actions,
.coc-budget {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-12);
  align-items: center;
  min-block-size: var(--stitch-control-height);
}
.coc-attributes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--stitch-space-12);
}
.coc-attributes dd {
  margin: 0;
}
.coc-library-list {
  block-size: 14rem;
  overflow: auto;
  scrollbar-gutter: stable;
}
.coc-library-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-space-8);
  min-block-size: var(--stitch-control-height);
  padding-block: var(--stitch-space-4);
}
.coc-library-row > span {
  flex: 1;
  min-inline-size: 8rem;
  overflow-wrap: anywhere;
}
.coc-build-slot {
  min-block-size: 24rem;
  padding-block: var(--stitch-space-16);
}
.coc-budget-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--stitch-space-12);
  align-items: stretch;
}
.coc-budget-grid :deep(.ui-panel) {
  min-inline-size: 0;
}
.coc-budget-body {
  display: grid;
  gap: var(--stitch-space-8);
}
.coc-budget-grid p {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.coc-remaining {
  font-weight: 700;
}
.coc-budget-hint {
  min-block-size: 3em;
}
.coc-budget-grid progress {
  inline-size: 100%;
  accent-color: var(--stitch-primary);
}
.coc-over-budget {
  color: var(--stitch-danger-ink);
}
.coc-over-budget .coc-budget-body :is(.coc-remaining, .coc-budget-hint) {
  color: var(--stitch-danger-ink);
}
@media (max-width: 760px) {
  .coc-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .coc-attributes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .coc-budget-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
