import timing from '../../../public/shared/attack-timing.json';
import { crystalReflection, shield } from '../../../public/shared/scene-rules.json';
import attackEffects from '../../../public/shared/attack-effects.json';

const TAU = Math.PI * 2;
const clamp = (value) => Math.max(0, Math.min(1, value));
const core = '#fff8eb';
const dark = '#171c30';

function line(ctx, points, color, width = 2) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function shape(ctx, points, fill, edge = core) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function arc(ctx, x, y, radiusX, radiusY, color, width = 2, start = 0, end = TAU) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, start, end);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function petal(ctx, x, y, rotation, size, fill, length = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size * length, size);
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.bezierCurveTo(-3, -5, 2, -6, 5, -2);
  ctx.lineTo(3, 0);
  ctx.lineTo(6, 1);
  ctx.bezierCurveTo(3, 5, -2, 5, -5, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function fillEllipse(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function heart(ctx, x, y, size, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.bezierCurveTo(x - size * 2, y - size * 0.25, x - size, y - size * 1.4, x, y - size * 0.5);
  ctx.bezierCurveTo(x + size, y - size * 1.4, x + size * 2, y - size * 0.25, x, y + size);
  ctx.fillStyle = color;
  ctx.fill();
}

const TALISMAN_GLYPHS = ['蘿', '莉', '控'];
const PETS = ['cat', 'dog', 'rabbit', 'alpaca', 'penguin'];

function drawPet(ctx, pet, accent, stride) {
  if (pet === 'penguin') {
    fillEllipse(ctx, -3, 0, 10, 13, '#354363', 0.25);
    fillEllipse(ctx, 0, 3, 6, 9, core, 0.27);
    fillEllipse(ctx, -10, 1, 3, 8, '#5e7398', 0.49 + stride * 0.13);
    fillEllipse(ctx, 2, -9, 7, 7, '#354363');
    fillEllipse(ctx, 6, -8, 3.5, 3.7, core);
    shape(
      ctx,
      [
        [8, -8],
        [14, -6],
        [8, -4],
      ],
      '#f7ad54',
      '#f7ad54',
    );
    fillEllipse(ctx, 6, -9, 1, 1, dark);
    fillEllipse(ctx, 3 + stride, 12, 4, 1.8, accent);
    return;
  }
  const fur = { cat: '#f4a45f', dog: '#b4846e', rabbit: '#f3dce9', alpaca: '#f4e5b7' }[pet];
  const fluffy = pet === 'alpaca';
  const rabbit = pet === 'rabbit';
  const dog = pet === 'dog';
  const headY = fluffy ? -16 : -7;
  fillEllipse(ctx, -5, 1, fluffy ? 12 : 10, 6.6, fur);
  for (const side of [-1, 1]) {
    const foot = side * 6;
    line(
      ctx,
      [
        [foot - 3, 4],
        [foot - 5 + side * stride, 10],
        [foot - 2 + side * stride, 10],
      ],
      fur,
      3.6,
    );
  }
  if (fluffy) {
    line(
      ctx,
      [
        [3, 0],
        [5, -12],
        [8, -16],
      ],
      fur,
      8,
    );
    for (let i = 0; i < 4; i++) fillEllipse(ctx, -13 + i * 5, -3, 4, 4, fur);
  } else if (rabbit) {
    fillEllipse(ctx, -15, -1, 4, 4, core);
  } else {
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.quadraticCurveTo(-24, -1, -19, -11 - stride);
    ctx.strokeStyle = fur;
    ctx.lineWidth = 3.2;
    ctx.stroke();
  }
  fillEllipse(ctx, 7, headY, 7.6, 6, fur);
  if (dog) {
    fillEllipse(ctx, 3, -6, 3.3, 6.5, '#734c46', -0.31);
    fillEllipse(ctx, 11, -3.5, 5.5, 3.1, core);
  } else if (rabbit || fluffy) {
    const height = rabbit ? 9 : 4;
    for (const x of [3, 8]) {
      fillEllipse(ctx, x, headY - height - 3, 2.5, height, fur, -0.27);
      fillEllipse(ctx, x + 0.3, headY - height - 3, 0.9, height * 0.63, '#e3a7ba', -0.27);
    }
  } else {
    for (const x of [2, 8])
      shape(
        ctx,
        [
          [x - 2, -9],
          [x - 2, -17],
          [x + 5, -11],
        ],
        fur,
        '#ffc48b',
      );
  }
  fillEllipse(ctx, 10, headY - 1, 1.25, 1.35, dark);
  fillEllipse(ctx, 14, headY + 2, 1.5, 1.05, dark);
  fillEllipse(ctx, 5, headY + 3, 2.3, 1.5, accent);
}

function chamber(ctx, color, elapsed) {
  const angle = elapsed / 480;
  for (const side of [-1, 1]) {
    arc(ctx, 0, 0, 52, 52, color, 2.5, angle * side, angle * side + 1.3);
    arc(ctx, 0, 0, 36, 36, core, 1, -angle * side, -angle * side + 0.65);
  }
}

const draws = {
  sakura_swarm(ctx, { p, tail, distance, color, index, connected }) {
    const side = index % 2 ? -1 : 1;
    const bloom = connected ? tail : 0;
    const head = distance * p;
    for (let i = 0; i < 44; i++) {
      const along = (i % 17) / 16;
      const angle = i * 2.399 + p * 9;
      const gap = along * Math.min(distance * p, 144) * (1 - bloom);
      const x = head - gap + Math.cos(angle) * bloom * (24 + (i % 7) * 6);
      const y = Math.sin(angle) * (6 + along * 15 + bloom * 46) + side * Math.sin(p * Math.PI) * 20;
      petal(
        ctx,
        x,
        y,
        Math.sin(angle) * 0.46 + bloom * angle,
        0.58 + (i % 6) * 0.12,
        i % 4 ? color : core,
        1.65,
      );
    }
    if (bloom) {
      arc(ctx, distance, 0, 18 + bloom * 42, 12 + bloom * 32, color, 3);
      arc(ctx, distance, 0, 13 + bloom * 37, 8 + bloom * 20, core, 1);
    }
  },
  returning_moon(ctx, { p, tail, distance, color }) {
    const orbit = tail ? 1 - tail * 0.55 : p;
    ctx.translate(distance * orbit, -Math.sin(Math.PI * orbit) * 48 * (tail ? -0.65 : 1));
    ctx.rotate(orbit * TAU + tail * Math.PI);
    arc(ctx, -11, 0, 45, 29, dark, 8, -2.1, 2.1);
    arc(ctx, -11, 0, 45, 29, color, 2.5, -2.1, 2.1);
    arc(ctx, -4, 0, 38, 27, core, 2, -0.8, 0.8);
    arc(ctx, -8, 0, 33, 24, color, 3, -1.7, 1.8);
    shape(
      ctx,
      [
        [-9, -22],
        [14, -20],
        [31, 0],
        [14, 21],
        [-9, 23],
        [9, 12],
        [15, 0],
        [9, -12],
      ],
      color,
    );
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha *= i === 0 ? 1 : 0.68;
      arc(ctx, -i * 13, i * 7, 25 - i * 3, 20 - i * 2, color, 7 - i * 2, -1.5, 1.5);
    }
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha * 2);
    arc(ctx, 0, 0, 24, 20, core, 2, -1.25, 1.25);
  },
  tidal_blades(ctx, { p, tail, distance, color, index }) {
    const x = distance * p;
    ctx.translate(x, Math.sin(Math.PI * p) * (index === 0 ? -27 : 27));
    for (let i = 0; i < 12; i++) {
      const spread = tail * (18 + (i % 6) * 7);
      const y = (i % 2 ? -1 : 1) * (8 + i * 2 + spread);
      petal(ctx, -i * 7 + spread, y, i * 0.77, 0.32 + (i % 3) * 0.17, i % 4 ? color : core);
    }
    arc(ctx, -8, 8, 48, 24, dark, 7, 2.8, 5.8);
    arc(ctx, -8, 8, 48, 24, core, 2, 3.4, 5.8);
    for (let i = 1; i <= 3; i++)
      arc(ctx, -i * 12, 10 + i * 3, 32 + i * 4, 14 + i * 2, color, 3, Math.PI * 0.9, TAU);
    ctx.beginPath();
    ctx.moveTo(-58, 18);
    ctx.quadraticCurveTo(-22, -34, 12 + tail * 17, 0);
    ctx.quadraticCurveTo(-9, -12, -36, 12);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const spread = tail * (i + 1) * 13;
      arc(ctx, -i * 8 + spread, 16 - i * 5 + (i % 2 ? spread : -spread), 2.5, 1.6, color);
    }
  },
  magnetic_disc(ctx, { p, tail, distance, color, index }) {
    const x = distance * p;
    line(
      ctx,
      [
        [x - 40, 0],
        [x, 0],
      ],
      color,
      3,
    );
    ctx.translate(x, 0);
    ctx.rotate(p * TAU * 1.5 + (index * Math.PI) / 3);
    arc(ctx, 0, 0, 34, 29, dark, 9);
    arc(ctx, 0, 0, 41 + tail * 16, 36 + tail * 13, color, 2.2, 0.1, 4.7);
    arc(ctx, 0, 0, 17, 15, color, 4);
    shape(
      ctx,
      [
        [0, -8],
        [8, 0],
        [0, 8],
        [-8, 0],
      ],
      core,
      color,
    );
    arc(ctx, 0, 0, 32, 27, core, 2, 0.2, 2.5);
    arc(ctx, 0, 0, 32, 27, core, 2, 3.3, 5.6);
    arc(ctx, 0, 0, 23 + tail * 16, 20 + tail * 10, color, 3);
    arc(ctx, 0, 0, 10, 10, core);
    for (let i = 0; i < 4; i++) {
      shape(
        ctx,
        [
          [12, -8],
          [23, -5],
          [20, 7],
          [8, 8],
        ],
        color,
      );
      line(
        ctx,
        [
          [22, 0],
          [28, -5],
          [30, 4],
          [38 + tail * 15, 0],
        ],
        color,
      );
      ctx.rotate(Math.PI / 2);
    }
  },
  quicksand_trap(ctx, { p, tail, distance, color, index }) {
    ctx.translate(distance, 12);
    const spread = 0.4 + p * 0.6 + tail * 0.24;
    ctx.scale(spread, spread);
    fillEllipse(ctx, 0, 0, 67, 29, '#272030');
    fillEllipse(ctx, 1, 4, 38, 16, '#171725');
    fillEllipse(ctx, 2, 7, 15, 6, '#0f111e');
    arc(ctx, 0, 0, 71, 30, color, 2.4);
    arc(ctx, 0, 0, 61, 26, core, 1.2, 0.4, 2.65);
    for (let band = 0; band < 3; band++) {
      const spiral = [];
      for (let i = 0; i <= 22; i++) {
        const fraction = i / 22;
        const angle = (band * TAU) / 3 + (p + index) * 2.1 + fraction * 4.9;
        const radius = 59 - fraction * 51;
        spiral.push([Math.cos(angle) * radius, Math.sin(angle) * radius * 0.42 + fraction * 7]);
      }
      line(ctx, spiral, color, 2.2);
    }
    for (let i = 0; i < 18; i++) {
      const progress = (i * 0.147 + p * 1.5 + tail * 0.6) % 1;
      const angle = i * 2.399 + progress * 3.2;
      const radius = 67 * (1 - progress) + 4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.41 + progress * 7;
      fillEllipse(ctx, x, y, 1.2 + (1 - progress) * 2, 1.15, i % 5 ? color : core);
    }
  },
  refracting_prism(ctx, { p, tail, distance, color, index }) {
    const deflect = (index - 1) * 30;
    const mid = distance * 0.53;
    shape(
      ctx,
      [
        [mid, deflect - 24],
        [mid + 17, deflect],
        [mid, deflect + 19],
        [mid - 17, deflect],
      ],
      dark,
      color,
    );
    line(
      ctx,
      [
        [mid, deflect - 22],
        [mid + 4, deflect + 3],
        [mid, deflect + 16],
      ],
      core,
      1.2,
    );
    shape(
      ctx,
      [
        [mid - 12, deflect + 10],
        [mid, deflect - 13],
        [mid + 12, deflect + 10],
      ],
      color,
    );
    const x = p < 0.5 ? mid * p * 2 : mid + (distance - mid) * (p * 2 - 1);
    const y = deflect * (p < 0.5 ? p * 2 : 2 - p * 2);
    const path =
      p < 0.5
        ? [
            [0, 0],
            [x, y],
          ]
        : [
            [0, 0],
            [mid, deflect],
            [x, y],
          ];
    line(ctx, path, dark, 11 + tail * 5);
    line(ctx, path, color, 6 + tail * 4);
    line(ctx, path, core, 1.5);
    line(
      ctx,
      path.map(([px, py]) => [px, py + 5]),
      color,
      2,
    );
    line(
      ctx,
      path.map(([px, py]) => [px, py - 5]),
      color,
      2,
    );
    if (p >= 0.5) arc(ctx, mid, deflect, 17 + tail * 12, 17 + tail * 12, core, 1.5);
  },
  // Keep the stored item ID so existing ownership and loadouts carry over.
  bell_shockwave(ctx, { p, tail, distance, color, index, connected }) {
    const pets = index ? PETS.slice(3) : PETS.slice(0, 3);
    for (let i = 0; i < pets.length; i++) {
      const delay = i * 0.15;
      if (p < delay) continue;
      const progress = (p - delay) / (1 - delay);
      const x = distance * progress;
      const y = -Math.sin(progress * Math.PI) * (24 + i * 10) + Math.sin(progress * TAU * 2) * 6;
      for (let j = 1; j <= 4; j++) {
        heart(ctx, x - j * 10, y + (j % 2 ? 8 : -9) + tail * j * 4, 2.7 - j * 0.4, color);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(progress * TAU * 2) * 0.14);
      const pet = pets[i];
      drawPet(ctx, pet, color, Math.sin(progress * TAU * 2.5) * 3);
      ctx.restore();
    }
    if (tail && connected) {
      for (let i = 0; i < 9; i++) {
        const angle = (i * TAU) / 9 + index;
        heart(
          ctx,
          distance + Math.cos(angle) * (10 + tail * 56),
          Math.sin(angle) * (10 + tail * 48),
          3 + (i % 3),
          i % 3 ? color : core,
        );
      }
    }
  },
  shadow_lunge(ctx, { p, tail, distance, color, connected }) {
    const tip = distance * p;
    for (let i = 0; i < 13; i++) {
      const lane = (i - 6) * 8;
      const length = 30 + (i % 5) * 21;
      const offset = (i % 4) * 9;
      line(
        ctx,
        [
          [tip - offset - length, lane],
          [tip - offset - 23, lane * 0.37],
          [tip - offset, lane * 0.11],
        ],
        i % 4 ? color : core,
        i % 4 ? 1.1 : 2.2,
      );
    }
    for (let i = 3; i >= 0; i--) {
      const x = tip - i * 28;
      const width = 34 + i * 9;
      ctx.save();
      ctx.translate(x, i % 2 ? 3 : -3);
      ctx.rotate(-0.31);
      ctx.globalAlpha *= 1 - i * 0.19;
      ctx.beginPath();
      ctx.moveTo(-width - 19, 28);
      ctx.bezierCurveTo(-width + 6, -35, -17, -44, 5, 0);
      ctx.bezierCurveTo(-22, -26, -width + 14, -24, -width - 19, 28);
      ctx.fillStyle = color;
      ctx.fill();
      arc(ctx, -width * 0.62, -1, width * 0.66, 23, core, 1.4, 3.51, 5.82);
      ctx.restore();
    }
    shape(
      ctx,
      [
        [tip - 117, 0],
        [tip - 37, -8],
        [tip + 9, 0],
        [tip - 38, 8],
      ],
      color,
      core,
    );
    line(
      ctx,
      [
        [tip - 92, 0],
        [tip + 7, 0],
      ],
      core,
      2.8,
    );
    if (tail && connected) {
      arc(ctx, distance, 0, 8 + tail * 17, 15 + tail * 39, core, 2.4);
      line(
        ctx,
        [
          [distance - 19, 13],
          [distance - 9, 7],
          [distance - 2, 14],
          [distance + 19, 9],
        ],
        color,
        1.6,
      );
    }
  },
  seeking_talismans(ctx, { p, tail, distance, color, index }) {
    const x = distance * p;
    const y = Math.sin(p * Math.PI) * (index - 1) * 49;
    ctx.translate(x, y);
    ctx.rotate(Math.sin(p * Math.PI) * (index - 1) * 0.8);
    for (let i = 0; i < 9; i++)
      petal(ctx, -8 - i * 6, Math.sin(p * 18 + i) * (5 + i), i, 0.46, i % 3 ? color : core);
    shape(
      ctx,
      [
        [-14, -16],
        [13, -16],
        [10, 17],
        [-13, 14],
      ],
      dark,
      color,
    );
    arc(ctx, 1, 0, 17 + 10 * tail, 20 + 10 * tail, color, 2, 0, 4.7);
    line(
      ctx,
      [
        [-55, 11],
        [-29, 4],
        [-12, 0],
      ],
      core,
      1.5,
    );
    line(
      ctx,
      [
        [-34, 7],
        [-23, -2],
        [-12, 2],
      ],
      color,
    );
    shape(
      ctx,
      [
        [-11, -14],
        [10, -13],
        [8, 14],
        [-10, 11],
      ],
      core,
      color,
    );
    ctx.fillStyle = '#7d211d';
    ctx.font = 'bold 15px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TALISMAN_GLYPHS[index], 0, 0);
    if (tail) arc(ctx, 4, 0, 12 + tail * 26, 10 + tail * 21, color, 3);
  },
};

