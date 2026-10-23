/* Adapted from user 123.zip / anime_vfx_lab_15_2 Canvas artwork.
 * Arena UI, dummy damage/physics, global inputs, screen shake/flash and auto-demo removed.
 * Each instance is bounded, transparent, and owns its animation frame and timers. */
export function playAttackArtwork(surface, options) {
  const canvas = { width: options.width, height: options.height },
    ctx = surface.getContext('2d');
  if (!ctx) return () => {};
  const quality = Math.min(1, 1280 / canvas.width, 900 / canvas.height);
  surface.width = Math.max(1, Math.round(canvas.width * quality));
  surface.height = Math.max(1, Math.round(canvas.height * quality));
  ctx.setTransform(quality, 0, 0, quality, 0, 0);
  const from = options.from,
    to = options.to,
    timers = new Set();
  let stopped = false,
    frame = 0;
  function later(callback, ms) {
    if (stopped) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!stopped) callback();
    }, ms);
    timers.add(timer);
  }
  function triggerScreenShake() {}
  function triggerScreenFlash() {}
  const state = {
    activeSkill: options.effect,
    filter: 'all',
    dummyActive: true,
    dummyHp: 100000,
    dummyMaxHp: 100000,
    dummyPos: { x: 0, y: 0, vx: 0, vy: 0, baseX: 0, baseY: 0 },
    combo: 124,
    autoDemo: false,
    color: options.color,
    isRainbow: false,
    speed: 1.5,
    bloom: 1.2,
    particleBudget: 220,
    scale: Math.min(1, options.width / 650),
    barrageMode: 'focus',
    funnelMode: 'circle',
    funnelCount: 4,
    singularityPull: 2.2,
    singularityRadius: 40,
    bladeArc: 1.4,
    lightningBranches: 4,
    frostSpikesCount: 7,
    arrowDensity: 12,
    vortexAngleSpeed: 0.12,
    screenShake: false,
    flash: false,
    showDamageNumbers: options.effect === 'damage_text',
    mouse: { x: 0, y: 0, down: false, holdTime: 0 },
  };

  state.mouse.x = from.x;
  state.mouse.y = from.y;
  state.dummyPos = { x: to.x, y: to.y, baseX: to.x, baseY: to.y, vx: 0, vy: 0 };
  let particles = [];
  let shockwaves = [];
  let damageNumbers = [];
  let activeBeams = [];
  let activeShields = [];
  let magicCircles = [];
  let orbitalBeams = [];
  let funnels = [];
  let blackHoles = [];
  let chains = [];
  let spaceDebris = [];
  let bladeWaves = [];
  let lightningBolts = [];
  let frostSpikes = [];
  let arrowVolleys = [];
  let flameVortices = [];
  function initDebris(count = 50) {
    spaceDebris = [];
    for (let i = 0; i < count; i++) {
      spaceDebris.push({
        x: Math.random() * (canvas.width || 800),
        y: Math.random() * (canvas.height || 600),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 1.2,
        color: Math.random() > 0.5 ? '#a855f7' : Math.random() > 0.5 ? '#00f0ff' : '#ff3366',
      });
    }
  }
  function getVFXColor() {
    if (state.isRainbow) return `hsl(${(Date.now() / 8) % 360}, 100%, 65%)`;
    return state.color;
  }
  function getDummyTarget() {
    return { x: state.dummyPos.x, y: state.dummyPos.y, radius: 46 };
  }
  function spawnDamageNumber(x, y, isCrit = false, customAmount = null) {
    if (!state.showDamageNumbers) return;
    const amount =
      customAmount !== null
        ? customAmount
        : isCrit
          ? Math.floor(Math.random() * 35000 + 18000)
          : Math.floor(Math.random() * 4500 + 1200);
    damageNumbers.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 30,
      vy: -3.0 - Math.random() * 2,
      vx: (Math.random() - 0.5) * 2.5,
      text: amount.toLocaleString(),
      isCrit: isCrit,
      life: 1.0,
    });
  }
  function initFunnels() {
    funnels = [];
    const count = state.funnelCount || 6;
    for (let i = 0; i < count; i++) {
      funnels.push({
        id: i,
        x: from.x,
        y: from.y,
        targetOffsetAngle: (i / count) * Math.PI * 2,
        recoilX: 0,
        recoilY: 0,
        charging: false,
        chargeGlow: 0,
      });
    }
  }
  function updateAndDrawFunnels() {
    const anchorX = from.x;
    const anchorY = from.y;
    const dummy = getDummyTarget();
    const fireTargetX = state.dummyActive ? dummy.x : anchorX + 260;
    const fireTargetY = state.dummyActive ? dummy.y : anchorY;

    const count = funnels.length;
    funnels.forEach((f, idx) => {
      let desiredX = anchorX,
        desiredY = anchorY;
      if (state.funnelMode === 'circle') {
        const orbitR = 90 * state.scale;
        const curAngle = f.targetOffsetAngle + Date.now() * 0.0015 * state.speed;
        desiredX = anchorX + Math.cos(curAngle) * orbitR;
        desiredY = anchorY + Math.sin(curAngle) * orbitR;
      } else if (state.funnelMode === 'wing') {
        const isLeft = idx % 2 === 0;
        const tier = Math.floor(idx / 2) + 1;
        desiredX = anchorX - tier * 45 * state.scale;
        desiredY = anchorY + (isLeft ? -1 : 1) * tier * 40 * state.scale;
      } else {
        const side = idx < count / 2 ? -1 : 1;
        const row = (idx % Math.ceil(count / 2)) - 1;
        desiredX = fireTargetX - 140 * state.scale;
        desiredY = fireTargetY + side * 85 * state.scale + row * 38;
      }

      f.x += (desiredX + f.recoilX - f.x) * 0.12;
      f.y += (desiredY + f.recoilY - f.y) * 0.12;
      f.recoilX *= 0.85;
      f.recoilY *= 0.85;

      const aimAngle = Math.atan2(fireTargetY - f.y, fireTargetX - f.x);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(aimAngle);
      ctx.fillStyle = '#191b24';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-14, -5);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-14, 5);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = f.charging ? '#ffffff' : '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = f.charging ? 18 : 6;
      ctx.beginPath();
      ctx.arc(3, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (f.charging) {
        f.chargeGlow += 0.08;
        if (f.chargeGlow >= 1.0) {
          f.charging = false;
          f.chargeGlow = 0;
          f.recoilX = -Math.cos(aimAngle) * 18;
          f.recoilY = -Math.sin(aimAngle) * 18;
          activeBeams.push({
            startX: f.x + Math.cos(aimAngle) * 15,
            startY: f.y + Math.sin(aimAngle) * 15,
            targetX: fireTargetX + (Math.random() - 0.5) * 20,
            targetY: fireTargetY + (Math.random() - 0.5) * 20,
            color: state.color,
            width: 14 * state.scale,
            life: 0.6,
            decay: 0.05,
          });
          triggerScreenShake(4);
          spawnDamageNumber(fireTargetX, fireTargetY, Math.random() < 0.4);
        }
      }
    });
  }
  function triggerFunnelBarrage() {
    funnels.forEach((f, idx) => {
      later(() => {
        f.charging = true;
        f.chargeGlow = 0;
      }, idx * 75);
    });
  }
  function spawnBlackHole(x, y) {
    blackHoles.push({
      x: x,
      y: y,
      radius: state.singularityRadius * state.scale,
      pullForce: state.singularityPull,
      rotation: 0,
      life: 1.0,
      decay: 0.0065,
      absorbedCount: 0,
    });
  }
  function updateAndDrawSingularities() {
    for (let i = blackHoles.length - 1; i >= 0; i--) {
      const bh = blackHoles[i];
      bh.rotation += 0.04 * state.speed;
      if (state.mouse.down && state.activeSkill === 'singularity') {
        bh.x += (state.mouse.x - bh.x) * 0.2;
        bh.y += (state.mouse.y - bh.y) * 0.2;
      } else {
        bh.life -= bh.decay;
      }

      spaceDebris.forEach((deb) => {
        const dx = bh.x - deb.x,
          dy = bh.y - deb.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 340 * state.scale) {
          const angle = Math.atan2(dy, dx);
          const perpAngle = angle + Math.PI / 2;
          const force = (bh.pullForce * 40) / Math.max(dist, 25);
          deb.vx += Math.cos(angle) * force + Math.cos(perpAngle) * (force * 0.6);
          deb.vy += Math.sin(angle) * force + Math.sin(perpAngle) * (force * 0.6);
          if (dist < bh.radius * 0.7) {
            deb.x = Math.random() > 0.5 ? 0 : canvas.width;
            deb.y = Math.random() * canvas.height;
            deb.vx = (Math.random() - 0.5) * 2;
            deb.vy = (Math.random() - 0.5) * 2;
            bh.absorbedCount++;
            if (bh.absorbedCount % 5 === 0)
              spawnDamageNumber(bh.x, bh.y, false, Math.floor(Math.random() * 800 + 400));
          }
        }
      });

      ctx.save();
      ctx.translate(bh.x, bh.y);
      for (let ring = 0; ring < 3; ring++) {
        ctx.save();
        ctx.rotate(bh.rotation * (ring % 2 === 0 ? 1 : -1) + ring);
        ctx.strokeStyle = ring === 0 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          bh.radius * 2.2 + ring * 10,
          bh.radius * 0.8 + ring * 5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#020308';
      ctx.beginPath();
      ctx.arc(0, 0, bh.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 24 * state.bloom;
      ctx.stroke();
      ctx.restore();

      if (bh.life <= 0) {
        triggerScreenShake(20);
        triggerScreenFlash(0.5);
        triggerShockwave(bh.x, bh.y, '#a855f7');
        spawnDamageNumber(bh.x, bh.y, true, 99999);
        blackHoles.splice(i, 1);
      }
    }

    spaceDebris.forEach((deb) => {
      deb.x += deb.vx;
      deb.y += deb.vy;
      deb.vx *= 0.98;
      deb.vy *= 0.98;
      ctx.fillStyle = deb.color;
      ctx.fillRect(deb.x, deb.y, deb.size, deb.size);
    });
  }
  function startExplosionChant(x, y) {
    magicCircles.push({
      x: x,
      y: y,
      chantProgress: 0.05,
      rotationOuter: 0,
      rotationInner: 0,
      finished: false,
    });
  }
  function updateAndDrawMagicCircles() {
    for (let i = magicCircles.length - 1; i >= 0; i--) {
      const mc = magicCircles[i];
      mc.rotationOuter += 0.02 * (1 + mc.chantProgress * 2);
      mc.rotationInner -= 0.035 * (1 + mc.chantProgress * 2);
      const curRadius = (60 + mc.chantProgress * 120) * state.scale;

      ctx.save();
      ctx.translate(mc.x, mc.y);
      ctx.save();
      ctx.rotate(mc.rotationOuter);
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 15 * state.bloom;
      ctx.beginPath();
      ctx.arc(0, 0, curRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(mc.rotationInner);
      ctx.strokeStyle = '#ffd556';
      ctx.lineWidth = 2;
      for (let poly = 0; poly < 2; poly++) {
        ctx.beginPath();
        const pOffset = (poly * Math.PI) / 3;
        for (let p = 0; p < 3; p++) {
          const pa = (p / 3) * Math.PI * 2 + pOffset;
          const px = Math.cos(pa) * (curRadius * 0.72);
          const py = Math.sin(pa) * (curRadius * 0.72);
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();

      if (mc.finished) magicCircles.splice(i, 1);
    }
  }
  function detonateExplosionMagic(mc) {
    if (!mc) return;
    mc.finished = true;
    triggerShockwave(mc.x, mc.y, '#ff3366');
    spawnDamageNumber(mc.x, mc.y, true, 225000);
  }
  function updateAndDrawBeams() {
    for (let i = activeBeams.length - 1; i >= 0; i--) {
      const b = activeBeams[i];
      b.life -= b.decay;
      if (b.life <= 0) {
        activeBeams.splice(i, 1);
        continue;
      }

      ctx.save();
      if (state.activeSkill === 'beam') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.startX, b.startY - 35);
        ctx.lineTo(b.startX, b.startY + 35);
        ctx.moveTo(b.startX - 35, b.startY);
        ctx.lineTo(b.startX + 35, b.startY);
        ctx.stroke();
      }
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * b.life;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 24 * state.bloom;
      ctx.beginPath();
      ctx.moveTo(b.startX, b.startY);
      ctx.lineTo(b.targetX, b.targetY);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.width * 0.4 * b.life;
      ctx.beginPath();
      ctx.moveTo(b.startX, b.startY);
      ctx.lineTo(b.targetX, b.targetY);
      ctx.stroke();
      ctx.restore();
    }
  }
  function spawnShield(x, y) {
    activeShields.push({
      type: 'hex',
      x: x,
      y: y,
      radius: 95 * state.scale,
      color: state.color,
      life: 1.0,
      decay: 0.015,
    });
    triggerScreenShake(4);
  }
  function updateAndDrawShields() {
    for (let i = activeShields.length - 1; i >= 0; i--) {
      const s = activeShields[i];
      s.life -= s.decay;
      if (s.life <= 0) {
        activeShields.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 16 * state.bloom;
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ha = (h / 6) * Math.PI * 2;
        const bx = Math.cos(ha) * s.radius,
          by = Math.sin(ha) * s.radius;
        if (h === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
  function spawnChain(x1, y1, x2, y2) {
    chains.push({ x1, y1, x2, y2, color: state.color, segments: 16, life: 1.0, decay: 0.02 });
    if (state.dummyActive) {
      const dummy = getDummyTarget();
      if (Math.hypot(x2 - dummy.x, y2 - dummy.y) < 140) {
        state.dummyPos.vx += (x1 - dummy.x) * 0.08;
        state.dummyPos.vy += (y1 - dummy.y) * 0.08;
        spawnDamageNumber(dummy.x, dummy.y, false, 3200);
      }
    }
  }
  function updateAndDrawChains() {
    for (let i = chains.length - 1; i >= 0; i--) {
      const c = chains[i];
      c.life -= c.decay;
      if (c.life <= 0) {
        chains.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      for (let seg = 1; seg < c.segments; seg++) {
        const t = seg / c.segments;
        const sag = Math.sin(t * Math.PI) * (20 * Math.sin(Date.now() * 0.02));
        ctx.lineTo(c.x1 + (c.x2 - c.x1) * t, c.y1 + (c.y2 - c.y1) * t + sag);
      }
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.restore();
    }
  }
  function spawnOrbitalStrike(tx, ty) {
    orbitalBeams.push({
      x: tx,
      targetY: ty,
      lockPhase: 1.0,
      width: 55 * state.scale,
      color: '#ffd556',
      impact: false,
      life: 1.0,
      decay: 0.02,
    });
  }
  function updateAndDrawOrbitalStrikes() {
    for (let i = orbitalBeams.length - 1; i >= 0; i--) {
      const ob = orbitalBeams[i];
      if (ob.lockPhase > 0) {
        ob.lockPhase -= 0.08 * state.speed;
        ctx.save();
        ctx.translate(ob.x, ob.targetY);
        const r = (ob.lockPhase * 90 + 20) * state.scale;
        ctx.strokeStyle = '#ffd556';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ob.life -= ob.decay;
      if (ob.life <= 0) {
        orbitalBeams.splice(i, 1);
        continue;
      }

      if (!ob.impact) {
        ob.impact = true;
        triggerShockwave(ob.x, ob.targetY, '#ffd556');
        triggerScreenShake(16);
        triggerScreenFlash(0.4);
        spawnDamageNumber(ob.x, ob.targetY, true, 48000);
      }

      ctx.save();
      ctx.fillStyle = ob.color;
      ctx.shadowColor = ob.color;
      ctx.shadowBlur = 35 * state.bloom;
      ctx.fillRect(ob.x - (ob.width / 2) * ob.life, 0, ob.width * ob.life, ob.targetY);
      ctx.restore();
    }
  }
  function spawnBarrage(originX, originY, targetX, targetY) {
    const angle = Math.atan2(targetY - originY, targetX - originX);
    const count = state.barrageMode === 'spread' ? 7 : 3;
    for (let i = 0; i < count; i++) {
      let spreadAngle = angle;
      if (state.barrageMode === 'spread') spreadAngle += (i - Math.floor(count / 2)) * 0.12;
      else spreadAngle += (Math.random() - 0.5) * 0.08;

      const spd = (14 + Math.random() * 6) * state.speed;
      particles.push({
        type: 'bullet',
        x: originX,
        y: originY,
        vx: Math.cos(spreadAngle) * spd,
        vy: Math.sin(spreadAngle) * spd,
        color: getVFXColor(),
        size: (5 + Math.random() * 4) * state.scale,
        life: 1.0,
        decay: 0.015,
      });
    }
  }
  function spawnBladeSlash(startX, startY, targetX, targetY, isIaiCharged = false) {
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = (18 + (isIaiCharged ? 8 : 0)) * state.speed;
    bladeWaves.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: angle,
      arc: state.bladeArc * (isIaiCharged ? 1.6 : 1.0),
      size: 45 * state.scale * (isIaiCharged ? 2.5 : 1.0),
      thickness: (isIaiCharged ? 10 : 5) * state.scale,
      color: state.color,
      isIai: isIaiCharged,
      life: 1.0,
      decay: 0.02,
    });
    triggerScreenShake(isIaiCharged ? 18 : 6);
    if (isIaiCharged) triggerScreenFlash(0.3);
  }
  function updateAndDrawBladeWaves() {
    const dummy = getDummyTarget();
    for (let i = bladeWaves.length - 1; i >= 0; i--) {
      const bw = bladeWaves[i];
      bw.x += bw.vx;
      bw.y += bw.vy;
      bw.life -= bw.decay;
      if (
        state.dummyActive &&
        Math.hypot(bw.x - dummy.x, bw.y - dummy.y) < dummy.radius + bw.size * 0.5
      ) {
        triggerScreenShake(bw.isIai ? 14 : 5);
        spawnDamageNumber(
          dummy.x,
          dummy.y,
          bw.isIai,
          bw.isIai ? Math.floor(Math.random() * 45000 + 35000) : null,
        );
        if (!bw.isIai) bw.life = 0;
      }
      if (bw.life <= 0) {
        bladeWaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(bw.x, bw.y);
      ctx.rotate(bw.angle);
      ctx.shadowColor = bw.color;
      ctx.shadowBlur = (bw.isIai ? 32 : 18) * state.bloom;
      ctx.strokeStyle = bw.color;
      ctx.lineWidth = bw.thickness * bw.life;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, bw.size, -bw.arc / 2, bw.arc / 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, bw.thickness * 0.35 * bw.life);
      ctx.beginPath();
      ctx.arc(0, 0, bw.size * 0.96, -bw.arc * 0.45, bw.arc * 0.45);
      ctx.stroke();
      ctx.restore();
    }
  }
  function generateLightningBranch(x1, y1, x2, y2, displace = 60, iterations = 4) {
    let points = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
    for (let i = 0; i < iterations; i++) {
      let newPoints = [];
      for (let j = 0; j < points.length - 1; j++) {
        const p1 = points[j],
          p2 = points[j + 1];
        const mx = (p1.x + p2.x) / 2,
          my = (p1.y + p2.y) / 2;
        const normalX = -(p2.y - p1.y),
          normalY = p2.x - p1.x;
        const len = Math.hypot(normalX, normalY) || 1;
        const offset = (Math.random() - 0.5) * displace;
        newPoints.push(p1);
        newPoints.push({ x: mx + (normalX / len) * offset, y: my + (normalY / len) * offset });
      }
      newPoints.push(points[points.length - 1]);
      points = newPoints;
      displace *= 0.52;
    }
    return points;
  }
  function spawnLightningStrike(targetX, targetY) {
    const topX = targetX + (Math.random() - 0.5) * 120;
    const mainPath = generateLightningBranch(topX, 0, targetX, targetY, 80 * state.scale, 4);
    lightningBolts.push({ mainPath, targetX, targetY, color: state.color, life: 1.0, decay: 0.08 });
    triggerScreenShake(15);
    triggerScreenFlash(0.65);
    triggerShockwave(targetX, targetY, '#00f0ff');
    spawnDamageNumber(targetX, targetY, true, Math.floor(Math.random() * 38000 + 22000));
  }
  function updateAndDrawLightning() {
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
      const bolt = lightningBolts[i];
      bolt.life -= bolt.decay;
      if (bolt.life <= 0) {
        lightningBolts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = bolt.color;
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 25 * state.bloom;
      ctx.lineWidth = 5 * bolt.life * state.scale;
      ctx.beginPath();
      bolt.mainPath.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 2 * bolt.life * state.scale);
      ctx.stroke();
      ctx.restore();
    }
  }
  function spawnFrostSpikes(centerX, centerY) {
    const count = state.frostSpikesCount || 7;
    const spikes = [];
    for (let s = 0; s < count; s++) {
      const ang = (s / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = Math.random() * 50 + 20;
      spikes.push({
        x: centerX + Math.cos(ang) * dist,
        y: centerY + Math.sin(ang) * dist,
        angle: ang - Math.PI / 2,
        targetLength: (65 + Math.random() * 60) * state.scale,
        width: (16 + Math.random() * 10) * state.scale,
      });
    }
    frostSpikes.push({
      cx: centerX,
      cy: centerY,
      spikes: spikes,
      growPhase: 0,
      life: 1.0,
      decay: 0.015,
    });
    triggerScreenShake(8);
    triggerShockwave(centerX, centerY, '#7df4ff');
    spawnDamageNumber(centerX, centerY, Math.random() < 0.3, 16500);
  }
  function updateAndDrawFrostSpikes() {
    for (let i = frostSpikes.length - 1; i >= 0; i--) {
      const fs = frostSpikes[i];
      fs.growPhase = Math.min(1.0, fs.growPhase + 0.12 * state.speed);
      fs.life -= fs.decay;
      if (fs.life <= 0) {
        frostSpikes.splice(i, 1);
        continue;
      }

      ctx.save();
      fs.spikes.forEach((sp) => {
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.angle);
        const curLen = sp.targetLength * fs.growPhase;
        const curW = sp.width;
        ctx.beginPath();
        ctx.moveTo(0, -curLen);
        ctx.lineTo(-curW / 2, -curLen * 0.25);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(219, 252, 255, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
    }
  }
  function spawnArrowVolley(targetX, targetY) {
    arrowVolleys.push({
      tx: targetX,
      ty: targetY,
      radius: 90 * state.scale,
      ringRotation: 0,
      life: 1.0,
    });
    for (let a = 0; a < (state.arrowDensity || 24); a++) {
      later(() => {
        const rx = targetX + (Math.random() - 0.5) * 140;
        const ry = targetY + (Math.random() - 0.5) * 140;
        const startX = rx - 160;
        const startY = -40;
        const angle = Math.atan2(ry - startY, rx - startX);
        const spd = (22 + Math.random() * 8) * state.speed;
        particles.push({
          type: 'arrow',
          x: startX,
          y: startY,
          targetX: rx,
          targetY: ry,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          angle: angle,
          color: '#ffe08b',
          life: 1.0,
          decay: 0.015,
        });
      }, Math.random() * 400);
    }
  }
  function updateAndDrawArrowVolleys() {
    for (let i = arrowVolleys.length - 1; i >= 0; i--) {
      const av = arrowVolleys[i];
      av.ringRotation += 0.03 * state.speed;
      av.life -= 0.012;
      if (av.life <= 0) {
        arrowVolleys.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(av.tx, av.ty);
      ctx.rotate(av.ringRotation);
      ctx.strokeStyle = `rgba(255, 213, 86, ${av.life * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, av.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  function spawnFlameVortex(x, y) {
    flameVortices.push({
      x: x,
      y: y,
      targetX: x,
      targetY: y,
      height: 220 * state.scale,
      baseRadius: 40 * state.scale,
      topRadius: 85 * state.scale,
      rotation: 0,
      swirlSpeed: state.vortexAngleSpeed || 0.12,
      intensity: 1.0,
      life: 1.0,
      decay: 0.005,
      vortexParticles: [],
    });
    triggerScreenShake(10);
    triggerShockwave(x, y, '#ff3366');
  }
  function updateAndDrawFlameVortices() {
    for (let i = flameVortices.length - 1; i >= 0; i--) {
      const fv = flameVortices[i];
      fv.rotation += fv.swirlSpeed * state.speed;
      if (state.mouse.down && state.activeSkill === 'flame_vortex') {
        fv.targetX = state.mouse.x;
        fv.targetY = state.mouse.y;
        fv.intensity = Math.min(2.0, fv.intensity + 0.015);
      } else {
        fv.life -= fv.decay;
      }
      fv.x += (fv.targetX - fv.x) * 0.1;
      fv.y += (fv.targetY - fv.y) * 0.1;

      if (state.dummyActive) {
        const dist = Math.hypot(fv.x - state.dummyPos.x, fv.y - state.dummyPos.y);
        if (dist < 180) {
          state.dummyPos.vx += ((fv.x - state.dummyPos.x) / dist) * 1.2 * fv.intensity;
          state.dummyPos.vy += ((fv.y - state.dummyPos.y) / dist) * 1.2 * fv.intensity;
          if (Math.random() < 0.3)
            spawnDamageNumber(state.dummyPos.x, state.dummyPos.y, false, 2800);
        }
      }

      for (let p = 0; p < Math.floor(5 * fv.intensity); p++) {
        const t = Math.random();
        const r = (fv.baseRadius + (fv.topRadius - fv.baseRadius) * t) * fv.intensity;
        const ang = fv.rotation + t * Math.PI * 4;
        fv.vortexParticles.push({
          x: fv.x + Math.cos(ang) * r,
          y: fv.y - t * fv.height,
          vx: -Math.sin(ang) * 4,
          vy: -4,
          size: 5 * state.scale,
          color: Math.random() > 0.4 ? '#ff3366' : '#ffd556',
          life: 1.0,
          decay: 0.03,
        });
      }

      for (let vp = fv.vortexParticles.length - 1; vp >= 0; vp--) {
        const p = fv.vortexParticles[vp];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          fv.vortexParticles.splice(vp, 1);
          continue;
        }
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (fv.life <= 0) flameVortices.splice(i, 1);
    }
  }
  function updateAndDrawParticles() {
    const dummy = getDummyTarget();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (
        p.type === 'arrow' &&
        (p.y >= p.targetY ||
          (state.dummyActive && Math.hypot(p.x - dummy.x, p.y - dummy.y) < dummy.radius))
      ) {
        triggerScreenShake(3);
        spawnDamageNumber(p.x, p.y, Math.random() < 0.35, 4500);
        p.life = 0;
      }

      if (
        state.dummyActive &&
        p.type === 'bullet' &&
        Math.hypot(p.x - dummy.x, p.y - dummy.y) < dummy.radius
      ) {
        triggerScreenShake(2);
        spawnDamageNumber(dummy.x, dummy.y, Math.random() < 0.2);
        p.life = 0;
      }

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      if (p.type === 'arrow') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function triggerShockwave(x, y, color = state.color) {
    shockwaves.push({
      x: x,
      y: y,
      radius: 10,
      maxRadius: 260 * state.scale,
      color: color,
      life: 1.0,
      decay: 0.03,
    });
    triggerScreenShake(10);
    triggerScreenFlash(0.2);
  }
  function updateAndDrawShockwaves() {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.16;
      sw.life -= sw.decay;
      if (sw.life <= 0) {
        shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 4 * sw.life;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  function updateAndDrawDamageNumbers() {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const dn = damageNumbers[i];
      dn.x += dn.vx;
      dn.y += dn.vy;
      dn.life -= 0.02;
      if (dn.life <= 0) {
        damageNumbers.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.font = `${dn.isCrit ? 'bold 20px' : 'bold 14px'} "Space Grotesk"`;
      ctx.fillStyle = dn.isCrit ? '#ffd556' : '#dbfcff';
      ctx.globalAlpha = dn.life;
      ctx.fillText(dn.isCrit ? `CRITICAL! ${dn.text}` : dn.text, dn.x, dn.y);
      ctx.restore();
    }
  }
  function castUltimateShowcase(skillId) {
    const dummy = getDummyTarget();
    const originX = from.x;
    const originY = from.y;
    const targetX = state.dummyActive ? dummy.x : canvas.width * 0.72;
    const targetY = state.dummyActive ? dummy.y : canvas.height * 0.5;

    switch (skillId) {
      case 'barrage':
        for (let i = 0; i < 18; i++) {
          later(() => {
            spawnBarrage(originX, originY + (Math.random() - 0.5) * 40, targetX, targetY);
          }, i * 40);
        }
        triggerScreenShake(8);
        break;
      case 'beam':
        activeBeams.push({
          startX: originX,
          startY: originY,
          targetX: targetX,
          targetY: targetY,
          color: state.color,
          width: 48 * state.scale,
          life: 1.4,
          decay: 0.025,
        });
        triggerScreenShake(20);
        triggerScreenFlash(0.5);
        triggerShockwave(targetX, targetY, state.color);
        for (let i = 0; i < 6; i++) {
          later(() => spawnDamageNumber(targetX, targetY, true, 26000 + i * 4000), i * 120);
        }
        break;
      case 'shield':
        spawnShield(targetX - 70, targetY);
        spawnShield(targetX, targetY);
        spawnShield(originX + 120, originY);
        triggerShockwave(targetX, targetY, '#00f0ff');
        break;
      case 'chains':
        for (let i = 0; i < 4; i++) {
          later(() => {
            spawnChain(
              originX,
              originY - 60 + i * 40,
              targetX + (Math.random() - 0.5) * 50,
              targetY + (Math.random() - 0.5) * 50,
            );
          }, i * 90);
        }
        break;
      case 'sphere':
        spawnShield(originX + 100, originY);
        spawnShield(targetX, targetY);
        triggerShockwave(targetX, targetY, state.color);
        break;
      case 'orbital':
        spawnOrbitalStrike(targetX - 60, targetY);
        later(() => spawnOrbitalStrike(targetX, targetY), 150);
        later(() => spawnOrbitalStrike(targetX + 60, targetY), 300);
        break;
      case 'funnel':
        triggerFunnelBarrage();
        later(() => triggerFunnelBarrage(), 350);
        break;
      case 'singularity':
        spawnBlackHole(targetX, targetY);
        break;
      case 'explosion':
        const mc = {
          x: targetX,
          y: targetY,
          chantProgress: 1.0,
          rotationOuter: 0,
          rotationInner: 0,
          finished: false,
        };
        magicCircles.push(mc);
        later(() => detonateExplosionMagic(mc), 600);
        break;
      case 'damage_text':
        for (let i = 0; i < 8; i++) {
          later(() => {
            spawnDamageNumber(targetX, targetY, i % 2 === 0, 15000 + i * 6500);
          }, i * 70);
        }
        break;
      case 'blade_aura':
        spawnBladeSlash(originX, originY, targetX, targetY, true);
        later(() => spawnBladeSlash(originX, originY - 40, targetX, targetY - 40, false), 120);
        later(() => spawnBladeSlash(originX, originY + 40, targetX, targetY + 40, false), 240);
        break;
      case 'chain_lightning':
        spawnLightningStrike(targetX - 40, targetY);
        later(() => spawnLightningStrike(targetX + 40, targetY), 140);
        later(() => spawnLightningStrike(targetX, targetY), 280);
        break;
      case 'frost_spikes':
        spawnFrostSpikes(targetX, targetY);
        later(() => spawnFrostSpikes(targetX - 80, targetY + 20), 180);
        later(() => spawnFrostSpikes(targetX + 80, targetY - 20), 320);
        break;
      case 'arrow_volley':
        spawnArrowVolley(targetX, targetY);
        break;
      case 'flame_vortex':
        spawnFlameVortex(targetX, targetY);
        break;
    }
  }
  if (state.activeSkill === 'funnel') initFunnels();
  if (state.activeSkill === 'singularity') initDebris(24);
  castUltimateShowcase(state.activeSkill);
  const start = performance.now();
  let last = start;
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    for (const t of timers) clearTimeout(t);
    timers.clear();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function tick(now) {
    if (stopped) return;
    if (document.hidden || now - start > 4200) {
      stop();
      return;
    }
    if (now - last >= 1000 / 60 - 1) {
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.dummyPos.x = to.x;
      state.dummyPos.y = to.y;
      particles = particles.slice(-220);
      shockwaves = shockwaves.slice(-220);
      damageNumbers = damageNumbers.slice(-220);
      activeBeams = activeBeams.slice(-220);
      activeShields = activeShields.slice(-220);
      magicCircles = magicCircles.slice(-220);
      orbitalBeams = orbitalBeams.slice(-220);
      funnels = funnels.slice(-220);
      blackHoles = blackHoles.slice(-220);
      chains = chains.slice(-220);
      spaceDebris = spaceDebris.slice(-220);
      bladeWaves = bladeWaves.slice(-220);
      lightningBolts = lightningBolts.slice(-220);
      frostSpikes = frostSpikes.slice(-220);
      arrowVolleys = arrowVolleys.slice(-220);
      flameVortices = flameVortices.slice(-220);
      updateAndDrawParticles();
      updateAndDrawShockwaves();
      updateAndDrawShields();
      updateAndDrawChains();
      updateAndDrawOrbitalStrikes();
      updateAndDrawMagicCircles();
      if (state.activeSkill === 'singularity') updateAndDrawSingularities();
      updateAndDrawBeams();
      if (state.activeSkill === 'funnel') updateAndDrawFunnels();
      updateAndDrawBladeWaves();
      updateAndDrawLightning();
      updateAndDrawFrostSpikes();
      updateAndDrawArrowVolleys();
      updateAndDrawFlameVortices();
      updateAndDrawDamageNumbers();
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return stop;
}
