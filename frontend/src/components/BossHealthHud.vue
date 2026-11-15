<script setup lang="ts">
import { computed } from 'vue';
import type { LobbyVisitor } from '../contracts/lobby';
import UiPanel from './UiPanel.vue';
const props = defineProps<{ visitors: LobbyVisitor[]; connected: boolean }>();
const bosses = computed(() =>
  props.connected
    ? props.visitors
        .filter(
          (v) =>
            v.bossId &&
            Number.isFinite(v.health) &&
            Number.isFinite(v.maxHealth) &&
            v.maxHealth! > 0,
        )
        .slice(0, 2)
    : [],
);
const health = (boss: LobbyVisitor) => Math.max(0, Math.min(boss.maxHealth!, boss.health!));
const hp = (value: number) => value.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const phase = (boss: LobbyVisitor) =>
  boss.bossPhase ||
  (health(boss) <= Math.ceil(boss.maxHealth! / 3)
    ? 3
    : health(boss) <= Math.ceil((boss.maxHealth! * 2) / 3)
      ? 2
      : 1);
const phaseLabel = (boss: LobbyVisitor) =>
  ['', '第一階段', '二階段・狂暴', '最終階段'][phase(boss)] +
  ((boss.bossPhaseLockMs || 0) > 0
    ? ' · 鎖血 ' + Math.ceil(boss.bossPhaseLockMs! / 1000) + '秒'
    : '');
</script>
<template>
  <Teleport to="body">
    <div v-if="bosses.length" class="boss-health-hud" aria-label="Boss 生命值">
      <UiPanel
        v-for="boss in bosses"
        :key="boss.id"
        density="hud"
        tone="translucent"
        class="boss-health-entry"
        :data-boss-id="boss.id"
      >
        <div class="boss-health-caption">
          <strong
            >{{ boss.name
            }}<small class="boss-phase-label"> · {{ phaseLabel(boss) }}</small></strong
          >
          <span>總生命 {{ hp(health(boss)) }} / {{ hp(boss.maxHealth!) }} HP</span>
        </div>
        <div class="boss-health-bars">
          <progress
            :value="health(boss)"
            :max="boss.maxHealth"
            :aria-label="boss.name + '的總生命值（三階段）'"
          />
          <span
            v-for="divider in 2"
            :key="divider"
            class="boss-health-divider"
            :style="{ left: (divider * 100) / 3 + '%' }"
            aria-hidden="true"
          />
        </div>
        <span v-if="health(boss) === 0" class="boss-health-defeated">已擊倒</span>
      </UiPanel>
    </div>
  </Teleport>
</template>
<style scoped>
.boss-health-hud {
  position: fixed;
  inset-block-start: max(76px, env(safe-area-inset-top));
  inset-inline-start: 50%;
  transform: translateX(-50%);
  inline-size: min(720px, calc(100vw - var(--stitch-space-32)));
  z-index: 31;
  pointer-events: none;
  display: grid;
  gap: var(--stitch-space-8);
}
.boss-health-entry {
  min-inline-size: 0;
}
.boss-health-caption {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30ch;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--stitch-space-4) var(--stitch-space-16);
  color: var(--stitch-ink);
  font-size: var(--stitch-text-body);
  line-height: var(--stitch-line-height-heading);
}
.boss-health-caption strong {
  overflow-wrap: anywhere;
  font-size: inherit;
  line-height: inherit;
}
.boss-health-caption span {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: end;
  font-size: inherit;
  line-height: inherit;
}
.boss-health-entry progress {
  appearance: none;
  display: block;
  inline-size: 100%;
  block-size: var(--stitch-space-16);
  border: var(--stitch-border);
  border-radius: var(--stitch-radius-pill);
  overflow: hidden;
  background: var(--stitch-line);
  accent-color: var(--stitch-boss-health-fill);
}
.boss-health-entry progress::-webkit-progress-bar {
  background: var(--stitch-line);
}
.boss-health-entry progress::-webkit-progress-value {
  background: var(--stitch-boss-health-fill);
}
.boss-health-entry progress::-moz-progress-bar {
  background: var(--stitch-boss-health-fill);
}
.boss-health-bars {
  position: relative;
}
.boss-health-divider {
  position: absolute;
  inset-block: 0;
  width: 2px;
  transform: translateX(-50%);
  background: var(--stitch-surface);
}
.boss-phase-label {
  font-size: inherit;
  color: var(--stitch-boss-health-fill);
}
.boss-health-defeated {
  color: var(--stitch-ink);
  font-size: var(--stitch-text-label);
}
:global(body.vue-lobby-arena-focus .boss-health-hud) {
  inset-block-start: max(var(--stitch-space-16), env(safe-area-inset-top));
}
@media (min-width: 701px) {
  :global(body.vue-lobby-battle .boss-health-hud),
  :global(body.vue-lobby-arena-focus .boss-health-hud) {
    inset-block-start: max(var(--stitch-space-16), env(safe-area-inset-top));
  }
}
@media (max-width: 700px) {
  .boss-health-caption {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(1.25em, auto) 1.25em;
    row-gap: var(--stitch-space-4);
  }
  .boss-health-caption span {
    justify-self: end;
  }
  .boss-health-hud {
    inset-block-start: max(216px, env(safe-area-inset-top));
  }
  :global(body.vue-lobby-arena-focus .boss-health-hud),
  :global(body.vue-lobby-battle .boss-health-hud) {
    inset-block-start: calc(30dvh + var(--stitch-space-24));
  }
}
</style>
