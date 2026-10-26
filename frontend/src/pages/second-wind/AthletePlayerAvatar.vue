<script setup lang="ts">
import { computed } from 'vue';
import { useAthleteStore } from '../../stores/second-wind';
import UiHoverInfo from '../../components/UiHoverInfo.vue';
import PlayerAvatar from '../../components/PlayerAvatar.vue';
const props = defineProps<{ playerId: string }>();
const athlete = useAthleteStore();
const player = computed(() => athlete.state?.players.find((p) => p.id === props.playerId));
</script>
<template>
  <UiHoverInfo
    :title="player?.name || playerId"
    :show-help="false"
    tabindex="0"
    class="athlete-player-avatar"
  >
    <PlayerAvatar :name="player?.name || playerId" :avatar="player?.avatar" :bot="player?.bot" />
    <template #info
      ><p>玩家 ID：{{ playerId }}</p></template
    >
  </UiHoverInfo>
</template>
<style scoped>
.athlete-player-avatar {
  width: 2.5rem;
  height: 2.5rem;
}
</style>
