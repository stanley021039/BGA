// Programmatic focus counts as :focus-visible in Chromium, so a mouse click
// that hands the keyboard to a large surface would paint its focus ring.
// Mark that focus as pointer-driven until the element really loses focus;
// switching windows keeps the mark because the element stays active.
export function focusFromPointer(element: HTMLElement | null | undefined) {
  if (!element) return;
  if (!('pointerFocus' in element.dataset)) {
    element.dataset.pointerFocus = '';
    element.addEventListener('blur', function clear() {
      if (element.ownerDocument.activeElement === element) return;
      delete element.dataset.pointerFocus;
      element.removeEventListener('blur', clear);
    });
  }
  element.focus({ preventScroll: true });
}
