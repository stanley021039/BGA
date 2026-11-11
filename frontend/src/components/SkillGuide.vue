<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import timing from '../../../public/shared/attack-timing.json';
import { attackEffectGroups } from '../services/effect-variants';
import { fitsAttackSlot } from '../stores/attack-loadout';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiField from './UiField.vue';
import UiPanel from './UiPanel.vue';
import UiTabs from './UiTabs.vue';
const dialog = ref<InstanceType<typeof UiDialog> | null>(null),
  query = ref(''),
  mode = ref('normal');
const panelPrefix = 'skill-guide-' + useId();
const tabs = [
  { id: 'normal', label: 'Q／E' },
  { id: 'ultimate', label: '大招' },
];
const entries = computed(() =>
  attackEffectGroups.filter(
    (g) =>
      fitsAttackSlot(mode.value === 'normal' ? 'q' : 'r', g.original.id) &&
      g.original.label.includes(String(query.value)),
  ),
);
function stats(effect: (typeof attackEffectGroups)[number]['original']) {
  const id = effect.id as keyof typeof timing;
  const phases = timing[id] || [];
  const ultimate = fitsAttackSlot('r', effect.id);
  return {
    segments:
      'damageMultiplier' in effect && effect.damageMultiplier === 0
        ? '防禦招式'
        : effect.id === 'giga_drill'
          ? '1段＋3次持續傷害'
          : ['quicksand_trap', 'venom_thorn'].includes(effect.id)
            ? '2段（15%追加1段）'
            : phases.length + '段',
    energy: ultimate
      ? '能量全滿時施放；命中不回能'
      : effect.id === 'returning_moon'
        ? '去程12；返程0'
        : effect.id === 'beam'
          ? '13.2'
          : effect.id === 'shield' || effect.id === 'sphere'
            ? '首次擋傷+15'
            : effect.id === 'crystal_reflection'
              ? '反彈最多12'
              : phases.length === 1
                ? '12'
                : phases.length === 2
                  ? '12／6'
                  : phases.length === 3
                    ? '12／6／6'
                    : '12／6／6／0',
  };
}
</script>
<template>
  <UiButton label="招式效果一覽" icon="help" @click="dialog?.open()" />
  <UiDialog ref="dialog" title="招式效果一覽">
    <div class="skill-guide-tools"
      ><UiTabs v-model="mode" :items="tabs" label="招式種類" :panel-prefix="panelPrefix" /><UiField
        v-model="query"
        label="搜尋招式"
        type="search"
    /></div>
    <p>各遊戲回能規則相同，同款異色效果相同。</p>
    <div :id="`${panelPrefix}-${mode}`" role="tabpanel" class="skill-guide-grid"
      ><UiPanel
        v-for="entry in entries"
        :key="entry.original.id"
        :title="entry.original.label"
        density="compact"
      >
        <p>{{ stats(entry.original).segments }}</p>
        <p><strong>能量</strong> {{ stats(entry.original).energy }}</p>
        <p>{{ entry.original.description.split('。')[0] }}。</p>
        <details
          ><summary>詳細規則</summary
          ><p
            >{{
              entry.original.description
            }}
            同一增益重施刷新時間；不同減速各自計時，取最強效果。直接回血不受持續回血加減成影響。異色版使用相同戰鬥規則。</p
          ></details
        >
      </UiPanel></div
    >
    <p v-if="!entries.length">沒有符合的招式</p>
  </UiDialog>
</template>
<style scoped>
.skill-guide-tools {
  display: grid;
  gap: var(--stitch-space-16);
}
.skill-guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stitch-space-16);
}
@media (max-width: 640px) {
  .skill-guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
