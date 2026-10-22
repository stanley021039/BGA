<script setup lang="ts">
import { lobbyBackgrounds, useLobbyBackgroundStore } from '../stores/lobby-background';
const background = useLobbyBackgroundStore();
</script>
<template>
  <section
    class="vue-preference-group lobby-background-preference"
    aria-labelledby="lobby-background-heading"
  >
    <h3 id="lobby-background-heading">大廳背景</h3>
    <div class="lobby-background-options" role="group" aria-label="我的大廳背景">
      <button
        v-for="item in lobbyBackgrounds"
        :key="item.id"
        type="button"
        :aria-pressed="background.selected === item.id"
        @click="background.select(item.id)"
      >
        <span class="lobby-background-swatch" :data-background="item.id" aria-hidden="true"></span>
        <span>{{ item.label }}</span>
      </button>
    </div>
    <p>只改變你看到的大廳。</p>
  </section>
</template>
<style scoped>
.lobby-background-preference h3 {
  margin: 0 0 8px;
  font-size: 16px;
}
.lobby-background-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.lobby-background-options button {
  --ui-button-radius: 12px;
  --ui-button-border-color: var(--play-line, #8a928d);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: stretch;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--play-line, #8a928d);
  border-radius: 12px;
  background: var(--play-surface, #1c2826);
  color: inherit;
  cursor: pointer;
}
.lobby-background-options button[aria-pressed='true'] {
  --ui-button-border-color: #edbc5b;
  border-color: #edbc5b;
  box-shadow: 0 0 0 2px #edbc5b66;
}
.lobby-background-swatch {
  display: block;
  width: 100%;
  height: 64px;
  border-radius: 6px;
  background: var(--play-paper, #304238);
}
.lobby-background-swatch[data-background='castle'] {
  background: #090e1a url('../assets/lobby-castle-stitch.svg') center / cover no-repeat;
}
</style>
