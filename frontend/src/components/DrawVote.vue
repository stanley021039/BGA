<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue';
import { useDrawResultsStore } from '../stores/draw-results';
import UiButton from './UiButton.vue';
import '../styles/draw-gallery.scss';
const props = defineProps<{ resultId: string | null }>(), results = useDrawResultsStore(), prefix = useId(), status = ref<HTMLElement | null>(null);
const presentation = computed(() => results.votePresentation(props.resultId));
async function vote(event: MouseEvent) {
  const id = props.resultId, trigger = event.currentTarget;
  if (!id) return; await results.vote(id); await nextTick();
  if (props.resultId === id && presentation.value.disabled && (document.activeElement === trigger || document.activeElement === document.body)) status.value?.focus({ preventScroll: true });
}
</script>
<template><section class="vue-result-vote vue-stitch-result-vote" aria-label="題目停用投票"><UiButton stitch variant="ghost" icon="ban" :caption="presentation.label" :label="presentation.label" :aria-describedby="prefix + '-summary ' + prefix + '-status'" :disabled="presentation.disabled" :pending="presentation.label === '送出投票…'" @click="vote" /><p :id="prefix + '-summary'" class="vue-result-vote-summary" aria-live="polite">{{ presentation.summary }}</p><p :id="prefix + '-status'" ref="status" class="frontend-status" role="status" tabindex="-1" :data-status="presentation.kind">{{ presentation.status }}</p></section></template>
