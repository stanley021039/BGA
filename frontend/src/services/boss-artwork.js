import abilities from '../../../public/shared/boss-abilities.json' with { type: 'json' };
import { bossZones } from '../engines/boss-geometry.js';
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
        ctx.globalAlpha = alpha;
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
          ctx.globalAlpha = alpha * 0.22;
          ctx.fill('evenodd');
          ctx.globalAlpha = alpha;
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = spec.accent;
        ctx.lineWidth = 0.35;
        if (z.shape === 'line') {
          const dx = z.x2 - z.x,
            dy = z.y2 - z.y,
            L = Math.hypot(dx, dy),
            a = Math.atan2(dy, dx);
          ctx.translate(z.x, z.y);
          ctx.rotate(a);
          if (spec.motif === 'stones') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(L, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(L * 0.7, -2);
            ctx.lineTo(L * 0.7 + 2, 0);
            ctx.lineTo(L * 0.7, 2);
            ctx.lineTo(L * 0.7 - 2, 0);
            ctx.closePath();
            ctx.fill();
          } else if (['chains', 'hoses', 'tendril', 'pincer'].includes(spec.motif)) {
            for (let k = 0; k < 14; k++) {
              ctx.beginPath();
              const x = (L * k) / 14,
                y = Math.sin(k * 0.8 + age / 180) * z.w * 0.18;
              ctx.ellipse(
                x,
                y,
                spec.motif === 'hoses' ? 0.5 : 1.1,
                z.w * 0.32,
                k % 2 ? 0.3 : -0.3,
                0,
                Math.PI * 2,
              );
              ctx.stroke();
            }
          } else if (['rail', 'beam'].includes(spec.motif)) {
            for (const side of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(0, side * z.w * 0.28);
              ctx.lineTo(L, side * z.w * 0.28);
              ctx.stroke();
            }
            for (let k = 0; k < 8; k++) ctx.strokeRect((k * L) / 8, -z.w * 0.5, L / 14, z.w);
          } else {
            ctx.beginPath();
            ctx.moveTo(0, -z.w * 0.35);
            ctx.lineTo(L, z.w * 0.1);
            ctx.lineTo(L * 0.5, z.w * 0.4);
            ctx.closePath();
            ctx.stroke();
            if (spec.motif === 'spray')
              for (let k = 0; k < 16; k++) {
                ctx.beginPath();
                ctx.arc(
                  L * ((k / 16 + age / 1800) % 1),
                  Math.sin(k * 4) * z.w * 0.4,
                  0.35,
                  0,
                  Math.PI * 2,
                );
                ctx.stroke();
              }
          }
        } else {
          ctx.translate(z.x, z.y);
          if (['drones', 'missiles', 'eyes', 'orbs', 'pools'].includes(spec.motif)) {
            ctx.rotate(age / 1800 + n);
            ctx.beginPath();
            if (spec.motif === 'eyes') {
              ctx.ellipse(0, 0, z.r * 0.7, z.r * 0.3, 0, 0, Math.PI * 2);
              ctx.moveTo(0, -z.r * 0.4);
              ctx.lineTo(0, z.r * 0.4);
            } else if (spec.motif === 'drones') {
              ctx.rect(-z.r * 0.4, -z.r * 0.3, z.r * 0.8, z.r * 0.6);
              ctx.moveTo(-z.r * 0.7, 0);
              ctx.lineTo(z.r * 0.7, 0);
            } else if (spec.motif === 'missiles') {
              ctx.moveTo(z.r * 0.7, 0);
              ctx.lineTo(-z.r * 0.5, -z.r * 0.35);
              ctx.lineTo(-z.r * 0.3, 0);
              ctx.lineTo(-z.r * 0.5, z.r * 0.35);
              ctx.closePath();
            } else
              for (let k = 0; k < 3; k++) {
                ctx.moveTo(z.r * (0.25 + k * 0.2), 0);
                ctx.arc(0, 0, z.r * (0.25 + k * 0.2), 0, Math.PI * 2);
              }
            ctx.stroke();
          } else {
            const inner = z.shape === 'ring' ? z.inner : 0;
            for (let k = 0; k < 12; k++) {
              const a = (k * Math.PI) / 6 + age / 1500,
                r0 = inner || z.r * 0.15,
                r1 = z.r * (0.65 + 0.25 * Math.sin(age / 140 + k));
              ctx.beginPath();
              if (['spiral', 'plague', 'steam'].includes(spec.motif)) {
                ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
                ctx.quadraticCurveTo(
                  Math.cos(a + 0.8) * r1,
                  Math.sin(a + 0.8) * r1,
                  Math.cos(a + 1.2) * z.r * 0.92,
                  Math.sin(a + 1.2) * z.r * 0.92,
                );
              } else {
                ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
                ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
              }
              ctx.stroke();
            }
            if (!charging) {
              ctx.beginPath();
              ctx.arc(0, 0, Math.max(inner + 0.1, z.r * ((age / 400) % 1)), 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
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
