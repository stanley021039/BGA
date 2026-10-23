import effects from '../../../public/shared/entrance-stitch.json';
import '../assets/entrance-stitch.css';
import '../assets/entrance-stitch-repairs.css';
import '../assets/entrance-purple-v2.css';
import '../styles/sakura-fall.scss';

export const stitchEntrances = effects;
let instance = 0;
/** User-authored markup is static, vetted at import, and never comes from player input. */
export function playStitchEntrance(
  id: string,
  layer: HTMLElement,
  cx: number,
  feet: number,
): () => void {
  const effect = effects.find((effect) => effect.id === id);
  if (!effect) return () => {};
  const node = document.createElement('div');
  node.className = 'lobby-fx stitch-vfx';
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
  node.innerHTML =
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
