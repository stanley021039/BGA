// Read-only first-paint snapshot. The HTTP adapter serializes this trusted
// function before CSS; ESM preference owners alone persist and subscribe.
export function prepaint() {
  try {
    const saved = localStorage.getItem('ah-color-scheme');
    const scheme = ['light', 'dark'].includes(saved)
      ? saved
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    document.documentElement.dataset.colorScheme = scheme;
    const entry = JSON.parse(localStorage.getItem('bga-entry-intro-settings') || 'null');
    document.documentElement.classList.toggle(
      'entry-intro-disabled',
      entry?.version === 1 && entry.enabled === false,
    );
  } catch {
    /* Storage refusal must never block the document. */
  }
}
