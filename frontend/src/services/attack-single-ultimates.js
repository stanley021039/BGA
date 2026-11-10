import timing from '../../../public/shared/attack-timing.json';
import { drawUltimateTitle } from './attack-revision.js';

const kinds = new Set(['starburst_stream', 'rainbow_bear', 'zero_equation']);
const singleProgress = (n) => Math.max(0, Math.min(1, n));
const bladePaints = {
  original: [
    {
      metal: '#161a24',
      edge: '#b4c8dd',
      ridge: '#414d63',
      grip: '#141c2b',
      gem: '#556a8a',
      impact: '#7bc7ff',
      light: '#f3fcff',
    },
    {
      metal: '#62c9c6',
      edge: '#d0ffef',
      ridge: '#298a9c',
      grip: '#234b59',
      gem: '#286db7',
      impact: '#57e7cc',
      light: '#e6fff7',
    },
  ],
  violet: [
    {
      metal: '#6d34b8',
      edge: '#e2bfff',
      ridge: '#391f72',
      grip: '#261a42',
      gem: '#b276fd',
      impact: '#bb7eff',
      light: '#f0d9ff',
    },
    {
      metal: '#f4f7ff',
      edge: '#ffffff',
      ridge: '#a4adc1',
      grip: '#4a546a',
      gem: '#d8e5f9',
      impact: '#f2f5ff',
      light: '#ffffff',
    },
  ],
};
const formulas = [
  ['∫₀¹ x² dx', '#f4d563'],
  ['aₙ = a₁ + (n−1)d', '#60ddfc'],
  ['sin²θ + cos²θ = 1', '#ef8ffc'],
  ['∇ × F', '#a5ff87'],
  ['x = (−b ± √Δ) / 2a', '#ff9d73'],
  ['e^(iπ) + 1 = 0', '#a5b3ff'],
  ['lim f(x)', '#fd829a'],
  ['Σ k²', '#9cfff0'],
  ['det(A − λI) = 0', '#ffe9aa'],
  ['d²y/dx²', '#bcd4ff'],
];

export function bearPortrait(width, height) {
  return Math.min(width / 410, height / 330) < 0.87
    ? '/assets/attacks/rainbow-bear-96.webp'
    : '/assets/attacks/rainbow-bear-192.webp';
}

export function bearSquad(width, height) {
  return Math.min(width / 410, height / 330) < 0.46
    ? '/assets/attacks/rainbow-bear-squad-96.webp'
    : '/assets/attacks/rainbow-bear-squad-192.webp';
}

