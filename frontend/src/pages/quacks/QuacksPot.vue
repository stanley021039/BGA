<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { QuacksSnapshot, QuacksRecipe, QuacksInsight } from '../../contracts/quacks';
import { useSteppedAnimations } from '../../composables/stepped-animations';
import '../../styles/quacks-pot.scss';
import QuacksPublicTray from './QuacksPublicTray.vue';
const props = defineProps<{ state: QuacksSnapshot; recipe: QuacksRecipe }>(),
  host = ref<HTMLElement | null>(null),
  tooltip = ref<HTMLDivElement | null>(null),
  insight = ref<QuacksInsight | null>(null),
  error = ref(''),
  motion = ref(false),
  tipId = useId(),
  stepped = useSteppedAnimations(host, motion);
const wide = window.matchMedia?.('(min-width: 1181px)');
let anchor: Element | null = null,
  generation = 0,
  disposed = false,
  unsubscribe: (() => void) | undefined;
const signature = computed(() =>
  JSON.stringify([
    props.state.code,
    props.state.roundId,
    props.state.options,
    props.state.books,
    props.recipe,
  ]),
);
const danger = computed(
  () =>
    !props.recipe.hidden &&
    !props.recipe.exploded &&
    props.recipe.white !== null &&
    props.recipe.threshold !== null &&
    props.recipe.white >= props.recipe.threshold - 1,
);
function dismiss(target?: Element) {
  if (target && target !== anchor) return;
  generation++;
  if (anchor) {
    const ids = (anchor.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== tipId);
    if (ids.length) anchor.setAttribute('aria-describedby', ids.join(' '));
    else anchor.removeAttribute('aria-describedby');
  }
  anchor = null;
  insight.value = null;
  if (tooltip.value?.matches(':popover-open')) tooltip.value.hidePopover();
}
async function inspect(details: QuacksInsight, _event: Event, target: Element) {
  dismiss();
  if (disposed || props.recipe.hidden) return;
  const epoch = generation;
  anchor = target;
  const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  target.setAttribute('aria-describedby', [...ids, tipId].join(' '));
  insight.value = details;
  await nextTick();
  if (
    disposed ||
    epoch !== generation ||
    anchor !== target ||
    !target.isConnected ||
    !tooltip.value
  )
    return;
  const tip = tooltip.value;
  tip.showPopover?.();
  const box = target.getBoundingClientRect(),
    size = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(8, Math.min(innerWidth - size.width - 8, box.left + box.width / 2 - size.width / 2))}px`;
  const below = box.bottom + 8;
  tip.style.top = `${Math.max(8, Math.min(innerHeight - size.height - 8, below + size.height <= innerHeight - 8 ? below : box.top - size.height - 8))}px`;
}
function render() {
  if (!host.value) return;
  const focused = host.value.contains(document.activeElement)
    ? (document.activeElement as Element)?.getAttribute('data-position')
    : null;
  dismiss();
  if (props.recipe.hidden) {
    host.value.replaceChildren();
    error.value = '';
    return;
  }
  if (!window.QuacksArt) {
    host.value.replaceChildren();
    error.value = '大釜圖像未載入，請更新頁面。';
    return;
  }
  try {
    const node = window.QuacksArt.cauldron(props.state, props.recipe, inspect, dismiss);
    // Wide tables give the pot full height; the overflow basin sits in a right column.
    if (wide?.matches) {
      node.setAttribute('viewBox', '0 0 1040 680');
      node.querySelector('.overflow-basin')?.setAttribute('transform', 'translate(330 -500)');
    }
    node.addEventListener('pointerleave', (event) => {
      if ((event as PointerEvent).pointerType !== 'touch') dismiss();
    });
    node.addEventListener('focusout', (event) => {
      if (!node.contains((event as FocusEvent).relatedTarget as Node | null)) dismiss();
    });
    host.value.replaceChildren(node);
    stepped.refresh();
    if (focused !== null)
      node
        .querySelector<HTMLElement>(`[data-position="${CSS.escape(focused)}"]`)
        ?.focus({ preventScroll: true });
    error.value = '';
  } catch (cause) {
    host.value.replaceChildren();
    error.value = cause instanceof Error ? cause.message : '無法繪製大釜。';
  }
}
function outside(event: PointerEvent) {
  if (
    anchor &&
    event.target instanceof Node &&
    !anchor.contains(event.target) &&
    !tooltip.value?.contains(event.target)
  )
    dismiss();
}
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !insight.value) return;
  event.preventDefault();
  event.stopPropagation();
  dismiss();
}
function visibility() {
  motion.value = !!window.MotionPolicy?.allowsMotion();
  if (document.hidden) dismiss();
}
function viewportChanged() {
  dismiss();
}
onMounted(() => {
  render();
  visibility();
  unsubscribe = window.MotionPolicy?.subscribe(visibility);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape, true);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('resize', viewportChanged);
  window.addEventListener('scroll', viewportChanged, true);
  wide?.addEventListener('change', render);
});
watch(signature, render, { flush: 'post' });
watch(danger, () => stepped.refresh(), { flush: 'post' });
onBeforeUnmount(() => {
  disposed = true;
  dismiss();
  unsubscribe?.();
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('keydown', escape, true);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('resize', viewportChanged);
  window.removeEventListener('scroll', viewportChanged, true);
  wide?.removeEventListener('change', render);
});
</script>
<template>
  <div
    class="vue-quacks-pot"
    :data-quacks-pot="recipe.id"
    :class="{ 'is-danger': danger, 'is-exploded': recipe.exploded, 'is-motion-enabled': motion }"
  >
    <div ref="host" class="vue-quacks-pot-art" />
    <QuacksPublicTray :recipe="recipe" />
    <p v-if="error || recipe.hidden" class="vue-quacks-pot-message" role="status">{{
      error || '這位玩家的大釜尚未公開；爆炸或結算後可查看。'
    }}</p>
  </div>
  <Teleport to="body">
    <div
      :id="tipId"
      ref="tooltip"
      class="vue-quacks-pot-tooltip"
      role="tooltip"
      popover="manual"
      :hidden="!insight"
      data-game-focus-overlay
      :data-ingredient="insight?.color"
    >
      <template v-if="insight"
        ><strong>{{ insight.title }}</strong
        ><p>{{ insight.effect }}</p
        ><small v-if="insight.caption">{{ insight.caption }}</small></template
      >
    </div>
  </Teleport>
</template>
