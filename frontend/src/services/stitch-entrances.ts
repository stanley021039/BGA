import effects from '../../../public/shared/entrance-stitch.json';
import '../assets/entrance-stitch.css';
import '../assets/entrance-stitch-repairs.css';
import '../assets/entrance-purple-v2.css';
import '../styles/sakura-fall.scss';
import '../styles/entrance-refinements.scss';
import '../styles/entrance-refined-art.scss';
import { refinedStitchArtwork } from './entrance-refined-art';

export const stitchEntrances = effects;
let instance = 0;
// Paint individual materials; never tint the portrait or collapse the whole effect to one hue.
const alternateInk: Record<string, Record<string, string>> = {
  'stitch-chibaku-tensei-alt': {
    '000000': '#100d16',
    '292524': '#100d16',
    '1c1917': '#100d16',
    f59e0b: '#ea4562',
    ea580c: '#9364ce',
    ef4444: '#ea4562',
    fbbf24: '#9364ce',
    ffffff: '#ea4562',
  },
  'stitch-bungee-gum-alt': {
    ec4899: '#b38355',
    d946ef: '#94c4ca',
    f43f5e: '#b38355',
    ffffff: '#f5dbab',
    '000000': '#b38355',
  },
};
function paintAlternate(node: HTMLElement, id?: string) {
  const ink = id && alternateInk[id];
  if (!ink) return;
  const copper = '#b38355',
    cream = '#f5dbab',
    cyan = '#94c4ca';
  const materials: Record<string, string> =
    id === 'stitch-chibaku-tensei-alt'
      ? {
          black: '#100d16',
          'stone-800': '#100d16',
          'stone-950': '#100d16',
          'amber-950': '#9364ce',
          'amber-500': '#ea4562',
          'amber-300': '#9364ce',
          'amber-400': '#ea4562',
        }
      : {
          white: cream,
          'pink-500': copper,
          'pink-400': cream,
          'pink-300': cyan,
          'fuchsia-400': cyan,
          'fuchsia-500': cyan,
          'red-500': copper,
          'red-600': copper,
        };
  node.style.setProperty('--entrance-palette', 'none');
  for (const [hex, color] of Object.entries(ink))
    node.style.setProperty('--stitch-artwork-swatch-' + hex, color);
  for (const element of node.querySelectorAll<HTMLElement>('*')) {
    for (const token of element.classList) {
      const match = /^(bg|border|text|from|via|to)-(.+?)(?:\/(\d+))?$/.exec(token);
      if (!match || !materials[match[2]]) continue;
      const color = materials[match[2]],
        value = match[3] ? `color-mix(in srgb, ${color} ${match[3]}%, transparent)` : color;
      if (match[1] === 'from' || match[1] === 'via' || match[1] === 'to') continue;
      element.style.setProperty(
        (
          { bg: 'background-color', border: 'border-color', text: 'color' } as Record<
            string,
            string
          >
        )[match[1]],
        value,
      );
    }
    if (element.classList.contains('bg-gradient-to-br'))
      element.style.backgroundImage =
        'linear-gradient(to bottom right, #100d16 20%, #32203f 52%, #100d16 80%)';
    for (const name of ['fill', 'stroke']) {
      const value = element.getAttribute(name);
      if (value && ink[value.slice(1).toLowerCase()])
        element.setAttribute(name, ink[value.slice(1).toLowerCase()]);
    }
  }
}
/** User-authored markup is static, vetted at import, and never comes from player input. */
export function playStitchEntrance(
  id: string,
  layer: HTMLElement,
  cx: number,
  feet: number,
  palette?: string,
  variantId?: string,
): () => void {
  const effect = effects.find((effect) => effect.id === id);
  if (!effect) return () => {};
  const node = document.createElement('div');
  node.className = 'lobby-fx stitch-vfx';
  node.dataset.entrance = id;
  if (variantId) node.dataset.entranceVariant = variantId;
  if (palette) node.style.setProperty('--entrance-palette', palette);
  const refined = refinedStitchArtwork(id, variantId);
  if (refined) {
    node.dataset.entranceRefined = 'true';
    node.style.setProperty('--entrance-palette', 'none');
    node.style.setProperty('--refined-duration', effect.duration + 'ms');
    for (const [index, name] of ['primary', 'shadow', 'highlight'].entries())
      node.style.setProperty('--refined-' + name, refined.colors[index]);
  }
  if (id === 'stitch-purple') node.classList.add('stitch-purple-v2');
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, {
    position: 'absolute',
    width: '320px',
    height: '260px',
    left: cx - 160 + 'px',
    top: feet - 180 + 'px',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  const suffix = '-entrance-' + ++instance;
  let html = refined?.html || effect.html;
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    const id = match[1];
    html = html
      .split('id="' + id + '"')
      .join('id="' + id + suffix + '"')
      .split('url(#' + id + ')')
      .join('url(#' + id + suffix + ')')
      .split('href="#' + id + '"')
      .join('href="#' + id + suffix + '"');
  }
  let filterMarkup = '';
  if (variantId === 'stitch-purple-alt') {
    const filterId = 'stitch-red-flame' + suffix;
    // Map dark, middle and bright tones to ember, flame and a white-hot core.
    filterMarkup = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <filter id="${filterId}" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.04 0.28 0.61 0.88 1 1"/>
          <feFuncG type="table" tableValues="0.01 0.018 0.055 0.21 0.72 0.97"/>
          <feFuncB type="table" tableValues="0.017 0.035 0.055 0.08 0.38 0.89"/>
        </feComponentTransfer>
      </filter>
    </svg>`;
    node.style.setProperty('--entrance-palette', 'url(#' + filterId + ')');
  }
  node.innerHTML =
    filterMarkup +
    '<div class="vfx-elem-container absolute inset-0 flex items-center justify-center pointer-events-none">' +
    html +
    '</div>';
  paintAlternate(node, variantId);
  for (const element of node.querySelectorAll<HTMLElement>('[style*="animation"]')) {
    element.style.animationIterationCount = '1';
    element.style.animationFillMode = 'both';
  }
  if (id === 'stitch-senbonzakura') {
    const fall = document.createElement('div');
    fall.className = 'stitch-sakura-fall';
    for (let i = 0; i < 16; i++) {
      const petal = document.createElement('span');
      petal.style.setProperty('--petal-x', 28 + ((i * 17) % 46) + '%');
      petal.style.setProperty('--petal-drift', (i % 2 ? 1 : -1) * (14 + (i % 4) * 5) + 'px');
      petal.style.setProperty('--petal-delay', (i % 5) * 130 + 'ms');
      petal.style.setProperty('--petal-duration', 1900 + (i % 4) * 120 + 'ms');
      petal.style.setProperty('--petal-size', 5 + (i % 3) * 2 + 'px');
      fall.append(petal);
    }
    node.append(fall);
  }
  layer.append(node);
  return () => node.remove();
}
