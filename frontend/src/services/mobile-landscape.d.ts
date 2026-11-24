export function installMobileLandscape(
  win: Window,
  doc: Document,
  changed: (portrait: boolean) => void,
): { request(): Promise<void>; stop(): void };
