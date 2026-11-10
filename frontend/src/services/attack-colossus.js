// Sculpted stone plates share the existing finite hero canvas and timeline.
function colossusPolygon(c, points, fill, edge, width = 0.65) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (edge) {
    c.strokeStyle = edge;
    c.lineWidth = width;
    c.stroke();
  }
}
function colossusBody(c, palette, kneeling, spread) {
  const alt = palette.stone === '#180b26';
  const p = alt
    ? {
        light: '#d0c2f5',
        stone: '#6752a1',
        mid: '#362459',
        shadow: '#161b2c',
        gold: '#bd8be0',
        eye: '#e0a6ff',
      }
    : {
        light: '#bce5ff',
        stone: '#3274b4',
        mid: '#18365e',
        shadow: '#0e1d37',
        gold: '#f6b449',
        eye: '#69e7ff',
      };
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    c.save();
    c.translate(15, -21);
    c.rotate(1.47 * (1 - spread));
    c.scale(0.53 + 0.47 * spread, 0.74 + 0.26 * spread);
    const plating = c.createLinearGradient(12, -34, 56, 16);
    plating.addColorStop(0, p.light);
    plating.addColorStop(0.32, p.stone);
    plating.addColorStop(0.72, p.mid);
    plating.addColorStop(1, p.shadow);
    for (let panel = 3; panel >= 0; panel--) {
      c.save();
      c.translate(panel * 5, panel * 9);
      const length = 84 - panel * 9;
      colossusPolygon(
        c,
        [
          [-2, 3],
          [22, -14],
          [length - 11, -37],
          [length, -36],
          [length - 12, -17],
          [48, 2],
          [15, 12],
        ],
        plating,
        p.light,
        0.75,
      );
      colossusPolygon(
        c,
        [
          [17, 4],
          [43, -4],
          [length - 11, -20],
          [length - 18, -13],
          [46, 4],
        ],
        p.eye,
        p.mid,
        0.4,
      );
      colossusPolygon(
        c,
        [
          [28, -12],
          [44, -17],
          [49, -15],
          [35, -8],
        ],
        p.gold,
        p.shadow,
        0.6,
      );
      c.restore();
    }
    colossusPolygon(
      c,
      [
        [-9, 2],
        [1, -11],
        [22, -17],
        [28, -10],
        [18, 6],
        [1, 11],
      ],
      p.mid,
      p.gold,
      0.9,
    );
    c.restore();
    // Broad pauldrons with raised ridges and an inset gold lip.
    colossusPolygon(
      c,
      [
        [10, -23],
        [26, -29],
        [36, -18],
        [29, -6],
        [12, -9],
      ],
      p.light,
      p.shadow,
      1.1,
    );
    colossusPolygon(
      c,
      [
        [24, -25],
        [33, -18],
        [27, -9],
        [21, -12],
      ],
      p.mid,
      p.gold,
      0.65,
    );
    const armY = kneeling ? 4 : -10;
    colossusPolygon(
      c,
      [
        [18, -10],
        [29, -10],
        [34, armY + 11],
        [23, armY + 15],
        [16, 0],
      ],
      p.stone,
      p.shadow,
      1,
    );
    colossusPolygon(
      c,
      [
        [28, armY],
        [35, armY + 8],
        [29, armY + 19],
        [22, armY + 11],
      ],
      p.mid,
      p.gold,
      0.8,
    );
    const fistX = kneeling ? (side === 1 ? 26 : 20) : 30,
      fistY = kneeling ? (side === 1 ? 30 : 15) : 18;
    colossusPolygon(
      c,
      [
        [fistX - 9, fistY - 9],
        [fistX + 5, fistY - 10],
        [fistX + 10, fistY - 3],
        [fistX + 7, fistY + 8],
        [fistX - 7, fistY + 8],
        [fistX - 11, fistY],
      ],
      p.light,
      p.shadow,
      1,
    );
    colossusPolygon(
      c,
      [
        [fistX + 4, fistY - 8],
        [fistX + 9, fistY - 2],
        [fistX + 6, fistY + 7],
        [fistX + 1, fistY + 6],
      ],
      p.mid,
      p.gold,
      0.6,
    );
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(fistX - 6 + k * 4, fistY - 4);
      c.lineTo(fistX - 6 + k * 4, fistY + 4);
      c.strokeStyle = p.mid;
      c.lineWidth = 0.8;
      c.stroke();
    }
    // Articulated thigh, shin and heavy planted heel.
    const kneeX = kneeling ? (side === 1 ? 17 : 9) : 12,
      kneeY = kneeling ? 24 : 28;
    colossusPolygon(
      c,
      [
        [5, 9],
        [15, 10],
        [kneeX + 6, kneeY],
        [kneeX - 5, kneeY + 3],
      ],
      p.stone,
      p.shadow,
      1,
    );
    colossusPolygon(
      c,
      [
        [kneeX - 5, kneeY],
        [kneeX + 6, kneeY],
        [kneeX + 9, 39],
        [kneeX - 7, 39],
      ],
      p.light,
      p.shadow,
      0.9,
    );
    colossusPolygon(
      c,
      [
        [kneeX + 2, kneeY + 2],
        [kneeX + 6, kneeY + 3],
        [kneeX + 8, 37],
        [kneeX + 2, 37],
      ],
      p.mid,
      p.gold,
      0.65,
    );
    colossusPolygon(
      c,
      [
        [kneeX - 8, 37],
        [kneeX + 8, 37],
        [kneeX + 13, 42],
        [kneeX - 10, 42],
      ],
      p.mid,
      p.gold,
      0.85,
    );
    c.restore();
  }
  // Overlapping breastplate facets and the faceted heart crystal.
  colossusPolygon(
    c,
    [
      [-18, -21],
      [0, -28],
      [18, -21],
      [15, 5],
      [8, 15],
      [-8, 15],
      [-15, 5],
    ],
    p.shadow,
    p.gold,
    1.3,
  );
  colossusPolygon(
    c,
    [
      [-17, -20],
      [0, -25],
      [0, -2],
      [-11, 4],
      [-14, -3],
    ],
    p.light,
    p.mid,
    0.7,
  );
  colossusPolygon(
    c,
    [
      [0, -25],
      [17, -20],
      [14, -3],
      [11, 4],
      [0, -2],
    ],
    p.stone,
    p.mid,
    0.7,
  );
  colossusPolygon(
    c,
    [
      [-11, 4],
      [0, -2],
      [11, 4],
      [7, 13],
      [-7, 13],
    ],
    p.mid,
    p.gold,
    0.8,
  );
  colossusPolygon(
    c,
    [
      [0, -18],
      [6, -10],
      [0, -3],
      [-6, -10],
    ],
    p.gold,
    p.shadow,
    0.8,
  );
  colossusPolygon(
    c,
    [
      [0, -15],
      [3, -10],
      [0, -6],
      [-3, -10],
    ],
    p.eye,
    p.light,
    0.5,
  );
  for (let k = 0; k < 2; k++)
    colossusPolygon(
      c,
      [
        [-8, 5 + k * 5],
        [0, 2 + k * 5],
        [8, 5 + k * 5],
        [0, 7 + k * 5],
      ],
      p.stone,
      p.shadow,
      0.5,
    );
  // Angular, horned guardian face: brow, recessed eyes, cheek and squared jaw.
  colossusPolygon(
    c,
    [
      [-10, -29],
      [-11, -39],
      [-5, -46],
      [0, -43],
      [5, -46],
      [11, -39],
      [10, -29],
      [5, -24],
      [-5, -24],
    ],
    p.stone,
    p.shadow,
    1.1,
  );
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    colossusPolygon(
      c,
      [
        [6, -41],
        [10, -50],
        [17, -55],
        [12, -42],
        [10, -35],
      ],
      p.gold,
      p.shadow,
      0.7,
    );
    colossusPolygon(
      c,
      [
        [1, -38],
        [9, -40],
        [8, -34],
        [2, -32],
      ],
      p.shadow,
      p.mid,
      0.5,
    );
    colossusPolygon(
      c,
      [
        [2, -36],
        [8, -37],
        [6, -34],
        [2, -34],
      ],
      p.eye,
      null,
    );
    colossusPolygon(
      c,
      [
        [8, -33],
        [10, -29],
        [4, -26],
        [2, -30],
      ],
      p.light,
      p.mid,
      0.5,
    );
    c.restore();
  }
  colossusPolygon(
    c,
    [
      [0, -46],
      [3, -39],
      [0, -34],
      [-3, -39],
    ],
    p.gold,
    p.shadow,
    0.7,
  );
  colossusPolygon(
    c,
    [
      [-4, -29],
      [4, -29],
      [3, -25],
      [-3, -25],
    ],
    p.mid,
    p.shadow,
    0.5,
  );
}
export function drawHeroFlyingStatue(c, p, spread) {
  c.save();
  c.scale(2.8, 2.8);
  colossusBody(c, p, false, spread);
  c.restore();
}
export function drawHeroLandedStatue(c, p) {
  c.save();
  c.translate(0, -76);
  c.scale(3.2, 3.2);
  colossusBody(c, p, true, 0.58);
  c.restore();
}
