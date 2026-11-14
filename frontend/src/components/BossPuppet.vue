<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted } from 'vue';
import type { LobbyVisitor } from '../contracts/lobby';
import { createBossPuppet } from '../services/boss-puppet.js';
const props = defineProps<{
  visitor: LobbyVisitor;
  src: string;
  active: boolean;
  serverNow: number;
}>();
const node = ref<HTMLElement | null>(null);
let puppet: ReturnType<typeof createBossPuppet> = null;
function refresh() {
  if (!node.value) return;
  if (
    !props.active ||
    !props.visitor.health ||
    (props.visitor.immobileUntil || 0) > props.serverNow
  ) {
    puppet?.dispose();
    puppet = null;
    return;
  }
  puppet ||= createBossPuppet(node.value, props.visitor.bossId || '');
  puppet?.update(
    {
      moving: props.visitor.moving,
      arrivalAt: props.visitor.bossArrivalAt,
      facing: props.visitor.facing,
      intent: props.visitor.bossIntent,
      health: props.visitor.health,
      connected: props.active,
    },
    props.serverNow,
  );
}
onMounted(refresh);
watch(() => [props.visitor, props.active, props.serverNow], refresh, { flush: 'post' });
function visibility() {
  puppet?.dispose();
  puppet = null;
  if (!document.hidden) refresh();
}
onMounted(() => document.addEventListener('visibilitychange', visibility));
onBeforeUnmount(() => {
  puppet?.dispose();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <span ref="node" class="boss-puppet" aria-hidden="true">
    <img class="boss-still" :src="src" alt="" draggable="false" style="animation: none" />
    <span class="boss-action" data-boss-action>
      <span
        v-for="part in ['lower', 'torso', 'head']"
        :key="part"
        class="boss-part"
        :data-boss-part="part"
      >
        <img :src="src" alt="" draggable="false" style="animation: none" />
      </span>
    </span>
  </span>
</template>
<style scoped>
.boss-puppet {
  display: inline-block;
  position: relative;
}
.boss-still {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.boss-action,
.boss-part {
  position: absolute;
  inset: 0;
  transform-origin: 50% 85%;
}
.boss-action {
  visibility: hidden;
}
.boss-puppet[data-animated] .boss-still {
  visibility: hidden;
}
.boss-puppet[data-animated] .boss-action {
  visibility: visible;
}
.boss-part img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.boss-part[data-boss-part='head'] {
  clip-path: inset(0 0 58% 0);
  transform-origin: 50% 44%;
}
.boss-part[data-boss-part='torso'] {
  clip-path: inset(36% 0 20% 0);
  transform-origin: 50% 76%;
}
.boss-part[data-boss-part='lower'] {
  clip-path: inset(74% 0 0 0);
}
</style>
