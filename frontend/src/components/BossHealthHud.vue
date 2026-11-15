<script setup lang="ts">
import { computed } from 'vue';
import type { LobbyVisitor } from '../contracts/lobby';
import UiPanel from './UiPanel.vue';
import sceneRules from '../../../public/shared/scene-rules.json';
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
const hp = (value: number) =>
  (value / sceneRules.unitScale).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
const phase = (boss: LobbyVisitor) =>
  boss.bossPhase ||
  (health(boss) <= Math.ceil(boss.maxHealth! / 3)
    ? 3
    : health(boss) <= Math.ceil((boss.maxHealth! * 2) / 3)
      ? 2
      : 1);
const phaseLabel = (boss: LobbyVisitor) =>
  ['', '第一階段', '狂暴', '極度狂暴'][phase(boss)] +
  ((boss.bossPhaseLockMs || 0) > 0
    ? ' · 鎖血 ' + Math.ceil(boss.bossPhaseLockMs! / 1000) + '秒'
    : '');
const barFloor = (boss: LobbyVisitor, bar: number) => Math.ceil((boss.maxHealth! * (3 - bar)) / 3);
const barMax = (boss: LobbyVisitor, bar: number) =>
  Math.ceil((boss.maxHealth! * (4 - bar)) / 3) - barFloor(boss, bar);
const barHealth = (boss: LobbyVisitor, bar: number) =>
  Math.max(0, Math.min(barMax(boss, bar), health(boss) - barFloor(boss, bar)));
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
          <span>{{ hp(health(boss)) }} / {{ hp(boss.maxHealth!) }} HP</span>
        </div>
        <div class="boss-health-bars">
          <progress
            v-for="bar in 3"
            :key="bar"
            :value="barHealth(boss, bar)"
            :max="barMax(boss, bar)"
            :aria-label="boss.name + '的第' + bar + '條生命值'"
            :data-active="phase(boss) === bar"
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
  inline-size: min(560px, calc(100vw - var(--stitch-space-32)));
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
  grid-template-columns: minmax(0, 1fr) 23ch;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--stitch-space-4) var(--stitch-space-16);
  color: var(--stitch-ink);
  font-size: var(--stitch-text-label);
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
  block-size: 6px;
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
  display: grid;
  gap: var(--stitch-space-4);
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
    inset-inline-start: auto;
    inset-inline-end: var(--stitch-space-16);
    transform: none;
    inline-size: min(560px, calc(100vw - 488px));
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
    inset-block-start: max(174px, env(safe-area-inset-top));
  }
  :global(body.vue-lobby-arena-focus .boss-health-hud),
  :global(body.vue-lobby-battle .boss-health-hud) {
    inset-block-start: calc(30dvh + var(--stitch-space-24));
  }
}
</style>
