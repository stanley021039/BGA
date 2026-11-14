// Authoritative normalized coordinates. Rendering and server collision share these shapes.
export function bossZones(spec, from, aim, aspect = 1.6) {
  const d = Math.max(1, aspect),
    p = { x: (from.x * aspect) / d, y: from.y / d },
    t = { x: (aim.x * aspect) / d, y: aim.y / d };
  const a = Math.atan2(t.y - p.y, t.x - p.x),
    L = Math.min(spec.range, Math.hypot(t.x - p.x, t.y - p.y));
  const end = { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L };
  const circle = (x, y, r = spec.radius) => ({ shape: 'circle', x, y, r });
  const line = (x, y, angle, length = spec.range) => ({
    shape: 'line',
    x,
    y,
    x2: x + Math.cos(angle) * length,
    y2: y + Math.sin(angle) * length,
    w: spec.width,
  });
  if (spec.geometry === 'line') return [line(p.x, p.y, a)];
  if (spec.geometry === 'fan') return [-0.48, 0, 0.48].map((offset) => line(p.x, p.y, a + offset));
  if (spec.geometry === 'star')
    return Array.from({ length: 6 }, (_, i) => line(p.x, p.y, a + (i * Math.PI) / 3));
  if (spec.geometry === 'cross')
    return [
      line(t.x - spec.radius, t.y, 0, spec.radius * 2),
      line(t.x, t.y - spec.radius, Math.PI / 2, spec.radius * 2),
    ];
  if (spec.geometry === 'ring')
    return [{ shape: 'ring', x: t.x, y: t.y, r: spec.radius, inner: spec.radius * 0.55 }];
  if (spec.geometry === 'spots')
    return [-1, 0, 1].map((n) =>
      circle(
        end.x + Math.cos(a + Math.PI / 2) * n * 9,
        end.y + Math.sin(a + Math.PI / 2) * n * 9,
        5.5,
      ),
    );
  const centered = ['nova', 'stomp', 'steam', 'plague'].includes(spec.motif);
  return [circle(centered ? p.x : t.x, centered ? p.y : t.y)];
}
export function inBossZones(zones, actor, aspect = 1.6) {
  const d = Math.max(1, aspect),
    x = (actor.x * aspect) / d,
    y = actor.y / d;
  return zones.some((z) => {
    if (z.shape === 'circle') return Math.hypot(x - z.x, y - z.y) <= z.r;
    if (z.shape === 'ring') {
      const r = Math.hypot(x - z.x, y - z.y);
      return r <= z.r && r >= z.inner;
    }
    const dx = z.x2 - z.x,
      dy = z.y2 - z.y,
      t = Math.max(0, Math.min(1, ((x - z.x) * dx + (y - z.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - z.x - dx * t, y - z.y - dy * t) <= z.w / 2;
  });
}
