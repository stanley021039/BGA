import { nextTick, onScopeDispose, watch, type Ref } from 'vue';

// Ambient CSS animations on SVG run on the main thread, so letting them play
// repaints the page at the display rate (144/s measured) for as long as they
// are on screen. The driver keeps them paused and moves every registered
// element to one shared clock FRAME_MS at a time; sharing the clock keeps
// elements that started at different moments on the same frames.
const FRAME_MS = 1000 / 12;
const sources = new Set<() => Animation[]>();
let timer: ReturnType<typeof setInterval> | null = null;

function paint(animations: Iterable<Animation>) {
  const time = performance.now();
  // A cancelled CSS animation (its class was removed) would come back if given a time.
  for (const animation of animations)
    if (animation.playState !== 'idle') animation.currentTime = time;
}
function tick() {
  for (const source of sources) paint(source());
}
function schedule() {
  if (sources.size && !timer) timer = setInterval(tick, FRAME_MS);
  else if (!sources.size && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function useSteppedAnimations(root: Ref<HTMLElement | null>, running: Ref<boolean>) {
  let animations: Animation[] = [];
  const source = () => animations;
  // Call after the element's content or animation classes change.
  function refresh() {
    animations = root.value?.getAnimations?.({ subtree: true }) || [];
    for (const animation of animations) animation.pause();
    if (running.value && animations.length) {
      paint(animations);
      sources.add(source);
    } else sources.delete(source);
    schedule();
  }
  watch(running, () => nextTick(refresh));
  onScopeDispose(() => {
    sources.delete(source);
    schedule();
  });
  return { refresh };
}
