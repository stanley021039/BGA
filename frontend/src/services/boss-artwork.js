import abilities from '../../../public/shared/boss-abilities.json' with { type: 'json' };
import {
  bossZones,
  bossStageSpec,
  bossAttackPlan,
  traceBossZone,
} from '../engines/boss-geometry.js';
import { drawBossStrike } from './boss-strike-art.js';
import { bossWarningOpacity } from './boss-warning-visibility.js';
export function createBossArtwork(ctx, options) {
  const spec = bossStageSpec(
    abilities.find((s) => s.id === options.effect),
    options.bossPhase || 1,
  );
  if (!spec) return null;
  if (spec.phase > 1) return createStagedBossArtwork(ctx, options, spec);
  const rate = Math.max(1, Math.min(1.3, Number(options.bossAttackRate) || 1));
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
      const age = (now - start) * rate;
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
        const floorOpacity = bossWarningOpacity(spec.slot, spec.windup, spec.windup, age, rate);
        ctx.globalAlpha = floorOpacity * 0.3;
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
          ctx.globalAlpha = floorOpacity * 0.08;
          ctx.fill('evenodd');
          ctx.globalAlpha = floorOpacity * 0.3;
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

function createStagedBossArtwork(ctx, options, spec) {
  const rate = Math.max(1, Math.min(1.3, Number(options.bossAttackRate) || 1));
  const start = performance.now() - (options.ageMs || 0),
    aspect = options.aspectRatio || 1.6,
    d = Math.max(1, aspect);
  const plan = bossAttackPlan(spec, options.bossFrom, options.bossAim, aspect);
  let disposed = false;
  return {
    dispose() {
      disposed = true;
    },
    draw(now) {
      const age = (now - start) * rate;
      if (disposed || age > 4200 || options.cancelled?.()) return false;
      const caster = options.readCaster?.();
      ctx.save();
      ctx.scale((options.width * d) / (100 * aspect), (options.height * d) / 100);
      for (const strike of plan) {
        if (age < strike.at - spec.windup || age > strike.at + 550) continue;
        const active = age >= strike.at;
        const appearance = { ...strike.spec, windup: strike.at, duration: 350, pulses: 1 };
        ctx.save();
        ctx.strokeStyle = appearance.color;
        ctx.fillStyle = appearance.color;
        ctx.globalAlpha = bossWarningOpacity(spec.slot, spec.windup, strike.at, age, rate) * 0.3;
        for (const zone of strike.zones) {
          traceBossZone(ctx, zone);
          if (zone.shape === 'line') ctx.stroke();
          else ctx.fill('evenodd');
        }
        ctx.globalAlpha = 1;
        const sector = strike.zones.find((z) => z.shape === 'sector');
        if (active && sector) {
          traceBossZone(ctx, sector);
          ctx.clip();
        }
        const gap = strike.zones.find((z) => z.gap);
        if (active && gap) {
          // Clip the safe corridor out of the offensive art as well as collision/warnings.
          ctx.beginPath();
          ctx.rect(-1000, -1000, 2000, 2000);
          ctx.moveTo(gap.x, gap.y);
          ctx.arc(gap.x, gap.y, 1000, gap.direction - gap.gap / 2, gap.direction + gap.gap / 2);
          ctx.closePath();
          ctx.clip('evenodd');
        }
        const readCaster = strike.reverse
          ? () => ({ ...options.to, width: 0, height: 0 })
          : () => caster;
        drawBossStrike(ctx, appearance, strike.zones, { ...options, readCaster }, age);
        ctx.restore();
      }
      ctx.restore();
      if (age >= spec.windup) {
        ctx.save();
        ctx.fillStyle = spec.accent;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        for (const hit of (options.readHits?.() || []).slice(0, 32))
          if (hit.damage > 0) ctx.fillText(hit.damage.toLocaleString(), hit.x, hit.y - 12);
        ctx.restore();
      }
      return true;
    },
  };
}
