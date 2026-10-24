/* Stitch 14297655819267599636 / 092b55de5a37454086c03f4b02a12971.
 * Finite adaptation of the reviewed artwork. Uses the caller's canvas and clock;
 * no additional canvas, animation loop, timer, input handler or network asset. */
const STITCH_EFFECTS = new Set([
  'chains',
  'sphere',
  'funnel',
  'explosion',
  'frost_spikes',
  'flame_kick',
]);
const TAU = Math.PI * 2;
const SPIKES = [
  [-90, 170, 50, -0.28, 0],
  [45, 210, 62, 0.18, 120],
  [-20, 280, 84, -0.05, 250],
  [110, 150, 46, 0.35, 400],
  [-130, 125, 38, -0.42, 540],
];
const DRAGOONS = [
  [-0.75, -0.85],
  [0.8, -0.55],
  [0.95, 0],
  [0.75, 0.65],
  [-0.65, 0.85],
  [-0.9, 0],
];
const BINDS = [
  [0, -26],
  [22, -16],
  [28, 4],
  [18, 26],
  [0, 32],
  [-18, 24],
  [-28, 2],
  [-20, -18],
];
const CHAIN_DELAYS = [0, 60, 150, 90, 210, 120, 30, 180];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (t) => 1 - (1 - clamp(t)) ** 3;

