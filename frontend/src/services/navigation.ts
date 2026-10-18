const gameRoutes = ['poker', 'race', 'majority', 'gift', 'draw', 'trpg', 'telephone', 'musicquiz', 'minimal', 'bluff', 'quacks'];
const room = new RegExp(`^/(?:${gameRoutes.join('|')})/[A-Fa-f0-9]{6}/?$`);

// Explicit local routes only: no external, protocol-relative or script URLs.
export function loginDestination(next: string | null): string {
  return next && (room.test(next) || next === '/market') ? next : '/';
}
