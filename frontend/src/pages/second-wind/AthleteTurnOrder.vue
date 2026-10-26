<script setup lang="ts">
defineProps<{ players: { id: string; name: string }[]; active?: string | null; snake?: boolean }>();
</script>
<template>
  <div
    class="athlete-turn-order"
    :aria-label="snake ? '選秀順序' : '行動順序'"
    :title="players.map((p) => p.name).join(snake ? ' ↔ ' : ' → ')"
  >
    <template v-for="(player, index) in players" :key="player.id"
      ><span v-if="index" aria-hidden="true">{{ snake ? ' ↔ ' : ' → ' }}</span
      ><span
        :data-active="player.id === active || undefined"
        :aria-current="player.id === active ? 'step' : undefined"
        >{{ player.name }}</span
      ></template
    >
  </div>
</template>
<style scoped>
.athlete-turn-order {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--stitch-text-hint);
}
.athlete-turn-order [data-active] {
  color: var(--stitch-link);
  font-weight: var(--stitch-weight-title);
}
</style>
