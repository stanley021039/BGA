<script setup lang="ts">
import { useId } from 'vue';
import UiHeading from './UiHeading.vue';
// The framed section from Figma 03 C07. Pages set layout (grid area, size)
// only; border, radius, surface and padding belong here.
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    note?: string;
    as?: 'section' | 'div' | 'article' | 'aside';
    headingLevel?: 2 | 3;
    tone?: 'surface' | 'subtle' | 'selected' | 'raised';
    density?: 'regular' | 'compact';
  }>(),
  { as: 'section', headingLevel: 2, tone: 'surface', density: 'regular' },
);
const headingId = useId();
</script>
<template>
  <component
    :is="as"
    class="ui-panel"
    :data-tone="tone"
    :data-density="density"
    :aria-labelledby="title ? headingId : undefined"
  >
    <header v-if="title || $slots.actions" class="ui-panel-heading"
      ><div
        v-if="title"
        class="ui-panel-title"
        :class="{ 'ui-panel-title-with-slots': $slots['title-before'] || $slots['title-after'] }"
        ><div v-if="$slots['title-before'] || $slots['title-after']" class="ui-panel-title-content">
          <slot name="title-before" /><UiHeading
            :level="headingLevel"
            kind="section"
            :id="headingId"
            >{{ title }}</UiHeading
          ><div v-if="$slots['title-after']" class="ui-panel-title-extra"
            ><slot name="title-after"
          /></div> </div
        ><UiHeading v-else :level="headingLevel" kind="section" :id="headingId">{{
          title
        }}</UiHeading
        ><p v-if="description" class="ui-panel-description">{{ description }}</p></div
      ><span v-if="note" class="ui-panel-note">{{ note }}</span
      ><slot name="actions"
    /></header>
    <slot />
  </component>
</template>
