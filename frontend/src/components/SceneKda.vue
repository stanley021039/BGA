<script setup lang="ts">
import UiBadge from './UiBadge.vue';
import UiIcon from './UiIcon.vue';
import { computed } from 'vue';
import rules from '../../../public/shared/scene-rules.json';
import type { LobbyVisitor } from '../contracts/lobby';
const props = defineProps<{
  value?: { kills: number; deaths: number; assists: number };
  self?: LobbyVisitor;
  connected: boolean;
  skillOnly?: boolean;
}>();
const status = computed(() => props.self?.combatStatus);
const number = (value?: number) => Math.round(value || 0).toLocaleString();
type Indicator = {
  icon: string;
  label: string;
  tone: 'primary' | 'success' | 'info' | 'neutral' | 'danger';
};
const speed = computed<Indicator | null>(() => {
  const { slowMs = 0, hasteMs = 0 } = props.self || {};
  const duration = slowMs || hasteMs;
  if (!props.connected || !props.self?.health || duration <= 0) return null;
  const slowed = slowMs > 0;
  const factor = slowed ? rules.frost.speedMultiplier : rules.bladeHaste.speedMultiplier;
  const percent = Math.round((factor - 1) * 100);
  return {
    icon: slowed ? 'frost' : 'haste',
    label:
      (slowed ? '移動減速 ' : '劍氣加速 +') +
      percent +
      '%，剩餘 ' +
      (Math.ceil(duration / 100) / 10).toFixed(1) +
      ' 秒',
    tone: slowed ? 'info' : 'success',
  };
});
const permanent = computed<Indicator[]>(() =>
  !props.skillOnly && props.connected && props.self?.health && status.value?.authorBonus
    ? statBoosts(status.value)
    : [],
);
function statBoosts(state: NonNullable<LobbyVisitor['combatStatus']>): Indicator[] {
  const boosts: Indicator[] = [];
  const temporary = state.guanyin ? 1.1 : 1;
  const percent = (factor: number) => Math.round((factor - 1) * 1000) / 10;
  const hp = (state.authorBonus ? 1.5 : 1) * temporary,
    attack = (state.authorBonus ? 1.15 : 1) * temporary;
  if (hp > 1)
    boosts.push({ icon: 'health-up', label: '生命上限 +' + percent(hp) + '%', tone: 'primary' });
  if (attack > 1)
    boosts.push({ icon: 'attack-up', label: '攻擊 +' + percent(attack) + '%', tone: 'primary' });
  if (hp > 1)
    boosts.push({ icon: 'regen-up', label: '回復 +' + percent(hp) + '%', tone: 'success' });
  return boosts;
}
const newAilments = computed<Indicator[]>(() => {
  const state = status.value;
  const items: Indicator[] = [];
  if (!props.connected || !props.self?.health) return items;
  if (state?.teleportBlockedMs && !state.sealedMs)
    items.push({
      icon: 'lock',
      label:
        '光柱封鎖：' + (Math.ceil(state.teleportBlockedMs / 100) / 10).toFixed(1) + ' 秒內不能瞬移',
      tone: 'danger',
    });
  if (state?.ordinaryDotMs)
    items.push({
      icon: 'scene-damage',
      label: '持續傷害：剩餘 ' + (Math.ceil(state.ordinaryDotMs / 100) / 10).toFixed(1) + ' 秒',
      tone: 'danger',
    });
  if (speed.value) items.push(speed.value);
  return items;
});
const temporary = computed<Indicator[]>(() => {
  if (props.skillOnly) return newAilments.value;
  if (!props.connected) return [{ icon: 'refresh', label: '連線中，等待更新', tone: 'neutral' }];
  if (!props.self?.health) return [{ icon: 'timer', label: '重生中', tone: 'neutral' }];
  const state = status.value;
  if (!state) return [{ icon: 'refresh', label: '狀態同步中', tone: 'neutral' }];
  const items = state.authorBonus ? [] : statBoosts(state);
  if (state.sealedMs && state.sealedMs > 0)
    items.push({
      icon: 'lock',
      label: '封印：' + (Math.ceil(state.sealedMs / 100) / 10).toFixed(1) + ' 秒內不能攻擊或瞬移',
      tone: 'danger',
    });
  if (state.shield !== 'none' || state.excalibur) {
    const multiplier = state.shield === 'residual' ? 0.5 : 1;
    const minimum = state.shield === 'none' ? 0 : (state.authorBonus ? 40 : 30) * multiplier,
      maximum = state.shield === 'none' ? 0 : (state.authorBonus ? 50 : 40) * multiplier;
    const guard = state.excalibur ? 0.8 : 1;
    const lo = Math.round((1 - (1 - minimum / 100) * guard) * 1000) / 10,
      hi = Math.round((1 - (1 - maximum / 100) * guard) * 1000) / 10;
    items.push({
      icon: 'shield',
      label:
        '減傷 ' +
        lo +
        (hi === lo ? '' : '–' + hi) +
        '%' +
        (state.shield === 'residual' ? '（護盾半幅）' : ''),
      tone: 'info',
    });
  }
  if (state.regenBlockedMs && state.regenBlockedMs > 0)
    items.push({
      icon: 'healing',
      label: '燃燒：' + (Math.ceil(state.regenBlockedMs / 100) / 10).toFixed(1) + ' 秒內無法回復',
      tone: 'danger',
    });
  else if (state.regenerating)
    items.push({
      icon: 'healing',
      label: '回復中，每秒 +' + number(state.regenPerSecond) + ' HP',
      tone: 'success',
    });
  else if (props.self.health < (props.self.maxHealth || 0) && state.regenWaitMs > 0)
    items.push({
      icon: 'timer',
      label: '等待回復 ' + (Math.ceil(state.regenWaitMs / 100) / 10).toFixed(1) + ' 秒',
      tone: 'neutral',
    });
  return [...items, ...newAilments.value];
});
const groups = computed(() => [
  { label: '永久加成', items: permanent.value },
  { label: '即時效果', items: temporary.value },
]);
</script>
<template>
  <div class="scene-stats">
    <div
      v-if="!skillOnly"
      class="scene-kda"
      role="group"
      aria-label="目前大廳戰績"
      :aria-busy="!connected"
    >
      <UiBadge :aria-label="'擊倒 ' + (value?.kills ?? 0)" title="本次大廳擊倒"
        >K {{ value?.kills ?? 0 }}</UiBadge
      >
      <UiBadge :aria-label="'死亡 ' + (value?.deaths ?? 0)" title="本次大廳死亡"
        >D {{ value?.deaths ?? 0 }}</UiBadge
      >
      <UiBadge
        :aria-label="'助攻 ' + (value?.assists ?? 0)"
        title="本次大廳助攻：倒地前10秒內造成傷害"
        >A {{ value?.assists ?? 0 }}</UiBadge
      >
      <span v-if="!connected">連線中</span>
    </div>
    <div v-if="self?.maxHealth" class="scene-self-status" role="group" aria-label="自己的戰鬥狀態">
      <div class="scene-bonuses" aria-label="增益與回復狀態">
        <div
          v-for="group in groups"
          v-show="
            group.items.length || (group.label === '即時效果' && connected && status?.guardEnergy)
          "
          :key="group.label"
          class="scene-effect-group"
          role="group"
          :aria-label="group.label"
        >
          <UiBadge
            v-for="item in group.items"
            :key="item.icon"
            :tone="item.tone"
            :title="item.label"
            :aria-label="item.label"
            :data-status="item.icon"
            data-ui-hint
            role="img"
            tabindex="0"
            ><UiIcon :name="item.icon"
          /></UiBadge>
          <UiBadge
            v-if="group.label === '即時效果' && connected && status?.guardEnergy"
            tone="info"
            role="status"
            >格擋 +{{ status.guardEnergy }} 能量</UiBadge
          >
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.scene-stats {
  display: grid;
  gap: var(--stitch-space-8);
  max-inline-size: min(24rem, calc(100vw - 32px));
  font-variant-numeric: tabular-nums;
}
.scene-self-status {
  display: grid;
  justify-items: stretch;
  gap: var(--stitch-space-8);
}
.scene-bonuses {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-8);
  min-block-size: var(--stitch-space-24);
  align-items: center;
}
.scene-effect-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--stitch-space-8);
}
.scene-effect-group:last-child {
  margin-inline-start: auto;
  justify-content: flex-end;
}
.scene-kda {
  display: flex;
  flex-wrap: wrap;
  gap: var(--stitch-space-8);
  align-items: center;
  font-variant-numeric: tabular-nums;
}
</style>
