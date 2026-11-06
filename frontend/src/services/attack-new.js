import {
  drawShaohua,
  drawReaper,
  drawRailgun,
  drawPlasma,
  drawMissiles,
  drawSniper,
} from './attack-new-draws.js';
import { drawGateOfHeroes } from './attack-hero-draw.js';
import { drawUltimateTitle } from './attack-revision.js';
const draws = {
  shaohua_devour: drawShaohua,
  reaper_seal: drawReaper,
  railgun: drawRailgun,
  plasma_pulse: drawPlasma,
  micro_missiles: drawMissiles,
  photon_sniper: drawSniper,
};
const pictures = new Map();
function picture(url) {
  if (!url || typeof Image === 'undefined') return null;
  if (!pictures.has(url)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    if (pictures.size >= 32) pictures.delete(pictures.keys().next().value);
    pictures.set(url, img);
  }
  const img = pictures.get(url);
  return img.complete && img.naturalWidth ? img : null;
}
export function createNewAttack(ctx, options) {
  const kind = options.effect.replace(/_alt$/, '');
  if (!draws[kind] && kind !== 'gate_of_heroes') return null;
  const scale = Math.min(1.1, Math.max(0.38, options.height / 700), options.width / 550);
  const alternate = options.effect.endsWith('_alt'),
    images = {};
  const loadPictures = () => {
    if (kind === 'shaohua_devour') {
      images.closed = picture('/assets/attacks/shaohua-closed.webp');
      images.open = picture('/assets/attacks/shaohua-open.webp');
    }
    if (kind === 'reaper_seal')
      images.reaper = picture(
        scale < 0.37
          ? '/assets/attacks/reaper-person-128.webp'
          : scale < 0.74
            ? '/assets/attacks/reaper-person-256.webp'
            : '/assets/attacks/reaper-person-512.webp',
      );
  };
  loadPictures();
  return (elapsed) => {
    if (elapsed < 0 || elapsed >= 4200) return;
    loadPictures();
    const hits = () =>
      (options.readHits?.() || [])
        .filter((h) => !h.pending && !h.missed && h.damage > 0)
        .map((h) => ({ ...h, at: h.delayMs }));
    const previewHead = () => {
      const p = Math.min(1, elapsed / 2200);
      return {
        x: options.from.x + (options.to.x - options.from.x) * p,
        y: options.from.y + (options.to.y - options.from.y) * p,
        targetX: options.to.x,
        targetY: options.to.y,
        at: elapsed,
        contactAt: elapsed >= 2200 ? 2200 : 0,
        biteAt: 2600,
        finished: elapsed >= 2600,
        cancelled: false,
      };
    };
    const settings = {
      ...options,
      alternate,
      images,
      scale,
      readHits: hits,
      readTargets: () => {
        const entries = options.readHits?.() || [];
        if (options.preview && entries.length === 0)
          return [-1, 0, 1].map((i) => ({
            x: Math.max(18, Math.min(options.width - 18, options.to.x + i * 65 * scale)),
            y: options.to.y + Math.abs(i) * 30 * scale,
            toId: 'preview-' + i,
          }));
        return [
          ...new Map(entries.filter((h) => !h.missed).map((h) => [h.toId, h])).values(),
        ].slice(0, 32);
      },
      readHead: options.readHead || (options.preview ? previewHead : () => null),
    };
    if (kind !== 'gate_of_heroes') {
      draws[kind](ctx, settings, elapsed);
      if (options.label && ['shaohua_devour', 'reaper_seal'].includes(kind) && elapsed < 700)
        drawUltimateTitle(
          ctx,
          options.label,
          (elapsed * 0.12) / 700,
          options.width,
          options.height,
        );
      return;
    }
    if (options.cancelled?.()) return;
    const point = (p) => ({ x: p.x / scale, y: p.y / scale });
    ctx.save();
    try {
      ctx.scale(scale, scale);
      drawGateOfHeroes(
        ctx,
        {
          ...settings,
          from: point(options.from),
          to: point(options.to),
          images: {},
          readHits: () => hits().map((h) => ({ ...h, ...point(h) })),
        },
        elapsed,
      );
    } finally {
      ctx.restore();
    }
    // The outer warning ring matches the server's 22.5% long-edge landing radius.
    const radius = 22.5,
      aspect = options.aspectRatio || options.width / options.height,
      divisor = Math.max(1, aspect);
    if (elapsed < 2100) {
      ctx.save();
      ctx.strokeStyle = alternate ? '#b388ff' : '#ffca28';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.ellipse(
        options.to.x,
        options.to.y,
        (((options.width / 100) * divisor) / aspect) * radius,
        (options.height / 100) * divisor * radius,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }
    const avatar = picture(options.casterImage);
    if (options.preview && avatar && elapsed >= 600 && elapsed < 2100) {
      const p = (elapsed - 600) / 1500;
      const x = options.from.x + (options.to.x - options.from.x) * p,
        y =
          options.from.y +
          (options.to.y - options.from.y) * p -
          Math.sin(p * Math.PI) * Math.min(180, options.height * 0.35);
      const size = 52 * scale;
      ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
    }
  };
}
