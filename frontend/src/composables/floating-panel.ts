import UIPopover from '../engines/popovers.js';
import { nextTick, onMounted, onScopeDispose, shallowRef, watch, type Ref } from 'vue';
interface Placement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  side: string;
}
declare global {
  interface Window {
    UIPopover?: {
      placement(
        anchor: { left: number; right: number; top: number; bottom: number },
        size: { width: number; height: number },
        viewport: { left: number; top: number; width: number; height: number },
        options: { align: string },
      ): Placement;
    };
  }
}
// Vue owns visibility and styles; the existing pure placement calculation owns geometry.
export function useFloatingPanel(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  opened: Ref<boolean>,
  width: number,
  align = 'end',
) {
  const style = shallowRef<Record<string, string>>({});
  let observer: ResizeObserver | null = null,
    frame = 0,
    disposed = false;
  function position() {
    frame = 0;
    if (disposed || !opened.value || !trigger.value || !panel.value || !UIPopover) return;
    const anchor = trigger.value.getBoundingClientRect(),
      box = panel.value.getBoundingClientRect(),
      viewport = window.visualViewport;
    const result = UIPopover.placement(
      { left: anchor.left, right: anchor.right, top: anchor.top, bottom: anchor.bottom },
      {
        width,
        height: Math.max(
          panel.value.scrollHeight + panel.value.offsetHeight - panel.value.clientHeight,
          box.height,
        ),
      },
      {
        left: viewport?.offsetLeft || 0,
        top: viewport?.offsetTop || 0,
        width: viewport?.width || innerWidth,
        height: viewport?.height || innerHeight,
      },
      { align },
    );
    const next = {
      position: 'fixed',
      left: result.left + 'px',
      top: result.top + 'px',
      width: result.width + 'px',
      maxHeight: result.maxHeight + 'px',
    };
    if (JSON.stringify(next) !== JSON.stringify(style.value)) style.value = next;
  }
  function schedule() {
    if (!disposed && opened.value && !frame) frame = requestAnimationFrame(position);
  }
  watch(opened, async (value) => {
    observer?.disconnect();
    if (!value) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      style.value = {};
      return;
    }
    await nextTick();
    if (!disposed && opened.value) {
      position();
      if (panel.value) observer?.observe(panel.value);
      if (trigger.value) observer?.observe(trigger.value);
    }
  });
  onMounted(() => {
    observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
  });
  onScopeDispose(() => {
    disposed = true;
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
  });
  return { style, schedule };
}
