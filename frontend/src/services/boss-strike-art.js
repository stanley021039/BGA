// Motion reference: Stitch #410 R2. Keep the authoritative 33 hit zones/timings;
// the prototype's three shared collision shapes and replacement mascots are not used.
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
    thanos: spec.slot === 'q' ? [0.2, 0.65] : [0.8, 0.5],
  };
  const anchor = emitters[spec.boss] || [0.5, 0.5];
  const anchorX = caster?.facingLeft ? 1 - anchor[0] : anchor[0];
  const source = caster
    ? {
        x:
          ((caster.x + (anchorX - 0.5) * (caster.width || 0)) * 100 * aspect) / (options.width * d),
        y: ((caster.y + (anchor[1] - 0.5) * (caster.height || 0)) * 100) / (options.height * d),
      }
    : { x: origin.x, y: origin.y - 5 };
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
  for (const [index, z] of zones.entries()) {
    ctx.save();
    const target = z.shape === 'line' ? { x: z.x2, y: z.y2 } : { x: z.x, y: z.y };
    const dx = target.x - source.x,
      dy = target.y - source.y;
    const angle = Math.atan2(dy, dx),
      nx = -Math.sin(angle),
      ny = Math.cos(angle);
    let x = source.x + dx * travel,
      y = source.y + dy * travel;
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
          if (spec.boss === 'thanos') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillStyle = spec.color;
            ctx.fillRect(-2, -1.5, 3, 3);
            for (let k = 0; k < 4; k++) bead(0.8, -1.1 + k * 0.72, 0.65, 0.45, spec.accent);
            ctx.restore();
          } else
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
          shard(x, py, 1.6, angle, spec.accent);
          shard(
            x - Math.cos(angle) * 2,
            py - Math.sin(angle) * 2,
            1.2,
            angle + Math.PI,
            spec.color,
          );
        } else if (spec.motif === 'drones') {
          ctx.save();
          ctx.translate(x, py);
          ctx.rotate(angle);
          ctx.fillStyle = spec.color;
          ctx.fillRect(-1, -0.6, 2, 1.2);
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
      if (['beam', 'rail', 'stones'].includes(spec.motif)) {
        const color =
          spec.motif === 'stones'
            ? ['#5bb9ff', '#f26868', '#ae79f0', '#5cdb99', '#f5dc6c', '#f5a353'][index % 6]
            : spec.color;
        ctx.strokeStyle = color;
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