export function createStitchAttack(ctx, options, onImpact) {
  if (!STITCH_EFFECTS.has(options.effect)) return null;
  const { width, height, from } = options;
  const target = options.effect === 'sphere' ? from : options.to;
  const size = clamp(height / 420, 0.55, 1);
  const ground = Math.min(height - 12, target.y + 42 * size);
  const radius = Math.min(115, width * 0.22, height * 0.28);
  const state = { bloom: 18 }; // Artwork helper's local bloom, not global settings.
  let hit = false;
  function impact() {
    if (hit) return;
    hit = true;
    onImpact();
  }
  function line(x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function disc(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, radius), 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function flare(x, y, alpha, color = '#ffffff') {
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    line(x - 54 * size, y, x + 54 * size, y, color, 3);
    line(x, y - 54 * size, x, y + 54 * size, color, 3);
    disc(x, y, 5 * size, '#ffffff');
    ctx.restore();
  }
  function drawRho(t) {
    const fade = clamp((2200 - t) / 450),
      grow = ease(t / 250);
    ctx.translate(from.x, from.y);
    ctx.globalAlpha = fade;
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 16;
    for (let layer = 6; layer >= 0; layer--) {
      const r = (38 + layer * 11) * size * grow;
      ctx.save();
      ctx.rotate(t * 0.0012 * (layer % 2 ? -1 : 1) + layer * 0.2);
      ctx.beginPath();
      for (let petal = 0; petal < 7; petal++) {
        const a = (petal / 7) * TAU;
        if (!petal) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else
          ctx.quadraticCurveTo(
            Math.cos(a - Math.PI / 7) * r * 0.65,
            Math.sin(a - Math.PI / 7) * r * 0.65,
            Math.cos(a) * r,
            Math.sin(a) * r,
          );
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(244,114,182,.35)';
      ctx.fill();
      ctx.strokeStyle = '#fff1fa';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.0006;
      const r = (60 + ((t / 24 + i * 7) % 70)) * size;
      ctx.save();
      ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4 * size, 1.8 * size, 0, 0, TAU);
      ctx.fillStyle = '#f9a8d4';
      ctx.fill();
      ctx.restore();
    }
  }
  function drawChains(t) {
    const outer = Math.min(275, width * 0.4, height * 0.4);
    const fade = clamp((2200 - t) / 400);
    for (let n = 0; n < 8; n++) {
      const progress = ease((t - CHAIN_DELAYS[n]) / 400);
      if (!progress) continue;
      const a = -Math.PI / 2 + (n * Math.PI) / 4;
      const sx = target.x + Math.cos(a) * outer,
        sy = target.y + Math.sin(a) * outer;
      const ex = target.x + BINDS[n][0] * size,
        ey = target.y + BINDS[n][1] * size;
      const distance = Math.hypot(ex - sx, ey - sy),
        angle = Math.atan2(ey - sy, ex - sx);
      const count = Math.min(24, Math.floor((distance * progress) / (11 * size)));
      for (let k = 1; k <= count; k++) {
        const f = (k / Math.max(1, count)) * progress;
        const wave = Math.sin(f * Math.PI * 3 + t * 0.012) * (1 - f) * 13 * (1 - progress * 0.85);
        drawChainLink(
          ctx,
          sx + (ex - sx) * f - Math.sin(angle) * wave,
          sy + (ey - sy) * f + Math.cos(angle) * wave,
          angle,
          k % 2 === 0,
          fade,
        );
      }
    }
    if (t >= 620) {
      impact();
      flare(target.x, target.y, clamp(1 - (t - 620) / 200));
    }
  }
  function drawDragoons(t) {
    const travel = 850,
      charge = 450,
      fireStart = travel + charge;
    DRAGOONS.forEach(([dx, dy], n) => {
      const sx = from.x + (n % 2 ? 24 : -24) * size;
      const sy = from.y + (n - 2.5) * 14 * size;
      const ex = clamp(target.x + dx * radius, 24, width - 24);
      const ey = clamp(target.y + dy * radius, 24, height - 24);
      let x, y, angle;
      if (t < travel) {
        const f = ease(t / travel),
          cx = (sx + ex) / 2;
        const cy = clamp((sy + ey) / 2 + (n < 3 ? -1 : 1) * radius * 1.25, 12, height - 12);
        x = (1 - f) ** 2 * sx + 2 * (1 - f) * f * cx + f * f * ex;
        y = (1 - f) ** 2 * sy + 2 * (1 - f) * f * cy + f * f * ey;
        angle = Math.atan2(
          (1 - f) * (cy - sy) + f * (ey - cy),
          (1 - f) * (cx - sx) + f * (ex - cx),
        );
        line(x, y, x - Math.cos(angle) * 28 * size, y - Math.sin(angle) * 28 * size, '#00f0ff', 2);
      } else if (t < 1950) {
        x = ex;
        y = ey;
        angle = Math.atan2(target.y - y, target.x - x);
      } else {
        const f = ease((t - 1950) / 650);
        x = ex + (sx - ex) * f;
        y = ey + (sy - ey) * f;
        angle = Math.atan2(sy - ey, sx - ex);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      drawDragoonPod(
        0,
        0,
        angle,
        t < travel || t >= 1950 ? 1 : 0.2,
        t >= travel && t < fireStart,
        clamp((t - travel) / charge),
      );
      ctx.restore();
      const firing = t - (fireStart + n * 65);
      if (firing >= 0 && firing < 190) {
        ctx.save();
        ctx.globalAlpha = clamp(1 - firing / 190);
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#00f0ff';
        line(x, y, target.x, target.y, '#007aff', 10 * size);
        line(x, y, target.x, target.y, '#00f0ff', 5 * size);
        line(x, y, target.x, target.y, '#ffffff', 1.6 * size);
        ctx.restore();
        impact();
        flare(target.x, target.y, 1 - firing / 190);
      }
    });
  }
  function drawMushroom(t) {
    if (t < 450) {
      ctx.translate(target.x, target.y);
      ctx.rotate(t * 0.004);
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, (50 + (25 * t) / 450) * size, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = ((k % 6) / 6) * TAU;
        ctx.lineTo(Math.cos(a) * 65 * size, Math.sin(a) * 65 * size);
      }
      ctx.stroke();
      return;
    }
    impact();
    const age = t - 450,
      fade = clamp((2400 - t) / 600);
    const room = Math.max(36, ground - 18);
    const stem = Math.min(220 * size, room * 0.62) * ease(age / 650);
    const cap = Math.min(125 * size, room * 0.28) * ease(age / 850);
    const top = ground - stem;
    ctx.globalAlpha = fade;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#ff1a53';
    ctx.beginPath();
    ctx.moveTo(target.x - 28 * size, ground);
    ctx.lineTo(target.x - 18 * size, top);
    ctx.lineTo(target.x + 18 * size, top);
    ctx.lineTo(target.x + 28 * size, ground);
    ctx.closePath();
    ctx.fillStyle = '#ff2a5f';
    ctx.fill();
    const plume = ctx.createLinearGradient(0, ground, 0, top);
    plume.addColorStop(0, '#ff4400');
    plume.addColorStop(1, '#fff5a0');
    ctx.fillStyle = plume;
    ctx.fillRect(target.x - 10 * size, top, 20 * size, stem);
    for (let p = 0; p < 10; p++) {
      const a = (p / 10) * TAU,
        puff = cap * (0.49 + 0.025 * Math.sin(age * 0.006 + p));
      disc(
        target.x + Math.cos(a) * cap * 0.8,
        top + Math.sin(a) * cap * 0.44,
        puff,
        p % 2 ? '#ff2a5f' : '#ffbd24',
      );
    }
    disc(target.x, top, cap * 0.45, '#ffea00');
  }
  function drawIce(t) {
    const rise = Math.min(280 * size, ground - 14),
      scale = rise / 280;
    ctx.translate(target.x, ground);
    ctx.globalAlpha = clamp((2350 - t) / 500);
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 145 * size, 15 * size, 0, 0, TAU);
    ctx.fillStyle = 'rgba(2,132,199,.35)';
    ctx.fill();
    SPIKES.forEach(([x, h, w, tilt, delay]) => {
      const g = ease((t - delay) / 400);
      if (!g) return;
      if (t >= delay + 220) impact();
      ctx.save();
      ctx.translate(x * size, 0);
      ctx.rotate(tilt);
      const tip = -h * scale * g,
        half = (w * size) / 2;
      ctx.beginPath();
      ctx.moveTo(0, tip);
      ctx.lineTo(-half, 0);
      ctx.lineTo(0, tip * 0.16);
      ctx.closePath();
      ctx.fillStyle = '#075985';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, tip);
      ctx.lineTo(0, tip * 0.16);
      ctx.lineTo(half, 0);
      ctx.closePath();
      ctx.fillStyle = '#bae6fd';
      ctx.fill();
      ctx.strokeStyle = '#f0fdff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, tip);
      ctx.lineTo(half, 0);
      ctx.stroke();
      ctx.restore();
    });
  }
  function drawKick(t) {
    const angle = Math.atan2(target.y - from.y, target.x - from.x);
    if (t < 650) {
      const f = ease(t / 650),
        x = from.x + (target.x - from.x) * f;
      const y =
        from.y + (target.y - from.y) * f - Math.sin(f * Math.PI) * Math.min(100, height * 0.22);
      for (let k = 5; k >= 0; k--)
        disc(
          x - Math.cos(angle) * k * 10 * size,
          y - Math.sin(angle) * k * 10 * size,
          (16 - k * 2) * size,
          k % 2 ? '#ffea00' : '#ff6600',
        );
      drawBurningBootPrint(ctx, x, y, angle, size, 0.95);
      return;
    }
    impact();
    const age = t - 650;
    flare(target.x, target.y, clamp(1 - age / 300), '#ffea00');
    const dx = Math.cos(angle),
      dy = Math.sin(angle),
      margin = 56 * size;
    const roomX =
      Math.abs(dx) < 0.001 ? Infinity : ((dx > 0 ? width - margin : margin) - target.x) / dx;
    const roomY =
      Math.abs(dy) < 0.001 ? Infinity : ((dy > 0 ? height - margin : margin) - target.y) / dy;
    const advance = Math.max(0, Math.min(190 * size, width * 0.3, roomX, roomY)) * ease(age / 1100);
    const x = target.x + Math.cos(angle) * advance,
      y = target.y + Math.sin(angle) * advance;
    const alpha = clamp((2050 - t) / 600);
    for (let k = 1; k <= 5; k++) {
      ctx.save();
      ctx.globalAlpha = alpha * (1 - k / 6) * 0.65;
      disc(
        x - Math.cos(angle) * k * 12 * size,
        y - Math.sin(angle) * k * 12 * size,
        (18 - k * 2) * size,
        k % 2 ? '#ffea00' : '#ff4400',
      );
      ctx.restore();
    }
    drawBurningBootPrint(ctx, x, y, angle, size * (1 + age / 3500), alpha);
  }
  function drawDragoonPod(
    x,
    y,
    angle,
    thrusterAlpha = 1.0,
    isCharging = false,
    chargeProgress = 0,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 1. 尾部錐形藍白離子推進火焰
    if (thrusterAlpha > 0.05) {
      ctx.save();
      ctx.translate(-22, 0);
      const flameLen = (Math.random() * 12 + 18) * thrusterAlpha;
      const grad = ctx.createLinearGradient(0, 0, -flameLen, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#00f0ff');
      grad.addColorStop(0.8, '#0055ff');
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(-flameLen, 0);
      ctx.lineTo(0, 4.5);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#00f0ff';
      ctx.fill();
      ctx.restore();
    }

    // 2. 深鐵機甲裝甲外殼 (Dark Gunmetal Polygon)
    ctx.beginPath();
    ctx.moveTo(22, 0); // 砲口尖端
    ctx.lineTo(8, -8); // 上側甲板
    ctx.lineTo(-14, -8); // 上側後方
    ctx.lineTo(-20, -5); // 尾部推進環上角
    ctx.lineTo(-20, 5); // 尾部推進環下角
    ctx.lineTo(-14, 8); // 下側後方
    ctx.lineTo(8, 8); // 下側甲板
    ctx.closePath();

    const metalGrad = ctx.createLinearGradient(-20, -8, 22, 8);
    metalGrad.addColorStop(0, '#111827');
    metalGrad.addColorStop(0.45, '#1e293b');
    metalGrad.addColorStop(0.8, '#334155');
    metalGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = metalGrad;
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. 內嵌發光青藍能量刻線 (Cyan Engraved Glow Lines)
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f0ff';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-10, -3.5);
    ctx.lineTo(6, -3.5);
    ctx.lineTo(14, 0);
    ctx.lineTo(6, 3.5);
    ctx.lineTo(-10, 3.5);
    ctx.stroke();

    ctx.fillStyle = '#dbfcff';
    ctx.beginPath();
    ctx.arc(-2, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. 前端砲口聚能環與鏡頭 (Lens Nozzle)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(20, 0, 3, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f0ff';
    ctx.fill();
    ctx.restore();

    // 5. 充能階段：能量球收斂聚能 (Energy Convergence)
    if (isCharging) {
      ctx.save();
      ctx.translate(24, 0);
      const chargeRadius = (1 - chargeProgress) * 16 + 3;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, chargeRadius, 0, Math.PI * 2);
      ctx.stroke();

      for (let s = 0; s < 4; s++) {
        const sa = (s / 4) * Math.PI * 2 + chargeProgress * Math.PI * 2;
        const sx = Math.cos(sa) * chargeRadius * 1.5;
        const sy = Math.sin(sa) * chargeRadius * 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(0, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 4.5 * chargeProgress, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
  function drawChainLink(ctx, x, y, angle, isFacing, alpha = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    if (isFacing) {
      // 正面立體橢圓鏈環
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 4.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      // 銀鋼金屬高光邊緣線
      ctx.beginPath();
      ctx.ellipse(0.4, -0.4, 6.6, 3.6, 0, 0, Math.PI * 2);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#f8fafc';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#e2e8f0';
      ctx.stroke();

      // 鏈環內孔
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.8, 1.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#090d16';
      ctx.fill();
    } else {
      // 側面咬合交錯環
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 7.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#64748b';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-1.8, -6);
      ctx.lineTo(1.8, -6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ffffff';
      ctx.stroke();
    }

    ctx.restore();
  }
  function drawBurningBootPrint(ctx, x, y, angle, scale = 1.0, alpha = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // 高溫熾烈烈焰輝光外層 (Bloom)
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#ff3b00';

    // 1. 戰靴輪廓外底 (熾熱金黃漸層到深赤紅)
    const bootGrad = ctx.createLinearGradient(-34, -18, 38, 18);
    bootGrad.addColorStop(0, '#ff1a00');
    bootGrad.addColorStop(0.3, '#ff6600');
    bootGrad.addColorStop(0.65, '#ffea00');
    bootGrad.addColorStop(1, '#ffffff');

    ctx.beginPath();
    // 前掌前緣
    ctx.moveTo(36, 0);
    ctx.bezierCurveTo(36, -15, 24, -20, 8, -20); // 前掌外緣上
    ctx.bezierCurveTo(-2, -20, -10, -14, -16, -11); // 足弓收腰
    ctx.lineTo(-24, -13); // 鞋跟前緣上
    ctx.bezierCurveTo(-34, -13, -34, 13, -24, 13); // 厚實鞋跟弧底
    ctx.lineTo(-16, 11); // 鞋跟前緣下
    ctx.bezierCurveTo(-10, 14, -2, 20, 8, 20); // 足弓收腰下
    ctx.bezierCurveTo(24, 20, 36, 15, 36, 0); // 前掌外緣下
    ctx.closePath();

    ctx.fillStyle = bootGrad;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 2. 深刻防滑深刻齒紋 (Tread Grooves & Cross Lugs)
    ctx.save();
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';

    // 前掌橫向深刻人字防滑紋
    for (let gx = 0; gx < 4; gx++) {
      const lx = 4 + gx * 7.5;
      ctx.beginPath();
      ctx.moveTo(lx, -13 + gx * 1.5);
      ctx.lineTo(lx + 4, 0);
      ctx.lineTo(lx, 13 - gx * 1.5);
      ctx.stroke();
    }

    // 足弓過渡段凹槽
    ctx.beginPath();
    ctx.moveTo(-14, -9);
    ctx.lineTo(-14, 9);
    ctx.stroke();

    // 厚實鞋跟交錯防滑紋
    ctx.beginPath();
    ctx.moveTo(-22, -10);
    ctx.lineTo(-22, 10);
    ctx.moveTo(-29, -9);
    ctx.lineTo(-29, 9);
    ctx.moveTo(-31, 0);
    ctx.lineTo(-20, 0);
    ctx.stroke();
    ctx.restore();

    // 3. 內嵌白熾高溫核心
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(14, 0, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-25, 0, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
  return (elapsed) => {
    if (elapsed < 0 || elapsed > 2700) return;
    ctx.save();
    switch (options.effect) {
      case 'sphere':
        drawRho(elapsed);
        break;
      case 'chains':
        drawChains(elapsed);
        break;
      case 'funnel':
        drawDragoons(elapsed);
        break;
      case 'explosion':
        drawMushroom(elapsed);
        break;
      case 'frost_spikes':
        drawIce(elapsed);
        break;
      case 'flame_kick':
        drawKick(elapsed);
        break;
    }
    ctx.restore();
  };
}
