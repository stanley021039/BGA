const NS = 'http://www.w3.org/2000/svg';

// The input is vetted, repository-owned SVG. Reuse live elements and attributes;
// do not parse/recreate an entire effect tree on every animation frame.
export function svgLayer(root, suffix, colors = {}) {
  let touched = false;
  return {
    beginFrame() {
      touched = false;
    },
    endFrame() {
      if (!touched) root.replaceChildren();
    },
    set innerHTML(markup) {
      touched = true;
      const stack = [{ node: root, cursor: 0 }];
      const rewrite = (value) =>
        (colors[value.toLowerCase()] || value).replace(/url\(#([^)]*)\)/g, `url(#$1-${suffix})`);
      for (const token of markup.match(/<[^>]+>|[^<]+/g) || []) {
        if (token.startsWith('</')) {
          const frame = stack.pop();
          while (frame.node.children.length > frame.cursor) frame.node.lastElementChild.remove();
        } else if (token.startsWith('<')) {
          const tag = token.match(/^<([\w-]+)/)?.[1];
          if (!tag) continue;
          const frame = stack.at(-1);
          let node = frame.node.children[frame.cursor++];
          if (!node || node.localName !== tag) {
            const next = root.ownerDocument.createElementNS(NS, tag);
            if (node) node.replaceWith(next);
            else frame.node.append(next);
            node = next;
          }
          const attributes = new Map();
          for (const [, name, value] of token.matchAll(/([\w:-]+)="([^"]*)"/g))
            attributes.set(name, name === 'id' ? `${value}-${suffix}` : rewrite(value));
          for (const attribute of [...node.attributes])
            if (!attributes.has(attribute.name)) node.removeAttribute(attribute.name);
          for (const [name, value] of attributes)
            if (node.getAttribute(name) !== value) node.setAttribute(name, value);
          if (!token.endsWith('/>')) stack.push({ node, cursor: 0 });
        } else if (token.trim()) {
          const node = stack.at(-1).node;
          if (node.textContent !== token) node.textContent = token;
        }
      }
      while (root.children.length > stack[0].cursor) root.lastElementChild.remove();
    },
  };
}

const contours = new Map();
// Trace alpha from the selected player's actual image, never a stock mascot.
export function characterContour(img) {
  const key = img.currentSrc || img.src;
  if (contours.has(key)) return contours.get(key);
  const canvas = img.ownerDocument.createElement('canvas');
  canvas.width = 40;
  canvas.height = 44;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !img.naturalWidth) return '';
  const scale = Math.min(40 / img.naturalWidth, 44 / img.naturalHeight);
  const w = img.naturalWidth * scale,
    h = img.naturalHeight * scale;
  ctx.drawImage(img, (40 - w) / 2, (44 - h) / 2, w, h);
  let alpha;
  try {
    alpha = ctx.getImageData(0, 0, 40, 44).data;
  } catch {
    return '';
  } // Cross-origin custom images still enter as the real image.
  const filled = (x, y) => x >= 0 && x < 40 && y >= 0 && y < 44 && alpha[(y * 40 + x) * 4 + 3] > 64;
  const edges = new Map();
  const edge = (x, y, a, b) => edges.set(`${x},${y}`, [a, b]);
  for (let y = 0; y < 44; y++)
    for (let x = 0; x < 40; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) edge(x, y, x + 1, y);
      if (!filled(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) edge(x, y + 1, x, y);
    }
  const point = ([x, y]) => `${((x * 81) / 40).toFixed(1)} ${((y * 87) / 44).toFixed(1)}`;
  let path = '';
  while (edges.size) {
    const first = edges.keys().next().value;
    let key = first;
    path += `M${point(key.split(',').map(Number))}`;
    do {
      const next = edges.get(key);
      edges.delete(key);
      if (!next) break;
      path += `L${point(next)}`;
      key = next.join(',');
    } while (edges.has(key) && key !== first);
    path += 'Z';
  }
  if (contours.size >= 16) contours.delete(contours.keys().next().value);
  contours.set(key, path);
  return path;
}
