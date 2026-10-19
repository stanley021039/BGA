import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useGameFocus(className = 'vue-game-focus') {
  const focused = ref(false); let owned = false, disposed = false, previous: HTMLElement | null = null, scroll = { x:0, y:0 };
  async function exit() {
    const native = owned && document.fullscreenElement === document.documentElement;
    focused.value = false; owned = false; document.body.classList.remove(className);
    if (native) try { await document.exitFullscreen(); } catch { /* Local focus still exits. */ }
    if (!disposed) { window.scrollTo(scroll.x,scroll.y); if (previous?.isConnected) previous.focus({ preventScroll:true }); }
  }
  async function toggle() {
    if (focused.value) return exit();
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; scroll = { x:scrollX,y:scrollY };
    focused.value = true; document.body.classList.add(className);
    if (!document.fullscreenElement) try { await document.documentElement.requestFullscreen(); if (focused.value && !disposed) owned = true; else if (document.fullscreenElement === document.documentElement) await document.exitFullscreen(); } catch { /* CSS focus is available if native fullscreen is unavailable. */ }
  }
  function nativeChange() { if (focused.value && owned && !document.fullscreenElement) void exit(); }
  function escape(event: KeyboardEvent) { if (!event.defaultPrevented && event.key === 'Escape' && focused.value && !document.querySelector('dialog:modal, :popover-open')) { event.preventDefault(); void exit(); } }
  onMounted(() => { document.addEventListener('fullscreenchange',nativeChange); document.addEventListener('keydown',escape); });
  onBeforeUnmount(() => { disposed = true; document.removeEventListener('fullscreenchange',nativeChange); document.removeEventListener('keydown',escape); void exit(); });
  return { focused, toggle, exit };
}
