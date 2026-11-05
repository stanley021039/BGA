import definitions from '../../../public/shared/attack-effects.json';

const byId = new Map(definitions.map((effect) => [effect.id, effect]));
export const attackVariant = (id) => {
  const effect = byId.get(id);
  return effect?.paletteHue === undefined ? undefined : effect;
};
export const attackArtworkKind = (id) => attackVariant(id)?.variantOf ?? id;
export const isDefensiveAttack = (id) => ['shield', 'sphere'].includes(attackArtworkKind(id));

const gradientMethods = new Set([
  'createLinearGradient',
  'createRadialGradient',
  'createConicGradient',
]);
const colorProperties = new Set(['strokeStyle', 'fillStyle', 'shadowColor']);

// Recolor each paint, including gradient stops, on the existing shared canvas.
// Isolated per cast so an overlapping original keeps its own colors.
export function attackPalette(context, hue) {
  const cache = new Map();
  function color(value) {
    if (typeof value !== 'string') return value;
    if (cache.has(value)) return cache.get(value);
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    const rgba = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(value);
    const hsl = /^hsla?\(([\d.]+),\s*[\d.]+%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)$/.exec(value);
    let light,
      alpha = 1;
    if (hex || rgba) {
      const channels = hex
        ? hex[1]
            .match(hex[1].length === 3 ? /./g : /../g)
            .map((part) => parseInt(part.length === 1 ? part + part : part, 16))
        : rgba.slice(1, 4).map(Number);
      light = (Math.min(...channels) + Math.max(...channels)) / 5.1;
      alpha = rgba?.[4] ?? 1;
    } else if (hsl) {
      light = Number(hsl[2]);
      alpha = hsl[3] ?? 1;
    }
    // Keep the white cores and deep outlines. Give neutral midtones a visible tint.
    const tinted =
      light === undefined || light <= 3 || light >= 98
        ? value
        : 'hsla(' + hue + ', 78%, ' + Math.round(light) + '%, ' + alpha + ')';
    if (cache.size >= 256) cache.clear();
    cache.set(value, tinted);
    return tinted;
  }
  const methods = new Map();
  const ctx = new Proxy(context, {
    get(target, key) {
      if (methods.has(key)) return methods.get(key);
      const value = target[key];
      if (typeof value !== 'function') return value;
      const method = gradientMethods.has(key)
        ? (...args) => {
            const gradient = value.apply(target, args);
            const add = gradient.addColorStop.bind(gradient);
            gradient.addColorStop = (offset, stop) => add(offset, color(stop));
            return gradient;
          }
        : value.bind(target);
      methods.set(key, method);
      return method;
    },
    set(target, key, value) {
      target[key] = colorProperties.has(key) ? color(value) : value;
      return true;
    },
  });
  return { ctx, color };
}
