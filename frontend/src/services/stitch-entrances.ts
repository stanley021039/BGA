import effects from '../../../public/shared/entrance-stitch.json';
import '../assets/entrance-stitch.css';
import '../assets/entrance-stitch-repairs.css';
import '../assets/entrance-purple-v2.css';
import '../styles/sakura-fall.scss';
import '../styles/entrance-refinements.scss';

export const stitchEntrances = effects;
let instance = 0;
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
  let html = effect.html;
  for (const match of effect.html.matchAll(/\bid="([^"]+)"/g)) {
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
