import { svgLayer, characterContour } from './arrival-svg.js';

const renderNames = [
  'gift-box',
  'hero-faceplant',
  'coffin-dance',
  'math-dimension',
  'heart-bubbles',
  'glass-break',
  'star-courier',
  'brush-creation',
  'delivery-scooter',
];
export const isArrival = (id) => id.startsWith('arrival-') && renderNames.includes(id.slice(8));
let instance = 0;

// The common apparate owner enforces the six-effect limit and motion lifetime.
// Animate the real image; independent front/back SVG layers keep occlusion.
export function playArrival(scene, id, duration) {
  const { anchor, img } = scene;
  if (!img || !img.naturalWidth) return () => {};
  const document = img.ownerDocument;
  const scale = scene.height / 87,
    suffix = 'arrival-' + ++instance;
  const makeLayer = (host, front = false) => {
    const node = host.ownerDocument.createElement('div');
    node.className = 'arrival-vector-layer';
    node.setAttribute('aria-hidden', 'true');
    Object.assign(node.style, {
      position: 'absolute',
      pointerEvents: 'none',
      width: '560px',
      height: '420px',
      left: scene.cx - 280 * scale + 'px',
      top: scene.feet - 340 * scale + 'px',
      transformOrigin: '0 0',
      transform: 'scale(' + scale + ')',
      zIndex: front ? '202' : '200',
    });
    host.append(node);
    return node;
  };
  const back = makeLayer(scene.layer),
    front = makeLayer(scene.host, true);
  const vfxBack = svgLayer(back, suffix + '-back', scene.paletteColors),
    vfxFront = svgLayer(front, suffix + '-front', scene.paletteColors);
  const actorPod = { style: {} },
    actorBody = { style: {} },
    actorShadow = { style: {} };
  const name = anchor.querySelector(':scope > span');
  const originals = new Map(),
    last = new Map();
  function write(node, prop, value) {
    if (!node) return;
    let record = originals.get(node);
    if (!record) {
      record = {};
      originals.set(node, record);
    }
    if (!(prop in record)) record[prop] = node.style[prop];
    node.style[prop] = value;
    let own = last.get(node);
    if (!own) {
      own = {};
      last.set(node, own);
    }
    own[prop] = node.style[prop];
  }
  const depth = anchor.animate?.([{ zIndex: 201 }, { zIndex: 201 }], { duration, fill: 'both' });
  let frame = 0,
    live = true,
    start = performance.now(),
    currentTimeMs = 0,
    lastDraw = start;
  const scaled = (value = '') => value.replace(/(-?[\d.]+)px/g, (_, n) => Number(n) * scale + 'px');
  const draw = (t) => {
    currentTimeMs = t;
    actorPod.style = {};
    actorBody.style = {};
    actorShadow.style = {};
    vfxBack.beginFrame();
    vfxFront.beginFrame();
    render(t);
    vfxBack.endFrame();
    vfxFront.endFrame();
    write(img, 'transformOrigin', '50% 100%');
    write(
      img,
      'transform',
      [scaled(actorPod.style.transform), scaled(actorBody.style.transform)]
        .filter(Boolean)
        .join(' ') || 'none',
    );
    write(
      img,
      'opacity',
      String(Number(actorPod.style.opacity ?? 1) * Number(actorBody.style.opacity ?? 1)),
    );
    write(img, 'filter', actorBody.style.filter || '');
    write(name, 'opacity', actorPod.style.opacity ?? '1');
    front.style.transform = (scene.layer.style.transform || '') + ' scale(' + scale + ')';
  };
  const stop = () => {
    if (!live) return;
    live = false;
    cancelAnimationFrame(frame);
    depth?.cancel();
    back.remove();
    front.remove();
    for (const [node, record] of originals)
      for (const [prop, value] of Object.entries(record))
        if (node.style[prop] === last.get(node)[prop]) {
          if (value) node.style[prop] = value;
          else node.style.removeProperty(prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
        }
  };
  const tick = (now) => {
    if (!live) return;
    if (!anchor.isConnected || !scene.host.isConnected || now - start >= duration) {
      stop();
      return;
    }
    if (now - lastDraw < 1000 / 60) {
      frame = requestAnimationFrame(tick);
      return;
    }
    lastDraw = now;
    try {
      draw(now - start);
    } catch {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  function renderVfxGiftBox(t) {
    actorPod.style.opacity = t < 1100 ? '0' : '1';

    if (t < 500) {
      const p = t / 500;
      const y = -320 * (1 - p);
      const squish = 1 + Math.sin(p * Math.PI) * 0.25;
      actorShadow.style.transform = `scale(${0.3 + p * 0.7})`;
      vfxFront.innerHTML = `
        <svg width="560" height="420" viewBox="0 0 560 420" fill="none">
          <g transform="translate(280, ${260 + y}) scale(${1 / squish}, ${squish}) translate(-280, -260)">
            <polygon points="335,200 375,175 375,260 335,285" fill="#ca8a04" stroke="#a16207" stroke-width="2"/>
            <polygon points="350,190 360,183 360,268 350,275" fill="#991b1b"/>
            <polygon points="215,200 335,200 335,285 215,285" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
            <rect x="265" y="200" width="20" height="85" fill="#dc2626"/>
            <polygon points="205,185 325,185 365,160 245,160" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
            <polygon points="205,185 325,185 325,200 205,200" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
            <polygon points="325,185 365,160 365,175 325,200" fill="#ca8a04" stroke="#ca8a04" stroke-width="2"/>
            <path d="M285 158 C265 140 250 145 260 160 C268 170 282 165 285 158 Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.5"/>
            <path d="M285 158 C305 140 320 145 310 160 C302 170 288 165 285 158 Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.5"/>
            <circle cx="285" cy="158" r="6" fill="#991b1b"/>
          </g>
        </svg>
      `;
    } else if (t < 1100) {
      const p = (t - 500) / 600;
      const shake = Math.sin(p * 38) * (6 + p * 10);
      const squish = 1 - Math.sin(p * 22) * 0.14;
      actorShadow.style.transform = `scale(${1 + Math.sin(p * 30) * 0.2})`;
      vfxFront.innerHTML = `
        <svg width="560" height="420" viewBox="0 0 560 420" fill="none">
          <g transform="translate(${280 + shake}, 260) scale(${1 / squish}, ${squish}) translate(-280, -260)">
            <polygon points="335,200 375,175 375,260 335,285" fill="#ca8a04" stroke="#a16207" stroke-width="2"/>
            <polygon points="215,200 335,200 335,285 215,285" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
            <rect x="265" y="200" width="20" height="85" fill="#dc2626"/>
            <polygon points="205,185 325,185 365,160 245,160" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
            <circle cx="285" cy="158" r="7" fill="#991b1b"/>
          </g>
        </svg>
      `;
    } else {
      const p = (t - 1100) / 1100;
      const jumpP = Math.min((t - 1100) / 550, 1);
      const jumpY = -Math.sin(jumpP * Math.PI) * 115;
      actorPod.style.transform = `translate(0px, ${jumpY}px)`;
      actorBody.style.transform = `scale(${1 + (1 - jumpP) * 0.15}, ${1 - (1 - jumpP) * 0.15})`;
      const lidY = -p * 260;
      const lidRot = p * 160;
      const fade = Math.max(0, 1 - p * 1.15);
      const surprises = Array.from({ length: 4 }, (_, i) => {
        const side = i % 2 ? -1 : 1,
          q = limit01(p * 1.4),
          x = 280 + side * (20 + q * (110 + i * 8)),
          y = 224 - Math.sin(q * Math.PI) * (90 + (i % 2) * 25) + q * q * 95 + (i < 2 ? -30 : 28),
          rot = side * q * (150 + i * 35);
        const icon =
          i < 2
            ? `<ellipse cx="0" cy="-16" rx="10" ry="12" fill="${i ? '#d5b8f4' : '#f4a6cf'}" stroke="#fff0f8" stroke-width="1.2"/><rect x="-5" y="-7" width="10" height="35" rx="5" fill="${i ? '#8270bd' : '#d86eaa'}" stroke="#f4d8ed" stroke-width="1"/><path d="M-4 -4H4" stroke="#fff4fb"/><circle cy="12" r="2" fill="#fff0f8"/>`
            : `<g fill="none" stroke="#c2d5e0" stroke-width="3.5"><ellipse cx="-14" cy="0" rx="10" ry="13"/><ellipse cx="17" cy="9" rx="10" ry="13"/><path d="M-4 1l6 -2 5 6" stroke-width="2.2"/></g><path d="M-21 -7Q-14 -15 -8 -8M10 2Q18 -6 24 3" stroke="#f7fcff" stroke-width="1.2" fill="none"/>`;
        return `<g transform="translate(${x},${y}) rotate(${rot})" opacity="${Math.min(1, (2200 - t) / 450)}">${icon}</g>`;
      }).join('');
      vfxBack.innerHTML = sceneSvg(surprises);

      vfxFront.innerHTML = `
        <svg width="560" height="420" viewBox="0 0 560 420" fill="none">
          <g opacity="${fade}" transform="translate(${280 + p * 80}, ${180 + lidY}) rotate(${lidRot})">
            <polygon points="-60,0 60,0 90,-22 -30,-22" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
            <polygon points="-60,0 60,0 60,14 -60,14" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
          </g>
          <g opacity="${fade}">
            <path d="M240 210 Q${210 - p * 60} ${170 - p * 80} ${230 - p * 100} ${120 - p * 100} T${180 - p * 120} ${80 - p * 110}" stroke="#ec4899" stroke-width="4.5" stroke-linecap="round" fill="none"/>
            <path d="M300 210 Q${340 + p * 70} ${180 - p * 90} ${320 + p * 100} ${130 - p * 100} T${370 + p * 120} ${70 - p * 110}" stroke="#3b82f6" stroke-width="4.5" stroke-linecap="round" fill="none"/>
            <path d="M270 200 Q${260} ${140 - p * 120} ${280} ${90 - p * 130} T${260} ${40 - p * 140}" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" fill="none"/>
          </g>
          <g opacity="${fade * (1 - p * 0.8)}">
            <polygon points="215,200 335,200 335,285 215,285" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
            <polygon points="335,200 375,175 375,260 335,285" fill="#ca8a04" stroke="#ca8a04" stroke-width="2"/>
          </g>
        </svg>
      `;
    }
  }

  // 2. 天降失誤 (2.8s 清場)
  function renderVfxFaceplant(t) {
    if (t < 700) {
      const p = limit01(t / 700),
        rush = p * p,
        dx = 95 * (1 - rush),
        dy = -300 * (1 - rush);
      actorPod.style.transform = `translate(${dx}px,${dy}px)`;
      actorBody.style.transform = `rotate(${-12 - 18 * p}deg) scale(${0.8 + 0.2 * p})`;
      actorShadow.style.transform = `scale(${0.2 + 0.8 * rush})`;
      const streaks = Array.from({ length: 14 }, (_, i) => {
        const x = 175 + i * 16,
          y = 100 + (i % 4) * 27 + p * 95;
        return `<path d="M${x + 38} ${y - 95}L${x} ${y}" stroke="${i % 3 ? '#9edfff' : '#fff0bc'}" stroke-width="${i % 3 ? 1.5 : 3}" opacity="${0.25 + 0.65 * p}"/>`;
      }).join('');
      vfxBack.innerHTML = sceneSvg(
        `<path d="M${280 + dx + 25} ${260 + dy - 120}L${280 + dx - 22} ${330 + dy}" stroke="#89d9ff" stroke-width="26" opacity=".15"/>${streaks}<ellipse cx="280" cy="342" rx="${55 * (1 - p) + 16}" ry="${12 * (1 - p) + 4}" stroke="#b3e9ff" opacity="${p}"/>`,
      );
      vfxFront.innerHTML = sceneSvg(`${sparkle(280 + dx, 277 + dy, 12, '#fff4cf', 1 - p * 0.5)}`);
    } else if (t < 1150) {
      const p = (t - 700) / 450,
        shock = Math.max(0, 1 - p * 3),
        shake = Math.sin(p * 65) * 7 * (1 - p);
      actorPod.style.transform = `translate(${shake}px,0)`;
      actorBody.style.transform = 'rotate(82deg) scale(1.22,.36)';
      actorShadow.style.transform = 'scale(1.7,.55)';
      const dust = Array.from({ length: 10 }, (_, i) => {
        const side = i % 2 ? -1 : 1,
          x = 280 + side * (25 + p * (55 + i * 5)),
          y = 339 - Math.sin(p * Math.PI) * (10 + (i % 3) * 9);
        return `<ellipse cx="${x}" cy="${y}" rx="${(7 + (i % 3) * 4) * (1 - p)}" ry="${(6 + (i % 3) * 3) * (1 - p)}" fill="#aab7c5" opacity="${(1 - p) * 0.65}"/>`;
      }).join('');
      vfxBack.innerHTML = sceneSvg(
        `<ellipse cx="280" cy="343" rx="${25 + p * 120}" ry="${5 + p * 17}" stroke="#e8e9d6" stroke-width="${4 * (1 - p)}" opacity="${1 - p}"/>${dust}<path d="M280 342l-35 -9 -16 7 -26 -9M280 342l30 -13 25 9 23 -11" stroke="#708193" opacity="${1 - p}"/>`,
      );
      vfxFront.innerHTML = sceneSvg(
        `<path d="M260 330l-21 -28 30 12 11 -30 11 30 29 -12 -22 28" stroke="#ffe5a0" stroke-width="${5 * shock}" opacity="${shock}"/>`,
      );
    } else if (t < 2250) {
      const p = outCubic((t - 1150) / 1100);
      actorBody.style.transform = `rotate(${82 * (1 - p)}deg) scale(${1.22 - 0.22 * p},${0.36 + 0.64 * p})`;
      actorPod.style.transform = `translateX(${Math.sin(p * 30) * 3 * (1 - p)}px)`;
    } else {
      const p = (t - 2250) / 550;
      actorBody.style.transform = `rotate(${Math.sin(p * Math.PI * 4) * 3 * (1 - p)}deg)`;
      vfxFront.innerHTML = sceneSvg(`${sparkle(321, 270, 4, '#fff0bd', Math.sin(p * Math.PI))}`);
    }
  }

  function renderVfxCoffinDance(t) {
    actorPod.style.opacity = t < 2100 ? '0' : '1';
    const lift = outCubic(t / 550),
      entry = outCubic(t / 900),
      exit = outCubic((t - 2600) / 900),
      fade = 1 - exit;
    const bounce = t < 2100 ? Math.sin(t * 0.016) * 4 : 0,
      sway = t < 2100 ? Math.sin(t * 0.009) * 5 : 0;
    const dx = 180 * (1 - entry) - exit * 245,
      cy = 305 - lift * 48 + bounce;
    const back = [185, 280, 375]
      .map((x, i) => renderFullChibiDancer(x + sway, 281 + bounce, i, lift))
      .join('');
    const front = [165, 260, 355]
      .map((x, i) => renderFullChibiDancer(x + sway, 303 + bounce, i + 3, lift))
      .join('');
    const lid = t < 2100 ? 0 : outCubic((t - 2100) / 450) * 72;
    vfxBack.innerHTML = sceneSvg(
      `<g transform="translate(${dx},0)" opacity="${fade}">${back}${render3DCoffin(280 + sway, cy, lid)}<text x="225" y="207" fill="#fbc36d" font-size="19">♪</text><text x="354" y="195" fill="#fbc36d" font-size="22">♫</text></g>`,
    );
    vfxFront.innerHTML = sceneSvg(
      `<g transform="translate(${dx},0)" opacity="${fade}">${front}</g>`,
    );
    if (t >= 2100) {
      const p = limit01((t - 2100) / 900);
      actorPod.style.transform = `translateY(${-Math.sin(p * Math.PI) * 130 - 48 * (1 - p)}px)`;
      actorBody.style.transform = `scale(${0.78 + 0.22 * outCubic(p)})`;
    }
  }

  function renderFullChibiDancer(x, y, seed, lift = 1) {
    const legPhase = (currentTimeMs * 0.015 + seed) % (Math.PI * 2);
    const legOffset = Math.sin(legPhase) * 4;
    return `
      <g transform="translate(${x}, ${y})">
        <path d="M-13 -36 H13 V-49 H-13 Z" fill="#090d16" stroke="#334155" stroke-width="1.5"/>
        <line x1="-18" y1="-36" x2="18" y2="-36" stroke="#090d16" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="-13" y="-39" width="26" height="3" fill="#f59e0b"/>
        <circle cx="0" cy="-24" r="10" fill="#451a03"/>
        <rect x="-8" y="-27" width="16" height="5" rx="2" fill="#000000" stroke="#475569" stroke-width="0.8"/>
        <path d="M-12 -14 H12 L10 14 H-10 Z" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
        <polygon points="-4,-14 4,-14 0,-4" fill="#ffffff"/>
        <polygon points="-3,-13 3,-13 0,-11" fill="#000000"/>
        <path d="M-12 -10 L-22 ${2 - lift * 29} L-13 ${6 - lift * 51}" stroke="#0f172a" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="-13" cy="${6 - lift * 51}" r="3.5" fill="#451a03"/>
        <path d="M12 -10 L22 ${2 - lift * 29} L13 ${6 - lift * 51}" stroke="#0f172a" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="13" cy="${6 - lift * 51}" r="3.5" fill="#451a03"/>
        <line x1="-5" y1="14" x2="${-6 + legOffset}" y2="30" stroke="#090d16" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="${-7 + legOffset}" cy="31" rx="5" ry="2.5" fill="#000000"/>
        <line x1="5" y1="14" x2="${6 - legOffset}" y2="30" stroke="#090d16" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="${7 - legOffset}" cy="31" rx="5" ry="2.5" fill="#000000"/>
      </g>
    `;
  }

  function render3DCoffin(cx, cy, lidSlide) {
    return `
      <g transform="translate(${cx}, ${cy})">
        <polygon points="-110,0 110,0 85,32 -85,32" fill="#381504" stroke="#78350f" stroke-width="2"/>
        <polygon points="-110,0 -85,32 -95,35 -125,0" fill="#260e02"/>
        <line x1="-90" y1="16" x2="90" y2="16" stroke="#451a03" stroke-width="2"/>
        <line x1="-105" y1="4" x2="105" y2="4" stroke="#fbbf24" stroke-width="2.5"/>
        <line x1="-80" y1="28" x2="80" y2="28" stroke="#d97706" stroke-width="2"/>
        <rect x="-85" y="10" width="18" height="6" rx="2" fill="#fde047" stroke="#b45309" stroke-width="1.2"/>
        <rect x="-9" y="10" width="18" height="6" rx="2" fill="#fde047" stroke="#b45309" stroke-width="1.2"/>
        <rect x="67" y="10" width="18" height="6" rx="2" fill="#fde047" stroke="#b45309" stroke-width="1.2"/>
        <g transform="translate(0, ${-lidSlide})">
          <polygon points="-120,-8 120,-8 105,4 -105,4" fill="#582106" stroke="#f59e0b" stroke-width="2"/>
          <line x1="-10" y1="-2" x2="10" y2="-2" stroke="#fde047" stroke-width="3"/>
          <line x1="0" y1="-7" x2="0" y2="3" stroke="#fde047" stroke-width="3"/>
        </g>
      </g>
    `;
  }

  // 4. 萬象演算 (3.2s 清場)
  // Choreography adapted from the approved Stitch design and later revisions.
  const sceneSvg = (content) =>
    `<svg width="560" height="420" viewBox="0 0 560 420" fill="none">${content}</svg>`;
  const limit01 = (n) => Math.max(0, Math.min(1, n));
  const outCubic = (n) => 1 - Math.pow(1 - limit01(n), 3);
  const starPoints = (r = 28, inner = r * 0.44) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        radius = i % 2 ? inner : r;
      return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
    }).join(' ');
  const sparkle = (x, y, r, colour, alpha = 1) =>
    `<path d="M${x - r} ${y}Q${x} ${y} ${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Z" fill="${colour}" opacity="${alpha}"/>`;

  function renderVfxMathDimension(t) {
    const colours = ['#79dfff', '#fff2c8', '#b5a2ff'];
    if (t < 3000) {
      if (t < 1800) actorPod.style.opacity = '0';
      const collapse = 1;
      const orbitFade = t < 2000 ? 1 : Math.max(0, 1 - (t - 2000) / 1000);
      const symbols = [
        '∑',
        '∫',
        'π',
        '√',
        '∞',
        '∂',
        'Δ',
        'λ',
        'f(x)',
        'd/dx',
        '[A]',
        'lim',
        '∇',
        'θ',
        'Ω',
        'eⁱπ',
        'α',
        'β',
        'x²',
        '1/2',
        '∮',
        'μ',
        'σ',
        '≡',
        '∀',
        '∈',
        'ℝ',
        '∏',
      ];
      const back = [],
        front = [];
      for (let ring = 0; ring < 3; ring++) {
        back.push(
          `<ellipse cx="280" cy="282" rx="${(125 - ring * 15) * collapse}" ry="${(38 + ring * 13) * collapse}" transform="rotate(${[-25, 15, 65][ring]} 280 282)" stroke="${colours[ring]}" opacity=".3" stroke-dasharray="3 7"/>`,
        );
      }
      symbols.forEach((symbol, i) => {
        const ring = i % 3,
          angle = t * (0.0035 + ring * 0.001) * (ring === 1 ? -1 : 1) + i * 2.399;
        const tilt = [-0.44, 0.26, 1.13][ring],
          r = 104 + ring * 16;
        const x = Math.cos(angle) * r,
          z = Math.sin(angle) * r,
          scale = 1 / (1 + z * 0.003);
        const px = 280 + (x * Math.cos(tilt) - z * 0.35 * Math.sin(tilt)) * scale * collapse;
        const py = 282 + (x * Math.sin(tilt) + z * 0.35 * Math.cos(tilt)) * scale * collapse;
        const text = `<text x="${px}" y="${py}" text-anchor="middle" fill="${colours[ring]}" font-size="${(12 + (i % 4) * 2) * scale * Math.max(0.4, collapse)}" opacity="${z > 0 ? 0.95 : 0.38}" font-family="Georgia,serif">${symbol}</text>`;
        (z < 0 ? back : front).push(text);
      });
      for (let i = 0; i < 6; i++) {
        const a = t * 0.002 + (i * Math.PI) / 3,
          x = 280 + Math.cos(a) * 120 * collapse,
          y = 282 + Math.sin(a) * 72 * collapse;
        const r = (10 + (i % 3) * 3) * collapse;
        front.push(
          `<g transform="translate(${x},${y}) rotate(${t * 0.08 + i * 20})" stroke="${colours[i % 3]}" stroke-width="1.1" opacity=".65"><path d="M${-r} ${-r * 0.5}L0 ${-r}L${r} ${-r * 0.5}V${r * 0.5}L0 ${r}L${-r} ${r * 0.5}ZM${-r} ${-r * 0.5}L0 0L${r} ${-r * 0.5}M0 0V${r}M0 ${-r}V0M${-r} ${r * 0.5}L0 0L${r} ${r * 0.5}"/></g>`,
        );
      }
      vfxBack.innerHTML = sceneSvg(`<g opacity="${orbitFade}">${back.join('')}</g>`);
      vfxFront.innerHTML = sceneSvg(`<g opacity="${orbitFade}">${front.join('')}</g>`);
    }
    if (t >= 1800) {
      const p = outCubic((t - 1800) / 1100);
      actorPod.style.transform = `translate(${50 * (1 - p)}px,${-180 * Math.pow(1 - p, 2)}px)`;
      actorBody.style.transform = `rotate(${720 * (1 - p)}deg)`;
    }
  }

  const heartOutline = 'M0 -5C-16 -24 -34 -5 -21 10L0 29L21 10C34 -5 16 -24 0 -5Z';
  function renderVfxHeartBubble(t) {
    const p = limit01(t / 1200),
      dy = -170 * (1 - outCubic(p));
    const fade = t < 1200 ? 1 : Math.max(0, 1 - (t - 1200) / 700);
    const back = [
      `<defs><radialGradient id="bubble-pearl"><stop stop-color="#ffe9f4" stop-opacity=".05"/><stop offset=".78" stop-color="#ff9ed1" stop-opacity=".16"/><stop offset="1" stop-color="#ffe2f2" stop-opacity=".65"/></radialGradient></defs>`,
    ];
    for (let i = 0; i < 17; i++) {
      const r = 10 + (i % 5) * 4,
        side = i % 2 ? -1 : 1;
      const x = 280 + side * (70 + (i % 4) * 26) + Math.sin(t * 0.002 + i) * 13;
      const y = 380 - ((t * 0.1 + i * 31) % 290),
        a = Math.min(1, t / 250) * fade;
      back.push(
        `<g transform="translate(${x},${y})" opacity="${a}">${i < 6 ? `<path d="${heartOutline}" transform="scale(${r / 24})" fill="url(#bubble-pearl)" stroke="#ffafd5" stroke-width="1.3"/>` : `<circle r="${r}" fill="url(#bubble-pearl)" stroke="#ffb8dd" stroke-width="1.1"/>`}<path d="M${-r * 0.55} ${-r * 0.55}Q${-r * 0.2} ${-r * 0.88} ${r * 0.25} ${-r * 0.73}" stroke="#fff6fc" stroke-width="2" stroke-linecap="round"/></g>`,
      );
    }
    vfxBack.innerHTML = sceneSvg(back.join(''));
    if (t < 1200) {
      const sway = Math.sin(p * Math.PI * 3) * 7;
      actorPod.style.transform = `translate(${sway}px,${dy}px)`;
      vfxFront.innerHTML = sceneSvg(
        `<g transform="translate(${280 + sway},${296 + dy})"><ellipse rx="58" ry="76" fill="#ffc4e4" fill-opacity=".10" stroke="#ffd3ea" stroke-width="2"/><path d="M-38 -47Q-24 -67 11 -65" stroke="#fff6fc" stroke-width="4" stroke-linecap="round"/><path d="M37 37Q47 15 44 -1" stroke="#f4b8ee" stroke-width="2" fill="none"/>${sparkle(42, -42, 5, '#fff6fc', 0.9)}</g>`,
      );
    } else {
      const q = limit01((t - 1200) / 700),
        hop = limit01((t - 1200) / 400);
      actorPod.style.transform = `translateY(${-Math.sin(hop * Math.PI) * 26}px)`;
      vfxFront.innerHTML = sceneSvg(
        Array.from({ length: 18 }, (_, i) => {
          const a = (i * Math.PI * 2) / 18,
            r = 15 + q * 95,
            x = 280 + Math.cos(a) * r,
            y = 296 + Math.sin(a) * r;
          return i % 4 === 0
            ? `<path d="${heartOutline}" transform="translate(${x},${y}) scale(.18)" fill="#ffb7d9" opacity="${fade}"/>`
            : `<ellipse cx="${x}" cy="${y}" rx="${2 + (i % 3)}" ry="${3 + (i % 2)}" fill="#ffd3e9" opacity="${fade}"/>`;
        }).join(''),
      );
    }
  }

  function renderVfxGlassBreak(t) {
    const beats = [180, 350, 520, 700, 880, 1080],
      pts = [
        [259, 279],
        [303, 285],
        [251, 303],
        [310, 260],
        [276, 285],
        [281, 286],
      ];
    const cracks = [];
    let fist = '',
      shake = 0;
    beats.forEach((at, i) => {
      if (t < at) return;
      const q = limit01((t - at) / 160),
        [x, y] = pts[i],
        hit = Math.max(0, 1 - q);
      shake += Math.sin(q * 30) * hit * (i === 5 ? 9 : 4);
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5 + i * 0.7,
          r = 23 + i * 7;
        cracks.push(
          `<path d="M${x} ${y}l${Math.cos(a) * r * 0.5} ${Math.sin(a) * r * 0.5}l${Math.cos(a + 0.3) * r * 0.5} ${Math.sin(a + 0.3) * r * 0.5}"/>`,
        );
      }
      if (q < 1)
        fist += `<g transform="translate(${x},${y}) scale(${0.7 + 0.7 * Math.sin(q * Math.PI)})" opacity="${hit}"><path d="M-15 10V-5Q-15 -12 -9 -10Q-8 -18 -3 -12Q1 -20 5 -12Q13 -17 14 -8L16 5L7 15H-7Z" fill="#e8ae76" stroke="#fff0c6" stroke-width="1.5"/><path d="M-7 -6V1M0 -8V0M7 -7V1" stroke="#a25d45"/><path d="M-24 -14L-37 -25M20 -15L33 -26M25 13L40 20" stroke="#c5f1ff" stroke-width="2"/></g>`;
    });
    if (t < 1200) {
      actorBody.style.filter = 'brightness(.28)';
      actorBody.style.transform = `translateX(${shake}px) scale(.94)`;
      vfxFront.innerHTML = sceneSvg(
        `<g transform="translate(${shake * 0.35},0)"><path d="M191 216L372 219L365 354L194 350Z" fill="#bfdff5" fill-opacity=".09" stroke="#99c6de" stroke-opacity=".6"/><path d="M202 219L358 219L194 338" fill="#c6edff" fill-opacity=".10"/><g stroke="#d7f4ff" stroke-width="1.3" fill="none">${cracks.join('')}</g>${fist}</g>`,
      );
    } else {
      const p = limit01((t - 1200) / 1200),
        step = outCubic((t - 1200) / 500),
        fade = 1 - p;
      actorPod.style.transform = `translate(${-18 * (1 - step)}px,${-Math.sin(step * Math.PI) * 18}px)`;
      actorBody.style.transform = `scale(${0.82 + 0.18 * step}) rotate(${-6 * (1 - step)}deg)`;
      vfxBack.innerHTML = sceneSvg(
        `<path d="M227 234L271 219L331 238L337 300L312 350L243 345L218 289Z" stroke="#678da7" stroke-width="7" opacity="${fade * 0.7}"/>`,
      );
      vfxFront.innerHTML = sceneSvg(
        Array.from({ length: 20 }, (_, i) => {
          const a = (i * Math.PI) / 10,
            r = 40 + outCubic(p) * (100 + (i % 3) * 22),
            x = 280 + Math.cos(a) * r,
            y = 286 + Math.sin(a) * r + p * p * 50;
          return `<g transform="translate(${x},${y}) rotate(${i * 31 + p * 190})" opacity="${fade}"><path d="M-12 -17L15 -9L6 18L-8 9Z" fill="#c8eaff" fill-opacity=".4" stroke="#effbff" stroke-width="1.4"/><path d="M-8 -13L8 -8L-5 5" stroke="#fff"/></g>`;
        }).join('') +
          `<ellipse cx="280" cy="286" rx="${20 + p * 150}" ry="${16 + p * 110}" stroke="#d4f6ff" stroke-width="${4 * (1 - p)}" opacity="${Math.max(0, 1 - p * 3)}"/>`,
      );
    }
  }

  function renderVfxStarCourier(t) {
    let dx = 0,
      dy = 0,
      sx = 0,
      sy = 365,
      tilt = 0;
    if (t < 900) {
      const p = outCubic(t / 900);
      dx = -280 * (1 - p);
      dy = -160 * (1 - p);
      tilt = 14;
      sx = dx;
      sy += dy;
    } else if (t < 1400) {
      const p = (t - 900) / 500;
      dx = 18 * Math.sin(p * Math.PI);
      tilt = -12 * Math.sin(p * Math.PI);
      sx = dx;
    } else {
      const p = limit01((t - 1400) / 700);
      dy = -Math.sin(limit01((t - 1400) / 400) * Math.PI) * 40;
      sx = outCubic(p) * 320;
      sy += p * 28;
    }
    actorPod.style.transform = `translate(${dx}px,${dy}px)`;
    actorBody.style.transform = `rotate(${tilt}deg)`;
    const fade = t < 1400 ? 1 : 1 - (t - 1400) / 700;
    const colours = ['#ff7886', '#ffb263', '#ffe27a', '#94deaa', '#88cbff', '#c1a1fa'];
    const trail = t < 1400 ? Math.min(1, t / 180) * (t < 900 ? 1 : 1 - (t - 900) / 500) : 0;
    vfxBack.innerHTML = sceneSvg(
      colours
        .map(
          (c, i) =>
            `<path d="M${280 + sx - 170} ${sy - 55 + i * 5}Q${280 + sx - 90} ${sy + 35 + i * 5} ${280 + sx - 8} ${sy - 5 + i * 5}" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity="${trail * 0.8}"/>`,
        )
        .join('') +
        Array.from({ length: 12 }, (_, i) =>
          sparkle(
            280 + sx - 25 - i * 12,
            sy - 25 + Math.sin(i * 2 + t * 0.005) * 28,
            2 + (i % 3),
            colours[i % 6],
            trail,
          ),
        ).join(''),
    );
    let smoke = '';
    if (t >= 900 && t < 1550) {
      const p = (t - 900) / 650;
      smoke = [-1, 1]
        .map(
          (side) =>
            `<path d="M${280 + side * 25} 376q${side * 55 * p} ${-45 * p} ${side * 65 * p} ${-10 * p}t${side * 20 * p} ${-23 * p}" stroke="#dce8f4" stroke-width="${7 * (1 - p)}" stroke-linecap="round" opacity="${0.55 * (1 - p)}"/>`,
        )
        .join('');
    }
    vfxFront.innerHTML = sceneSvg(
      `<g transform="translate(${280 + sx},${sy}) rotate(${tilt})" opacity="${fade}"><polygon points="${starPoints(31)}" transform="translate(2,5)" fill="#a86e23"/><polygon points="${starPoints(31)}" fill="#ffcf55" stroke="#f6e5a0" stroke-width="1.5"/><path d="M0 -27L-4 -6L-24 -7L-9 4L-14 24L0 10" stroke="#fff3b5" stroke-width="2" opacity=".7"/></g>${smoke}`,
    );
  }

  const PROTAGONIST_CONTOUR_PATH = characterContour(img);
  let contourGeometry;
  function brushGeometry() {
    if (!contourGeometry) {
      contourGeometry = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      contourGeometry.setAttribute('d', PROTAGONIST_CONTOUR_PATH);
    }
    return contourGeometry;
  }
  function renderVfxBrushCreation(t) {
    const path = brushGeometry(),
      length = path.getTotalLength(),
      p = limit01(t / 1300),
      point = path.getPointAtLength(length * p),
      next = path.getPointAtLength(Math.min(length, length * p + 1));
    const angle = (Math.atan2(next.y - point.y, next.x - point.x) * 180) / Math.PI + 35;
    const fade = t < 1450 ? 1 : Math.max(0, 1 - (t - 1450) / 950);
    const paintFill = limit01((t - 1000) / 400),
      strokeFade = 1 - limit01((t - 1500) / 400);
    const away = outCubic((t - 1450) / 700);
    const x = 239.5 + point.x + away * 130,
      y = 253 + point.y - away * 70;
    if (t < 1450) actorPod.style.opacity = '0';
    else {
      const hop = limit01((t - 1450) / 750);
      actorPod.style.transform = `translateY(${-Math.sin(hop * Math.PI) * 65}px)`;
      actorBody.style.transform = `scale(${0.9 + 0.1 * outCubic(hop)})`;
    }
    vfxBack.innerHTML = sceneSvg(
      `<g opacity="${fade}"><defs><linearGradient id="canvas-paper" x2="0" y2="1"><stop stop-color="#fff6de"/><stop offset="1" stop-color="#ead9b8"/></linearGradient><linearGradient id="portrait-fill" x2="0" y2="1"><stop stop-color="#e9bc58"/><stop offset=".45" stop-color="#deb17d"/><stop offset=".5" stop-color="#345c9d"/><stop offset="1" stop-color="#203659"/></linearGradient></defs><path d="M267 199L218 387M293 199L344 387M280 350V387" stroke="#674730" stroke-width="8" stroke-linecap="round"/><path d="M267 199L218 387M293 199L344 387" stroke="#ad7c4c" stroke-width="3"/><path d="M202 213H357V367H202Z" fill="#93623c" stroke="#cf9a5f" stroke-width="2"/><path d="M211 222H348V355H211Z" fill="url(#canvas-paper)"/><path d="M216 228H343M217 234H342M216 348H341" stroke="#a18c65" stroke-opacity=".15"/><path d="M199 368H361V376H199Z" fill="#bc8d57" stroke="#735137"/><path d="${PROTAGONIST_CONTOUR_PATH}" transform="translate(239.5 253)" fill="url(#portrait-fill)" opacity="${paintFill * strokeFade}"/></g><path d="${PROTAGONIST_CONTOUR_PATH}" transform="translate(239.5 253)" stroke="#75d5e7" stroke-width="2" stroke-linecap="round" stroke-dasharray="${length}" stroke-dashoffset="${length * (1 - p)}" opacity="${fade * strokeFade}"/>`,
    );
    vfxFront.innerHTML = sceneSvg(
      `<g transform="translate(${x},${y}) rotate(${angle})" opacity="${fade}"><path d="M-4 -39L-3 -126Q0 -132 4 -126L5 -39Z" fill="#9d673f" stroke="#593d2d" stroke-width="1.5"/><path d="M0 -120L1 -49M-2 -91L3 -83" stroke="#d3a070" stroke-width="1"/><path d="M-6 -42H7L8 -27H-7Z" fill="#a9bcc8" stroke="#e3edf2" stroke-width="1"/><path d="M-6 -27C-9 -16 -3 -7 0 0C5 -8 12 -17 7 -27Z" fill="#4b697b"/><path d="M-4 -26Q-6 -13 0 0M1 -27Q6 -15 0 0M5 -24Q9 -14 0 0" stroke="#82d4df" stroke-width="1.3"/></g>`,
    );
  }

  function renderVfxDeliveryScooter(t) {
    let dx = 0,
      dy = 8,
      lean = 0,
      bagOpen = 0,
      vehicleX = 0,
      fade = 1,
      helmet = false;
    actorPod.style.opacity = t < 1900 ? '0' : '1';
    if (t < 1700) {
      dx = -390 * Math.pow(1 - limit01(t / 650), 2);
      vehicleX = dx;
    } else {
      bagOpen = 1 - limit01((t - 1900) / 600);
      vehicleX = outCubic((t - 2550) / 750) * 370;
      fade = 1 - limit01((t - 2950) / 350);
      if (t >= 1900) {
        const p = limit01((t - 1900) / 1000),
          e = outCubic(p);
        actorPod.style.transform = `translate(${-52 * (1 - e)}px,${-45 * (1 - e) - 65 * Math.sin(p * Math.PI)}px)`;
        actorBody.style.transform = `scale(${0.7 + 0.3 * e})`;
      }
    }
    const brake = limit01((t - 650) / 400),
      bank = t >= 650 && t < 1050 ? -8 * Math.sin(brake * Math.PI) : 0;
    const wheelAngle = Math.min(t, 650) * 1.8 + Math.max(0, t - 2550) * 1.5;
    const wheelDetails = [218, 343]
      .map(
        (cx) =>
          `<g transform="translate(${cx},365)"><circle r="18" stroke="#46586a" stroke-width="1.1"/><circle r="12" stroke="#9eafbb" stroke-width="1.2" stroke-dasharray="2 3"/><g transform="rotate(${wheelAngle})">${Array.from({ length: 6 }, (_, i) => `<path d="M0 0L${Math.cos((i * Math.PI) / 3) * 15} ${Math.sin((i * Math.PI) / 3) * 15}" stroke="#9aaebc" stroke-width="1.6"/>`).join('')}</g><circle r="4" fill="#d9e5e9"/><path d="M8 -12L12 -7" stroke="#c46143" stroke-width="3"/></g>`,
      )
      .join('');
    const trim = `${wheelDetails}<path d="M327 340L338 358" stroke="#dce3df" stroke-width="4"/><path d="M326 341l7 2 -3 4 7 2 -3 4 7 2" stroke="#687f8e" stroke-width="2"/><path d="M204 342L217 346" stroke="#ff6e59" stroke-width="5"/><path d="M231 354L265 360" stroke="#a7b4b9" stroke-width="7" stroke-linecap="round"/><path d="M235 353L263 358" stroke="#e0ebed" stroke-width="2"/><path d="M267 351H301" stroke="#203345" stroke-width="5"/><path d="M331 287L329 268M350 289L359 274" stroke="#afc2cc" stroke-width="2.5"/><ellipse cx="327" cy="265" rx="9" ry="5" fill="#80aec1" stroke="#d0e1e8" transform="rotate(-12 327 265)"/><ellipse cx="361" cy="271" rx="8" ry="5" fill="#80aec1" stroke="#d0e1e8" transform="rotate(15 361 271)"/><path d="M251 330Q267 330 280 343" stroke="#f4c29b" stroke-width="2"/><path d="M316 328V346M320 325V344" stroke="#765443" stroke-width="1.5"/><path d="M212 280V318M237 280L243 317" stroke="#1d514d" stroke-width="4"/><rect x="214" y="299" width="25" height="13" rx="3" fill="#b6cbb8"/><path d="M220 306l5 -4 6 4 -6 4Z" fill="#357a72"/><path d="M246 291l8 2 -1 7" stroke="#d5c68d" stroke-width="1.7"/>`;
    const rush =
      t < 650
        ? Array.from(
            { length: 12 },
            (_, i) =>
              `<path d="M${60 + (i % 3) * 19} ${282 + i * 8}H${155 + (i % 4) * 13}" stroke="${i % 3 ? '#b5d9e7' : '#ffe3a1'}" stroke-width="${i % 3 ? 1.2 : 2.5}" opacity="${Math.sin(limit01(t / 650) * Math.PI) * 0.8}"/>`,
          ).join('')
        : '';
    const smoke =
      t >= 650 && t < 1200
        ? Array.from({ length: 6 }, (_, i) => {
            const p = (t - 650) / 550;
            return `<ellipse cx="${215 - p * (25 + i * 10)}" cy="${378 - Math.sin(p * Math.PI) * (8 + (i % 3) * 4)}" rx="${(5 + (i % 3) * 3) * (1 - p)}" ry="${(4 + (i % 2) * 4) * (1 - p)}" fill="#c5d6df" opacity="${(1 - p) * 0.5}"/>`;
          }).join('')
        : '';
    const bike = `<g transform="translate(${vehicleX},0)" opacity="${fade}"><g fill="#172132" stroke="#6a7a8d" stroke-width="2.2"><circle cx="218" cy="365" r="22"/><circle cx="343" cy="365" r="22"/></g><g fill="#d6dee5" stroke="#526070"><circle cx="218" cy="365" r="10"/><circle cx="343" cy="365" r="10"/></g><path d="M218 365L251 330H307L343 365M249 330L275 360H319L324 317" stroke="#7d91a3" stroke-width="6" fill="none"/><path d="M231 337Q243 321 266 325L283 344H319L330 314L343 317L339 353H256L244 347H225Z" fill="#c77b53" stroke="#e7ac7c" stroke-width="2"/><path d="M323 319L335 286L350 287" stroke="#a6b7c4" stroke-width="4"/><rect x="250" y="316" width="57" height="9" rx="4" fill="#202734"/><path d="M328 303L342 302L347 311L331 313Z" fill="#fff1ab" stroke="#c6a065"/><path d="M202 278L244 278L251 320L202 320Z" fill="#357a72" stroke="#a1c2aa" stroke-width="1.5"/><path d="M244 278L260 286L265 320L251 320Z" fill="#245c59" stroke="#5f9690"/><path d="M202 278L217 267L259 275L244 278Z" fill="#73a395"/><path d="M208 286H240M211 291H240" stroke="#d5d3a5" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M210 279Q227 ${272 - bagOpen * 28} 247 279" stroke="#cadbcd" stroke-width="3"/><path d="M260 365H307" stroke="#b2b8b7" stroke-width="3"/>${t > 650 && t < 1200 ? `<path d="M193 376q-32 -20 -41 -2t-21 -9" stroke="#d1deeb" opacity="${((1200 - t) / 550) * 0.55}" stroke-width="5" fill="none"/>` : ''}${trim}</g>`;
    const rider = `<g transform="translate(${vehicleX + 283},303)" opacity="${fade}"><path d="M-12 -8Q-18 0 -14 24L10 26L16 8L6 -9Z" fill="#c64f4f" stroke="#f29d85" stroke-width="1.5"/><path d="M-9 23L-13 40L8 42M8 24L20 36L35 36" fill="none" stroke="#273d55" stroke-width="8" stroke-linecap="round"/><path d="M7 -2L25 10L48 -3" fill="none" stroke="#c64f4f" stroke-width="6" stroke-linecap="round"/><circle cx="48" cy="-3" r="4" fill="#e8ad83"/><circle cy="-20" r="15" fill="#e8ad83"/><path d="M-17 -20Q-17 -44 1 -44Q20 -43 18 -19L10 -13H-11Z" fill="#e7e9ec" stroke="#91a9b8" stroke-width="1.5"/><path d="M-8 -28H18L15 -17H-8Z" fill="#486981" fill-opacity=".85"/><path d="M-12 -36H3" stroke="#da5250" stroke-width="4"/></g>`;
    vfxBack.innerHTML = sceneSvg(
      rush + `<g transform="rotate(${bank} 280 365)">${bike + rider + smoke}</g>`,
    );
    let front = '';
    if (helmet) {
      const hx = 280 + dx + Math.sin((-lean * Math.PI) / 180) * 50;
      front += `<g transform="translate(${hx},286)"><path d="M-17 0Q-18 -24 0 -24Q19 -23 18 1L10 6H-12Z" fill="#eac26b" stroke="#fff0bc" stroke-width="1.3"/><path d="M-14 -4H15L12 5H-11Z" fill="#547181" fill-opacity=".65"/><path d="M-7 -19Q0 -23 8 -18" stroke="#fff2ce" stroke-width="2" fill="none"/></g>`;
    }
    if (t >= 1700 && t < 2300)
      front += `<path d="M202 285L246 285L251 320L202 320Z" fill="#357a72" stroke="#9abca9"/><path d="M207 288H241" stroke="#e6d6a3" stroke-width="2" stroke-dasharray="2 2"/>`;
    vfxFront.innerHTML = sceneSvg(front);
  }

  const render = [
    renderVfxGiftBox,
    renderVfxFaceplant,
    renderVfxCoffinDance,
    renderVfxMathDimension,
    renderVfxHeartBubble,
    renderVfxGlassBreak,
    renderVfxStarCourier,
    renderVfxBrushCreation,
    renderVfxDeliveryScooter,
  ][renderNames.indexOf(id.replace(/^arrival-/, ''))];
  if (!render) {
    stop();
    return stop;
  }
  try {
    draw(0);
    frame = requestAnimationFrame(tick);
  } catch {
    stop();
  }
  return stop;
}
