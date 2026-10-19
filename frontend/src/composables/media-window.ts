import { computed, onScopeDispose, ref, type Ref } from 'vue';

interface Point { left: number; top: number }
interface Size { width: number; height: number }
const positionKey = 'bga.media.window.v1', sizeKey = 'bga.media.size.v1';
export function useMediaWindow(node: Ref<HTMLDialogElement | null>, opened: Ref<boolean>, mode: Ref<'full' | 'compact' | 'bar'>) {
  let position: Point | null = null, size: Size | null = null;
  try { const value = JSON.parse(localStorage.getItem(positionKey) || 'null'); if (Number.isFinite(value?.left) && Number.isFinite(value?.top)) position = value; } catch { /* Local geometry is optional. */ }
  try { const value = JSON.parse(localStorage.getItem(sizeKey) || 'null'); if (Number.isFinite(value?.width) && Number.isFinite(value?.height)) size = value; } catch { /* Local geometry is optional. */ }
  const box = ref({ left: 8, top: 8, width: 430, height: 720 });
  const style = computed(() => ({ left: box.value.left + 'px', top: box.value.top + 'px', width: box.value.width + 'px', height: box.value.height + 'px' }));
  let pointer: { id: number; node: HTMLElement; edge: string; x: number; y: number; before: typeof box.value; position: Point | null; size: Size | null } | null = null;
  const edges = [['n', '上邊'], ['s', '下邊'], ['w', '左邊'], ['e', '右邊'], ['nw', '左上角'], ['ne', '右上角'], ['sw', '左下角'], ['se', '右下角']];
  function viewport() {
    const header = document.querySelector('[data-site-header]')?.getBoundingClientRect();
    const preferred = mode.value === 'bar' ? 56 : mode.value === 'compact' ? 280 : Math.max(520, size?.height || 720);
    const reserved = Math.min(preferred, Math.max(0, innerHeight - 16));
    // A tall mobile room header must not consume the floating player's area.
    // Prefer below-header placement only when the complete window still fits.
    const top = header && header.top <= 32 && header.bottom > 0 ? Math.min(header.bottom + 8, Math.max(8, innerHeight - 8 - reserved)) : 8;
    return { top, width: Math.max(0, innerWidth - 16), height: Math.max(0, innerHeight - top - 8) };
  }
  function layout(candidate = position) {
    const view = viewport(), bar = mode.value === 'bar', compact = mode.value === 'compact';
    const width = Math.min(view.width, bar ? 164 : compact ? 360 : Math.max(Math.min(340, view.width), size?.width || Math.min(430, view.width)));
    const height = Math.min(view.height, bar ? 56 : compact ? 280 : Math.max(Math.min(520, view.height), size?.height || Math.min(720, view.height)));
    box.value = { width, height, left: Math.max(8, Math.min(innerWidth - width - 8, candidate?.left ?? innerWidth - width - 8)), top: Math.max(view.top, Math.min(innerHeight - height - 8, candidate?.top ?? view.top)) };
  }
  function persist() { try { localStorage.setItem(positionKey, JSON.stringify(position)); localStorage.setItem(sizeKey, JSON.stringify(size)); } catch { /* Still usable when storage is disabled. */ } }
  function release() { const active = pointer; pointer = null; if (active) try { active.node.releasePointerCapture(active.id); } catch { /* Pointer capture may already be lost. */ } }
  function cancel() { const active = pointer; if (!active) return; release(); position = active.position; size = active.size; layout(active.before); }
  function start(event: PointerEvent, edge = '') {
    if (!opened.value || pointer || event.button !== 0 || event.isPrimary === false || mode.value !== 'full' && edge) return;
    if (!edge && (event.target as HTMLElement).closest('button,a,input,select')) return;
    event.preventDefault(); const target = event.currentTarget as HTMLElement; layout();
    pointer = { id: event.pointerId, node: target, edge, x: event.clientX, y: event.clientY, before: { ...box.value }, position: position ? { ...position } : null, size: size ? { ...size } : null };
    target.setPointerCapture(event.pointerId);
  }
  function resize(before: typeof box.value, edge: string, dx: number, dy: number) {
    const view = viewport(), minWidth = Math.min(340, view.width), minHeight = Math.min(520, view.height);
    const width = Math.max(minWidth, Math.min(edge.includes('w') ? before.left + before.width - 8 : innerWidth - before.left - 8, before.width + (edge.includes('w') ? -dx : edge.includes('e') ? dx : 0)));
    const height = Math.max(minHeight, Math.min(edge.includes('n') ? before.top + before.height - view.top : innerHeight - before.top - 8, before.height + (edge.includes('n') ? -dy : edge.includes('s') ? dy : 0)));
    size = { width, height }; layout({ left: edge.includes('w') ? before.left + before.width - width : before.left, top: edge.includes('n') ? before.top + before.height - height : before.top });
  }
  function move(event: PointerEvent) { const active = pointer; if (!active || event.pointerId !== active.id) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (active.edge) resize(active.before, active.edge, dx, dy); else layout({ left: active.before.left + dx, top: active.before.top + dy });
  }
  function end(event: PointerEvent) { if (pointer?.id !== event.pointerId) return; release(); position = { left: box.value.left, top: box.value.top }; persist(); }
  function cancelled(event: PointerEvent) { if (pointer?.id === event.pointerId) cancel(); }
  function keyboard(event: KeyboardEvent, edge = '') {
    if ((event.target as HTMLElement).closest('button,a,input,select')) return;
    if (event.key === 'Home') { event.preventDefault(); cancel(); if (edge) size = null; else position = null; layout(); persist(); return; }
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
    if (!direction || edge.length === 1 && (direction[0] && !/[ew]/.test(edge) || direction[1] && !/[ns]/.test(edge))) return;
    event.preventDefault(); const dx = direction[0] * (event.shiftKey ? 50 : 20), dy = direction[1] * (event.shiftKey ? 50 : 20);
    if (edge) resize(box.value, edge, dx, dy); else layout({ left: box.value.left + dx, top: box.value.top + dy });
    position = { left: box.value.left, top: box.value.top }; persist();
  }
  function reset() { cancel(); size = position = null; layout(); persist(); }
  const resized = () => { cancel(); layout(); };
  window.addEventListener('resize', resized);
  onScopeDispose(() => { release(); window.removeEventListener('resize', resized); });
  return { box, style, edges, layout, reset, cancel, start, move, end, cancelled, keyboard };
}
