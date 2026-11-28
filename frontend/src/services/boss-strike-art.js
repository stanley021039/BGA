// Art reference: Stitch #410 R3-A/B/C (exported 2026-11-24).
// Adapt material, impact and silhouette details to the authoritative clock/zones;
// do not import the prototype's actors, damage simulation, shake or timers.
import { ghidorahMouthsFor } from './boss-mouths.js';
import { traceBossZone } from '../engines/boss-geometry.js';
export function drawBossStrike(ctx, spec, zones, options, age) {
  const aspect = options.aspectRatio || 1.6,
    d = Math.max(1, aspect);
  const origin = { x: (options.bossFrom.x * aspect) / d, y: options.bossFrom.y / d };
  const caster = options.readCaster?.();
  // readCaster is a portrait centre in stage pixels. It follows the real sprite,
  // while the ground endpoints remain fixed to the server's cast snapshot.
  const emitters = {
    mutalith: [0.56, 0.26],
    cthulhu: spec.slot === 'q' ? [0.72, 0.7] : [0.5, 0.3],
    gatanozoa: spec.slot === 'q' ? [0.74, 0.65] : [0.5, 0.5],
    arkveld: [0.23, 0.5],
    greeza: [0.5, 0.35],
    'hyper-zetton': spec.slot === 'q' ? [0.76, 0.65] : [0.5, 0.4],
    colossal: spec.slot === 'q' ? [0.5, 0.94] : [0.5, 0.5],
    'steel-behemoth': spec.slot === 'r' ? [0.5, 0.12] : [0.7, 0.35],
    'prismatic-void': spec.slot === 'q' ? [0.72, 0.5] : [0.5, 0.44],
    gyo: spec.slot === 'q' ? [0.5, 0.7] : [0.5, 0.3],
    'gleam-eyes': spec.slot === 'e' ? [0.5, 0.32] : [0.27, 0.62],
    'dark-zagi': spec.slot === 'r' ? [0.5, 0.44] : [0.41, 0.45],
    'ghidorah-turtle': (() => {
      const m = ghidorahMouthsFor(spec.phase)[1];
      return [m.x / 256, m.y / 256];
    })(),
  };
  const anchor = emitters[spec.boss] || [0.5, 0.5];
  function atAnchor(anchor) {
    const anchorX = caster?.facingLeft ? 1 - anchor[0] : anchor[0];
    return caster
      ? {
          x:
            ((caster.x + (anchorX - 0.5) * (caster.width || 0)) * 100 * aspect) /
            (options.width * d),
          y: ((caster.y + (anchor[1] - 0.5) * (caster.height || 0)) * 100) / (options.height * d),
        }
      : { x: origin.x, y: origin.y - 5 };
  }
  const source = atAnchor(anchor);
  const charge = Math.max(0, Math.min(1, age / spec.windup));
  const active = age >= spec.windup;
  const impactAge = Math.max(0, age - spec.windup);
  const phase =
    spec.slot === 'r' ? (impactAge % 550) / 550 : Math.min(1, impactAge / spec.duration);
  const travel = Math.max(0, Math.min(1, (age - spec.windup + 260) / 260));
  const alpha = Math.max(0, Math.min(1, (spec.windup + spec.duration + 500 - age) / 500));
  const bead = (x, y, rx, ry = rx, fill = spec.color) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const curve = (points, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    ctx.bezierCurveTo(...points.slice(2));
    ctx.stroke();
  };
  const ring = (x, y, r, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
    ctx.stroke();
  };
  const shard = (x, y, r, a, color = spec.accent) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.55, -r * 0.3);
    ctx.lineTo(-r * 0.2, 0);
    ctx.lineTo(-r * 0.55, r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  // A finite cast charge at the actual limb/weapon, not a second boss sprite.
  if (!active) {
    ring(source.x, source.y, 0.6 + charge * 2, 0.22, spec.accent);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - age / 600,
        r = (1 - charge) * 5 + 1;
      shard(source.x + Math.cos(a) * r, source.y + Math.sin(a) * r, 0.25 + charge * 0.25, a);
    }
  }
  // Ultimate accents are bounded to the cast clock, not a second particle loop.
  // The short impact outline follows actual zones, including their safe corridors.
  if (spec.slot === 'r') {
    ctx.save();
    if (!active) {
      ctx.globalAlpha = alpha * charge * 0.65;
      for (let i = 0; i < 2; i++) {
        const radius = 3 + (1 - charge) * (8 + i * 3);
        ring(source.x, source.y, radius, 0.2 + charge * 0.3, i ? spec.color : spec.accent);
      }
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 + age / 1800;
        const radius = 3 + (1 - charge) * 12;
        shard(
          source.x + Math.cos(angle) * radius,
          source.y + Math.sin(angle) * radius,
          0.3 + charge * 0.6,
          angle + Math.PI,
        );
      }
    } else if (impactAge < 280) {
      ctx.globalAlpha = alpha * (1 - impactAge / 280) * 0.65;
      ctx.strokeStyle = spec.accent;
      for (const zone of zones) {
        ctx.lineWidth = zone.shape === 'line' ? zone.w : 0.7;
        traceBossZone(ctx, zone);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        const radius = 2 + impactAge / 24;
        shard(
          source.x + Math.cos(angle) * radius,
          source.y + Math.sin(angle) * radius,
          1.4 * (1 - impactAge / 280),
          angle,
        );
      }
    }
    ctx.restore();
  }
  for (const [index, z] of zones.entries()) {
    ctx.save();
    const headAnchors = ghidorahMouthsFor(spec.phase).map((m) => [m.x / 256, m.y / 256]);
    const source =
      spec.boss === 'ghidorah-turtle'
        ? atAnchor(
            spec.slot === 'e'
              ? [index % 2 ? 0.82 : 0.18, 0.43]
              : headAnchors[spec.head ?? index % 3],
          )
        : atAnchor(anchor);
    const target = z.shape === 'line' ? { x: z.x2, y: z.y2 } : { x: z.x, y: z.y };
    const dx = target.x - source.x,
      dy = target.y - source.y;
    const angle = Math.atan2(dy, dx),
      nx = -Math.sin(angle),
      ny = Math.cos(angle);
    let x = source.x + dx * travel,
      y = source.y + dy * travel;
    ctx.save();
    const physical = ['tendril', 'chains', 'hoses', 'pincer'].includes(spec.motif);
    if (physical && spec.slot === 'q') {
      const reach = active ? Math.max(0, 1 - phase) : travel;
      x = source.x + dx * reach;
      y = source.y + dy * reach;
      const whip =
        Math.sin((active ? phase : travel) * Math.PI) * 5 * (spec.boss === 'cthulhu' ? 1.4 : 1);
      const points = [
        source.x,
        source.y,
        source.x + dx * 0.25 + nx * whip,
        source.y + dy * 0.25 + ny * whip,
        x - dx * 0.2 - nx * whip,
        y - dy * 0.2 - ny * whip,
        x,
        y,
      ];
      if (age > spec.windup - 260) {
        const retract = active ? Math.max(0, 1 - phase) : 1;
        ctx.globalAlpha = alpha * retract;
        curve(points, spec.motif === 'chains' ? 0.85 : 1.6, spec.color);
        curve(points, 0.35, spec.accent);
        for (let k = 0; k < 10; k++) {
          const t = k / 10,
            u = 1 - t,
            px =
              u * u * u * points[0] +
              3 * u * u * t * points[2] +
              3 * u * t * t * points[4] +
              t * t * t * points[6],
            py =
              u * u * u * points[1] +
              3 * u * u * t * points[3] +
              3 * u * t * t * points[5] +
              t * t * t * points[7];
          if (spec.motif === 'chains') {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.strokeStyle = spec.accent;
            ctx.lineWidth = 0.22;
            ctx.strokeRect(-0.6, -0.4, 1.2, 0.8);
            ctx.restore();
          } else bead(px + nx * 0.35, py + ny * 0.35, 0.22, 0.35, spec.accent);
        }
        if (spec.motif === 'pincer') {
          for (const side of [-1, 1])
            curve(
              [
                x - dx * 0.12 + nx * side * 2,
                y - dy * 0.12 + ny * side * 2,
                x + nx * side * 2,
                y + ny * side * 2,
                x + nx * side * 0.7,
                y + ny * side * 0.7,
                x + Math.cos(angle),
                y + Math.sin(angle),
              ],
              0.8,
              spec.accent,
            );
        }
      }
    } else if (['orbs', 'drones', 'missiles', 'pools', 'eyes'].includes(spec.motif)) {
      if (age > spec.windup - 260 && !active) {
        const lift = Math.sin(travel * Math.PI) * (spec.motif === 'missiles' ? 10 : 6);
        const py = y - lift;
        curve(
          [
            source.x,
            source.y,
            source.x + dx * 0.3,
            source.y + dy * 0.3 - 5,
            x - dx * 0.1,
            py - 1,
            x,
            py,
          ],
          0.3,
          spec.color,
        );
        if (spec.motif === 'missiles') {
          ctx.save();
          ctx.translate(x, py);
          ctx.rotate(angle);
          ctx.fillStyle = spec.color;
          ctx.strokeStyle = spec.accent;
          ctx.lineWidth = 0.16;
          ctx.beginPath();
          ctx.moveTo(2.1, 0);
          ctx.lineTo(0.7, -0.55);
          ctx.lineTo(-1.7, -0.55);
          ctx.lineTo(-1.7, 0.55);
          ctx.lineTo(0.7, 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = spec.accent;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-0.6, side * 0.4);
            ctx.lineTo(-2, side * 1.1);
            ctx.lineTo(-1.7, 0);
            ctx.closePath();
            ctx.fill();
          }
          curve([-1.8, 0, -2.3, -0.3, -3.1, 0.3, -4, 0], 0.55, spec.accent);
          for (let k = 0; k < 5; k++) {
            ctx.globalAlpha = alpha * (1 - k / 5) * 0.3;
            bead(-4 - k * 1.1, Math.sin(k + travel * 6) * 0.25, 0.3 + k * 0.12);
          }
          ctx.restore();
        } else if (spec.motif === 'drones') {
          ctx.save();
          ctx.translate(x, py);
          ctx.rotate(angle);
          ctx.fillStyle = spec.color;
          ctx.fillRect(-1, -0.6, 2, 1.2);
          ctx.fillStyle = spec.accent;
          ctx.beginPath();
          ctx.moveTo(1.5, 0);
          ctx.lineTo(-0.7, -0.35);
          ctx.lineTo(-0.7, 0.35);
          ctx.closePath();
          ctx.fill();
          for (const s of [-1, 1]) {
            ring(0, s * 1.1, 0.75, 0.2, spec.accent);
            ctx.strokeStyle = spec.accent;
            ctx.beginPath();
            ctx.moveTo(-1, s * 1.1);
            ctx.lineTo(1, s * 1.1);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          bead(x, py, 1.3, 1.3, spec.color);
          bead(x - 0.3, py - 0.3, 0.5, 0.5, spec.accent);
        }
      }
      if (active) {
        const r = z.r * (0.3 + 0.7 * phase);
        if (spec.motif === 'eyes') {
          ctx.fillStyle = spec.color;
          ctx.beginPath();
          ctx.ellipse(z.x, z.y, z.r * 0.85, z.r * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
          bead(z.x, z.y, 0.65, 1.8, spec.accent);
          for (let k = 0; k < 4; k++)
            shard(
              z.x + Math.cos((k * Math.PI) / 2) * z.r,
              z.y + Math.sin((k * Math.PI) / 2) * z.r,
              0.7,
              (k * Math.PI) / 2,
            );
        } else {
          ring(z.x, z.y, r, 0.65 * (1 - phase) + 0.15, spec.accent);
          bead(z.x, z.y, z.r * 0.45 * (1 - phase), z.r * 0.25 * (1 - phase), spec.color);
        }
        if (spec.motif === 'pools')
          for (let k = 0; k < 5; k++) {
            const a = k * 2.4;
            bead(z.x + Math.cos(a) * z.r * 0.5, z.y + Math.sin(a) * z.r * 0.5, 1.4, 1, spec.color);
          }
      }
    } else if (z.shape === 'line' && active) {
      const anchored = !['cross', 'rifts'].includes(spec.motif);
      const start = anchored ? source : z;
      ctx.translate(start.x, start.y);
      ctx.rotate(Math.atan2(z.y2 - start.y, z.x2 - start.x));
      const L = Math.max(0.01, Math.hypot(z.x2 - start.x, z.y2 - start.y));
      if (['beam', 'rail'].includes(spec.motif)) {
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = z.w * (0.35 + 0.4 * Math.sin(phase * Math.PI));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(L, 0);
        ctx.stroke();
        ctx.strokeStyle = spec.accent;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        for (let k = 0; k < 6; k++)
          shard((L * (k / 6 + phase / 6)) % L, Math.sin(k * 4 + phase * 6) * z.w * 0.3, 0.65, 0);
      } else if (['cross', 'rifts'].includes(spec.motif)) {
        for (let k = 0; k < 8; k++) {
          const px = (L * k) / 8;
          curve(
            [px, 0, px + 0.7, -z.w * 0.6, px + 1.2, z.w * 0.5, px + L / 8, 0],
            0.6,
            spec.accent,
          );
          shard(px, z.w * 0.4 * Math.sin(k * 3), 0.9, k + phase);
        }
      } else if (spec.motif === 'spray') {
        for (let k = 0; k < 12; k++) {
          const t = (k / 12 + phase) % 1;
          bead(L * t, Math.sin(k * 4) * z.w * 0.4, 0.4 + t * 0.65, 0.3 + t * 0.4, spec.color);
        }
      } else {
        const reach = L * (0.3 + 0.7 * phase);
        curve(
          [0, -z.w * 0.3, reach * 0.5, -z.w, reach * 0.9, z.w, reach, z.w * 0.1],
          1,
          spec.color,
        );
        curve(
          [0, -z.w * 0.25, reach * 0.5, -z.w * 0.8, reach * 0.9, z.w * 0.8, reach, z.w * 0.1],
          0.25,
          spec.accent,
        );
        for (let k = 0; k < 5; k++) shard(reach - k * L * 0.06, Math.sin(k) * z.w * 0.25, 1.3, 0);
      }
    } else if (z.shape !== 'line' && active) {
      // Donut attacks keep the authority's central safe area completely clear.
      const inner = z.shape === 'ring' ? z.inner : 0;
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5,
          r = inner + (z.r - inner) * (0.2 + 0.75 * phase);
        const px = z.x + Math.cos(a) * r,
          py = z.y + Math.sin(a) * r;
        if (['steam', 'plague'].includes(spec.motif)) {
          const lift = phase * (spec.motif === 'steam' ? 6 : 3);
          // Smoke stays in a damage disk; rings never paint over their safe centre.
          bead(px, py - lift, 0.6 + phase * 1.2, 0.8 + phase * 2, spec.color);
          curve([px, py, px - 1, py - 2, px + 1, py - 3, px, py - 4], 0.2, spec.accent);
        } else if (spec.motif === 'stomp' || (spec.motif === 'nova' && spec.boss === 'colossal')) {
          shard(px, py, 0.7 + phase, a, spec.color);
          curve(
            [
              z.x + Math.cos(a) * z.r * 0.3,
              z.y + Math.sin(a) * z.r * 0.3,
              px - 1,
              py,
              px + 1,
              py,
              px,
              py,
            ],
            0.3,
            spec.accent,
          );
        } else if (spec.motif === 'spiral') {
          const t = a + phase * 1.6;
          curve(
            [
              z.x + Math.cos(t) * r,
              z.y + Math.sin(t) * r,
              z.x + Math.cos(t + 0.3) * z.r,
              z.y + Math.sin(t + 0.3) * z.r,
              z.x + Math.cos(t + 0.7) * z.r,
              z.y + Math.sin(t + 0.7) * z.r,
              z.x + Math.cos(t + 1) * r,
              z.y + Math.sin(t + 1) * r,
            ],
            0.55,
            spec.color,
          );
        } else shard(px, py, 0.8 + phase, a + age / 600, spec.accent);
      }
      ring(z.x, z.y, inner + (z.r - inner) * phase, 0.8 * (1 - phase) + 0.15, spec.color);
      if (inner) ring(z.x, z.y, inner, 0.25, spec.accent);
      if (spec.motif === 'nova' && spec.boss === 'hyper-zetton')
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          curve(
            [
              z.x,
              z.y,
              z.x + Math.cos(a) * z.r * 0.3,
              z.y + Math.sin(a) * z.r * 0.3 - 3,
              z.x + Math.cos(a) * z.r * 0.6,
              z.y + Math.sin(a) * z.r * 0.6 - 3,
              z.x + Math.cos(a) * z.r * phase,
              z.y + Math.sin(a) * z.r * phase,
            ],
            0.8,
            spec.color,
          );
        }
    }
    ctx.restore();
    paintBossMaterial(ctx, spec, z, source, target, age, index);
    // Finite impact flecks show the timed beat, never a false damage number.
    if (active && phase < 0.55)
      for (let k = 0; k < 5; k++) {
        const a = k * 2.4,
          r = 1 + phase * 5;
        if (z.shape !== 'ring')
          shard(target.x + Math.cos(a) * r, target.y + Math.sin(a) * r, 0.6 * (1 - phase), a);
      }
    ctx.restore();
  }
  ctx.restore();
}