// Shares the combat timeline and the caller's canvas. No timers or new media
// are needed to draw a phase, including for a late or resumed preview.
function drawDualWhips(ctx, options, phases, scale, elapsed) {
  const recovery = clamp((elapsed - phases[1][0]) / 300);
  if (recovery >= 1) return;
  const skin = '#f5c6a4';
  const jacket = '#263750';
  const alternate = options.alternatePalette === 'venom_thorn_alt';
  const strapColors = alternate ? ['#6366f1', options.color] : ['#141720', options.color];
  const strapEdges = alternate ? ['#a7adff', '#ffd980'] : ['#909aaa', '#dba875'];
  const origin = options.from;
  const facing = Math.atan2(options.to.y - origin.y, options.to.x - origin.x);
  const reach = Math.hypot(options.to.x - origin.x, options.to.y - origin.y) / scale;
  const hits = options.readHits?.() ?? [];
  const pose = phases.map(([impact], index) => {
    const start = index ? phases[0][0] - 90 : 0;
    const release = clamp((elapsed - start) / (impact - start));
    const pull = Math.sin(Math.PI * release) * (1 - release);
    const follow = clamp((elapsed - impact) / 170);
    const snap = clamp((elapsed - impact + 125) / 125);
    const arm = snap ** 1.6 * (1 - follow);
    return { pull, arm, follow };
  });
  const lean = (pose[0].arm + pose[1].arm) * 7 - (pose[0].pull + pose[1].pull) * 12;
  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(facing);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= Math.min(1, elapsed / 90) * (1 - recovery);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  fillEllipse(ctx, -8, 25, 25, 6, '#151a27');
  line(
    ctx,
    [
      [-5, 4],
      [-19, 16],
      [-29, 24],
    ],
    '#242c40',
    9,
  );
  line(
    ctx,
    [
      [-3, 5],
      [7 + lean * 0.4, 15],
      [20, 24],
    ],
    '#455675',
    9,
  );
  line(
    ctx,
    [
      [-36, 24],
      [-24, 24],
    ],
    '#8792a8',
    3,
  );
  line(
    ctx,
    [
      [15, 25],
      [25, 25],
    ],
    '#8792a8',
    3,
  );
  shape(
    ctx,
    [
      [-17 + lean, -24],
      [4 + lean, -22],
      [3, 6],
      [-11, 8],
    ],
    jacket,
    '#a0afc5',
  );
  shape(
    ctx,
    [
      [lean - 8, -22],
      [lean + 3, -22],
      [lean + 1, -9],
    ],
    '#f1ecdf',
    '#f1ecdf',
  );
  line(
    ctx,
    [
      [lean - 2, -21],
      [lean, -12],
      [lean + 1, 1],
    ],
    '#d84349',
    2.7,
  );
  ctx.save();
  ctx.translate(lean - 4, -31);
  fillEllipse(ctx, 0, 1, 9.5, 11, skin, -0.2);
  fillEllipse(ctx, -7, 1, 2.9, 3.9, '#e4a082');
  shape(
    ctx,
    [
      [-7, -7],
      [-9, -11],
      [-2, -15],
      [6, -13],
      [12, -9],
      [4, -9],
      [-2, -6],
      [-7, -1],
    ],
    '#e5b852',
    '#f6db8a',
  );
  line(
    ctx,
    [
      [-6, -10],
      [0, -13],
      [8, -10],
    ],
    '#fff0af',
    1.3,
  );
  line(
    ctx,
    [
      [1, -3],
      [5, -4],
      [8, -2],
    ],
    '#a47048',
    1.2,
  );
  fillEllipse(ctx, 5, -2, 1.05, 0.85, dark);
  line(
    ctx,
    [
      [7, -1],
      [10, 2],
      [7, 3],
    ],
    '#ca886c',
    1.1,
  );
  line(
    ctx,
    [
      [2, 6],
      [6, 5.5],
      [8, 6],
    ],
    '#995e54',
    1.05,
  );
  ctx.restore();
  for (let index = 0; index < 2; index++) {
    const [impact, , phase] = phases[index];
    const { pull, arm, follow } = pose[index];
    const side = index ? 1 : -1;
    const shoulder = [lean + side * 4, -21 + side * 5];
    const elbow = [lean - 5 - pull * 31 + arm * 20, -18 + side * (15 + pull * 19)];
    const hand = [elbow[0] + 10 + arm * 17 - pull * 22, elbow[1] + side * (10 - arm * 9)];
    line(ctx, [shoulder, elbow], index ? '#627592' : '#3e506c', 7);
    line(ctx, [elbow, hand], skin, 5);
    fillEllipse(ctx, hand[0], hand[1], 3, 3, skin);
    const grip = [hand[0] + 13, hand[1] + side * 3];
    line(ctx, [hand, grip], '#211923', 5.4);
    line(ctx, [[hand[0] + 3, hand[1] + side], grip], '#bc9875', 2.6);

    const hit = hits.find((item) => item.phase === phase);
    const dx = hit ? hit.x - origin.x : options.to.x - origin.x;
    const dy = hit ? hit.y - origin.y : options.to.y - origin.y;
    const localX = (Math.cos(facing) * dx + Math.sin(facing) * dy) / scale;
    const localY = (Math.cos(facing) * dy - Math.sin(facing) * dx) / scale;
    const slack = 1 - arm;
    const tipX = localX * arm + (grip[0] + 52 - 88 * pull) * slack;
    const tipY = localY * arm + (grip[1] + side * (44 + follow * 18)) * slack;
    const bend = side * (32 + pull * 105 + follow * 32) * slack;
    const span = Math.min(105, Math.max(35, reach * 0.43));
    const control = [
      grip,
      [grip[0] + span * (0.4 - pull), grip[1] + bend],
      [tipX + span * (slack - 0.55), tipY - bend * 0.88],
      [tipX, tipY],
    ];
    const pointAt = (t) => {
      const u = 1 - t;
      return [0, 1].map(
        (axis) =>
          u ** 3 * control[0][axis] +
          3 * u ** 2 * t * control[1][axis] +
          3 * u * t ** 2 * control[2][axis] +
          t ** 3 * control[3][axis],
      );
    };
    for (let segment = 0; segment < 4; segment++) {
      const points = Array.from({ length: 7 }, (_, step) => pointAt((segment + step / 6) / 4));
      const width = 5.3 - segment * 1.22;
      line(ctx, points, strapEdges[index], width + 1.5 - segment * 0.28);
      line(ctx, points, strapColors[index], width);
    }
    for (let braid = 1; braid <= 6; braid++) {
      const [x, y] = pointAt(braid / 20);
      const [endX, endY] = pointAt((braid + 0.3) / 20);
      line(
        ctx,
        [
          [x, y + 0.9],
          [endX, endY - 0.9],
        ],
        strapEdges[index],
        0.9,
      );
    }

    const after = (elapsed - impact) / 165;
    if (after >= 0 && after < 1 && (options.preview || (hit && !hit.pending && !hit.missed))) {
      ctx.save();
      ctx.globalAlpha *= 1 - after;
      for (let spark = 0; spark < 8; spark++) {
        const angle = (spark * TAU) / 8 + side * 0.17;
        const radius = 7 + after * (28 + (spark % 3) * 7);
        const x = Math.cos(angle),
          y = Math.sin(angle);
        line(
          ctx,
          [
            [localX + x * 4, localY + y * 4],
            [localX + x * radius, localY + y * radius],
          ],
          spark % 3 ? strapEdges[index] : core,
          spark % 3 ? 1.5 : 2.5,
        );
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

export function createOrdinaryAttack(ctx, options) {
  if (options.effect === 'shield') return createHexBarrier(ctx, options);
  if (options.effect === 'crystal_reflection') return createReflection(ctx, options);
  if (options.effect === 'venom_thorn') {
    const scale = Math.min(1.5, options.width / 330, options.height / 165);
    return (elapsed) => drawDualWhips(ctx, options, timing[options.effect], scale, elapsed);
  }
  const draw = draws[options.effect];
  if (!draw) return null;
  const phases = timing[options.effect];
  const scale = Math.min(1.5, options.width / 330, options.height / 165);
  return (elapsed) => {
    let previous = 0;
    phases.forEach(([scheduledImpact, , phase], index) => {
      if (options.reflectedPhase && phase !== options.reflectedPhase) return;
      const impact = options.reflectedPhase ? crystalReflection.travelMs : scheduledImpact;
      const start = index && !options.reflectedPhase ? previous - 80 : 0;
      previous = scheduledImpact;
      if (elapsed < start || elapsed >= impact + 300) return;
      const hit = options.readHits?.().find((item) => item.phase === phase);
      const target =
        options.effect === 'sakura_swarm' && (!hit || hit.pending)
          ? (options.readTarget?.() ?? hit ?? options.to)
          : (hit ?? options.to);
      const dx = target.x - options.from.x;
      const dy = target.y - options.from.y;
      const p = clamp((elapsed - start) / (impact - start));
      const tail = clamp((elapsed - impact) / 300);
      ctx.save();
      ctx.translate(options.from.x, options.from.y);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, p * 6) * (1 - tail);
      ctx.lineJoin = ctx.lineCap = 'round';
      const connected = options.preview || (hit && !hit.pending && !hit.missed);
      draw(ctx, {
        p,
        tail,
        distance: Math.hypot(dx, dy) / scale,
        color: options.color,
        index,
        connected,
      });
      ctx.restore();
      if (elapsed < impact || !connected) return;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.scale(scale, scale);
      ctx.globalAlpha = (1 - tail) * 0.88;
      arc(ctx, 0, 0, 9 + tail * 29, 14 + tail * 35, options.color, 3);
      for (let i = 0; i < 5; i++) {
        const angle = (i * TAU) / 5 + index;
        const x = Math.cos(angle),
          y = Math.sin(angle);
        line(
          ctx,
          [
            [x * (9 + tail * 16), y * (9 + tail * 16)],
            [x * (16 + tail * 30), y * (16 + tail * 30)],
          ],
          core,
          2,
        );
      }
      ctx.restore();
    });
  };
}

function createHexBarrier(ctx, options) {
  const alternate = options.alternatePalette === 'shield_alt';
  const definition = attackEffects.find(
    (effect) => effect.id === (alternate ? 'shield_alt' : 'shield'),
  );
  const [primary, shade, highlight] = definition.artworkColors;
  const points = (x, y, radius) =>
    Array.from({ length: 6 }, (_, k) => {
      const angle = (k * TAU) / 6 - Math.PI / 2;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    });
  const margin = Math.min(
    options.from.x,
    options.width - options.from.x,
    options.from.y,
    options.height - options.from.y,
  );
  const radius = Math.max(
    4,
    Math.min(84, options.width * 0.21, options.height * 0.4, margin / 1.12 - 3),
  );
  const rim = points(0, 0, radius),
    inner = points(0, 0, radius - 5),
    back = points(-5, 5, radius);
  const cells = [];
  for (let q = -2; q <= 2; q++)
    for (let row = -2; row <= 2; row++) {
      if (Math.abs(q + row) > 2) continue;
      const r = radius * 0.17;
      const x = Math.sqrt(3) * r * (q + row / 2),
        y = r * 1.5 * row;
      cells.push({ x, y, polygon: points(x, y, r - 1) });
    }
  function trace(vertices) {
    ctx.beginPath();
    ctx.moveTo(...vertices[0]);
    for (const point of vertices.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
  }
  return (elapsed) => {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= shield.durationMs) return;
    const reveal = clamp(elapsed / 160),
      fade = clamp((shield.durationMs - elapsed) / 220);
    // readAnchor is translated by the shared stage. Do not follow twice.
    const center = options.readAnchor ? options.from : options.readCaster?.() || options.from;
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(0.9 + reveal * 0.1, 0.9 + reveal * 0.1);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.globalAlpha = reveal * fade;
    trace(back);
    ctx.strokeStyle = shade;
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      trace([back[k], back[(k + 1) % 6], rim[(k + 1) % 6], rim[k]]);
      ctx.fillStyle = k % 2 ? shade : primary;
      ctx.globalAlpha = reveal * fade * 0.17;
      ctx.fill();
    }
    ctx.save();
    trace(rim);
    ctx.clip();
    const face = ctx.createLinearGradient(-radius, -radius, radius, radius);
    face.addColorStop(0, primary);
    face.addColorStop(0.48, shade);
    face.addColorStop(1, highlight);
    trace(rim);
    ctx.fillStyle = face;
    ctx.globalAlpha = reveal * fade * 0.055;
    ctx.fill();
    for (const [index, cell] of cells.entries()) {
      const pulse = (Math.sin(elapsed / 280 - cell.y / 13 - index * 0.16) + 1) / 2;
      trace(cell.polygon);
      ctx.strokeStyle = primary;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = reveal * fade * (0.17 + pulse * 0.18);
      ctx.stroke();
      ctx.globalAlpha = reveal * fade * (0.015 + pulse * 0.045);
      ctx.fillStyle = primary;
      ctx.fill();
      if (index % 3 === 1) {
        ctx.globalAlpha = reveal * fade * 0.5;
        if (alternate) {
          line(
            ctx,
            [
              [cell.x - 3, cell.y + 4],
              [cell.x, cell.y - 4],
              [cell.x + 3, cell.y + 2],
            ],
            highlight,
            0.8,
          );
          line(
            ctx,
            [
              [cell.x, cell.y],
              [cell.x + 4, cell.y - 2],
            ],
            primary,
            0.8,
          );
        } else
          line(
            ctx,
            [
              [cell.x - 4, cell.y - 2],
              [cell.x, cell.y - 2],
              [cell.x, cell.y + 3],
              [cell.x + 3, cell.y + 3],
            ],
            highlight,
            0.8,
          );
      }
    }
    ctx.restore();
    ctx.globalAlpha = reveal * fade;
    trace(rim);
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    trace(inner);
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 0.8;
    if (alternate) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < 6; k++) {
      const a = rim[k],
        b = inner[k];
      line(ctx, [a, back[k]], shade, 1);
      const x = a[0] * 0.94,
        y = a[1] * 0.94;
      ctx.globalAlpha = reveal * fade * 0.85;
      if (alternate) {
        trace([
          [x, y - 4],
          [x + 3, y],
          [x, y + 4],
          [x - 3, y],
        ]);
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else
        line(
          ctx,
          [
            [x - 3, y],
            [x + 3, y],
          ],
          highlight,
          1.5,
        );
      line(ctx, [b, [b[0] * 0.9, b[1] * 0.9]], primary, 1);
    }
    const progress = (elapsed / 230) % 6,
      edge = Math.floor(progress),
      t = progress - edge;
    const a = rim[edge],
      b = rim[(edge + 1) % 6];
    const tip = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    ctx.globalAlpha = reveal * fade;
    line(ctx, [a, tip], highlight, 2);
    ctx.beginPath();
    ctx.arc(...tip, 2.5, 0, TAU);
    ctx.fillStyle = highlight;
    ctx.fill();
    ctx.restore();
  };
}

function createReflection(ctx, options) {
  const { windowMs, travelMs } = crystalReflection;
  const { from, to, color } = options;
  const previewAt = windowMs * 0.44;
  const flashMs = 110;
  const scale = Math.min(1.25, options.width / 280, options.height / 180);
  return (elapsed, drawReturn) => {
    const hits = options.preview
      ? [previewAt, previewAt + 260].map((contact, index) => ({
          ...to,
          pathX: from.x,
          pathY: from.y,
          delayMs: contact + travelMs,
          reflectionIndex: index,
          reflectedEffect: 'tidal_blades',
          reflectedPhase: 'hit' + (index + 1),
        }))
      : options.readHits?.() || [];
    const playing = hits
      .filter((hit) => elapsed >= hit.delayMs - travelMs && elapsed < hit.delayMs + 160)
      .slice(-4);
    const shieldUntil = windowMs + 75;
    if (elapsed < 0 || (elapsed >= shieldUntil && !playing.length)) return;
    const center = options.readCaster?.() ?? from;
    const originFor = (hit) => ({ x: hit.pathX ?? center.x, y: hit.pathY ?? center.y });
    ctx.save();
    if (elapsed < shieldUntil) {
      const fade = clamp((shieldUntil - elapsed) / 75);
      const reveal = clamp(elapsed / 85);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = fade * reveal;
      const radius = (33 + 14 * reveal) * (1 + 0.18 * (1 - fade));
      const glow = ctx.createRadialGradient(-7, -9, 6, 0, 0, radius * 1.07);
      glow.addColorStop(0, 'rgba(255,244,220,0.03)');
      glow.addColorStop(0.72, 'rgba(255,218,135,0.13)');
      glow.addColorStop(0.93, color);
      glow.addColorStop(1, 'rgba(255,218,135,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-radius * 1.1, -radius * 1.1, radius * 2.2, radius * 2.2);
      arc(ctx, 0, 0, radius, radius, color, 3.5);
      arc(ctx, 0, 0, radius - 5, radius - 5, core, 1.4, -2.8, -0.38);
      arc(ctx, 0, 0, radius + 8, radius * 0.36, color, 1.6);
      chamber(ctx, color, elapsed);
      const rotation = elapsed / 1350;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / 8 + rotation);
        shape(
          ctx,
          [
            [radius - 13, 0],
            [radius + 1, -8],
            [radius + 10, 0],
            [radius + 1, 8],
          ],
          color,
        );
        shape(
          ctx,
          [
            [radius - 12, 0],
            [radius + 1, -8],
            [radius + 9, 0],
          ],
          core,
          color,
        );
        ctx.restore();
      }
      const contact = playing.findLast((hit) => elapsed < hit.delayMs - travelMs + flashMs);
      if (contact) {
        const age = clamp((elapsed - contact.delayMs + travelMs) / flashMs);
        const origin = originFor(contact);
        ctx.globalAlpha = 1 - age;
        ctx.translate((origin.x - center.x) / scale, (origin.y - center.y) / scale);
        ctx.rotate(Math.atan2(contact.y - origin.y, contact.x - origin.x));
        arc(ctx, radius * 0.74, 0, 15 + 31 * age, 19 + 34 * age, core, 4 - 2 * age);
        arc(ctx, radius * 0.8, 0, 21 + 48 * age, 26 + 45 * age, color, 3 - age);
        for (let i = 0; i < 10; i++)
          petal(
            ctx,
            radius * 0.75 + age * i * 5,
            (i - 4.5) * (2 + age * 4),
            i * 1.25,
            0.8,
            i % 2 ? color : core,
          );
        for (let i = -2; i <= 2; i++)
          line(
            ctx,
            [
              [radius * 0.7, i * 3],
              [radius + 36 * age, i * (11 + 15 * age)],
            ],
            color,
            2,
          );
      }
      ctx.restore();
    }
    for (const hit of playing) {
      const bounceAt = hit.delayMs - travelMs;
      const origin = originFor(hit);
      if (drawReturn?.(hit, origin, elapsed - bounceAt)) continue;
      const p = clamp((elapsed - bounceAt) / travelMs);
      const x = origin.x + (hit.x - origin.x) * p;
      const y = origin.y + (hit.y - origin.y) * p;
      ctx.save();
      ctx.globalAlpha = clamp(1 - (elapsed - hit.delayMs) / 160);
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(hit.y - origin.y, hit.x - origin.x));
      ctx.scale(scale, scale);
      const impact = clamp((elapsed - hit.delayMs) / 160);
      shape(
        ctx,
        [
          [-66, 0],
          [-18, -12],
          [18, 0],
          [-18, 12],
        ],
        color,
      );
      line(
        ctx,
        [
          [-68, 0],
          [13, 0],
        ],
        core,
        3,
      );
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [-57, side * 9],
            [-22, side * 6],
            [5, side * 2],
          ],
          color,
          2.5,
        );
      }
      if (impact) arc(ctx, 0, 0, 9 + impact * 31, 9 + impact * 31, core, 3);
      line(
        ctx,
        [
          [-44, 0],
          [-2, 0],
        ],
        color,
        4,
      );
      shape(
        ctx,
        [
          [-12, 0],
          [0, -7],
          [13, 0],
          [0, 7],
        ],
        color,
      );
      ctx.restore();
    }
    if (options.preview && elapsed < previewAt) {
      const p = clamp(elapsed / previewAt);
      const x = to.x + (from.x - to.x) * p;
      ctx.translate(x, from.y);
      ctx.scale(scale, scale);
      line(
        ctx,
        [
          [5, 0],
          [25, 0],
        ],
        color,
        3,
      );
      shape(
        ctx,
        [
          [-8, 0],
          [1, -5],
          [9, 0],
          [1, 5],
        ],
        color,
      );
    }
    ctx.restore();
  };
}
