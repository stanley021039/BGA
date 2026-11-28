import abilities from '../../../public/shared/boss-abilities.json' with { type: 'json' };
import { motionAllowed, watchMotionCancellation } from './motion-lifetime.js';

export const bossTransformMaterials = {
  mutalith: 'vortex',
  cthulhu: 'tentacles',
  gatanozoa: 'shell',
  arkveld: 'chains',
  greeza: 'rift',
  'hyper-zetton': 'ember',
  colossal: 'steam',
  'steel-behemoth': 'armor',
  'prismatic-void': 'prism',
  gyo: 'spores',
  'ghidorah-turtle': 'storm',
  'gleam-eyes': 'blades',
  'dark-zagi': 'eclipse',
};
export function bossTransformPlan(id, phase, remainingMs) {
  const duration = phase === 3 ? 780 : 660;
  const elapsed = Math.max(0, 2000 - (Number(remainingMs) || 0));
  if (![2, 3].includes(phase) || !bossTransformMaterials[id] || elapsed >= duration) return null;
  return {
    material: bossTransformMaterials[id],
    duration,
    elapsed,
    revealAt: phase === 3 ? 350 : 280,
    shards: phase === 3 ? 12 : 8,
  };
}
let materialSerial = 0;
// Directional light and etched geometry instead of filters, bitmaps or extra particles.
function buildMaterial(svg, id, phase, plan, spec) {
  const add = (tag, attrs, parent = svg) => {
    const el = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    parent.append(el);
    return el;
  };
  const color = spec?.color || 'currentColor',
    accent = spec?.accent || color;
  const tone = (source, light, saturation = 1) => {
    const match = /^#([a-f\d]{6})$/i.exec(source);
    if (!match) return source;
    const rgb = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
    const grey = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    return (
      '#' +
      rgb
        .map((v) => {
          const base = grey + (v - grey) * saturation;
          return Math.round(
            Math.max(
              0,
              Math.min(255, light < 1 ? base * light : base + (255 - base) * (light - 1)),
            ),
          )
            .toString(16)
            .padStart(2, '0');
        })
        .join('')
    );
  };
  const shadow = tone(color, 0.12, 0.35),
    dark = tone(color, 0.36, 0.65),
    mid = tone(color, 0.82, 0.55);
  const light = tone(accent, 1.76, 0.28),
    edge = tone(accent, 1.3, 0.72);
  const key = 'boss-material-' + ++materialSerial,
    defs = add('defs', {});
  function gradient(name, radial, stops, attrs = {}) {
    const g = add(
      radial ? 'radialGradient' : 'linearGradient',
      { id: key + '-' + name, ...attrs },
      defs,
    );
    for (const [offset, paint, opacity = 1] of stops)
      add('stop', { offset, 'stop-color': paint, 'stop-opacity': opacity }, g);
    return 'url(#' + key + '-' + name + ')';
  }
  const metal = gradient(
    'metal',
    false,
    [
      [0, dark],
      [0.29, mid],
      [0.44, light],
      [0.49, dark],
      [1, shadow],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 1 },
  );
  const core = gradient(
    'core',
    true,
    [
      [0, light],
      [0.21, tone(color, 1.25, 0.72)],
      [0.61, dark],
      [1, shadow],
    ],
    { cx: '.35', cy: '.28', r: '.75' },
  );
  const vapor = gradient(
    'vapor',
    true,
    [
      [0, tone(accent, 1.7, 0.08), 0.35],
      [0.24, tone(accent, 1.5, 0.1), 0.46],
      [0.61, tone(accent, 1.12, 0.12), 0.21],
      [1, tone(color, 0.45, 0.15), 0],
    ],
    { cx: '.36', cy: '.31', r: '.67' },
  );
  const skin = gradient(
    'skin',
    true,
    [
      [0, tone(color, 1.18, 0.85)],
      [0.28, tone(color, 0.74, 0.95)],
      [0.7, dark],
      [1, shadow],
    ],
    { cx: '.22', cy: '.22', r: '.9' },
  );
  const cocoon = add('g', {
    'data-cocoon': '',
    'transform-origin': '128px 128px',
    'data-material-detail': 'layered',
  });
  const material = plan.material;
  add(
    'ellipse',
    {
      cx: 128,
      cy: 128,
      rx: 89,
      ry: 100,
      fill: core,
      'fill-opacity': material === 'steam' ? 0.16 : material === 'vortex' ? 0.68 : 0.97,
      stroke: dark,
      'stroke-width': 0.7,
    },
    cocoon,
  );
  for (let i = 0; i < 6; i++) {
    const rotate = `rotate(${i * 60 + (i % 2 ? 3 : -2)} 128 128)`;
    const path = (d, fill = metal, stroke = shadow, width = 0.8, extra = {}) =>
      add('path', { d, fill, stroke, 'stroke-width': width, transform: rotate, ...extra }, cocoon);
    if (material === 'armor') {
      path('M119 23L153 31L169 51L158 103L130 124L99 103L91 48L105 30Z');
      path(
        'M107 34L119 30L146 37L158 54L149 91M100 52L109 98L130 113L151 97M115 44L140 49L139 59L116 54M119 78L144 82',
        'none',
        edge,
        0.9,
        { 'stroke-opacity': 0.65 },
      );
      path(
        'M109 43a2 2 0 1 0 .1 0M149 52a2 2 0 1 0 .1 0M115 98a1.6 1.6 0 1 0 .1 0M139 90h8m-7 4h6m-29-33l9 2m-6 4l5 1',
        'none',
        shadow,
        1.7,
      );
    } else if (['rift', 'prism', 'eclipse'].includes(material)) {
      path(
        material === 'eclipse'
          ? 'M126 13L172 31L191 59L152 57L132 122L116 62L77 48Z'
          : material === 'rift'
            ? 'M135 19L164 44L150 65L168 97L127 124L106 75L95 55Z'
            : 'M124 17L166 60L145 123L100 81L92 53Z',
        metal,
        shadow,
        0.6,
        { 'fill-opacity': 0.92 },
      );
      path('M124 21L130 113L147 64L160 58Z', light, 'none', 0, {
        'fill-opacity': material === 'prism' ? 0.31 : 0.13,
      });
      path('M112 46L130 62L120 79L133 103M140 42L132 68L149 89M105 65L123 62', 'none', edge, 0.65, {
        'stroke-opacity': 0.7,
      });
    } else if (material === 'chains') {
      path(
        'M117 23C94 33 98 71 116 80C137 89 154 51 139 32ZM119 34C130 24 141 45 131 62C121 82 106 51 119 34ZM118 64C95 73 100 109 121 116C145 123 155 84 140 72ZM123 76C137 69 141 91 131 103C117 114 108 86 123 76Z',
        metal,
        shadow,
        0.9,
        { 'fill-rule': 'evenodd' },
      );
      path(
        'M114 29Q99 50 115 72M137 36Q147 53 131 73M113 74Q100 95 120 109M138 80Q147 95 133 109',
        'none',
        light,
        1.2,
        { 'stroke-opacity': 0.7 },
      );
      path('M109 42l6 2m-6 6l5 1m17 32l7 2m-20 11l6 1m1-29l7 2', 'none', dark, 1.2);
    } else if (['tentacles', 'spores', 'shell'].includes(material)) {
      path(
        material === 'shell'
          ? 'M125 24C150 41 176 84 139 123L117 119C91 92 93 44 125 24Z'
          : 'M134 120C55 95 79 25 115 25C149 25 163 45 150 62C146 37 119 39 116 60C113 83 149 92 158 112Z',
        skin,
        shadow,
        0.9,
      );
      path(
        material === 'shell'
          ? 'M125 31Q111 76 135 115M113 45L127 51M106 60L128 66M105 80L130 85M111 97L134 102'
          : 'M109 34C82 50 93 90 136 110M114 40C102 56 108 79 133 94M118 54L128 57M120 64L132 68M126 77L140 84',
        'none',
        edge,
        0.85,
        { 'stroke-opacity': 0.55 },
      );
      path(
        material === 'spores'
          ? 'M99 46a7 10 0 1 0 1 0M113 76a5 7 0 1 0 1 0M138 100a4 5 0 1 0 1 0'
          : 'M96 57a3 4 0 1 0 .1 0M100 70a3 4 0 1 0 .1 0M107 83a3 4 0 1 0 .1 0M118 96a2 3 0 1 0 .1 0',
        'none',
        shadow,
        1.8,
      );
    } else if (material === 'steam') {
      for (const d of [
        'M104 15C74 9 72 43 91 49C65 57 78 82 107 80C138 79 150 55 132 43C145 19 119 9 104 15Z',
        'M121 51C92 32 84 70 101 83C72 103 92 132 119 120C135 143 165 110 147 93C173 74 145 51 121 51Z',
        'M91 88C65 83 54 112 77 127C63 150 89 170 108 146C143 155 149 120 124 113C126 92 105 80 91 88Z',
      ])
        path(d, vapor, 'none', 0, { 'fill-opacity': 0.74 + (i % 3) * 0.1 });
    } else if (material === 'vortex') {
      path('M127 26C219 18 227 148 154 164C89 182 65 114 112 86', 'none', core, 13, {
        'stroke-opacity': 0.84,
      });
      path('M126 28C206 23 220 137 157 156C100 176 73 118 112 89', 'none', edge, 1.1, {
        'stroke-opacity': 0.7,
      });
      path('M134 39C187 41 207 111 178 139M97 142Q89 117 103 103', 'none', shadow, 2.4);
    } else if (material === 'blades') {
      path('M127 15L138 89L132 122L123 122L116 89Z');
      path('M127 18L127 113L133 86Z', light, 'none', 0, { 'fill-opacity': 0.65 });
      path(
        'M120 88L135 88M122 94L134 94M124 99H132M121 61L124 67M129 41L133 62',
        'none',
        shadow,
        0.8,
      );
    } else if (material === 'storm') {
      path('M133 18L145 52L127 67L143 104L116 77L133 53L123 32Z', core, shadow, 0.6);
      path(
        'M131 22L138 51L122 65L137 96M125 63L104 70L112 87M138 51L157 43L151 35',
        'none',
        light,
        1.2,
      );
      path('M137 26L152 54L131 70L151 108', 'none', accent, 0.8, { 'stroke-opacity': 0.46 });
    } else {
      path(
        'M130 18C116 47 164 55 142 115C124 97 119 105 108 113C83 81 113 47 130 18Z',
        core,
        'none',
        0,
        { 'fill-opacity': 0.82 },
      );
      path('M130 34Q155 75 133 107Q139 78 119 61Q125 48 130 34Z', vapor, 'none', 0);
      path('M120 47Q107 77 120 98M136 56Q147 81 137 99', 'none', edge, 0.8, {
        'stroke-opacity': 0.52,
      });
    }
  }
  if (material !== 'steam') {
    const crack =
      'M93 42L118 78L111 109L139 144L127 181L149 215M118 78L144 91L155 76M111 109L83 123L76 148M139 144L170 130L192 142M127 181L104 189';
    add(
      'path',
      { d: crack, fill: 'none', stroke: shadow, 'stroke-width': phase === 3 ? 3 : 2 },
      cocoon,
    );
    add(
      'path',
      {
        d: crack,
        fill: 'none',
        stroke: edge,
        'stroke-width': phase === 3 ? 1.2 : 0.65,
        'stroke-opacity': 0.76,
      },
      cocoon,
    );
  }
  const wave = add('ellipse', {
    cx: 128,
    cy: 147,
    rx: 86,
    ry: 64,
    fill: 'none',
    stroke: edge,
    'stroke-width': phase === 3 ? 2 : 1,
    'stroke-opacity': 0.7,
    'data-shockwave': '',
  });
  const shards = [];
  for (let i = 0; i < plan.shards; i++) {
    const angle = (i * Math.PI * 2) / plan.shards,
      x = Math.cos(angle),
      y = Math.sin(angle);
    const shard = add('path', {
      d:
        material === 'steam'
          ? `M${128 + x * 65} ${128 + y * 65}q${x * 30 - y * 12} ${y * 30 + x * 12} ${x * 42} ${y * 42}q${-x * 18 - y * 20} ${-y * 18 + x * 20} ${-x * 42} ${-y * 42}Z`
          : `M${128 + x * 73} ${128 + y * 73}l${x * (19 + (i % 3) * 3) - y * 5} ${y * (19 + (i % 3) * 3) + x * 5}l${y * 9 - x * 4} ${-x * 9 - y * 4}Z`,
      fill: material === 'steam' ? vapor : i % 2 ? metal : core,
      stroke: material === 'steam' ? 'none' : dark,
      'stroke-width': 0.6,
    });
    shards.push({ shard, x, y });
  }
  return { cocoon, wave, shards };
}

