import timing from '../../../public/shared/attack-timing.json';
import rules from '../../../public/shared/scene-rules.json';
import { drawUltimateTitle } from './attack-revision.js';

const guns = [
  [
    [-22, -6],
    [18, -6],
    [28, -2],
    [28, 2],
    [9, 5],
    [-2, 12],
    [-16, 12],
  ],
  [
    [-27, -11],
    [11, -11],
    [11, -7],
    [32, -7],
    [32, 7],
    [10, 7],
    [7, 12],
    [-27, 12],
  ],
  [
    [-27, -12],
    [19, -12],
    [29, -7],
    [29, 7],
    [19, 12],
    [-27, 12],
    [-33, 5],
    [-33, -5],
  ],
  [
    [-29, -8],
    [-12, -16],
    [17, -16],
    [33, -7],
    [21, -3],
    [21, 3],
    [33, 7],
    [17, 16],
    [-12, 16],
    [-29, 8],
  ],
];
const grenadeLauncher = [
  [-26, -9],
  [10, -9],
  [17, -5],
  [31, -5],
  [31, 5],
  [12, 5],
  [8, 15],
  [-5, 15],
  [-11, 7],
  [-26, 7],
];
const rocketLauncher = [
  [-29, -8],
  [22, -8],
  [33, -14],
  [33, 14],
  [22, 8],
  [-6, 8],
  [-11, 14],
  [-22, 14],
  [-26, 8],
];
const arsenal = [
  { kind: 'machinegun', profile: guns[0], body: '#704720', tracer: '#ffd175', edge: '#bd8a51' },
  { kind: 'cannon', profile: guns[1], body: '#343f51', tracer: '#8eb5e9', edge: '#a5b6cb' },
  {
    kind: 'grenade',
    profile: grenadeLauncher,
    body: '#334b2f',
    tracer: '#a5dd63',
    edge: '#7a9c67',
  },
  { kind: 'rocket', profile: rocketLauncher, body: '#502623', tracer: '#ff6749', edge: '#df856c' },
  { kind: 'missile', profile: guns[2], body: '#473455', tracer: '#da9eff', edge: '#a48bbb' },
  { kind: 'beam', profile: guns[3], body: '#143c4d', tracer: '#64efff', edge: '#56aebd' },
];
const visualScale = (width, height) => Math.min(1.2, height / 330, width / 410);
export function malicePortrait(width, height) {
  const size = 212 * visualScale(width, height);
  if (size >= 192) return '/assets/attacks/human-malice-384.webp';
  if (size >= 128) return '/assets/attacks/human-malice-256.webp';
  return '/assets/attacks/human-malice-128.webp';
}

