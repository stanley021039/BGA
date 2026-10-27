import { drawFateAttack, drawAreaRefinement, drawExplosionAttack } from './attack-figures.js';
import { drawUltimateRevision, drawUltimateTitle, drawScreenRift } from './attack-revision.js';
/* Reviewed finite adaptation of Stitch 14297655819267599636 / 49f8c4190ca540f997339c7ec07485d4.
 * No workstation UI, dummy rendering, timer, network or additional animation loop.
 * Bounded decoration is independent of authoritative hit geometry; incoming hits only
 * provide impact locations and never change gameplay from this renderer. */
const AREA_IDS = [
  'guanyin_barrage',
  'solar_phoenix',
  'dimension_cleave',
  'bijuu_beam',
  'giga_drill',
  'gate_of_babylon',
  'excalibur',
  'explosion',
  'giant_orange_cat',
];
export function createAreaAttack(ctx, options, onImpact) {
  const index = AREA_IDS.indexOf(options.effect);
  if (index < 0 || !options.area) return null;
  const { width, height, from, to, area } = options;
  const aspect = options.aspectRatio || width / height,
    divisor = Math.max(1, aspect);
  const previewUnit = Math.min(width / 115, height / 100);
  const mx = options.preview ? previewUnit : ((width / 100) * divisor) / aspect,
    my = options.preview ? previewUnit : (height / 100) * divisor;
  const ax = (to.x - from.x) / mx,
    ay = (to.y - from.y) / my;
  const angle = options.effect === 'excalibur' ? 0 : Math.atan2(ay, ax),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const range = options.range || 65,
    scale = range / 760;
  const caster = { x: 0, y: 0 },
    reducedMotion = false;
  const convertTargets = (hits) =>
    [...new Map(hits.map((hit, i) => [hit.toId || i, hit])).values()].slice(0, 32).map((hit) => {
      const x = ((hit.pathX ?? hit.x) - from.x) / mx,
        y = ((hit.pathY ?? hit.y) - from.y) / my;
      const beamScale = options.effect === 'bijuu_beam' ? 760 / (Math.hypot(x, y) || 1) : 1 / scale;
      return {
        x: (x * cos + y * sin) * beamScale,
        y: (y * cos - x * sin) * beamScale,
        isHit: true,
        hitImpulse: 0,
        shake: { x: 0, y: 0 },
      };
    });
  const fixedRays =
    options.effect === 'bijuu_beam'
      ? options.rays ||
        (options.preview
          ? [-0.32, 0, 0.32].map((a) => ({
              x: from.x + Math.cos(angle + a) * mx,
              y: from.y + Math.sin(angle + a) * my,
            }))
          : undefined)
      : undefined;
  let targets = convertTargets(fixedRays || options.hits || []);
  const particles = [];
  let hit = false,
    last = 0;
  function spawnParticle(x, y, vx, vy, color, size, life, shape = 'circle') {
    if (particles.length >= 96) return;
    particles.push({ x, y, vx, vy, color, size, life, maximum: life, shape });
  }
  function areaPath() {
    ctx.beginPath();
    if (area.shape === 'fan') {
      const half = (area.angle * Math.PI) / 360;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, range, -half, half);
      ctx.closePath();
    } else if (area.shape === 'burst') {
      ctx.arc(Math.hypot(ax, ay), 0, area.radius, 0, Math.PI * 2);
    } else if (area.shape === 'rectangle') {
      ctx.rect(0, -area.width / 2, range, area.width);
    } else if (area.shape === 'screenBeam') {
      ctx.rect(-from.x / mx, -area.width / 2, width / mx, area.width);
    } else if (area.shape === 'targetRays') {
      for (const target of targets.slice(0, 3)) {
        ctx.save();
        ctx.rotate(Math.atan2(target.y, target.x));
        ctx.rect(0, -area.width / 2, Math.hypot(target.x, target.y) * scale, area.width);
        ctx.restore();
      }
    } else if (area.shape === 'beam') {
      ctx.rect(0, -area.width / 2, range, area.width);
      ctx.moveTo(range + area.blastRadius, 0);
      ctx.arc(range, 0, area.blastRadius, 0, Math.PI * 2);
    } else {
      const half = 4 + range * Math.tan((area.angle * Math.PI) / 360);
      ctx.moveTo(0, -4);
      ctx.lineTo(range, -half);
      ctx.lineTo(range, half);
      ctx.lineTo(0, 4);
      ctx.closePath();
    }
  }
  function renderDimensionCleave(phase, tProgress, time) {
    const cx = caster.x;
    const cy = caster.y;
    const rectW = 720;
    const rectH = 260;

    // Phase 1: Sudden Standstill / Hit-Stop & Faint Crimson Warning Threads (0.0 -> 0.28)
    if (tProgress < 0.28) {
      const prog = tProgress / 0.28;
      ctx.save();
      // Atmospheric Dark Tint in the Box
      ctx.fillStyle = `rgba(12, 14, 22, ${prog * 0.65})`;
      ctx.fillRect(cx, cy - rectH / 2, rectW, rectH);

      // 6 Delicate Crimson Premonition Slices
      ctx.strokeStyle = `rgba(255, 51, 102, ${prog * 0.7})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const py = cy - 100 + i * 36;
        ctx.beginPath();
        ctx.moveTo(cx, py);
        ctx.lineTo(cx + rectW, py + (i % 2 === 0 ? 30 : -30));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Phase 2: Rapid 30+ Space Cleave Slashes (0.28 -> 0.75)
    if (tProgress >= 0.28 && tProgress < 0.82) {
      const actProg = (tProgress - 0.28) / 0.54;

      // Draw fractured void cracks
      ctx.save();
      const slashCount = 28;
      for (let s = 0; s < slashCount; s++) {
        // Seeded pseudo-random slash lines
        const seed = (s * 47) % 100;
        const sx1 = cx + (s / slashCount) * rectW * 0.9;
        const sy1 = cy - 120 + ((seed * 3) % 240);
        const sx2 = sx1 + 100 + (seed % 90);
        const sy2 = cy - 120 + ((seed * 7 + 50) % 240);

        // Pure Black Void Line with Brilliant White-Red Edge
        ctx.strokeStyle = s % 3 === 0 ? '#ffffff' : '#ff3366';
        ctx.lineWidth = s % 4 === 0 ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        // Diamond Slash Glint Sparks
        if (Math.random() > 0.8) {
          spawnParticle(
            (sx1 + sx2) / 2,
            (sy1 + sy2) / 2,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            '#ffffff',
            3,
            300,
            'shard',
          );
        }
      }
      ctx.restore();

      // Targets Hit: Sliced polygon offsets
      targets.forEach((t) => {
        if (t.isHit) {
          t.hitImpulse = 1.0;
          t.shake.x = 18;
          t.shake.y = 18;
          if (Math.random() > 0.5) {
            spawnParticle(
              t.x,
              t.y,
              (Math.random() - 0.5) * 10,
              (Math.random() - 0.5) * 10,
              '#ff3366',
              4,
              450,
              'shard',
            );
          }
        }
      });
    }

    // Phase 3: Shattered Space Shards Glint & Fade (0.75 -> 1.0)
    if (tProgress >= 0.75) {
      const fadeProg = (tProgress - 0.75) / 0.25;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - fadeProg})`;
      ctx.lineWidth = 1;
      for (let g = 0; g < 12; g++) {
        const rx = cx + 50 + g * 55;
        const ry = cy + ((g * 31) % 180) - 90;
        // Draw 4-point Star Glint
        ctx.beginPath();
        ctx.moveTo(rx - 8, ry);
        ctx.lineTo(rx + 8, ry);
        ctx.moveTo(rx, ry - 8);
        ctx.lineTo(rx, ry + 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 4. 尾獸玉・超巨型噴射 (Bijuu Dama - Colossal Ion Beam Blast)
  function renderGigaDrill(phase, tProgress, time) {
    const cx = caster.x;
    const cy = caster.y;
    const emerald = '#00dbe9';
    const emeraldLight = '#dbfcff';
    const goldSpire = '#ffd556';

    // Phase 1: Emerald Galaxy Vortex & Alloy Drill Synthesis (0.0 -> 0.3)
    if (tProgress < 0.3) {
      const prog = tProgress / 0.3;
      ctx.save();
      ctx.translate(cx, cy);

      // Galaxy Spiral Arms behind Caster
      ctx.rotate(time * 0.005);
      for (let arm = 0; arm < 3; arm++) {
        ctx.strokeStyle = `rgba(0, 219, 233, ${prog * 0.6})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let r = 10; r < 140 * prog; r += 5) {
          const th = (arm * Math.PI * 2) / 3 + r * 0.08;
          ctx.lineTo(Math.cos(th) * r, Math.sin(th) * r);
        }
        ctx.stroke();
      }

      // Initial Drill Silhouette
      ctx.fillStyle = emerald;
      ctx.beginPath();
      ctx.moveTo(0, -30 * prog);
      ctx.lineTo(120 * prog, 0);
      ctx.lineTo(0, 30 * prog);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Phase 2: Forward Expanding Spiral Cone Rush (0.3 -> 0.8)
    if (tProgress >= 0.28 && tProgress < 0.84) {
      const actProg = (tProgress - 0.28) / 0.56;
      ctx.save();

      // Drill expands and surges forward
      const drillTipX = cx + actProg * 760;
      const drillBaseX = Math.max(cx, drillTipX - 320);
      const currentSpread = (drillTipX - cx) * Math.tan(Math.PI / 5.5);

      // Golden Spiral Energy Acceleration Rings
      const ringCount = 8;
      for (let r = 0; r < ringCount; r++) {
        const rx = drillBaseX + (r / ringCount) * (drillTipX - drillBaseX);
        const rh = (rx - cx) * Math.tan(Math.PI / 5.5);

        ctx.strokeStyle = r % 2 === 0 ? goldSpire : emerald;
        ctx.lineWidth = 2.5;
        ctx.save();
        ctx.translate(rx, cy);
        ctx.rotate(time * 0.03 + r);
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, rh, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Massive Rotating Giga Drill Contour
      const drillGrad = ctx.createLinearGradient(drillBaseX, cy - currentSpread, drillTipX, cy);
      drillGrad.addColorStop(0, 'rgba(0, 219, 233, 0.3)');
      drillGrad.addColorStop(0.5, '#00f0ff');
      drillGrad.addColorStop(0.9, '#ffffff');
      drillGrad.addColorStop(1, goldSpire);

      ctx.fillStyle = drillGrad;
      ctx.beginPath();
      ctx.moveTo(drillBaseX, cy - currentSpread * 0.85);
      ctx.lineTo(drillTipX, cy); // Sharp piercing tip
      ctx.lineTo(drillBaseX, cy + currentSpread * 0.85);
      ctx.closePath();
      ctx.fill();

      // Spiral Alloy Surface Grooves
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let g = 0; g < 4; g++) {
        ctx.beginPath();
        const gx = drillBaseX + (g / 4) * (drillTipX - drillBaseX);
        ctx.arc(gx, cy, 30 + g * 20, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }

      ctx.restore();

      // Targets Hit: Spiral centrifugal dispersion
      targets.forEach((t) => {
        if (t.isHit && t.x <= drillTipX) {
          t.hitImpulse = 1.0;
          t.shake.x = 16;
          t.shake.y = 16;
          spawnParticle(
            t.x,
            t.y,
            (Math.random() - 0.5) * 11,
            (Math.random() - 0.5) * 11,
            emeraldLight,
            4,
            450,
            'shard',
          );
        }
      });
    }

    // Phase 3: Cosmic Cross Nebula Burst & Frozen Drill Silhouette (0.8 -> 1.0)
    if (tProgress >= 0.8) {
      const fadeProg = (tProgress - 0.8) / 0.2;
      ctx.save();
      const burstX = cx + 760;
      ctx.translate(burstX, cy);

      // Giant 4-Star Cosmic Nebula Cross
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - fadeProg})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-180, 0);
      ctx.lineTo(180, 0);
      ctx.moveTo(0, -180);
      ctx.lineTo(0, 180);
      ctx.stroke();

      // Concentric Cosmic Shock Rings
      ctx.strokeStyle = goldSpire;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 120 * (1 + fadeProg * 0.8), 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // Main Render Loop (60 FPS)

  const renderers = [
    (_phase, p) => {
      drawUltimateRevision(ctx, 'guanyin_barrage', p);
      drawAreaRefinement(ctx, 'guanyin_barrage', p, targets);
    },
    (_phase, p) => {
      drawUltimateRevision(ctx, 'solar_phoenix', p);
      drawAreaRefinement(ctx, 'solar_phoenix', p);
    },
    (phase, p, time) => {
      renderDimensionCleave(phase, p, time);
      if (p >= 0.5) drawUltimateRevision(ctx, 'dimension_cleave', p);
    },
    (_phase, p) =>
      drawUltimateRevision(
        ctx,
        'bijuu_beam',
        p,
        Math.hypot(ax, ay) / scale,
        targets.length ? targets.slice(0, 3) : undefined,
      ),
    renderGigaDrill,
    (_phase, p) =>
      drawUltimateRevision(
        ctx,
        'gate_of_babylon',
        p,
        Math.hypot(ax, ay) / scale,
        targets.length ? targets : undefined,
        angle,
      ),
    (_phase, p) => {
      drawFateAttack(ctx, 'excalibur', p);
      if (p >= 0.5) {
        const extent = Math.min(1, (p - 0.5) / 0.12),
          span = width / mx / scale;
        ctx.save();
        ctx.translate(-from.x / mx / scale, 0);
        const beam = ctx.createLinearGradient(0, 0, span, 0);
        beam.addColorStop(0, 'rgba(255,181,40,0.8)');
        beam.addColorStop(0.5, '#fffbe5');
        beam.addColorStop(1, 'rgba(255,181,40,0.8)');
        ctx.fillStyle = beam;
        ctx.fillRect(0, -160 * extent, span, 320 * extent);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -52 * extent, span, 104 * extent);
        ctx.restore();
      }
    },
    (_phase, p) => drawExplosionAttack(ctx, p, Math.hypot(ax, ay) / scale, area.radius / scale),
    (_phase, p) => drawUltimateRevision(ctx, 'giant_orange_cat', p, Math.hypot(ax, ay) / scale),
  ];
  return (elapsed) => {
    if (elapsed < 0 || elapsed > 4100) return;
    if (elapsed < 700) {
      drawUltimateTitle(
        ctx,
        options.label || options.effect,
        (elapsed * 0.12) / 700,
        width,
        height,
      );
      return;
    }
    const progress = (elapsed - 700) / 3400,
      dt = Math.min(4, Math.max(0, (elapsed - last) / 16.667));
    last = elapsed;
    if (options.readHits && !fixedRays) targets = convertTargets(options.readHits());
    ctx.save();
    if (progress > 0.32 && progress < 0.76) {
      const shake = Math.sin(((progress - 0.32) / 0.44) * Math.PI) * 4;
      ctx.translate(Math.sin(elapsed * 0.07) * shake, Math.cos(elapsed * 0.09) * shake);
    }
    ctx.translate(from.x, from.y);
    ctx.scale(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.arc(0, 0, range, 0, Math.PI * 2);
    if (!['giant_orange_cat', 'explosion', 'excalibur', 'gate_of_babylon'].includes(options.effect))
      ctx.clip();
    // Actor silhouettes and caster-side summons may extend behind the caster.
    // Only damaging geometry is tested server-side; the range clip stays bounded.
    if (options.effect === 'giga_drill' && progress >= 0.28) {
      areaPath();
      ctx.clip();
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(0.12, (1 - progress) * 0.16));
    ctx.fillStyle = options.color;
    areaPath();
    ctx.fill();
    ctx.restore();
    ctx.scale(scale, scale);
    renderers[index](0, progress, elapsed);
    for (let n = particles.length - 1; n >= 0; n--) {
      const p = particles[n];
      p.life -= dt * 16.667;
      if (p.life <= 0) {
        particles.splice(n, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = p.life / p.maximum;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (options.effect === 'dimension_cleave') drawScreenRift(ctx, progress, width, height);
    if (
      !hit &&
      progress >=
        (options.effect === 'gate_of_babylon'
          ? 0.72
          : options.effect === 'excalibur'
            ? 0.55
            : options.effect === 'explosion'
              ? 0.45
              : options.effect === 'giant_orange_cat'
                ? 0.55
                : 0.35)
    ) {
      hit = true;
      onImpact();
    }
  };
}
