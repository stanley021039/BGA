const gameRoutes = [
  'poker',
  'race',
  'majority',
  'gift',
  'draw',
  'trpg',
  'telephone',
  'musicquiz',
  'minimal',
  'bluff',
  'quacks',
];
const room = new RegExp(`^/(?:${gameRoutes.join('|')})/[A-Fa-f0-9]{6}/?$`);
const documents = new Set([
  '/',
  '/market',
  '/profile',
  '/settings',
  '/collection',
  '/studio',
  '/music',
  '/achievements',
  '/community',
  '/draw-words',
  '/gifts',
  '/admin',
  '/rules',
  '/credits',
]);

// Explicit local routes only: no external, protocol-relative or script URLs.
export function loginDestination(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next))
    return '/';
  try {
    const url = new URL(next, location.origin);
    if (
      url.origin !== location.origin ||
      (!room.test(url.pathname) && !documents.has(url.pathname))
    )
      return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}