// Bounded details, sampled from the same cast age. No extra animation owner,
// random particles, hit tests, screen transforms or persistent drawing state.
function paintBossMaterial(ctx, spec, zone, source, target, age, index) {
  const windup = Math.max(1, spec.windup);
  const active = age >= windup;
  const elapsed = Math.max(0, age - windup);
  if (age > windup + spec.duration + 400) return;
  const beat = Math.min(1, (spec.slot === 'r' ? elapsed % 550 : elapsed) / 450);
  const fade = active
    ? Math.max(0, 1 - elapsed / (spec.duration + 400))
    : Math.min(1, age / windup);
  const line = (points, width, color = spec.accent) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.stroke();
  };
  const oval = (x, y, rx, ry, color = spec.color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const glow = (x, y, radius, color = spec.color) => {
    const r = Math.max(0.1, radius);
    const gradient = ctx.createRadialGradient?.(x, y, 0, x, y, r);
    if (gradient?.addColorStop) {
      gradient.addColorStop(0, spec.accent);
      gradient.addColorStop(0.28, color);
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const lineZone = zone.shape === 'line';
  const direction = Math.atan2(target.y - source.y, target.x - source.x);
  const width = lineZone ? zone.w : Math.max(1, zone.r || 4);
  ctx.save();
  ctx.globalAlpha = fade * 0.75;
  if (spec.boss === 'dark-zagi' && !active && spec.slot === 'r') {
    const spread = 3 * (1 - Math.min(1, age / windup)) + 1;
    line(
      [
        [source.x - spread, source.y - spread],
        [source.x + spread, source.y + spread],
      ],
      0.8,
    );
    line(
      [
        [source.x - spread, source.y + spread],
        [source.x + spread, source.y - spread],
      ],
      0.8,
    );
    glow(source.x, source.y, 1.2 + (age / windup) * 2);
  }
  if (active && lineZone && spec.boss === 'gleam-eyes' && spec.slot === 'e') {
    ctx.save();
    ctx.translate(source.x, source.y);
    ctx.rotate(direction);
    const length = Math.hypot(target.x - source.x, target.y - source.y);
    for (let i = 0; i < 9; i++) {
      const x = length * (i / 9 + beat / 18),
        flare = width * (0.3 + 0.15 * Math.sin(i * 2 + age / 90));
      ctx.fillStyle = i % 2 ? spec.color : spec.accent;
      ctx.beginPath();
      ctx.moveTo(x, -flare);
      ctx.quadraticCurveTo(x + length / 12, -flare * 1.3, x + length / 8, 0);
      ctx.quadraticCurveTo(x + length / 12, flare * 1.3, x, flare);
      ctx.closePath();
      ctx.fill();
    }
    line(
      [
        [0, 0],
        [length, 0],
      ],
      width * 0.18,
      spec.accent,
    );
    ctx.restore();
  }
  if (active && zone.shape === 'sector' && ['gleam-eyes', 'dark-zagi'].includes(spec.boss)) {
    const radius = zone.r * (0.4 + 0.6 * beat),
      a = zone.direction - zone.angle / 2;
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = spec.boss === 'gleam-eyes' ? 1.2 : 2;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, radius, a, a + zone.angle);
    ctx.stroke();
    const strikeAngle = zone.direction;
    glow(
      zone.x + Math.cos(strikeAngle) * radius,
      zone.y + Math.sin(strikeAngle) * radius,
      2.2 * (1 - beat) + 0.3,
    );
    if (spec.boss === 'dark-zagi') {
      const x = zone.x + Math.cos(strikeAngle) * radius,
        y = zone.y + Math.sin(strikeAngle) * radius;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(strikeAngle);
      ctx.fillStyle = spec.color;
      ctx.fillRect(-2, -1.7, 3.8, 3.4);
      for (let i = 0; i < 3; i++)
        line(
          [
            [1.8, -1.2 + i * 0.9],
            [2.4, -1.2 + i * 0.9],
          ],
          0.4,
        );
      ctx.restore();
    }
  }
  if (!active) {
    if (spec.boss === 'steel-behemoth') {
      // Sliding gun housing and compression rails, not a magic charging halo.
      ctx.translate(source.x, source.y);
      ctx.rotate(direction);
      for (const side of [-1, 1]) {
        line(
          [
            [-2, side],
            [1.5, side],
            [2, side * 0.45],
          ],
          0.3,
          spec.color,
        );
        line(
          [
            [-1 + fade, side * 0.6],
            [2, side * 0.6],
          ],
          0.2,
        );
      }
    } else if (spec.boss === 'ghidorah-turtle' && spec.slot !== 'e') {
      for (let k = 0; k < 3; k++) {
        const a = age / 180 + k * 2.1;
        line(
          [
            [source.x + Math.cos(a) * 2.3, source.y + Math.sin(a) * 2.3],
            [source.x, source.y],
          ],
          0.2,
        );
      }
    }
    ctx.restore();
    return;
  }
  if (lineZone) {
    // Perspective streaks live inside the actual lane and never widen the hit box.
    const from = ['cross', 'rifts'].includes(spec.motif) ? zone : source;
    const length = Math.max(0.1, Math.hypot(target.x - from.x, target.y - from.y));
    ctx.save();
    ctx.translate(from.x, from.y);
    ctx.rotate(Math.atan2(target.y - from.y, target.x - from.x));
    if (spec.boss === 'greeza' || spec.boss === 'prismatic-void') {
      for (let k = 0; k < 7; k++) {
        const x = (length * k) / 7,
          step = length / 7;
        const side = k % 2 ? -1 : 1;
        ctx.fillStyle = k % 2 ? spec.color : spec.accent;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + step * 0.4, side * width * 0.33);
        ctx.lineTo(x + step, 0);
        ctx.lineTo(x + step * 0.55, side * width * 0.1);
        ctx.closePath();
        ctx.fill();
      }
    } else if (['beam', 'rail'].includes(spec.motif)) {
      const beamWidth = Math.max(0.1, width * 0.35 * (1 - beat * 0.4));
      const gradient = ctx.createLinearGradient?.(0, -beamWidth, 0, beamWidth);
      if (gradient?.addColorStop) {
        gradient.addColorStop(0, spec.color + '00');
        gradient.addColorStop(0.3, spec.color);
        gradient.addColorStop(0.5, spec.accent);
        gradient.addColorStop(0.7, spec.color);
        gradient.addColorStop(1, spec.color + '00');
        ctx.fillStyle = gradient;
      } else ctx.fillStyle = spec.color;
      ctx.fillRect(0, -beamWidth, length, beamWidth * 2);
      glow(0, 0, width * 0.7);
      glow(length, 0, width * 0.6);
      for (const side of [-1, 1]) {
        const points = [];
        for (let k = 0; k <= 10; k++)
          points.push([
            (length * k) / 10,
            side * width * (0.2 + 0.1 * Math.sin(k * 2.1 + beat * 8)),
          ]);
        line(points, spec.boss === 'ghidorah-turtle' ? 0.32 : 0.16);
      }
      oval(length, 0, width * (0.2 + beat * 0.2), width * 0.28, spec.accent);
    } else if (spec.boss === 'arkveld') {
      for (let k = 0; k < 5; k++) {
        const x = (length * (k + 0.7)) / 6;
        line(
          [
            [x - 2, -width * 0.25],
            [x + 1, 0],
            [x - 2, width * 0.25],
          ],
          0.3,
        );
      }
    } else if (spec.boss === 'gyo' && spec.slot === 'e') {
      for (let k = 0; k < 9; k++) {
        const t = (k / 9 + beat * 0.2) % 1;
        oval(length * t, Math.sin(k * 2.3) * width * 0.25, 0.45 + t * 0.6, 0.2 + t * 0.3);
      }
    } else if (spec.boss === 'cthulhu' || spec.boss === 'mutalith') {
      for (let k = 0; k < 6; k++) {
        const x = (length * (k + 0.5)) / 7;
        oval(x, Math.sin(k * 2 + beat * 3) * width * 0.16, 0.45, 0.23, spec.accent);
      }
    }
    ctx.restore();
  } else {
    const inner = zone.shape === 'ring' ? zone.inner : 0;
    const radius = Math.max(inner + 0.1, zone.r || 4);
    const explosion = spec.boss === 'steel-behemoth' || spec.boss === 'hyper-zetton';
    if (!inner && zone.shape === 'circle' && explosion) {
      ctx.save();
      const blast = radius * (0.3 + beat * 0.45);
      ctx.globalAlpha = fade * (1 - beat * 0.65);
      glow(zone.x, zone.y, radius * (0.7 + beat * 0.2));
      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      for (let k = 0; k < 20; k++) {
        const a = (k * Math.PI) / 10;
        const r = blast * (k % 2 ? 0.42 : 1);
        const x = zone.x + Math.cos(a) * r,
          y = zone.y + Math.sin(a) * r;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      // Dark fire keeps a compressed centre; ordnance keeps a bright pressure core.
      ctx.globalAlpha = fade * 0.9;
      oval(
        zone.x,
        zone.y,
        blast * 0.35,
        blast * 0.27,
        spec.boss === 'hyper-zetton' ? spec.accent : 'white',
      );
      ctx.restore();
    } else if (!inner && zone.shape === 'circle' && spec.boss === 'mutalith') {
      glow(zone.x, zone.y, radius * 0.75);
      ctx.save();
      ctx.translate(zone.x, zone.y);
      ctx.rotate(age / 500 + index);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.8, radius * 0.25, s * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = s > 0 ? spec.color : spec.accent;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      oval(0, 0, radius * 0.25, radius * 0.25, spec.accent);
      ctx.restore();
    }
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + index * 0.3;
      const r = inner + (radius - inner) * (0.4 + beat * 0.45);
      const x = zone.x + Math.cos(a) * r,
        y = zone.y + Math.sin(a) * r;
      if (spec.boss === 'hyper-zetton') {
        // Pointed black-fire lobes with a thin hot inner edge.
        line(
          [
            [x - Math.sin(a), y + Math.cos(a)],
            [x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1],
            [x + Math.sin(a), y - Math.cos(a)],
          ],
          0.8,
          spec.color,
        );
        line(
          [
            [x, y],
            [x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9],
          ],
          0.25,
        );
        ctx.save();
        ctx.globalAlpha = fade * 0.35;
        glow(x, y, (radius - inner) * 0.18, spec.accent);
        ctx.restore();
      } else if (spec.boss === 'cthulhu' || spec.boss === 'prismatic-void') {
        oval(x, y, 0.8, 0.35);
        oval(x, y, 0.16, 0.32, spec.accent);
      } else if (spec.boss === 'mutalith' || spec.boss === 'greeza') {
        line(
          [
            [x - Math.sin(a), y + Math.cos(a)],
            [x + Math.cos(a), y + Math.sin(a)],
            [x + Math.sin(a), y - Math.cos(a)],
          ],
          0.35,
        );
      } else if (spec.boss === 'gyo' || spec.boss === 'gatanozoa') {
        oval(x, y, 0.4 + beat * 0.5, 0.25 + beat * 0.3);
        line(
          [
            [x, y],
            [x + Math.cos(a) * 0.5, y + Math.sin(a) * 0.5 - 1],
          ],
          0.12,
        );
        ctx.save();
        ctx.globalAlpha = fade * 0.2;
        glow(x, y, (radius - inner) * 0.22);
        ctx.restore();
      } else if (spec.boss === 'colossal') {
        const startR = inner + (radius - inner) * 0.3;
        line(
          [
            [zone.x + Math.cos(a) * startR, zone.y + Math.sin(a) * startR],
            [x - 0.4, y],
            [x, y],
          ],
          0.28,
        );
        ctx.save();
        ctx.globalAlpha = fade * (spec.slot === 'e' ? 0.15 : 0.35);
        glow(x, y, (radius - inner) * 0.22, spec.accent);
        ctx.restore();
      }
    }
  }
  // SAGIUS impacts are a fireball, sharp metal fragments and expanding smoke;
  // the quiet interval between separate waves remains visible.
  if (spec.boss === 'steel-behemoth' && beat < 0.85) {
    const size = Math.min(lineZone ? width * 0.4 : width * 0.45, 3.8);
    ctx.globalAlpha = fade * (1 - beat) * 0.8;
    oval(target.x, target.y, size * (0.4 + beat), size * (0.25 + beat * 0.6), spec.accent);
    for (let k = 0; k < 6; k++) {
      const a = k * 2.4,
        r = size * (0.5 + beat);
      line(
        [
          [target.x + Math.cos(a) * r * 0.5, target.y + Math.sin(a) * r * 0.5],
          [target.x + Math.cos(a) * r, target.y + Math.sin(a) * r],
        ],
        0.2,
      );
      ctx.globalAlpha = fade * beat * 0.18;
      oval(
        target.x + Math.cos(a) * size * beat,
        target.y + Math.sin(a) * size * beat - beat,
        size * 0.35,
        size * 0.3,
      );
    }
  }
  ctx.restore();
}
