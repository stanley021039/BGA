export function createPanelDrag(
  node: HTMLElement,
  win: Window,
  changed: (style: Record<string, string>) => void,
): {
  start(event: PointerEvent): void;
  move(event: PointerEvent): void;
  end(event: Pick<PointerEvent, 'pointerId'>): void;
  key(event: KeyboardEvent): void;
  dispose(): void;
};
