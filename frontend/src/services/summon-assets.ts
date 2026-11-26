const portraits: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  susanoo: ['/assets/attacks/susanoo-violet-256.webp', '/assets/attacks/susanoo-violet-384.webp'],
  susanoo_orange: [
    '/assets/attacks/susanoo-orange-256.webp',
    '/assets/attacks/susanoo-orange-384.webp',
  ],
  susanoo_alt: ['/assets/attacks/susanoo-jade-256.webp', '/assets/attacks/susanoo-jade-384.webp'],
  susanoo_blue: ['/assets/attacks/susanoo-blue-256.webp', '/assets/attacks/susanoo-blue-384.webp'],
  susanoo_cyan: ['/assets/attacks/susanoo-cyan-256.webp', '/assets/attacks/susanoo-cyan-384.webp'],
});

export function summonAssets(effect: string) {
  return Object.hasOwn(portraits, effect) ? portraits[effect] : undefined;
}

const thumbnails: Readonly<Record<string, string>> = Object.freeze({
  susanoo: '/assets/attacks/susanoo-violet-128.webp',
  susanoo_orange: '/assets/attacks/susanoo-orange-128.webp',
  susanoo_alt: '/assets/attacks/susanoo-jade-128.webp',
  susanoo_blue: '/assets/attacks/susanoo-blue-128.webp',
  susanoo_cyan: '/assets/attacks/susanoo-cyan-128.webp',
});
export function summonImage(effect: string, width: number) {
  const assets = summonAssets(effect);
  return assets
    ? width <= 128
      ? thumbnails[effect]
      : width <= 256
        ? assets[0]
        : assets[1]
    : undefined;
}
