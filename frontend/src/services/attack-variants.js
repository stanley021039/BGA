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

function readPaint(value) {
  const hsl = /^hsla?\(([-\d.]+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)$/.exec(value);
  if (hsl)
    return {
      hue: Number(hsl[1]),
      saturation: Number(hsl[2]),
      light: Number(hsl[3]),
      alpha: hsl[4] ?? 1,
    };
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  const rgba = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(value);
  if (!hex && !rgba) return;
  const [red, green, blue] = hex
    ? hex[1]
        .match(hex[1].length === 3 ? /./g : /../g)
        .map((part) => parseInt(part.length === 1 ? part + part : part, 16))
    : rgba.slice(1, 4).map(Number);
  const max = Math.max(red, green, blue),
    min = Math.min(red, green, blue);
  const chroma = max - min,
    light = (max + min) / 5.1;
  const hue = !chroma
    ? 0
    : max === red
      ? (green - blue) / chroma
      : max === green
        ? (blue - red) / chroma + 2
        : (red - green) / chroma + 4;
  const saturation = chroma ? (100 * chroma) / (255 - Math.abs(max + min - 255)) : 0;
  return { hue: hue * 60, saturation, light, alpha: rgba?.[4] ?? 1 };
}

// Rotate the main hue and carry the original accents along with it. Keep the
// alpha and lightness of each paint so the glow, core and outline still read.
export function attackPalette(context, hue, baseColor) {
  const shift = hue - (readPaint(baseColor)?.hue ?? hue);
  const cache = new Map();
  function color(value) {
    if (typeof value !== 'string') return value;
    if (cache.has(value)) return cache.get(value);
    const paint = readPaint(value);
    let tinted = value;
    if (paint && paint.light > 3 && paint.light < 98) {
      const targetHue = paint.saturation >= 15 ? paint.hue + shift : hue;
      const saturation = Math.round(Math.max(30, paint.saturation * 0.92));
      tinted =
        'hsla(' +
        Math.round(((targetHue % 360) + 360) % 360) +
        ', ' +
        saturation +
        '%, ' +
        Math.round(paint.light) +
        '%, ' +
        paint.alpha +
        ')';
    }
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
