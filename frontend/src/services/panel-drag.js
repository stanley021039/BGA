// One captured pointer per panel; no frame loop or persistent global gesture.
export function createPanelDrag(node, win, changed) {
  let pointer = null,
    position = null,
    disposed = false;
  function viewport() {
    const v = win.visualViewport;
    return {
      x: v?.offsetLeft || 0,
      y: v?.offsetTop || 0,
      width: v?.width || win.innerWidth,
      height: v?.height || win.innerHeight,
    };
  }
  function place(left, top) {
    if (disposed) return;
    const box = node.getBoundingClientRect(),
      view = viewport(),
      margin = 8;
    position = {
      left: Math.max(view.x + margin, Math.min(left, view.x + view.width - box.width - margin)),
      top: Math.max(view.y + margin, Math.min(top, view.y + view.height - box.height - margin)),
    };
    changed({
      left: position.left + 'px',
      top: position.top + 'px',
      right: 'auto',
      bottom: 'auto',
    });
  }
  function start(event) {
    if (disposed || pointer || event.button !== 0) return;
    const target = event.target;
    if (!target?.closest?.('.ui-panel-heading')) return;
    if (target.closest('button,a,input,select,textarea') && !target.closest('[data-panel-drag]'))
      return;
    const box = node.getBoundingClientRect();
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: box.left,
      top: box.top,
    };
    node.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function move(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    place(pointer.left + event.clientX - pointer.x, pointer.top + event.clientY - pointer.y);
    event.preventDefault();
  }
  function end(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const id = pointer.id;
    pointer = null;
    if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
  }
  function key(event) {
    if (
      disposed ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Home') {
      position = null;
      changed({});
      return;
    }
    const box = node.getBoundingClientRect(),
      step = event.shiftKey ? 24 : 8;
    place(
      box.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      box.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
    );
  }
  function resize() {
    if (position) place(position.left, position.top);
  }
  const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(resize) : null;
  observer?.observe(node);
  win.addEventListener('resize', resize);
  win.visualViewport?.addEventListener('resize', resize);
  win.visualViewport?.addEventListener('scroll', resize);
  return {
    start,
    move,
    end,
    key,
    dispose() {
      if (pointer) end({ pointerId: pointer.id });
      disposed = true;
      observer?.disconnect();
      win.removeEventListener('resize', resize);
      win.visualViewport?.removeEventListener('resize', resize);
      win.visualViewport?.removeEventListener('scroll', resize);
    },
  };
}