export function createSingleUltimate(ctx, options, picture) {
  const { effect, width, height, color, from, to } = options;
  if (!kinds.has(effect)) return null;
  const scale = Math.min(1.2, width / 410, height / 330);
  const stages = timing[effect];
  const blades =
    options.alternatePalette === 'starburst_stream_alt' ? bladePaints.violet : bladePaints.original;
  const slashPaint = (count) => blades[(count - 1) % 2];
  const first = stages[0][0];
  const bearUrl = effect === 'rainbow_bear' ? bearPortrait(width, height) : '';
  const squadUrl = bearUrl ? bearSquad(width, height) : '';
  if (bearUrl) {
    picture(bearUrl);
    picture(squadUrl);
  }
  let shownSlash = 0;
  let nextSlashAt = 0;
  let recentSlash;
  let slashShownAt = 0;
  let finalBurstAt;
  let finalBurstCenter;
  const segment = (x, y, endX, endY, paint, weight) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = paint;
    ctx.lineWidth = weight;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const ring = (x, y, radius, paint, weight) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = paint;
    ctx.lineWidth = weight;
    ctx.stroke();
  };
  function blade(x, y, angle, elucidator, active) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const { metal, edge, ridge, grip, gem } = blades[elucidator ? 0 : 1];
    const outline = (points, fill, stroke = edge, weight = 1.5) => {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = weight;
      ctx.stroke();
    };
    outline(
      elucidator
        ? [
            [-9, 6],
            [-9, -77],
            [0, -103],
            [9, -77],
            [9, 6],
          ]
        : [
            [-12, 5],
            [-15, -61],
            [-12, -83],
            [0, -104],
            [12, -83],
            [15, -61],
            [12, 5],
          ],
      metal,
      edge,
      active ? 2.5 : 1.7,
    );
    outline(
      elucidator
        ? [
            [0, -98],
            [0, 1],
            [6, -6],
            [6, -73],
          ]
        : [
            [0, -99],
            [1, -4],
            [9, -14],
            [12, -62],
            [9, -82],
          ],
      ridge,
      ridge,
      0.5,
    );
    outline(
      elucidator
        ? [
            [-20, 9],
            [-20, 1],
            [-10, 3],
            [-6, -2],
            [6, -2],
            [10, 3],
            [20, 1],
            [20, 9],
            [8, 12],
            [-8, 12],
          ]
        : [
            [-23, 2],
            [-14, -8],
            [-7, 0],
            [0, -9],
            [7, 0],
            [14, -8],
            [23, 2],
            [14, 13],
            [0, 16],
            [-14, 13],
          ],
      metal,
    );
    if (!elucidator) {
      outline(
        [
          [0, -19],
          [6, -10],
          [0, 1],
          [-6, -10],
        ],
        gem,
        edge,
      );
    } else {
      segment(-4, -9, 4, -9, edge, 1.5);
      segment(0, -13, 0, -5, edge, 1.5);
    }
    segment(0, 14, 0, 33, grip, 8);
    for (let grip = 17; grip < 33; grip += 4) segment(-3, grip, 3, grip + 1, ridge, 1.3);
    segment(-4, 34, 4, 34, edge, 2.5);
    ctx.restore();
  }
  function starburst(elapsed, target, hits) {
    const interval = stages[1][0] - first;
    const windup = 43;
    const passed = elapsed - first + windup;
    const strike = Math.min(stages.length - 1, Math.max(0, Math.floor(passed / interval)));
    const last = stages.at(-1)[0];
    const finalAge = finalBurstAt === undefined ? Infinity : elapsed - finalBurstAt;
    if (
      elapsed > last + 520 &&
      shownSlash >= hits.length &&
      finalAge > 760 &&
      elapsed > nextSlashAt + 220
    )
      return;
    const size = Math.min(options.preview ? 1.7 : 1.45, width / 380, height / 260);
    if (finalAge < 760) {
      ctx.save();
      ctx.translate(finalBurstCenter.x, finalBurstCenter.y);
      ctx.scale(size, size);
      drawFinalBurst(finalAge);
      ctx.restore();
    }
    const cycle = singleProgress((passed - strike * interval) / interval);
    const progress = singleProgress(cycle * 1.18);
    const hand = strike % 2 === 0 ? -1 : 1;
    const finishing = strike === stages.length - 1;
    const fade = 1 - singleProgress((elapsed - last - 35) / 340);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(size, size);
    if (fade > 0) {
      ctx.save();
      const bladeFit = Math.min(1, width / (size * 485));
      ctx.scale(bladeFit, bladeFit);
      const hold = 1 - singleProgress((elapsed - last + 10) / 195);
      ctx.globalAlpha = fade * hold * 0.88;
      blade(-hand * 92, 16, -hand * 0.5, hand > 0, false);
      ctx.globalAlpha = fade * hold;
      const swing = Math.sin((0.5 - progress) * Math.PI);
      blade(
        hand * swing * (finishing ? 126 : 103),
        15 - Math.sin(progress * Math.PI) * 32,
        hand * (1.27 - progress * 2.54),
        hand < 0,
        true,
      );
      ctx.restore();
    }
    if (elapsed >= nextSlashAt && shownSlash < hits.length) {
      recentSlash = hits[shownSlash++];
      slashShownAt = elapsed;
      nextSlashAt = elapsed + 78;
      if (recentSlash.phase === 'slash16') {
        finalBurstAt = elapsed;
        finalBurstCenter = recentSlash;
        ctx.save();
        ctx.translate((recentSlash.x - target.x) / size, (recentSlash.y - target.y) / size);
        drawFinalBurst(0);
        ctx.restore();
      }
    }
    if (recentSlash) {
      const count = Number(recentSlash.phase.slice(5));
      const age = elapsed - slashShownAt;
      if (age < 126) starburstImpact(count, age);
      if (age < (count === 16 ? 650 : 298)) starburstCounter(count, age, target, size);
    }
    ctx.restore();
  }
  function drawFinalBurst(age) {
    const p = singleProgress(age / 760);
    const expand = 1 - (1 - p) ** 3;
    const { impact, light } = slashPaint(16);
    ctx.save();
    const radius = 72 + expand * 144;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    core.addColorStop(0, light + 'de');
    core.addColorStop(0.24, impact + 'a8');
    core.addColorStop(1, impact + '00');
    ctx.globalAlpha = 0.82 * (1 - p);
    ctx.fillStyle = core;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    for (let wave = 0; wave < 3; wave++) {
      const delay = wave * 0.14;
      if (p < delay) continue;
      const travel = singleProgress((p - delay) / (1 - delay));
      ctx.globalAlpha = (1 - travel) * (1 - wave * 0.16);
      ring(0, 0, 29 + 163 * (1 - (1 - travel) ** 2), wave % 2 ? light : impact, 5 - wave);
    }
    ctx.globalAlpha = 0.9 * (1 - p);
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.399 + 0.27;
      const d = 29 + expand * (89 + (i % 7) * 14);
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const length = 7 + (i % 5) * 5;
      segment(
        x * (d - length),
        y * (d - length),
        x * d,
        y * d,
        i % 4 ? impact : light,
        i % 3 ? 2 : 4,
      );
      if (i % 4 === 0) {
        ctx.save();
        ctx.translate(x * d, y * d);
        ctx.rotate(angle + p * 5);
        ctx.fillStyle = light;
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function starburstImpact(count, age) {
    const finisher = count === 16;
    const p = singleProgress(age / 126);
    const side = count % 2 === 0 ? 1 : -1;
    const { impact, light } = slashPaint(count);
    const x = 9 * side;
    const y = 8 + (count % 3) * 5;
    const radius = (finisher ? 82 : 58) + 25 * p;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ring(x, y, (finisher ? 41 : 25) + 62 * p, impact, finisher ? 6 : 3.5);
    ring(x, y, (finisher ? 35 : 18) + 39 * p, light, 2.5 * (1 - p));
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, light + 'a0');
    glow.addColorStop(0.36, impact + '68');
    glow.addColorStop(1, impact + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    for (let i = 0; i < (finisher ? 24 : 15); i++) {
      const angle = count * 0.74 + i * 2.4;
      const inner = 11 + 41 * p;
      const tip = inner + ((i % 3) + 1) * (finisher ? 21 : 15);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      segment(
        x + dx * inner,
        y + dy * inner,
        x + dx * tip,
        y + dy * tip,
        i % 4 ? impact : light,
        finisher ? 3.6 : 2.4,
      );
      if (i % 3 === 0) {
        const spark = tip + 7;
        ring(x + dx * spark, y + dy * spark, 1.4 + (i % 4) * 0.65, impact, 1.8);
      }
    }
    ctx.translate(x, y);
    ctx.rotate(side * 0.6);
    segment(-31, 0, 31, 0, light, 5.5);
    segment(0, -26, 0, 26, impact, 4.5);
    ctx.restore();
  }
  function starburstCounter(count, age, target, size) {
    const finalHit = count === 16;
    const flash = 1 - singleProgress(age / 110);
    const finishScale = finalHit ? 1.21 : 1;
    ctx.save();
    ctx.globalAlpha = 1 - singleProgress((age - (finalHit ? 410 : 154)) / (finalHit ? 240 : 144));
    const margin = Math.min(width / 2, 76 * size);
    const labelX = Math.max(margin, Math.min(width - margin, target.x));
    const lift = target.y >= 115 * size ? -73 - flash * 4 : 70 + flash * 4;
    ctx.translate((labelX - target.x) / size, lift);
    ctx.scale(finishScale + flash * 0.12, finishScale + flash * 0.12);
    ctx.beginPath();
    ctx.moveTo(-49, -18);
    ctx.lineTo(-35, -31);
    ctx.lineTo(48, -31);
    ctx.lineTo(49, 18);
    ctx.lineTo(35, 31);
    ctx.lineTo(-49, 31);
    ctx.closePath();
    ctx.fillStyle = '#091122';
    ctx.fill();
    const marker = slashPaint(count).impact;
    ctx.strokeStyle = marker;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    segment(-54, 31, -30, 31, marker, 3);
    segment(30, -31, 54, -31, marker, 3);
    ctx.font = 'italic 900 39px system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#102245';
    ctx.lineWidth = 4;
    const number = String(count);
    ctx.strokeText(number, 0, 8);
    ctx.fillStyle = finalHit ? '#fff1b6' : '#effaff';
    ctx.fillText(number, 0, 8);
    ctx.font = '800 10px system-ui';
    ctx.fillStyle = finalHit ? '#ffda91' : color;
    ctx.fillText('連擊', 0, 23);
    ctx.restore();
  }
  function bear(elapsed, target, caster, hits) {
    const arrival = elapsed >= first;
    const img = picture(bearUrl);
    const squad = picture(squadUrl);
    if (elapsed < first + 290) {
      const takeoff = first - 238;
      const charge = singleProgress((elapsed - 590) / 175);
      const flight = singleProgress((elapsed - takeoff) / (first - takeoff));
      for (const index of [-2, -1, 0, 1, 2]) {
        const fade = index ? 1 - singleProgress((elapsed - takeoff) / 140) : 1;
        if (!fade || (arrival && index)) continue;
        const entrance = singleProgress((elapsed - 90 - (index + 2) * 55) / 430);
        if (!entrance) continue;
        const twist = 1 - entrance;
        const wiggle = Math.sin(elapsed / 29 + index * 2.1);
        const x = caster.x + (index * 63 + wiggle * 13 * twist) * scale;
        const y = caster.y - (42 - Math.abs(index) * 12) * scale;
        const p = index ? 0 : flight;
        const currentX = x + (target.x - x) * p;
        const currentY =
          y +
          (target.y - y) * p -
          Math.sin(p * Math.PI) * 52 * scale -
          twist * (15 + Math.cos(elapsed / 35 + index) * 12) * scale;
        ctx.save();
        ctx.globalAlpha = fade * (arrival ? 1 - singleProgress((elapsed - first) / 290) : entrance);
        const lead = index === 0;
        const radius = 104 * scale * (0.63 + 0.37 * entrance) * (lead ? 1 + 0.85 * charge : 1);
        ctx.translate(currentX, currentY);
        ctx.rotate(wiggle * twist * 0.53 + (lead && p > 0 ? Math.sin(p * Math.PI) * 0.26 : 0));
        ctx.scale(1 + wiggle * twist * 0.22, 1 - wiggle * twist * 0.17);
        if (!index && charge > 0 && !arrival)
          ring(0, 22 * scale, (24 + 25 * charge) * scale, color, 3 * scale);
        ring(0, 25 * scale, 24 * scale, color, 3 * scale);
        const left = -radius / 2;
        const top = -radius / 2;
        if (index === 0 && img) ctx.drawImage(img, left, top, radius, radius);
        if (index && squad) {
          const tile = index < 0 ? index + 2 : index + 1;
          const half = squad.naturalWidth / 2;
          ctx.drawImage(
            squad,
            (tile % 2) * half,
            Math.floor(tile / 2) * half,
            half,
            half,
            left,
            top,
            radius,
            radius,
          );
        }
        ctx.restore();
      }
    }
    if (!options.preview || !hits.some((hit) => hit.phase === 'hug') || elapsed >= stages.at(-1)[0])
      return;
    ctx.save();
    ctx.font = `900 ${Math.round(56 * scale)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('💋', target.x, target.y + 8 * scale);
    ctx.restore();
  }
  function equation(elapsed, target, caster, hits) {
    if (elapsed < 230 || elapsed > first + 850) return;
    const connected = hits.some((hit) => hit.phase === 'equation');
    const columnWidth = Math.min(width * 0.45, 194 * scale);
    const anchorX = Math.max(columnWidth, Math.min(width - columnWidth, caster.x));
    const rowStep = Math.min(height * 0.12, 36 * scale);
    const anchorY = Math.max(rowStep * 2.5, Math.min(height - rowStep * 2.5, caster.y));
    for (const [index, [formula, paint]] of formulas.entries()) {
      const revealAt = 230 + index * 132;
      const reveal = singleProgress((elapsed - revealAt) / 122);
      if (reveal === 0) continue;
      const arrival = first + ((index * 3) % formulas.length) * 77;
      if (elapsed >= arrival + 150) continue;
      const depart = first - 330 + ((index * 7) % formulas.length) * 22;
      const hover = Math.min(elapsed, depart) / 380 + index;
      const column = index % 2 === 0 ? -0.5 : 0.5;
      const row = Math.floor(index / 2) - 2;
      const p = singleProgress((elapsed - depart) / (arrival - depart));
      const motion = p * p;
      const orbitX = anchorX + column * columnWidth + Math.sin(hover) * 5 * scale;
      const orbitY =
        anchorY + row * rowStep + Math.cos(hover) * 3 * scale - (1 - reveal) * 8 * scale;
      const x = orbitX + (target.x - orbitX) * motion;
      const y = orbitY + (target.y - orbitY) * motion - Math.sin(p * Math.PI) * 16 * scale;
      ctx.save();
      if (elapsed >= arrival) {
        if (connected) {
          const impact = singleProgress((elapsed - arrival) / 150);
          ctx.globalAlpha = 1 - impact;
          ring(x, y, (10 + 29 * impact) * scale, paint, 3 * scale);
        }
      } else {
        ctx.globalAlpha = reveal;
        ctx.font = `900 ${Math.max(10, Math.round((20 + (index % 3) * 4) * scale * (0.78 + 0.22 * reveal)))}px system-ui`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#231f49';
        ctx.lineWidth = 3;
        const textWidth = columnWidth - 8;
        const inset = Math.min(ctx.measureText(formula).width, textWidth) / 2 + 4;
        const textX = Math.max(inset, Math.min(width - inset, x));
        ctx.strokeText(formula, textX, y, textWidth);
        ctx.fillStyle = paint;
        ctx.fillText(formula, textX, y, textWidth);
        if (p > 0)
          segment(
            x,
            y + 5 * scale,
            x - Math.sign(target.x - orbitX) * p * 28 * scale,
            y + 5 * scale,
            paint,
            2,
          );
      }
      ctx.restore();
    }
  }
  return (elapsed) => {
    if (elapsed < 620) drawUltimateTitle(ctx, options.label, (elapsed * 0.12) / 620, width, height);
    const hits = (options.readHits?.() ?? []).filter(
      (hit) => !hit.pending && !hit.missed && hit.delayMs <= elapsed,
    );
    const target = options.readTarget?.() ?? hits.at(-1) ?? to;
    const caster = options.readCaster?.() ?? from;
    if (effect === 'starburst_stream' && elapsed >= 600) starburst(elapsed, target, hits);
    if (effect === 'rainbow_bear') bear(elapsed, target, caster, hits);
    if (effect === 'zero_equation') equation(elapsed, target, caster, hits);
  };
}
