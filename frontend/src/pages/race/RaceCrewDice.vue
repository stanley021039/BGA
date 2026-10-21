<script setup lang="ts">
import type { RacePlayer } from '../../contracts/race';
import RaceDie from './RaceDie.vue';
withDefaults(defineProps<{ player: RacePlayer; variant?: number }>(), { variant: 0 });
</script>
<template>
  <div class="vue-race-roster-details">
    <span>輕型 · 中型 · 重型</span>
    <div class="vue-race-roster-dice" :aria-label="player.name + ' 的公開移動骰'">
      <RaceDie
        v-for="(die, i) in player.dice"
        :key="i"
        :value="die.value"
        :color="player.color"
        :variant="variant"
        :class="{ spent: die.used }"
      />
      <span v-if="!player.dice.length">骰子尚未公開</span>
    </div>
  </div>
</template>
