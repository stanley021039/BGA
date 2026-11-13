/* Finite production adaptation of the confirmed six-skill Stitch direction.
 * Source preview: work/stitch-moves-314; impacts require real server receipts.
 * No demo controls, network, timer, animation loop or invented damage. */
'use strict';
import { homingScale } from './attack-homing.js';
import rules from '../../../public/shared/scene-rules.json' with { type: 'json' };
const TAU = Math.PI * 2;
const clamp = (n) => Math.max(0, Math.min(1, n));
const mix = (a, b, p) => a + (b - a) * p;
const palettes = {
  shaohua: ['#ffb858', '#a895ef'],
  reaper: ['#65e8c2', '#f77597'],
  railgun: ['#55ddff', '#ff915a'],
  plasma: ['#80edaf', '#bc93ff'],
  missiles: ['#ffad54', '#78dafa'],
  sniper: ['#ff779f', '#65e5b8'],
};
// Material and accent colours are independent of the energy glow. No image tinting.
const alternateMaterials = {
  shaohua: { accent: '#ffda86', core: '#fff1c9', dark: '#181329' },
  reaper: { accent: '#88dfcd', core: '#ffe5cb', dark: '#301826' },
  railgun: {
    accent: '#78d9ee',
    core: '#fff3ce',
    top: '#e6c4a2',
    middle: '#855841',
    dark: '#261f26',
    edge: '#edbd89',
  },
  plasma: {
    accent: '#70eadc',
    core: '#fff1ff',
    top: '#d9daf4',
    middle: '#655879',
    dark: '#24243e',
    edge: '#b9bde4',
  },
  missiles: {
    accent: '#a6a0ef',
    core: '#dfe7ff',
    top: '#77cbdc',
    middle: '#28647b',
    dark: '#182a3e',
    edge: '#a2d3eb',
  },
  sniper: {
    accent: '#efcd85',
    core: '#effff5',
    top: '#b9ddd0',
    middle: '#375b59',
    dark: '#132d30',
    edge: '#b7cdac',
  },
};
function material(o, k) {
  return o.alternate ? alternateMaterials[k] : undefined;
}
function color(o, k) {
  return palettes[k][o.alternate ? 1 : 0];
}
function circle(c, x, y, r, fill, stroke) {
  if (r <= 0) return;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function line(c, x, y, X, Y, col, w = 2) {
  c.strokeStyle = col;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(X, Y);
  c.stroke();
}
function glow(c, x, y, r, col) {
  if (r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, col.slice(0, 7) + '00');
  circle(c, x, y, r, g);
}
function frame(c, o, fn) {
  const f = o.from,
    t = o.to;
  c.save();
  c.translate(f.x, f.y);
  c.rotate(Math.atan2(t.y - f.y, t.x - f.x));
  try {
    fn(Math.max(1, Math.hypot(t.x - f.x, t.y - f.y)));
  } finally {
    c.restore();
  }
}
function followCaster(c, o) {
  c.save();
  const caster = o.readCaster?.();
  if (!caster) return;
  const x = caster.x - o.from.x;
  const y = caster.y - o.from.y;
  const angle = Math.atan2(o.to.y - o.from.y, o.to.x - o.from.x);
  c.translate(x * Math.cos(angle) + y * Math.sin(angle), y * Math.cos(angle) - x * Math.sin(angle));
}
function impact(c, o, t, col, phase) {
  const hits = typeof o.readHits === 'function' ? o.readHits() : [];
  for (const h of hits.slice(0, 32)) {
    if (phase && h.phase !== phase) continue;
    const p = (t - h.at) / 340;
    if (p < 0 || p > 1) continue;
    c.save();
    c.globalAlpha = 1 - p;
    c.lineWidth = 3;
    circle(c, h.x, h.y, 9 + p * 36, null, col);
    glow(c, h.x, h.y, 25 * (1 - p), col);
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12;
      const r = 12 + p * (22 + (k % 3) * 7);
      line(
        c,
        h.x + Math.cos(a) * r,
        h.y + Math.sin(a) * r,
        h.x + Math.cos(a) * (r + 7),
        h.y + Math.sin(a) * (r + 7),
        col,
        2,
      );
    }
    c.restore();
  }
}
function imageFit(c, img, x, y, w, h) {
  if (!img || !img.width || !img.height) return;
  const r = Math.min(w / img.width, h / img.height);
  c.drawImage(
    img,
    x - (img.width * r) / 2,
    y - (img.height * r) / 2,
    img.width * r,
    img.height * r,
  );
}
function alive(t, max = 4200) {
  return Number.isFinite(t) && t >= 0 && t < max;
}
function drawShaohua(c, o, t) {
  if (!alive(t) || typeof o.readHead !== 'function') return;
  const h = o.readHead();
  if (h?.exploded) {
    const p = (t - h.at) / rules.shaohua.burstMs;
    if (p < 0 || p >= 1) return;
    const col = color(o, 'shaohua');
    const scale = o.scale || 1;
    const spread = 1 - (1 - p) ** 2;
    c.save();
    c.translate(h.x, h.y);
    c.scale(scale, scale);
    c.globalAlpha = 1 - p;
    glow(c, 0, 0, 35 + spread * 82, col);
    c.lineWidth = 5 * (1 - p) + 1;
    circle(c, 0, 0, 20 + spread * 112, null, col);
    circle(c, 0, 0, 10 + spread * 76, null, col);
    for (let k = 0; k < 14; k++) {
      const a = (k * TAU) / 14;
      const r = 16 + spread * (74 + (k % 3) * 15);
      const tail = r - 23 * (1 - p);
      line(c, Math.cos(a) * tail, Math.sin(a) * tail, Math.cos(a) * r, Math.sin(a) * r, col, 4);
    }
    c.restore();
    return;
  }
  if (!h || h.cancelled) return;
  const biting = h.contactAt > 0 && t >= h.contactAt;
  const img = o.images?.[biting ? 'open' : 'closed'];
  if (!img?.width) return;
  const paint = material(o, 'shaohua');
  const col = color(o, 'shaohua'),
    S = (o.scale || 1) * homingScale(Math.max(t, h.at || 0)),
    sz = (biting ? 176 : 124) * S;
  const facing = Math.atan2(h.targetY - h.y, h.targetX - h.x);
  const p = biting ? clamp((t - h.contactAt) / Math.max(1, h.biteAt - h.contactAt)) : 0;
  const closing = biting && t >= h.biteAt ? clamp((t - h.biteAt) / 300) : 0;
  if (!h.finished) {
    c.save();
    try {
      c.translate(h.x, h.y);
      c.globalAlpha = 1 - closing;
      // Finite afterimages stay behind the authoritative tracking-head position.
      if (!biting) {
        for (let k = 3; k >= 1; k--) {
          c.save();
          c.globalAlpha = (4 - k) * 0.065;
          const d = (25 + k * 20) * S;
          imageFit(
            c,
            img,
            -Math.cos(facing) * d,
            -Math.sin(facing) * d,
            sz * (1 - k * 0.13),
            sz * (1 - k * 0.13),
          );
          c.restore();
        }
        for (let k = 0; k < 12; k++) {
          const a = facing + Math.PI + (k - 5.5) * 0.12;
          const r = (50 + ((t * 0.15 + k * 17) % 65)) * S;
          line(
            c,
            Math.cos(a) * r,
            Math.sin(a) * r,
            Math.cos(a) * (r + 24 * S),
            Math.sin(a) * (r + 24 * S),
            col + '88',
            2 * S,
          );
        }
      }
      glow(c, 0, 0, sz * (biting ? 1.05 : 0.85), col + '66');
      const accent = paint?.accent || '#ffe0a1';
      // Open arcs follow the authoritative head; the portrait keeps its original colours.
      for (let k = 0; k < 2; k++) {
        const radius = sz * (0.76 + k * 0.16) * (1 - p * 0.12);
        const turn = t * (k ? -0.0025 : 0.003) + facing + k * Math.PI;
        c.beginPath();
        c.arc(0, 0, radius, turn, turn + Math.PI * (biting ? 1.3 : 0.95));
        c.strokeStyle = (k ? col : accent) + 'cc';
        c.lineWidth = (k ? 2 : 3) * S;
        c.stroke();
        const a = turn + Math.PI * 0.85;
        line(
          c,
          Math.cos(a) * radius,
          Math.sin(a) * radius,
          Math.cos(a + 0.18) * radius * 0.88,
          Math.sin(a + 0.18) * radius * 0.88,
          accent,
          2 * S,
        );
      }
      c.lineWidth = 4 * S;
      circle(c, 0, 0, sz * 0.65, null, paint?.accent || col);
      for (let k = 0; k < 10; k++) {
        const a = t * 0.004 + (k * TAU) / 10;
        const orbit = sz * (biting ? 0.88 - p * 0.22 : 0.72);
        const inner = orbit - (biting ? 15 : 7) * S;
        line(
          c,
          Math.cos(a) * orbit,
          Math.sin(a) * orbit,
          Math.cos(a + 0.08) * inner,
          Math.sin(a + 0.08) * inner,
          k % 2 ? accent : paint?.core || col,
          2.5 * S,
        );
      }
      c.scale(1 - closing * 0.65, 1 - closing * 0.65);
      if (!biting) {
        imageFit(c, img, 0, 0, sz, sz);
      } else {
        const ratio = sz / Math.max(img.width, img.height),
          w = img.width * ratio,
          H = img.height * ratio;
        const gape = Math.pow(Math.max(0, Math.sin(p * Math.PI)), 0.7) * 76 * S,
          split = 0.58;
        const mouthY = -H / 2 + H * split;
        // A local vortex exaggerates the suction without moving or damaging players.
        c.fillStyle = paint?.dark || '#130d1b';
        c.fillRect(-w / 2, mouthY, w, H * (1 - split) + gape);
        if (p < 1) {
          c.save();
          c.translate(0, mouthY + gape * 0.5);
          c.scale(1, 0.55);
          for (let k = 0; k < 3; k++) {
            c.save();
            c.rotate(-t * 0.008 + (k * TAU) / 3);
            c.strokeStyle = (k % 2 ? paint?.accent || col : col) + 'bb';
            c.lineWidth = 3 * S;
            c.beginPath();
            c.arc(0, 0, (24 + k * 18) * S, 0.15, Math.PI * 1.5);
            c.stroke();
            c.restore();
          }
          c.restore();
          for (let k = 0; k < 22; k++) {
            const phase = (p * 2.2 + k / 22) % 1;
            const a = k * 2.399 + p * 4,
              r = (1 - phase) * (130 + 18 * (k % 3)) * S;
            const x = Math.cos(a) * r,
              y = mouthY + gape * 0.5 + Math.sin(a) * r * 0.7;
            line(
              c,
              x,
              y,
              x + Math.cos(a) * 18 * S,
              y + Math.sin(a) * 12 * S,
              col + 'bb',
              (1 + phase * 2) * S,
            );
          }
        }
        // Only the mouth's lower region moves; both original photographs keep their colors.
        c.drawImage(img, 0, 0, img.width, img.height * split, -w / 2, -H / 2, w, H * split);
        c.drawImage(
          img,
          0,
          img.height * split,
          img.width,
          img.height * (1 - split),
          -w / 2,
          mouthY + gape,
          w,
          H * (1 - split),
        );
        for (let k = 0; k < 8; k++) {
          const a = (k * TAU) / 8 + t * 0.003,
            r = sz * (0.85 - p * 0.2);
          line(
            c,
            Math.cos(a) * r,
            Math.sin(a) * r,
            Math.cos(a) * (r + 22 * S),
            Math.sin(a) * (r + 22 * S),
            col,
            3 * S,
          );
        }
      }
    } finally {
      c.restore();
    }
  }
  // The large bite burst is driven exclusively by a real hit, never by contact time.
  const hit = (o.readHits?.() || []).find((hit) => t >= hit.at && t - hit.at < 500);
  if (hit) {
    const q = clamp((t - hit.at) / 500);
    c.save();
    try {
      c.translate(hit.x, hit.y);
      c.globalAlpha = (1 - q) * (1 - q);
      glow(c, 0, 0, (65 + q * 60) * S, col + '77');
      c.lineWidth = (7 - 4 * q) * S;
      circle(c, 0, 0, (20 + q * 145) * S, null, col);
      circle(c, 0, 0, (12 + q * 105) * S, null, (paint?.accent || col) + 'aa');
      for (let k = 0; k < 24; k++) {
        const a = (k * TAU) / 24,
          r = (30 + q * (95 + (k % 3) * 15)) * S;
        line(
          c,
          Math.cos(a) * r,
          Math.sin(a) * r,
          Math.cos(a) * (r + 20 * S),
          Math.sin(a) * (r + 20 * S),
          col,
          (k % 3 === 0 ? 5 : 2) * S,
        );
      }
    } finally {
      c.restore();
    }
  }
  impact(c, o, t, col);
}
function drawReaper(c, o, t) {
  if (!alive(t, 4050)) return;
  const paint = material(o, 'reaper');
  const col = color(o, 'reaper'),
    f = o.readCaster?.() || o.from,
    scale = o.scale || 1;
  const alpha = Math.min(clamp(t / 600), clamp((4050 - t) / 500));
  const reveal = clamp(t / 1600);
  const characterScale = 0.25 + 0.75 * reveal * reveal * (3 - 2 * reveal);
  const hits = (o.readHits?.() || []).filter((h) => t >= h.at).slice(0, 32);
  const cx = f.x + (o.to.x >= f.x ? 20 : -20) * scale,
    cy = f.y - 45 * scale;
  function seal(x, y, r, rotation, flatten = 1) {
    c.save();
    try {
      c.translate(x, y);
      c.scale(1, flatten);
      c.rotate(rotation);
      c.lineWidth = 2 * scale;
      circle(c, 0, 0, r, null, col);
      circle(c, 0, 0, r * 0.86, null, (paint?.accent || col) + 'aa');
      for (let k = 0; k < 24; k++) {
        c.save();
        c.rotate((k * TAU) / 24);
        c.strokeStyle = paint?.core || col;
        c.lineWidth = 1.5 * scale;
        c.strokeRect(r * 0.91, -3 * scale, 7 * scale, 6 * scale);
        line(c, r * 0.91, -6 * scale, r * 0.96, -6 * scale, col, scale);
        c.restore();
      }
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6,
          b = a + TAU / 3;
        line(
          c,
          Math.cos(a) * r * 0.72,
          Math.sin(a) * r * 0.72,
          Math.cos(b) * r * 0.72,
          Math.sin(b) * r * 0.72,
          col + 'aa',
          1.5 * scale,
        );
      }
    } finally {
      c.restore();
    }
  }
  c.save();
  try {
    c.globalAlpha = alpha;
    glow(c, cx, cy, 145 * scale, col + '55');
    seal(cx, cy, 114 * scale * clamp(t / 600), t * 0.0005);
    seal(cx, cy, 83 * scale * clamp(t / 900), -t * 0.0007);
    // A summoned spirit frames the original photo from behind, leaving its face visible.
    c.save();
    try {
      c.translate(cx, cy - 45 * scale);
      c.scale(scale, scale);
      c.globalAlpha = alpha * 0.7 * clamp(t / 900);
      c.fillStyle = paint ? paint.dark + '99' : col + '22';
      c.strokeStyle = col + 'bb';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-42, -62);
      c.lineTo(-53, -115);
      c.lineTo(-22, -96);
      c.quadraticCurveTo(0, -112, 22, -96);
      c.lineTo(53, -115);
      c.lineTo(42, -62);
      c.quadraticCurveTo(34, -24, 0, -8);
      c.quadraticCurveTo(-34, -24, -42, -62);
      c.closePath();
      c.fill();
      c.stroke();
      line(c, -27, -69, -10, -62, paint?.accent || col, 4);
      line(c, 10, -62, 27, -69, paint?.accent || col, 4);
      c.beginPath();
      c.moveTo(-32, -35);
      c.quadraticCurveTo(-80, -13, -112, 35);
      c.lineTo(-145, 13);
      c.quadraticCurveTo(-137, 65, -102, 66);
      c.quadraticCurveTo(-65, 36, -49, 25);
      c.lineTo(-68, 135);
      c.lineTo(0, 115);
      c.lineTo(68, 135);
      c.lineTo(49, 25);
      c.quadraticCurveTo(65, 36, 102, 66);
      c.quadraticCurveTo(137, 65, 145, 13);
      c.lineTo(112, 35);
      c.quadraticCurveTo(80, -13, 32, -35);
      c.stroke();
      for (let side of [-1, 1])
        for (let k = 0; k < 4; k++) {
          const x = side * (112 + k * 8),
            y = 36 - k * 6;
          c.beginPath();
          c.moveTo(x, y + 18);
          c.quadraticCurveTo(x + side * 12, y - 15, x + side * 5, y - 29);
          c.stroke();
        }
    } finally {
      c.restore();
    }
    for (let k = 0; k < 12; k++) {
      const p = (t / 1600 + k / 12) % 1,
        a = k * 2.399 + t * 0.0004,
        r = (65 + 25 * Math.sin(p * Math.PI)) * scale;
      const x = cx + Math.cos(a) * r,
        y = cy + (80 - p * 190) * scale;
      line(c, x, y, x + Math.sin(a) * 5 * scale, y + 12 * scale, col + '99', 2 * scale);
    }
    imageFit(
      c,
      o.images?.reaper,
      cx,
      cy + 16 * scale + Math.sin(t * 0.004) * 3 * scale,
      280 * scale * characterScale,
      350 * scale * characterScale,
    );
    for (const [i, mark] of (o.readTargets?.() || [o.to]).slice(0, 32).entries()) {
      if (i < 3) {
        seal(mark.x, mark.y, (58 + clamp(t / 2600) * 32) * scale, t * 0.001, 0.35);
        seal(mark.x, mark.y, 112 * scale * clamp(t / 1400), -t * 0.0007, 0.35);
      } else {
        c.save();
        c.translate(mark.x, mark.y);
        c.scale(1, 0.35);
        c.lineWidth = 2 * scale;
        circle(c, 0, 0, 90 * scale * clamp(t / 900), null, col);
        circle(c, 0, 0, 65 * scale * clamp(t / 900), null, col);
        c.restore();
      }
    }
    for (const [i, h] of hits.entries()) {
      const p = clamp((t - h.at) / 850);
      if (p >= 1) continue;
      const endY = cy + 30 * scale,
        controlX = (h.x + cx) / 2,
        controlY = Math.min(h.y, endY) - (100 + i * 12) * scale;
      if (i >= 8) {
        c.save();
        c.globalAlpha = 1 - p;
        c.strokeStyle = col;
        c.lineWidth = 2 * scale;
        c.beginPath();
        c.moveTo(h.x, h.y);
        c.quadraticCurveTo(controlX, controlY, cx, endY);
        c.stroke();
        c.restore();
        continue;
      }
      function soulPoint(q) {
        return {
          x: (1 - q) * (1 - q) * h.x + 2 * (1 - q) * q * controlX + q * q * cx,
          y: (1 - q) * (1 - q) * h.y + 2 * (1 - q) * q * controlY + q * q * endY,
        };
      }
      c.save();
      try {
        c.globalAlpha = alpha * (1 - p * 0.6);
        for (const [width, tint] of [
          [12, col + '33'],
          [4, col + 'bb'],
          [1, paint?.core || col],
        ]) {
          c.strokeStyle = tint;
          c.lineWidth = width * scale;
          c.beginPath();
          c.moveTo(h.x, h.y);
          c.quadraticCurveTo(controlX, controlY, cx, endY);
          c.stroke();
        }
        for (let k = 0; k < 4; k++) {
          const q = clamp(p - k * 0.045),
            v = soulPoint(q);
          glow(c, v.x, v.y, 13 * scale, col + '88');
        }
        const v = soulPoint(p);
        c.translate(v.x, v.y);
        c.fillStyle = (paint?.accent || col) + 'dd';
        c.strokeStyle = col;
        c.lineWidth = 2 * scale;
        c.beginPath();
        c.moveTo(-9 * scale, 0);
        c.quadraticCurveTo(-12 * scale, -24 * scale, 0, -25 * scale);
        c.quadraticCurveTo(12 * scale, -24 * scale, 9 * scale, 0);
        c.lineTo(13 * scale, 12 * scale);
        c.lineTo(0, 6 * scale);
        c.lineTo(-13 * scale, 12 * scale);
        c.closePath();
        c.fill();
        c.stroke();
        circle(c, -3.5 * scale, -15 * scale, 1.8 * scale, paint?.dark || '#16342f');
        circle(c, 3.5 * scale, -15 * scale, 1.8 * scale, '#16342f');
      } finally {
        c.restore();
      }
    }
    // Seal closure follows confirmed soul extraction, never an assumed timed hit.
    const finish = hits.length ? Math.max(...hits.map((h) => h.at + 850)) : -1;
    if (finish >= 0 && t >= finish && t < finish + 550) {
      const p = clamp((t - finish) / 550),
        r = Math.min((30 + p * 130) * scale, cx - 8 * scale);
      c.save();
      c.globalAlpha = alpha * (1 - p);
      c.lineWidth = 5 * scale;
      circle(c, cx, cy, r, null, col);
      circle(c, cx, cy, r * 0.75, null, col + 'aa');
      for (let k = 0; k < 20; k++) {
        const a = (k * TAU) / 20;
        line(
          c,
          cx + Math.cos(a) * r,
          cy + Math.sin(a) * r,
          cx + Math.cos(a) * (r + 12 * scale),
          cy + Math.sin(a) * (r + 12 * scale),
          col,
          2 * scale,
        );
      }
      c.restore();
    }
  } finally {
    c.restore();
  }
  impact(c, o, t, col);
}
// A six-face crystal replaces the alternate's soft sphere without extra particles.
function crystal(c, x, y, r, rotation, fill, edge, core) {
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6;
    if (k === 0) c.moveTo(Math.cos(a) * r * 1.25, Math.sin(a) * r);
    else c.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = fill;
  c.strokeStyle = edge;
  c.lineWidth = 1.5;
  c.fill();
  c.stroke();
  for (let k = 0; k < 3; k++) {
    const a = (k * TAU) / 3;
    line(c, 0, 0, Math.cos(a) * r * 1.25, Math.sin(a) * r, k ? edge : core, 1);
  }
  line(c, -r * 0.42, -r * 0.34, r * 0.5, -r * 0.34, core, 2);
  c.restore();
}
function gun(c, w, col, style = 0, paint) {
  c.save();
  c.scale(0.7, 0.7);
  w /= 0.7;
  const g = c.createLinearGradient(0, -18, 0, 18);
  g.addColorStop(0, paint?.top || '#d6e2e8');
  g.addColorStop(0.35, paint?.middle || '#526374');
  g.addColorStop(1, paint?.dark || '#152432');
  c.fillStyle = g;
  c.strokeStyle = paint?.edge || '#9ba9b3';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-28, -12);
  c.lineTo(-19, -19);
  c.lineTo(w - 24, -19);
  c.lineTo(w - 15, -8);
  c.lineTo(w - 18, 13);
  c.lineTo(w - 29, 20);
  c.lineTo(-18, 20);
  c.lineTo(-28, 11);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = paint?.dark || '#222b3c';
  c.fillRect(-15, -7, Math.max(9, w - 14), 13);
  for (let i = 0; i < 4; i++) {
    const x = -12 + i * Math.min(9, w / 7);
    line(c, x, -4, x + 3, 2, paint?.edge || '#aab9c9', 1.5);
  }
  for (const x of [-20, w - 28]) {
    circle(c, x, 10, 3.5, '#22303c', '#9ba9b3');
    circle(c, x, 10, 1.1, col);
  }
  line(c, -16, 15, w - 26, 15, '#8296a6', 1.5);
  c.fillStyle = '#1a2430';
  c.fillRect(-35, -12, 20, 24);
  line(c, -26, 22, -8, 22, '#8a9aa9', 7);
  line(c, -12, -12, w - 25, -12, col, 2);
  if (style === 1) {
    c.fillStyle = paint?.dark || '#263d50';
    c.fillRect(15, -33, 40, 16);
    circle(c, 36, -26, 9, '#203240', col);
  }
  c.restore();
}
function drawRailgun(c, o, t) {
  if (!alive(t, 1450)) return;
  const col = color(o, 'railgun'),
    paint = material(o, 'railgun');
  c.save();
  try {
    frame(c, o, (L) => {
      const w = Math.min(80, L * 0.3);
      followCaster(c, o);
      gun(c, w, col, 0, paint);
      c.fillStyle = paint?.dark || '#1a2d3b';
      c.fillRect(2, -6, w, 12);
      line(c, 0, -14, w, -14, paint?.edge || '#dbe6f2', 4);
      line(c, 0, 14, w, 14, paint?.middle || '#849cae', 4);
      if (paint) {
        // Copper cheek plates leave the dark acceleration channel visible.
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(-3, side * 17);
          c.lineTo(12, side * 26);
          c.lineTo(w - 9, side * 26);
          c.lineTo(w + 4, side * 14);
          c.lineTo(w - 6, side * 11);
          c.lineTo(4, side * 12);
          c.closePath();
          c.fillStyle = paint.middle;
          c.strokeStyle = paint.edge;
          c.lineWidth = 1.5;
          c.fill();
          c.stroke();
          line(c, 13, side * 21, w - 13, side * 21, paint.top, 2);
        }
      }
      for (let k = 0; k < 6; k++) {
        const active = clamp((t - k * 65) / 160);
        c.globalAlpha = 0.3 + 0.7 * active;
        c.lineWidth = 3;
        const x = (k * w) / 6;
        if (paint) {
          c.beginPath();
          c.ellipse(x, 0, 4.5, 15, 0, 0, TAU);
          c.strokeStyle = active > 0.6 ? paint.accent : paint.edge;
          c.stroke();
        } else circle(c, x, 0, 14, null, col);
        line(c, x - 3, -19, x + 3, -19, '#eaf6ff', 2);
        line(c, x - 3, 19, x + 3, 19, '#788d9f', 2);
      }
      c.globalAlpha = 1;
      if (paint && t < 950) {
        const charge = Math.min(1, t / 550),
          front = w * charge;
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(0, side * 9);
          for (let k = 1; k <= 6; k++) {
            const x = (front * k) / 6;
            c.lineTo(x, side * (8 + ((k + Math.floor(t / 55)) % 2) * 6));
          }
          c.strokeStyle = paint.accent;
          c.lineWidth = 1.5;
          c.stroke();
        }
      }
      glow(c, w, 0, 28 * clamp(t / 550), col + '99');
      c.restore();
      const p = (t - 550) / 400;
      if (p >= 0 && p <= 1) {
        const x = mix(w, L, p);
        line(c, Math.max(w, x - 125), 0, x, 0, col + '77', 14);
        line(c, Math.max(w, x - 95), 0, x, 0, col, 6);
        line(c, Math.max(w, x - 75), 0, x, 0, paint?.core || '#ecfbff', 2);
        for (let i = 0; i < 8; i++) {
          const d = Math.max(w, x - i * 11);
          const y = (i % 2 ? -1 : 1) * (5 + i * 2);
          line(c, d, y, d + 8, y * 0.65, paint?.accent || col, 1.3);
        }
        c.fillStyle = '#f6f8f4';
        c.fillRect(x - 13, -3, 17, 6);
        glow(c, x, 0, 14, col);
      }
    });
  } finally {
    c.restore();
  }
  impact(c, o, t, col);
}
function drawPlasma(c, o, t) {
  if (!alive(t, 1550)) return;
  const col = color(o, 'plasma'),
    paint = material(o, 'plasma');
  c.save();
  try {
    frame(c, o, (L) => {
      const w = Math.min(63, L * 0.25);
      followCaster(c, o);
      gun(c, w, col, 0, paint);
      for (let k = 0; k < 3; k++) {
        c.save();
        c.translate(w - 21 + k * 10, 0);
        c.scale(0.45, 1);
        c.lineWidth = 4;
        if (paint)
          crystal(
            c,
            0,
            0,
            16 + Math.sin(t * 0.006 + k) * 2,
            t * 0.002 + k * 0.4,
            paint.dark + '99',
            k % 2 ? paint.accent : col,
            paint.core,
          );
        else circle(c, 0, 0, 18 + Math.sin(t * 0.006 + k) * 2, null, col);
        c.restore();
      }
      glow(c, w, 0, 25, col + '77');
      c.restore();
      for (const [index, at] of [650, 1050].entries()) {
        if (o.reflectedPhase && o.reflectedPhase !== 'hit' + (index + 1)) continue;
        const p = (t - at + 380) / 380;
        if (p < 0 || p > 1) continue;
        const x = mix(w, L, p),
          r = 12 + Math.sin(t * 0.015) * 2;
        glow(c, x, 0, 30, col + 'aa');
        if (paint) {
          const beat = 1 + 0.18 * Math.sin((t - at) * 0.028);
          crystal(c, x, 0, r * beat, t * 0.008 + index, col + 'cc', paint.accent, paint.core);
        } else {
          circle(c, x, 0, r, col + 'bb', '#f4fff9');
          circle(c, x, 0, r * 0.5, '#f1fff6');
        }
        for (let i = 0; i < 7; i++) {
          const phase = t * 0.016 + (i * TAU) / 7;
          const offset = Math.cos(phase) * 15;
          const y = Math.sin(phase) * 14;
          line(
            c,
            x - 24 + offset,
            y * 1.4,
            x - 14 + offset,
            y,
            i % 3 ? col : paint?.accent || '#effff8',
            2,
          );
        }
        c.save();
        c.translate(x, 0);
        c.scale(1.5, 0.6);
        c.rotate(t * 0.01);
        c.lineWidth = 1.5;
        circle(c, 0, 0, r * 1.25, null, paint?.accent || col);
        c.restore();
      }
    });
  } finally {
    c.restore();
  }
  impact(c, o, t, col);
}
function drawMissiles(c, o, t) {
  if (!alive(t, 2100)) return;
  const col = color(o, 'missiles'),
    paint = material(o, 'missiles');
  c.save();
  try {
    frame(c, o, (L) => {
      const w = Math.min(46, L * 0.18);
      followCaster(c, o);
      gun(c, w, col, 0, paint);
      c.restore();
      for (let k = 0; k < 4; k++) {
        const y = (k - 1.5) * 11;
        followCaster(c, o);
        c.fillStyle = paint?.middle || '#35475b';
        c.fillRect(-10, y - 4, w, 8);
        line(c, -10, y - 4, w, y - 4, '#8499ac', 1.3);
        line(c, -8, y + 4, w, y + 4, '#111c2a', 1.5);
        circle(c, w, y, 4, '#101b25', col);
        c.restore();
        if (o.reflectedPhase && o.reflectedPhase !== 'hit' + (k + 1)) continue;
        const p = (t - [850, 1100, 1350, 1600][k] + 700) / 700;
        if (p < 0 || p > 1) continue;
        const bend = (k - 1.5) * 25,
          x = mix(w, L, p),
          Y = y * (1 - p) + Math.sin(Math.PI * p) * bend;
        const angle = Math.atan2(-y + Math.PI * bend * Math.cos(Math.PI * p), L - w);
        c.save();
        c.translate(x, Y);
        c.rotate(angle);
        line(c, -62, 0, -10, 0, (paint?.accent || col) + '66', 5);
        for (let i = 0; i < 5; i++) {
          const tail = -23 - i * 7;
          circle(
            c,
            tail,
            Math.sin(t * 0.02 + i) * i * 0.8,
            1.5 + i * 0.55,
            (paint?.accent || col) + '66',
          );
        }
        line(c, -25, 0, -10, 0, paint?.core || '#fff2d0', 2.5);
        c.fillStyle = paint?.accent || col;
        c.beginPath();
        c.moveTo(-11, 0);
        c.lineTo(-28, -5);
        c.lineTo(-22, 0);
        c.lineTo(-28, 5);
        c.fill();
        if (paint) {
          // Cyan armour and violet exhaust distinguish the entire alternate projectile.
          line(c, -46, -5, -15, -3, col + 'aa', 1.5);
          line(c, -46, 5, -15, 3, col + 'aa', 1.5);
        }
        // Warm, broad segmented casing versus a longer dark shaft with split ice armour.
        c.fillStyle = paint?.dark || '#d3ae78';
        c.beginPath();
        c.moveTo(paint ? 16 : 12, 0);
        c.lineTo(paint ? 3 : 2, -5);
        c.lineTo(paint ? -22 : -14, -5);
        c.lineTo(paint ? -22 : -14, 5);
        c.lineTo(paint ? 3 : 2, 5);
        c.closePath();
        c.fill();
        if (paint) {
          c.beginPath();
          c.moveTo(16, 0);
          c.lineTo(3, -5);
          c.lineTo(-1, -5);
          c.lineTo(4, 0);
          c.lineTo(-1, 5);
          c.lineTo(3, 5);
          c.closePath();
          c.fillStyle = paint.top;
          c.fill();
          for (const x of [-20, -12, -4]) {
            for (const side of [-1, 1]) {
              c.beginPath();
              c.moveTo(x, side * 5);
              c.lineTo(x + 5, side * 5);
              c.lineTo(x + 7, side * 2);
              c.lineTo(x + 1, side * 2);
              c.closePath();
              c.fillStyle = side < 0 ? paint.top : paint.middle;
              c.fill();
            }
          }
        } else {
          line(c, -13, 3, 1, 3, '#674d35', 2);
          line(c, -12, -3, 1, -3, '#fff0c6', 1);
          for (const x of [-9, -2]) line(c, x, -5, x, 5, '#674d35', 2);
        }
        c.fillStyle = paint?.dark || '#674d35';
        c.beginPath();
        c.moveTo(-7, -4);
        c.lineTo(paint ? -20 : -16, paint ? -15 : -10);
        c.lineTo(-13, 0);
        c.lineTo(paint ? -20 : -16, paint ? 15 : 10);
        c.lineTo(-7, 4);
        c.fill();
        if (paint) {
          line(c, -18, -12, -9, -4, col, 1.5);
          line(c, -18, 12, -9, 4, col, 1.5);
        }
        if (paint) line(c, -21, 0, 5, 0, col, 1.3);
        else line(c, 3, -3, 7, -1, col, 2);
        c.restore();
      }
    });
  } finally {
    c.restore();
  }
  impact(c, o, t, col);
}
function drawSniper(c, o, t) {
  if (!alive(t, 1800)) return;
  const col = color(o, 'sniper'),
    paint = material(o, 'sniper');
  c.save();
  try {
    frame(c, o, (L) => {
      const w = Math.min(95, L * 0.32);
      followCaster(c, o);
      gun(c, w, col, 1, paint);
      c.fillStyle = paint?.middle || '#9aadb9';
      c.fillRect(w - 15, -5, 45, 10);
      line(c, w + 10, -6, w + 30, -6, col, 2);
      c.restore();
      const p = clamp(t / 1250),
        r = 45 - 25 * p;
      c.lineWidth = 1.5;
      circle(c, L, 0, r, null, col);
      circle(c, L, 0, r + 8, null, (paint?.accent || col) + 'aa');
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        line(
          c,
          L + Math.cos(a) * (r + 7),
          Math.sin(a) * (r + 7),
          L + Math.cos(a) * (r + 11),
          Math.sin(a) * (r + 11),
          col,
          1,
        );
      }
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        line(
          c,
          L + Math.cos(a) * (r + 4),
          Math.sin(a) * (r + 4),
          L + Math.cos(a) * (r + 13),
          Math.sin(a) * (r + 13),
          paint?.accent || col,
          2,
        );
      }
      c.setLineDash([4, 8]);
      line(c, w + 30, 0, L, 0, col + '66', 1);
      c.setLineDash([]);
      const fire = (t - 1250) / 220;
      if (fire >= 0 && fire <= 1) {
        c.globalAlpha = 1 - fire;
        line(c, w + 20, 0, L, 0, col + '66', 17);
        line(c, w + 20, 0, L, 0, col, 7);
        circle(c, w + 25, 0, 9 + fire * 21, null, col);
        circle(c, L, 0, 8 + fire * 38, null, paint?.accent || '#fff2f9');
        line(c, w + 20, 0, L, 0, paint?.core || '#ffffff', 2);
        glow(c, w + 30, 0, 27, col);
      }
    });
  } finally {
    c.restore();
  }
  impact(c, o, t, col);
}

export { drawShaohua, drawReaper, drawRailgun, drawPlasma, drawMissiles, drawSniper };
