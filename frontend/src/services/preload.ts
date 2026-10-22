// Background warm-up of what the next screen will need. Everything goes into the
// HTTP cache with <link rel="prefetch">, at idle time, and nothing is fetched
// when the visitor asked to save data or is on a slow connection.
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW = new Set(['slow-2g', '2g', '3g']);
const warmed = new Set<string>();

export function preloadAllowed(): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !connection?.saveData && !SLOW.has(connection?.effectiveType || '');
}

export function whenIdle(task: () => void): void {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function')
    window.requestIdleCallback(task, { timeout: 3000 });
  else window.setTimeout(task, 1500);
}

export function warm(urls: readonly string[], { idle = true } = {}): void {
  if (!preloadAllowed()) return;
  const run = () => {
    for (const url of urls) {
      if (!url || warmed.has(url)) continue;
      warmed.add(url);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.append(link);
    }
  };
  if (idle) whenIdle(run);
  else run();
}