const owners = new Set();
// Native SVG tracks only: <= 5 owners, 64 nodes and 18 tracks per owner, < 800ms.
export function playBossTransformation(node, id, phase, remainingMs, reveal = () => {}) {
  const plan = bossTransformPlan(id, phase, remainingMs);
  if (!node?.animate || !plan || !motionAllowed() || owners.size >= 5) {
    reveal();
    return null;
  }
  const doc = node.ownerDocument,
    ns = 'http://www.w3.org/2000/svg';
  const spec = abilities.find((a) => a.boss === id);
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('class', 'boss-transform-shell');
  svg.style.width = '130%';
  svg.style.height = '130%';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-boss-transform', plan.material);
  svg.setAttribute('data-transform-phase', String(phase));
  const { cocoon, wave, shards } = buildMaterial(svg, id, phase, plan, spec);
  node.append(svg);
  owners.add(svg);
  let live = true,
    shown = false,
    release = () => {},
    revealTimer,
    finishTimer;
  const tracks = [];
  const show = () => {
    if (!shown) {
      shown = true;
      reveal();
    }
  };
  const stop = () => {
    if (!live) return;
    live = false;
    clearTimeout(revealTimer);
    clearTimeout(finishTimer);
    for (const a of tracks) a.cancel();
    svg.remove();
    owners.delete(svg);
    release();
    show();
  };
  const animate = (target, frames) => {
    const a = target.animate?.(frames, { duration: plan.duration, fill: 'both', easing: 'linear' });
    if (a) {
      a.currentTime = plan.elapsed;
      tracks.push(a);
    }
  };
  animate(cocoon, [
    { opacity: 0, transform: 'scale(.35)' },
    { opacity: 1, transform: 'scale(1)', offset: 0.19 },
    { opacity: 1, transform: phase === 3 ? 'scale(1.13)' : 'scale(1.03)', offset: 0.44 },
    { opacity: 0, transform: 'scale(1.22)', offset: 0.6 },
    { opacity: 0, transform: 'scale(1.25)' },
  ]);
  animate(wave, [
    { opacity: 0, transform: 'scale(.3)', transformOrigin: '128px 147px' },
    { opacity: 0, transform: 'scale(.5)', offset: 0.44 },
    { opacity: 0.85, transform: 'scale(.85)', offset: 0.56 },
    { opacity: 0, transform: phase === 3 ? 'scale(1.8)' : 'scale(1.45)' },
  ]);
  for (const { shard, x, y } of shards)
    animate(shard, [
      { opacity: 0, transform: `translate(${x * 36}px,${y * 36}px)` },
      { opacity: 0.7, offset: 0.12 },
      { opacity: 0, transform: 'translate(0px,0px)', offset: 0.3 },
      { opacity: 0, transform: 'translate(0px,0px)', offset: 0.43 },
      { opacity: 1, offset: 0.5 },
      {
        opacity: 0,
        transform: `translate(${x * (phase === 3 ? 48 : 30)}px,${y * (phase === 3 ? 48 : 30)}px)`,
      },
    ]);
  revealTimer = setTimeout(show, Math.max(0, plan.revealAt - plan.elapsed));
  finishTimer = setTimeout(stop, plan.duration - plan.elapsed);
  release = watchMotionCancellation(stop);
  if (!live) release();
  return stop;
}
