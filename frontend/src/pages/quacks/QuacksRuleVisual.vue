<script setup lang="ts">
import QuacksGlyph from './QuacksGlyph.vue';
import UiIcon from '../../components/UiIcon.vue';
import type { Ingredient } from '../../contracts/quacks';
defineProps<{
  text: string;
  chip?: Ingredient;
  resource?: string;
  patient?: string;
  icon?: string;
}>();
</script>
<template>
  <span
    class="quacks-rule-visual"
    data-quacks-visual-rule
    data-ui-hint
    role="img"
    :aria-label="text"
    :title="text"
    tabindex="0"
  >
    <span v-if="!chip && !patient && text.length <= 10" class="quacks-short-effect">{{ text }}</span
    ><UiIcon v-else-if="icon" :name="icon" />
    <QuacksGlyph
      v-else
      :chip="chip"
      :hint="text"
      :patient="patient"
      :resource="resource || 'essence'"
      :size="40"
      :show-value="false"
    />
  </span>
</template>
<style>
.quacks-rule-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  max-width: 100%;
  color: var(--play-ink);
  cursor: help;
}
.quacks-rule-visual > span {
  flex: none;
}
.quacks-rule-visual .ui-icon {
  width: 28px;
  height: 28px;
}
.quacks-rule-visual:focus-visible {
  outline: 3px solid var(--play-accent, #daa93e);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
