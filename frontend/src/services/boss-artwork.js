import abilities from '../../../public/shared/boss-abilities.json' with { type: 'json' };
import { bossZones } from '../engines/boss-geometry.js';
import { drawBossStrike } from './boss-strike-art.js';
export function createBossArtwork(ctx, options) {
  const spec = abilities.find((s) => s.id === options.effect);
  if (!spec) return null;
  const start = performance.now() - (options.ageMs || 0),
    aspect = options.aspectRatio || 1.6,
    d = Math.max(1, aspect);
  const zones = bossZones(spec, options.bossFrom, options.bossAim, aspect);
  let disposed = false;
  function path(z) {
    ctx.beginPath();
    if (z.shape === 'line') {
      ctx.moveTo(z.x, z.y);
      ctx.lineTo(z.x2, z.y2);
      ctx.lineWidth = z.w;
    } else {
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      if (z.shape === 'ring') {
        ctx.moveTo(z.x + z.inner, z.y);
        ctx.arc(z.x, z.y, z.inner, 0, Math.PI * 2, true);
      }
    }
  }
  return {
    dispose() {
      disposed = true;
    },
    draw(now) {
      const age = now - start;
      if (
        disposed ||
        age > 4200 ||
        (typeof options.cancelled === 'function' && options.cancelled())
      )
        return false;
      const charging = age < spec.windup,
        p = Math.min(1, Math.max(0, (age - spec.windup) / spec.duration));
      const pulse = charging ? age / 1000 : Math.floor(p * spec.pulses),
        alpha = charging
          ? 0.25 + 0.1 * Math.sin(age / 100)
          : Math.max(0, 1 - (age - spec.windup - spec.duration) / 500);
      ctx.save();
      ctx.scale((options.width * d) / (100 * aspect), (options.height * d) / 100);
      ctx.lineCap = 'round';
      for (const [n, z] of zones.entries()) {
        ctx.save();
        ctx.globalAlpha = alpha * (charging ? 0.18 : 0.07);
        ctx.strokeStyle =
          spec.motif === 'stones'
            ? ['#5bb9ff', '#f26868', '#ae79f0', '#5cdb99', '#f5dc6c', '#f5a353'][n % 6]
            : spec.color;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 0.65;
        if (charging) ctx.setLineDash([1.3, 1]);
        else ctx.setLineDash([]);
        path(z);
        if (z.shape === 'line') ctx.stroke();
        else {
          ctx.globalAlpha = alpha * 0.06;
          ctx.fill('evenodd');
          ctx.globalAlpha = alpha * 0.28;
          ctx.stroke();
        }
        ctx.restore();
      }
      drawBossStrike(ctx, spec, zones, options, age);
      ctx.restore();
      if (!charging) {
        ctx.save();
        ctx.fillStyle = spec.accent;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        for (const h of (options.readHits?.() || []).slice(0, 32))
          if (h.damage > 0) ctx.fillText(h.damage.toLocaleString(), h.x, h.y - 12);
        ctx.restore();
      }
      return true;
    },
  };
}
