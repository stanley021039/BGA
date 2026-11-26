// Shared authoritative plans: the server, static warning and artwork use identical locked zones.
export function bossStageSpec(spec, phase = 1) {
  if (!spec) return null;
  phase = [1, 2, 3].includes(Number(phase)) ? Number(phase) : 1;
  if (spec.phase === phase) return spec;
  const stage = spec.stages?.[phase];
  const windup = Math.max(
    spec.windup * 0.85,
    (spec.slot === 'r' ? 1400 : 550) * [1, 1.15, 1.3][phase - 1],
  );
  return {
    ...spec,
    ...(stage || {}),
    phase,
    windup,
    duration: Math.max(spec.duration, ...(stage?.steps || []).map((s) => s.delay)),
  };
}
export function bossAttackPlan(spec, from, aim, aspect = 1.6) {
  const steps =
    spec.steps ||
    Array.from({ length: spec.pulses }, (_, i) => ({
      delay: (i * spec.duration) / Math.max(1, spec.pulses - 1),
      weight: 1 / spec.pulses,
    }));
  return steps.map((step, index) => {
    const strike = { ...spec, ...step, steps: undefined };
    const effects = {
      slow: spec.slow ? 20 : 0,
      ms: spec.slow || 1000,
      drain: spec.drain || 0,
      pull: spec.pull || 0,
      ...(spec.effects || {}),
      ...(step.effects || {}),
      root: step.root ?? (index === steps.length - 1 ? spec.root || 0 : 0),
    };
    if (step.pull !== undefined) effects.pull = step.pull;
    return {
      index,
      at: spec.windup + step.delay,
      damage: spec.damage * spec.pulses * step.weight,
      zones: baseBossZones(strike, from, aim, aspect),
      effects,
      spec: strike,
      reverse: !!step.reverse,
    };
  });
}
export function bossZones(spec, from, aim, aspect = 1.6) {
  return spec.steps
    ? bossAttackPlan(spec, from, aim, aspect).flatMap((s) => s.zones)
    : baseBossZones(spec, from, aim, aspect);
}
function baseBossZones(spec, from, aim, aspect) {
  const d = Math.max(1, aspect),
    p = { x: (from.x * aspect) / d, y: from.y / d },
    t = { x: (aim.x * aspect) / d, y: aim.y / d };
  const a = Math.atan2(t.y - p.y, t.x - p.x),
    rotation = ((spec.rotation || 0) * Math.PI) / 180,
    side = spec.side || 0;
  for (const point of [p, t]) {
    point.x -= Math.sin(a) * side;
    point.y += Math.cos(a) * side;
  }
  const angle = a + rotation,
    L = Math.min(spec.range, Math.hypot(t.x - p.x, t.y - p.y));
  const end = { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L };
  const circle = (x, y, r = spec.radius) => ({ shape: 'circle', x, y, r });
  const line = (x, y, angle, length = spec.range) => {
    const z = {
      shape: 'line',
      x,
      y,
      x2: x + Math.cos(angle) * length,
      y2: y + Math.sin(angle) * length,
      w: spec.width,
    };
    return spec.reverse ? { ...z, x: z.x2, y: z.y2, x2: z.x, y2: z.y } : z;
  };
  if (spec.geometry === 'line') return [line(p.x, p.y, angle)];
  if (spec.geometry === 'fan')
    return [-0.48, 0, 0.48].map((offset) => line(p.x, p.y, angle + offset));
  if (spec.geometry === 'fork')
    return [-0.38, 0.38].map((offset) => line(p.x, p.y, angle + offset));
  if (spec.geometry === 'lanes')
    return [-1, 0, 1].map((n) =>
      line(
        p.x - Math.sin(angle) * n * (spec.spacing || 9),
        p.y + Math.cos(angle) * n * (spec.spacing || 9),
        angle,
      ),
    );
  if (spec.geometry === 'star')
    return Array.from({ length: 6 }, (_, i) => line(p.x, p.y, angle + (i * Math.PI) / 3));
  if (spec.geometry === 'cross')
    return [0, Math.PI / 2].map((turn) =>
      line(
        t.x - Math.cos(rotation + turn) * spec.radius,
        t.y - Math.sin(rotation + turn) * spec.radius,
        rotation + turn,
        spec.radius * 2,
      ),
    );
  const centered = ['nova', 'stomp', 'steam', 'plague'].includes(spec.motif);
  if (spec.geometry === 'ring')
    return [
      {
        shape: 'ring',
        x: centered ? p.x : t.x,
        y: centered ? p.y : t.y,
        r: spec.radius,
        inner: spec.radius * (spec.innerRatio ?? 0.55),
        ...(spec.gapDegrees ? { direction: angle, gap: (spec.gapDegrees * Math.PI) / 180 } : {}),
      },
    ];
  if (spec.geometry === 'sector')
    return [
      {
        shape: 'sector',
        x: p.x,
        y: p.y,
        r: spec.radius,
        direction: angle,
        angle: ((spec.coneDegrees || 90) * Math.PI) / 180,
      },
    ];
  if (spec.geometry === 'spots')
    return [-1, 0, 1].map((n) =>
      circle(
        end.x + Math.cos(a + Math.PI / 2) * n * 9,
        end.y + Math.sin(a + Math.PI / 2) * n * 9,
        spec.spotRadius || 5.5,
      ),
    );
  return [circle(centered ? p.x : t.x, centered ? p.y : t.y)];
}
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export function inBossZones(zones, actor, aspect = 1.6) {
  const d = Math.max(1, aspect),
    x = (actor.x * aspect) / d,
    y = actor.y / d;
  return zones.some((z) => {
    if (z.shape === 'circle') return Math.hypot(x - z.x, y - z.y) <= z.r;
    if (z.shape === 'ring') {
      const r = Math.hypot(x - z.x, y - z.y);
      return (
        r <= z.r &&
        r >= z.inner &&
        (!z.gap || angleDistance(Math.atan2(y - z.y, x - z.x), z.direction) > z.gap / 2)
      );
    }
    if (z.shape === 'sector')
      return (
        Math.hypot(x - z.x, y - z.y) <= z.r &&
        angleDistance(Math.atan2(y - z.y, x - z.x), z.direction) <= z.angle / 2
      );
    const dx = z.x2 - z.x,
      dy = z.y2 - z.y,
      t = Math.max(0, Math.min(1, ((x - z.x) * dx + (y - z.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - z.x - dx * t, y - z.y - dy * t) <= z.w / 2;
  });
}
export function bossZonePath(z) {
  if (z.shape === 'line') return 'M' + z.x + ',' + z.y + 'L' + z.x2 + ',' + z.y2;
  const point = (r, a) => [z.x + Math.cos(a) * r, z.y + Math.sin(a) * r].join(',');
  if (z.shape === 'circle' || (z.shape === 'ring' && !z.gap)) {
    const full = (r, clockwise) =>
      'M' +
      point(r, 0) +
      'a' +
      r +
      ',' +
      r +
      ' 0 1 ' +
      clockwise +
      ' ' +
      -2 * r +
      ',0a' +
      r +
      ',' +
      r +
      ' 0 1 ' +
      clockwise +
      ' ' +
      2 * r +
      ',0';
    return full(z.r, 1) + (z.shape === 'ring' ? full(z.inner, 0) : '') + 'Z';
  }
  const start = z.shape === 'ring' ? z.direction + z.gap / 2 : z.direction - z.angle / 2;
  const end =
    z.shape === 'ring' ? z.direction + 2 * Math.PI - z.gap / 2 : z.direction + z.angle / 2;
  const large = end - start > Math.PI ? 1 : 0,
    inner = z.inner || 0;
  return (
    'M' +
    point(z.r, start) +
    'A' +
    z.r +
    ',' +
    z.r +
    ' 0 ' +
    large +
    ' 1 ' +
    point(z.r, end) +
    (inner
      ? 'L' +
        point(inner, end) +
        'A' +
        inner +
        ',' +
        inner +
        ' 0 ' +
        large +
        ' 0 ' +
        point(inner, start)
      : 'L' + z.x + ',' + z.y) +
    'Z'
  );
}
export function traceBossZone(ctx, z) {
  ctx.beginPath();
  if (z.shape === 'line') {
    ctx.moveTo(z.x, z.y);
    ctx.lineTo(z.x2, z.y2);
    ctx.lineWidth = z.w;
    return;
  }
  if (z.shape === 'circle' || (z.shape === 'ring' && !z.gap)) {
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    if (z.shape === 'ring') {
      ctx.moveTo(z.x + z.inner, z.y);
      ctx.arc(z.x, z.y, z.inner, 0, Math.PI * 2, true);
    }
    return;
  }
  const start = z.shape === 'ring' ? z.direction + z.gap / 2 : z.direction - z.angle / 2,
    end = z.shape === 'ring' ? z.direction + 2 * Math.PI - z.gap / 2 : z.direction + z.angle / 2;
  ctx.moveTo(z.x + Math.cos(start) * z.r, z.y + Math.sin(start) * z.r);
  ctx.arc(z.x, z.y, z.r, start, end);
  if (z.inner) {
    ctx.lineTo(z.x + Math.cos(end) * z.inner, z.y + Math.sin(end) * z.inner);
    ctx.arc(z.x, z.y, z.inner, end, start, true);
  } else ctx.lineTo(z.x, z.y);
  ctx.closePath();
}