export function createExtraUltimate(ctx, options, picture) {
  const { effect, width, height, color, from, to, area } = options;
  if (!['black_coffin', 'world_stasis', 'human_malice', 'susanoo'].includes(effect)) return null;
  const stages = timing[effect];
  const unit = visualScale(width, height);
  const aspect = options.aspectRatio || width / height;
  const previewUnit = options.previewUnit ?? Math.min(width / 110, height / 62);
  const xUnit = options.preview ? previewUnit : (width * Math.max(1, aspect)) / aspect / 100;
  const yUnit = options.preview ? previewUnit : (height * Math.max(1, aspect)) / 100;
  const tau = Math.PI * 2;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ivory = '#fff3d5';
  const portraitSize = 212 * unit;
  const portraitUrl = effect === 'human_malice' ? malicePortrait(width, height) : '';
  if (portraitUrl) picture(portraitUrl);
  const line = (points, paint, weight = 2) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = paint;
    ctx.lineWidth = weight;
    ctx.stroke();
  };
  const polygon = (points, paint, edge = color) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fillStyle = paint;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  };
  function ring(x, y, rx, ry, paint = color, weight = 2) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, tau);
    ctx.strokeStyle = paint;
    ctx.lineWidth = weight;
    ctx.stroke();
  }
  function coffin(t, targets) {
    const [pierce, collapse] = stages.map(([at]) => at);
    for (const { x, y } of targets) {
      ctx.save();
      ctx.translate(x, y + 25 * unit);
      ctx.scale(unit, unit);
      const rise = Math.max(3, 132 * clamp((t - 700) / 650));
      const burst = clamp((t - collapse) / 900);
      ctx.globalAlpha = 1 - burst;
      ring(0, 0, 55 + 28 * burst, 17 + 12 * burst);
      const w = 31 + 34 * burst;
      polygon(
        [
          [-w, 1],
          [-w, -rise],
          [w, -rise],
          [w, 1],
        ],
        '#10081d',
      );
      polygon(
        [
          [w, 1],
          [w + 22, -11],
          [w + 22, -rise - 14],
          [w, -rise],
        ],
        '#251437',
      );
      polygon(
        [
          [-w, -rise],
          [-w + 22, -rise - 14],
          [w + 22, -rise - 14],
          [w, -rise],
        ],
        '#382047',
      );
      ring(0, 0, 61 + 31 * burst, 22 + 14 * burst, ivory, 0.8);
      for (let i = 0; i < 7; i++) {
        const x = -w + 8 + (i * (w * 2 - 16)) / 6;
        const y = -rise + 14 + (i % 2) * 10;
        line(
          [
            [x - 4, y],
            [x + 4, y],
            [x, y + 8],
            [x, y + 15],
          ],
          color,
          0.9,
        );
        line(
          [
            [x, -rise * 0.48],
            [x - 3, -rise * 0.25],
            [x, -7],
          ],
          color,
          0.6,
        );
      }
      line(
        [
          [-w + 7, -rise + 8],
          [w - 7, -rise + 8],
          [w - 7, -8],
          [-w + 7, -8],
          [-w + 7, -rise + 8],
        ],
        color,
        1.1,
      );
      ring(0, -rise * 0.52, w * 0.54, w * 0.54, color, 1.4);
      line(
        [
          [-w * 0.38, -rise * 0.52],
          [0, -rise * 0.73],
          [w * 0.38, -rise * 0.52],
          [0, -rise * 0.3],
          [-w * 0.38, -rise * 0.52],
        ],
        ivory,
        1,
      );
      if (t >= pierce - 150) {
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1;
          const level = -rise + 16 + i * 17;
          const reach = 95 * clamp((t - pierce + 150) / 150) * (1 - burst);
          line(
            [
              [side * (w + reach), level - 19],
              [0, level],
            ],
            i % 3 ? color : ivory,
            2.6,
          );
        }
      }
      if (burst > 0)
        for (let i = 0; i < 8; i++) {
          const a = (i * tau) / 8;
          const u = Math.cos(a) * (25 + 84 * burst),
            v = Math.sin(a) * (22 + 67 * burst) - 60;
          polygon(
            [
              [u, v],
              [u + 9, v - 12],
              [u + 4, v + 7],
            ],
            color,
          );
        }
      ctx.restore();
    }
  }
  function stasis(t, targets) {
    const [stop, release] = stages.map(([at]) => at);
    const hold = t >= stop && t < release;
    const finish = clamp((t - release) / 750);
    const clock = 73 * unit;
    ctx.save();
    ctx.globalAlpha = 0.24 * (1 - finish);
    ring(from.x, from.y, area.radius * xUnit, area.radius * yUnit);
    ctx.globalAlpha = 1 - finish;
    ring(from.x, from.y, clock, clock, color, 3);
    ring(from.x, from.y, clock * 0.88, clock * 0.88);
    const clockMotion = Math.min(t, stop) / 340;
    for (let i = 0; i < 3; i++) {
      const radius = clock * (1.16 + i * 0.17 + finish * (i + 1));
      ctx.globalAlpha = (1 - finish) * (0.48 - i * 0.08);
      ctx.setLineDash([5 * unit, 7 * unit + i * 2]);
      ring(from.x, from.y, radius, radius, i === 1 ? ivory : color, 2);
      ctx.setLineDash([]);
      const a = clockMotion + (i * tau) / 3;
      const x = from.x + Math.cos(a) * radius,
        y = from.y + Math.sin(a) * radius;
      polygon(
        [
          [x - 4, y],
          [x, y - 6],
          [x + 4, y],
          [x, y + 6],
        ],
        ivory,
      );
    }
    ctx.globalAlpha = 1 - finish;
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12;
      const x = Math.cos(a),
        y = Math.sin(a);
      line(
        [
          [from.x + x * clock * 0.76, from.y + y * clock * 0.76],
          [from.x + x * clock * 0.84, from.y + y * clock * 0.84],
        ],
        color,
      );
    }
    const angle = hold ? -Math.PI / 2 : -Math.PI / 2 + (t < stop ? (t - stop) / 110 : finish * tau);
    line(
      [
        [from.x, from.y],
        [from.x + Math.cos(angle) * clock * 0.71, from.y + Math.sin(angle) * clock * 0.71],
      ],
      ivory,
      4,
    );
    if (t >= stop)
      for (const point of targets) {
        const r = (hold ? 28 : 28 + finish * 54) * unit;
        ring(point.x, point.y, r, r * 0.76, color, 3);
        ring(point.x, point.y, r * 1.23, r * 0.98, ivory, 1);
        for (let i = 0; i < 4; i++) {
          const a = (i * tau) / 4 + 0.65;
          const x = Math.cos(a),
            y = Math.sin(a);
          line(
            [
              [point.x + x * r * 1.55, point.y + y * r * 1.55],
              [point.x + x * r * 0.73, point.y + y * r * 0.73],
            ],
            ivory,
            2,
          );
        }
      }
    ctx.restore();
  }
  function malice(t, hits) {
    const last = stages.at(-1)[0];
    const [salvoAt, , phase] = stages[0];
    const fireEnd = salvoAt + 520;
    const portraitAt = fireEnd + 45;
    const detonation = hits.find((hit) => hit.phase === 'detonation');
    const caster = options.readCaster?.() ?? from;
    const origin =
      detonation?.pathX !== undefined ? { x: detonation.pathX, y: detonation.pathY } : caster;
    const blast = clamp((t - last) / 810);
    const img = picture(portraitUrl);
    if (img && t >= portraitAt && t < last + 160) {
      const rise = clamp((t - portraitAt) / 1100);
      const grow = 0.62 + 0.38 * rise;
      const size = portraitSize * grow;
      ctx.save();
      ctx.globalAlpha = rise * (1 - blast);
      const portraitHeight = (size * img.naturalHeight) / img.naturalWidth;
      ctx.drawImage(
        img,
        caster.x - size / 2,
        Math.max(4, caster.y - portraitHeight * 0.95 + (1 - rise) * 38 * unit),
        size,
        portraitHeight,
      );
      ctx.restore();
    }
    if (t >= last - 380) {
      ctx.save();
      ctx.globalAlpha = 0.78 * (1 - blast);
      const radius = rules.humanMalice.detonationRadius;
      const factor = t < last ? 1 : 0.28 + blast * 0.72;
      ring(origin.x, origin.y, radius * xUnit * factor, radius * yUnit * factor, color, 5);
      if (t >= last) {
        const size = 30 + blast * 115;
        const glow = ctx.createRadialGradient(
          origin.x,
          origin.y,
          0,
          origin.x,
          origin.y,
          size * unit,
        );
        glow.addColorStop(0, ivory);
        glow.addColorStop(0.35, color);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(
          origin.x - size * unit,
          origin.y - size * unit,
          size * unit * 2,
          size * unit * 2,
        );
        for (let i = 0; i < 9; i++) {
          const a = (i * tau) / 9;
          const distance = (23 + 61 * blast) * unit;
          const spread = (16 + 28 * blast) * unit;
          const x = origin.x + Math.cos(a) * distance;
          const y = origin.y + Math.sin(a) * distance * 0.68 - blast * 27 * unit;
          ctx.beginPath();
          ctx.ellipse(x, y, spread, spread * 0.68, a, 0, tau);
          ctx.fillStyle = i % 3 === 0 ? '#2d182a' : color;
          ctx.fill();
          ring(x, y, spread * 0.91, spread * 0.62, ivory, 1);
        }
        for (let i = 0; i < 14; i++) {
          const a = (i * tau) / 14,
            r = radius * (0.22 + blast * 0.65);
          line(
            [
              [origin.x + Math.cos(a) * r * xUnit, origin.y + Math.sin(a) * r * yUnit],
              [
                origin.x + Math.cos(a) * r * xUnit * 1.38,
                origin.y + Math.sin(a) * r * yUnit * 1.38,
              ],
            ],
            color,
            3,
          );
        }
      }
      ctx.restore();
    }
    const start = 650;
    const aimStart = 815;
    const aimEnd = 1150;
    const launch = 1320;
    if (t < start || t >= portraitAt) return;
    const targets = hits.filter((hit) => hit.phase === phase && !hit.missed).slice(0, 6);
    if (!targets.length) return;
    const columns = Math.max(6, targets.length + 1);
    const spacing = Math.min(92 * unit, width / (columns + 0.6));
    const inset = ((columns - 1) * spacing) / 2 + 32 * unit;
    const centerX = Math.max(inset, Math.min(width - inset, caster.x));
    const baseline = Math.max(122 * unit, caster.y - 52 * unit);
    const reveal = clamp((t - start) / 270);
    const flashes = new Map();
    for (let index = 0; index < columns * 2; index++) {
      const target = targets[index % targets.length];
      const row = Math.floor(index / columns);
      const column = index % columns;
      const weapon = arsenal[(index + row * 3) % arsenal.length];
      const gunX = centerX + (column - (columns - 1) / 2 + (row ? 0.2 : -0.2)) * spacing;
      const gunY = baseline - (row * 68 + (1 - reveal) * 32) * unit;
      const heading = Math.atan2(target.y - gunY, target.x - gunX);
      const atRest = -Math.PI / 2 + (column - (columns - 1) / 2) * 0.24;
      const turn = clamp((t - aimStart - (index % 4) * 18) / (aimEnd - aimStart - 54));
      const difference = heading - atRest;
      const angle =
        atRest +
        Math.atan2(Math.sin(difference), Math.cos(difference)) * (turn * turn * (3 - 2 * turn));
      const span = Math.hypot(target.x - gunX, target.y - gunY) / unit;
      const burst = weapon.kind === 'machinegun' ? 18 : weapon.kind === 'beam' ? 4 : 9;
      const cadence = weapon.kind === 'machinegun' ? 22 : weapon.kind === 'beam' ? 106 : 45;
      const firstShot = launch + (index % 4) * 11;
      const travel = salvoAt - launch + row * 16 + (index % 3) * 12;
      const lastShot = Math.min(burst - 1, Math.floor((t - firstShot) / cadence));
      const latest = lastShot < 0 ? undefined : t - firstShot - lastShot * cadence;
      const recoil = latest === undefined ? 0 : Math.max(0, 1 - latest / 65) * 9;

      ctx.save();
      ctx.translate(gunX, gunY);
      ctx.rotate(angle);
      ctx.scale(unit, unit);
      ctx.globalAlpha = reveal * (1 - clamp((t - fireEnd) / 95));
      if (t >= aimStart && t < launch) {
        const sight = span * turn;
        line(
          [
            [29, 0],
            [Math.max(29, sight), 0],
          ],
          t < aimEnd ? weapon.edge : weapon.tracer,
          t < aimEnd ? 0.6 : 1.2,
        );
      }
      ctx.save();
      ctx.translate(-recoil, 0);
      drawWeapon(weapon, latest);
      ctx.restore();
      for (
        let shot = Math.max(0, Math.ceil((t - firstShot - travel) / cadence));
        shot <= lastShot;
        shot++
      ) {
        const age = t - firstShot - shot * cadence;
        drawSalvoProjectile(weapon, span, clamp(age / travel), shot);
      }
      ctx.restore();

      if (t >= salvoAt && !target.pending && target.damage > 0) {
        const arrived = Math.min(burst - 1, Math.floor((t - firstShot - travel) / cadence));
        if (arrived < 0) continue;
        const age = t - firstShot - travel - arrived * cadence;
        if (age < 88 && (!flashes.has(target) || age < flashes.get(target).age))
          flashes.set(target, { age, paint: weapon.tracer, arrived });
      }
    }
    if (t >= aimStart && t < launch) {
      const focus = clamp((t - aimStart) / (aimEnd - aimStart));
      for (const target of targets) drawLock(target, focus);
    }
    for (const [target, flash] of flashes) drawSalvoHit(target, flash);
  }
  function drawLock(target, focus) {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(unit, unit);
    ctx.globalAlpha = focus * 0.9;
    const r = 31 - 12 * focus;
    ring(0, 0, r, r, '#ffb184', 1.5);
    for (const side of [-1, 1]) {
      line(
        [
          [side * (r + 10), 0],
          [side * (r - 5), 0],
        ],
        ivory,
        1.4,
      );
      line(
        [
          [0, side * (r + 10)],
          [0, side * (r - 5)],
        ],
        ivory,
        1.4,
      );
    }
    if (focus >= 1) {
      ctx.font = '800 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = ivory;
      ctx.fillText('鎖定', 0, -r - 15);
    }
    ctx.restore();
  }
  function drawSalvoHit(target, { age, paint, arrived }) {
    const p = age / 88;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(unit, unit);
    ctx.globalAlpha = (1 - p) * 0.76;
    const offset = ((arrived % 3) - 1) * 6;
    ring(offset, 0, 6 + p * 17, 5 + p * 15, paint, 2.3);
    line(
      [
        [offset - 9, -5],
        [offset + 8, 6],
      ],
      ivory,
      2.2,
    );
    line(
      [
        [offset + 7, -8],
        [offset - 4, 8],
      ],
      paint,
      2.2,
    );
    ctx.restore();
  }
  function drawWeapon(weapon, age) {
    const plating = ctx.createLinearGradient(0, -15, 0, 15);
    plating.addColorStop(0, weapon.edge);
    plating.addColorStop(0.25, weapon.body);
    plating.addColorStop(0.78, '#151b27');
    plating.addColorStop(1, weapon.body);
    polygon(weapon.profile, plating, weapon.edge, 1.5);
    polygon(
      [
        [-23, -7],
        [-12, -10],
        [5, -6],
        [1, 5],
        [-18, 8],
      ],
      '#242c39',
      weapon.edge,
    );
    polygon(
      [
        [-19, -3],
        [-10, -5],
        [-3, -2],
        [-7, 3],
        [-16, 4],
      ],
      weapon.body,
      weapon.tracer,
    );
    for (const slot of [-10, -5, 0, 5])
      line(
        [
          [slot, 4],
          [slot + 3, 8],
        ],
        weapon.edge,
        1.2,
      );
    if (weapon.kind === 'machinegun') {
      for (const y of [-5, 0, 5]) {
        line(
          [
            [10, y],
            [35, y],
          ],
          '#191f2a',
          4.5,
        );
        line(
          [
            [12, y - 1],
            [35, y - 1],
          ],
          weapon.edge,
          1.3,
        );
      }
      polygon(
        [
          [25, -8],
          [30, -8],
          [30, 8],
          [25, 8],
        ],
        weapon.body,
        weapon.edge,
      );
    } else if (weapon.kind === 'missile') {
      for (const y of [-7, 0, 7]) {
        line(
          [
            [9, y],
            [31, y],
          ],
          '#10141c',
          4.5,
        );
        line(
          [
            [17, y - 0.8],
            [30, y - 0.8],
          ],
          weapon.tracer,
          1.2,
        );
      }
    } else {
      polygon(
        [
          [11, -4],
          [30, -4],
          [32, 4],
          [11, 4],
        ],
        '#151d2b',
        weapon.edge,
      );
      line(
        [
          [14, -1],
          [30, -1],
        ],
        weapon.tracer,
        1.7,
      );
    }
    if (age === undefined || age >= 63) return;
    ctx.globalAlpha *= 1 - age / 63;
    polygon(
      [
        [27, -4],
        [36, -11],
        [41, -4],
        [53, 0],
        [41, 3],
        [36, 11],
        [27, 4],
      ],
      weapon.tracer,
      ivory,
    );
    if (weapon.kind === 'machinegun' || weapon.kind === 'cannon') {
      const drift = age * 0.22;
      line(
        [
          [3 - drift, -8 - drift],
          [10 - drift, -12 - drift],
        ],
        '#d4a257',
        3.5,
      );
    }
  }
  function drawSalvoProjectile(weapon, span, p, shot) {
    const { kind, tracer } = weapon;
    const lead = 27 + Math.max(0, span - 27) * p;
    if (kind === 'beam') {
      line(
        [
          [26, 0],
          [lead, 0],
        ],
        tracer,
        12,
      );
      line(
        [
          [26, 0],
          [lead, 0],
        ],
        '#eaffff',
        3.6,
      );
      return;
    }
    {
      const x = lead;
      const y =
        kind === 'grenade'
          ? -Math.sin(p * Math.PI) * 48
          : kind === 'missile'
            ? Math.sin(p * Math.PI) * (shot % 2 ? 24 : -24)
            : ((shot % 3) - 1) * 9 * Math.sin(p * Math.PI);
      if (kind === 'machinegun' || kind === 'cannon') {
        const shell = kind === 'cannon';
        line(
          [
            [x - (shell ? 41 : 30), y + 1],
            [x, y],
          ],
          tracer,
          shell ? 4 : 2.2,
        );
        line(
          [
            [x - (shell ? 11 : 5), y],
            [x + (shell ? 9 : 5), y],
          ],
          shell ? '#a5b6cb' : '#f4bf58',
          shell ? 8 : 4.3,
        );
        line(
          [
            [x + (shell ? 5 : 2), y - 0.9],
            [x + (shell ? 10 : 6), y - 0.9],
          ],
          ivory,
          1.2,
        );
      } else if (kind === 'grenade') {
        line(
          [
            [x - 15, y + 2],
            [x, y],
          ],
          tracer,
          2,
        );
        polygon(
          [
            [x - 7, y - 5],
            [x + 4, y - 5],
            [x + 9, y],
            [x + 4, y + 5],
            [x - 7, y + 5],
          ],
          '#506043',
          tracer,
        );
      } else {
        line(
          [
            [x - 28, y + 4],
            [x, y],
          ],
          tracer,
          4,
        );
        polygon(
          [
            [x - 10, y - 6],
            [x + 7, y - 3],
            [x + 12, y],
            [x + 7, y + 3],
            [x - 10, y + 6],
            [x - 5, y],
          ],
          weapon.edge,
          ivory,
        );
      }
    }
  }
  function swordSweeps(t, hits) {
    for (const [index, [at, , phase]] of stages.entries()) {
      if (t < at - 235 || t > at + 300) continue;
      const landed = hits.find((hit) => hit.phase === phase && !hit.pending && !hit.missed);
      const p = clamp((t - at + 235) / 535);
      const center =
        landed?.pathX !== undefined
          ? { x: landed.pathX, y: landed.pathY }
          : (options.readCaster?.() ?? from);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.scale(xUnit, yUnit);
      ctx.globalAlpha = Math.sin(p * Math.PI);
      const direction = index % 2 === 0 ? 1 : -1;
      const sweep = direction * (p * tau - Math.PI) + index * Math.PI * 0.42;
      const arcLength = index === 2 ? 3.35 : 2.55;
      const radius = area.radius * (0.84 + 0.16 * clamp(p * 1.9));
      for (const [fraction, paint, thickness, offset] of [
        [0.96, '#080d1e', 3.4, 0],
        [0.99, color, index === 2 ? 2.7 : 2.15, 0],
        [1, ivory, 0.55, 0],
        [0.84, color, 0.85, 0.36],
        [0.74, color, 0.32, 0.67],
      ]) {
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          radius * fraction,
          sweep - direction * (arcLength + offset),
          sweep - direction * offset,
          direction < 0,
        );
        ctx.strokeStyle = paint;
        ctx.lineWidth = thickness;
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const a = sweep - direction * (i * 0.29 + 0.08);
        const drift = 0.91 + (i % 3) * 0.055 + p * 0.14;
        const inner = radius * drift;
        const outer = inner + 1.7 + p * 2;
        line(
          [
            [Math.cos(a) * inner, Math.sin(a) * inner],
            [Math.cos(a + 0.09) * outer, Math.sin(a + 0.09) * outer],
          ],
          i % 2 ? color : ivory,
          0.38,
        );
      }
      if (index === 2 && t >= at) {
        const echo = clamp((t - at) / 300);
        ctx.globalAlpha = (1 - echo) * 0.6;
        ring(0, 0, radius * (0.61 + echo * 0.53), radius * (0.61 + echo * 0.53), color, 0.8);
      }
      ctx.restore();
    }
  }
  return (elapsed) => {
    if (elapsed < 0 || elapsed >= 4200) return;
    if (elapsed < 700) {
      drawUltimateTitle(ctx, options.label || effect, (elapsed * 0.12) / 700, width, height);
      return;
    }
    const hits = options.readHits?.() || [];
    const relevant =
      effect === 'world_stasis' && !options.preview && elapsed >= stages[0][0]
        ? hits.filter((hit) => hit.phase === 'stasis' && !hit.pending && !hit.missed)
        : hits.filter((hit) => !hit.missed);
    const targets = [...new Map(relevant.map((hit) => [hit.toId, hit])).values()];
    if (effect === 'black_coffin') coffin(elapsed, targets.length ? targets : [to]);
    else if (effect === 'world_stasis') stasis(elapsed, targets);
    else if (effect === 'human_malice') malice(elapsed, hits);
    else swordSweeps(elapsed, hits);
  };
}
