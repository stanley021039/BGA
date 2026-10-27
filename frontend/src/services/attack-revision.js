/* Adapted from Stitch 14297655819267599636 / 178f1581bba04e3699f31b8d32d73070.
 * Workbench dummy/grid removed; retains prior detailed phoenix/fists via composition.
 * Fixed side-column overlap and target centring; avatar knockback belongs to scene-knockback.
 * Pure bounded drawing; no network, DOM, timer, animation loop or invented damage. */
export function drawUltimateRevision(ctx, kind, p, targetX = 760, targets, angle = 0) {
  p = Math.max(0, Math.min(1, p));
  ctx.save();

  /* ----------------------------------------------------------------------
         1. GATE OF BABYLON (60 Golden Portals + 6 Weapons + Ea Core)
         ---------------------------------------------------------------------- */
  if (kind === 'gate_of_babylon') {
    drawBabylonVolley(ctx, p, targets, angle);
    if (p > 0.78) {
      const release = Math.min(1, (p - 0.78) / 0.15);
      for (const target of (targets || [{ x: 760, y: 0 }]).slice(0, 32)) {
        ctx.save();
        const length = Math.hypot(target.x, target.y) * release;
        ctx.rotate(Math.atan2(target.y, target.x));
        ctx.fillStyle = 'rgba(12,2,10,0.8)';
        ctx.beginPath();
        ctx.moveTo(25, -10);
        ctx.lineTo(length, -85 * release);
        ctx.lineTo(length, 85 * release);
        ctx.lineTo(25, 10);
        ctx.fill();
        for (let ring = 0; ring < 8; ring++) {
          const t = ring / 8,
            x = length * t,
            radius = 10 + 70 * t;
          ctx.strokeStyle = ring % 2 ? '#ff214d' : '#ffd470';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x, 0, 12, radius, p * 20 + ring, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (release > 0.94) {
          ctx.strokeStyle = '#fff2d1';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(length - 60, -90);
          ctx.lineTo(length + 60, 90);
          ctx.moveTo(length + 60, -90);
          ctx.lineTo(length - 60, 90);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /* ----------------------------------------------------------------------
         2. GUANYIN BARRAGE (Thousand-Hand Buddha + Palm Array)
         ---------------------------------------------------------------------- */
  else if (kind === 'guanyin_barrage') {
    const appear = Math.min(1, p / 0.2);
    ctx.save();
    ctx.translate(-20, -180);

    // Golden Halo Rings Behind Buddha
    const haloR = Math.max(0.1, 140 * appear);
    const bGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, haloR);
    bGrad.addColorStop(0, 'rgba(255, 235, 150, 0.7)');
    bGrad.addColorStop(0.6, 'rgba(241, 193, 0, 0.35)');
    bGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();

    // 3 Layered Concentric Radiant Wheels
    ctx.strokeStyle = '#ffd556';
    ctx.lineWidth = 1.5;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.arc(0, 0, haloR * (0.35 * ring), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Thousands of Golden Arms in Fan Array (32 visible stylized fan spokes)
    const armCount = 36;
    for (let a = 0; a < armCount; a++) {
      const armAng = -Math.PI * 0.95 + (a / armCount) * Math.PI * 1.9;
      const armLen = (110 + (a % 3) * 20) * appear;
      const ax = Math.cos(armAng) * armLen;
      const ay = Math.sin(armAng) * armLen;

      ctx.strokeStyle = '#ffd556';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(ax * 0.5 + Math.sin(p * 10 + a) * 8, ay * 0.5, ax, ay);
      ctx.stroke();

      // Palm at end of arm
      ctx.fillStyle = '#fff5e2';
      ctx.beginPath();
      ctx.arc(ax, ay, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central Bodhisattva Silhouette (High Chignon, Crown, Serene Face, Praying Hands)
    ctx.fillStyle = '#ffe08b';
    ctx.strokeStyle = '#745c00';
    ctx.lineWidth = 1;

    // Head & Crown
    ctx.beginPath();
    ctx.arc(0, -28, 18, 0, Math.PI * 2); // Face
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-10, -38);
    ctx.lineTo(0, -62);
    ctx.lineTo(10, -38); // Chignon & Crown
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Closed Serene Eyes & Brow
    ctx.strokeStyle = '#3d2f00';
    ctx.beginPath();
    ctx.arc(-6, -26, 4, 0.1, Math.PI * 0.9);
    ctx.arc(6, -26, 4, 0.1, Math.PI * 0.9);
    ctx.stroke();

    // Praying Hands in front of chest
    ctx.fillStyle = '#fff5e2';
    ctx.beginPath();
    ctx.ellipse(0, 8, 8, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Golden Lotus Base
    ctx.fillStyle = '#ffd556';
    ctx.beginPath();
    ctx.ellipse(0, 80, 50, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /* ----------------------------------------------------------------------
         3. BIJUU BEAM (Nine-Tailed Demon Fox + Bifurcated Purple Laser)
         ---------------------------------------------------------------------- */
  else if (kind === 'bijuu_beam') {
    ctx.save();
    ctx.translate(-98, 0);

    // Nine Huge Waving Tail Curves Behind
    ctx.strokeStyle = 'rgba(241, 193, 0, 0.6)';
    ctx.lineWidth = 9;
    for (let t = 0; t < 9; t++) {
      const tAng = -Math.PI * 0.8 + (t / 8) * Math.PI * 1.4;
      const sway = Math.sin(p * 12 + t) * 22;
      ctx.beginPath();
      ctx.moveTo(-30, 20);
      ctx.quadraticCurveTo(-90 + sway, -60 + t * 14, -130 + sway * 1.5, Math.sin(tAng) * 110);
      ctx.stroke();
    }

    // Demon Fox Head Profile
    ctx.fillStyle = '#ff922e'; // Orange fur
    ctx.strokeStyle = '#05070c';
    ctx.lineWidth = 2.5;

    // Snout, Jaws with Fangs
    ctx.beginPath();
    ctx.moveTo(35, -20);
    ctx.lineTo(85, -8); // Upper snout
    ctx.lineTo(75, 4); // Fangs
    ctx.lineTo(55, 12); // Open lower jaw
    ctx.lineTo(25, 28);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pointy Ears
    ctx.beginPath();
    ctx.moveTo(10, -25);
    ctx.lineTo(-15, -75);
    ctx.lineTo(-5, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dark Eye Sockets & Crimson Slit Pupil
    ctx.fillStyle = '#05070c';
    ctx.beginPath();
    ctx.ellipse(32, -14, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(32, -18, 3, 9); // Slit

    // Black-Purple Bijudama Nuclear Core
    const coreSize = Math.max(0.1, Math.min(36, p < 0.4 ? (p / 0.4) * 36 : 36));
    const cGrad = ctx.createRadialGradient(98, 0, 2, 98, 0, coreSize);
    cGrad.addColorStop(0, '#ffffff');
    cGrad.addColorStop(0.3, '#7400b8');
    cGrad.addColorStop(0.8, '#10002b');
    cGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(98, 0, coreSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Hyper Dual-layer Laser Blast (p: 0.38 -> 1.0)
    if (p > 0.38) {
      const blastP = (p - 0.38) / 0.62;
      const beamW = Math.max(0.1, Math.sin(blastP * Math.PI) * 55);

      for (const target of (
        targets ||
        [-0.5, 0, 0.5].map((a) => ({ x: targetX * Math.cos(a), y: targetX * Math.sin(a) }))
      ).slice(0, 3)) {
        ctx.save();
        ctx.rotate(Math.atan2(target.y, target.x));
        const reach = Math.hypot(target.x, target.y) * Math.min(1, blastP / 0.22);
        // Each ray shares the exact server apex and branch angle.
        ctx.fillStyle = 'rgba(116, 0, 184, 0.4)';
        ctx.fillRect(0, -beamW * 0.7, reach, beamW * 1.4);

        // Core White-Hot Death Ray
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#dbfcff';
        ctx.shadowBlur = 24;
        ctx.fillRect(0, -beamW * 0.25, reach, beamW * 0.5);
        ctx.shadowBlur = 0;

        // Lightning Arcs surrounding beam
        ctx.strokeStyle = '#dbfcff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let lx = 0; lx < reach; lx += 45) {
          ctx.lineTo(lx, Math.sin(lx * 0.05 + p * 30) * beamW * 0.6);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ----------------------------------------------------------------------
         4. FLAME KICK (Red-Gold Dragon + Rider Kick Stomp)
         ---------------------------------------------------------------------- */
  else if (kind === 'dimension_cleave') {
    // Preliminary Criss-cross Blade Tears (p: 0 -> 0.5)
    if (p < 0.6) {
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 3;
      for (let s = 0; s < 4; s++) {
        const sp = Math.min(1, p * 2.5);
        ctx.beginPath();
        ctx.moveTo(targetX - 120 + s * 60, -280 * sp);
        ctx.lineTo(targetX + 120 - s * 60, 120 * sp);
        ctx.stroke();
      }
    }

    // Final Dimensional Cleave: White-hot cut line + Void Slit (p >= 0.5)
    if (p >= 0.5) {
      const cleaveP = (p - 0.5) / 0.5;
      const shift = Math.sin(cleaveP * Math.PI) * 28; // Screen half displacement

      // Top half split line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-240, -140);
      ctx.lineTo(1000, -100);
      ctx.stroke();

      // Black Void Aperture Exposure
      ctx.fillStyle = '#05070c';
      ctx.beginPath();
      ctx.moveTo(-240, -140 - shift);
      ctx.lineTo(1000, -100 - shift);
      ctx.lineTo(1000, -100 + shift);
      ctx.lineTo(-240, -140 + shift);
      ctx.closePath();
      ctx.fill();

      // Accretion Sparks inside rift
      ctx.fillStyle = '#00f0ff';
      for (let sp = 0; sp < 24; sp++) {
        const rx = ((sp * 55 + p * 600) % 1200) - 240;
        const ry = -120 + Math.sin(sp + p * 20) * (shift * 0.8);
        ctx.fillRect(rx, ry, 3, 3);
      }
    }
  }

  /* ----------------------------------------------------------------------
         6. SOLAR PHOENIX (Dragon-Bird Flame Consciousness + Magma Ground)
         ---------------------------------------------------------------------- */
  else if (kind === 'solar_phoenix') {
    // Scorched Earth / Magma Crust on ground where phoenix has passed
    const passedX = Math.min(760, Math.max(0, 100 + ((p - 0.2) / 0.6) * 580));
    if (passedX > 0) {
      ctx.fillStyle = 'rgba(18,5,3,0.85)';
      ctx.fillRect(0, -7, passedX, 24);
      const groundGlow = ctx.createLinearGradient(0, -110, 0, 22);
      groundGlow.addColorStop(0, 'rgba(255,74,0,0)');
      groundGlow.addColorStop(0.6, 'rgba(255,80,0,0.55)');
      groundGlow.addColorStop(1, '#ffce52');
      ctx.fillStyle = groundGlow;
      ctx.fillRect(0, -110, passedX, 132);
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(passedX, 2);
      ctx.stroke();

      // Rolling magma flame tongues
      ctx.fillStyle = '#ffd556';
      for (let fx = 0; fx < passedX; fx += 35) {
        const fh = 34 + Math.abs(Math.sin(fx * 0.31 + p * 25)) * 70;
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.bezierCurveTo(fx - 10, -fh * 0.45, fx + 26, -fh * 0.65, fx + 10, -fh);
        ctx.bezierCurveTo(fx + 45, -fh * 0.4, fx + 30, -fh * 0.15, fx + 20, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* ----------------------------------------------------------------------
         7. BARRAGE (Pellet Core + Toroid Rings + Cross Impacts)
         ---------------------------------------------------------------------- */
  else if (kind === 'barrage') {
    const pelletCount = 18;
    const palette = ['#00f0ff', '#ff2a5f', '#ffea00', '#a855f7', '#10b981', '#ff007f', '#ff8800'];
    for (let b = 0; b < pelletCount; b++) {
      const shotColor = palette[b % palette.length];
      const bp = (p * 2.8 + b / pelletCount) % 1;
      const bx = bp * targetX;
      const by = Math.sin(b * 1.5 + p * 8) * 80 * Math.sin(bp * Math.PI);

      ctx.save();
      ctx.translate(bx, by);

      // Dual Spiral Tail
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-30, Math.sin(p * 20 + b) * 8);
      ctx.stroke();

      // Black Outline & Metal Core
      ctx.fillStyle = '#05070c';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = shotColor;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Toroid High Energy Ring
      ctx.strokeStyle = shotColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 4, 0.4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Impact Cross Flash near target
      if (bp > 0.88) {
        ctx.save();
        ctx.translate(targetX, by);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(22, 0);
        ctx.moveTo(0, -22);
        ctx.lineTo(0, 22);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ----------------------------------------------------------------------
         8. ORBITAL (Heavenly Pillar + 6 Sub-beams + 3 Magic Circles)
         ---------------------------------------------------------------------- */
  else if (kind === 'orbital') {
    const landP = Math.min(1, p / 0.25);

    // Ground 3-Layer Magic Runes
    ctx.save();
    ctx.translate(targetX, 0);
    ctx.strokeStyle = '#ffd556';
    ctx.lineWidth = 1.5;

    // Concentric Circles with Non-negative Radius Protection
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, 140 * landP), Math.max(0.1, 40 * landP), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, 95 * landP), Math.max(0.1, 26 * landP), p * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, 55 * landP), Math.max(0.1, 15 * landP), -p * 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Massive Main Orbital Beam Slamming from Sky
    if (p > 0.15) {
      const mainW = Math.max(0.1, 90 + Math.sin(p * 30) * 12);
      const oGrad = ctx.createLinearGradient(targetX - mainW, 0, targetX + mainW, 0);
      oGrad.addColorStop(0, 'rgba(0, 240, 255, 0.1)');
      oGrad.addColorStop(0.3, 'rgba(255, 245, 226, 0.85)');
      oGrad.addColorStop(0.5, '#ffffff');
      oGrad.addColorStop(0.7, 'rgba(255, 245, 226, 0.85)');
      oGrad.addColorStop(1, 'rgba(0, 240, 255, 0.1)');

      ctx.fillStyle = oGrad;
      ctx.fillRect(targetX - mainW, -440, mainW * 2, 440);

      // 6 Intermittent Sub-pillars Around
      for (let sub = 0; sub < 6; sub++) {
        const subOff = [-240, -175, -120, 120, 175, 240][sub];
        const subDelay = 0.2 + sub * 0.08;
        if (p > subDelay) {
          const subW = 12 + (sub % 3) * 6;
          ctx.fillStyle = 'rgba(219, 252, 255, 0.45)';
          const columnTop = -230 - (sub % 3) * 70;
          ctx.fillRect(targetX + subOff - subW * 0.5, columnTop, subW, -columnTop);
        }
      }
    }
  }

  /* ----------------------------------------------------------------------
         9. GIANT ORANGE CAT (天降巨橘・泰山壓頂 - Multi-target Mega Cat)
         ---------------------------------------------------------------------- */
  else if (kind === 'giant_orange_cat') {
    // Phase 1: Expanding Ominous Oval Shadow on Ground (0 -> 0.48)
    const dropP = Math.min(1, p / 0.55);
    const shadowScale = Math.max(0.1, dropP * 240);

    ctx.save();
    ctx.fillStyle = `rgba(12, 14, 22, ${Math.min(0.85, dropP * 0.9)})`;
    ctx.beginPath();
    ctx.ellipse(targetX, 0, shadowScale, Math.max(0.1, shadowScale * 0.32), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Phase 2: Chubby Orange Tabby Drops from Stratosphere
    // Parabolic vertical drop with elastic squash & stretch bounce
    const catX = targetX;
    let catY = -440 + Math.pow(dropP, 2.5) * 440;
    let stretchX = 1.0;
    let stretchY = 1.0;

    // Extreme Jiggle Bounce on Ground Impact (p: 0.55 -> 1.0)
    if (p >= 0.55) {
      const impactP = (p - 0.55) / 0.45;
      const bounce = Math.sin(impactP * Math.PI * 4) * Math.exp(-impactP * 4);
      catY = 0 - Math.abs(bounce * 40);
      stretchX = 1.0 + (1 - impactP) * 0.65 - bounce * 0.3; // Flattens wide
      stretchY = 1.0 - (1 - impactP) * 0.5 + bounce * 0.3; // Compresses flat
    }

    ctx.save();
    ctx.translate(catX, catY);
    ctx.scale(Math.max(0.1, stretchX), Math.max(0.1, stretchY));

    // Giant Chubby Cat Body (Warm Orange Tabby)
    ctx.fillStyle = '#ff922e'; // Orange
    ctx.strokeStyle = '#745c00';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.ellipse(0, -90, 110, 85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Chubby Snow-White Belly
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -75, 70, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark Tabby Stripes on Back
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 4;
    for (let st = -2; st <= 2; st++) {
      ctx.beginPath();
      ctx.moveTo(st * 24 - 10, -170);
      ctx.lineTo(st * 24, -135);
      ctx.stroke();
    }

    // Triangular Folded Ears
    ctx.fillStyle = '#ff922e';
    ctx.beginPath();
    ctx.moveTo(-60, -165);
    ctx.lineTo(-95, -205);
    ctx.lineTo(-40, -172);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(40, -172);
    ctx.lineTo(95, -205);
    ctx.lineTo(60, -165);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ear pink inner
    ctx.fillStyle = '#ffb2ba';
    ctx.beginPath();
    ctx.moveTo(-55, -168);
    ctx.lineTo(-85, -195);
    ctx.lineTo(-45, -172);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(45, -172);
    ctx.lineTo(85, -195);
    ctx.lineTo(55, -168);
    ctx.fill();

    // Forehead 'M' Marking
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-20, -155);
    ctx.lineTo(-10, -140);
    ctx.lineTo(0, -150);
    ctx.lineTo(10, -140);
    ctx.lineTo(20, -155);
    ctx.stroke();

    // Face Details: Happy Squeezed Eyes & Cute Pink Nose
    ctx.strokeStyle = '#05070c';
    ctx.lineWidth = 3;
    // Closed joyful arc eyes (> <)
    ctx.beginPath();
    ctx.arc(-28, -125, 8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(28, -125, 8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Pink Nose & White Muzzle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-10, -108, 14, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(10, -108, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.moveTo(0, -114);
    ctx.lineTo(-6, -122);
    ctx.lineTo(6, -122);
    ctx.closePath();
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -110);
    ctx.lineTo(-60, -118);
    ctx.moveTo(-26, -104);
    ctx.lineTo(-62, -104);
    ctx.moveTo(26, -110);
    ctx.lineTo(60, -118);
    ctx.moveTo(26, -104);
    ctx.lineTo(62, -104);
    ctx.stroke();

    // 4 Paws with Pink Beans (肉球)
    const pawPositions = [
      { x: -75, y: -25 },
      { x: -25, y: -15 },
      { x: 25, y: -15 },
      { x: 75, y: -25 },
    ];
    pawPositions.forEach((pos) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb2ba'; // Pink main pad
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y - 2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mini toe beans
      for (let b = -1; b <= 1; b++) {
        ctx.beginPath();
        ctx.arc(pos.x + b * 6, pos.y + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Curled Tail sticking high up
    ctx.strokeStyle = '#ff922e';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(85, -120);
    ctx.quadraticCurveTo(140, -160, 120, -210);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff'; // White tail tip
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(130, -195);
    ctx.lineTo(120, -210);
    ctx.stroke();

    ctx.restore();

    // Radial Shockwaves & Burst Dust upon Cat Impact (p >= 0.55)
    if (p >= 0.55) {
      const impactP = (p - 0.55) / 0.45;
      ctx.save();
      ctx.translate(catX, 0);

      // Dual Ring Shockwave
      ctx.strokeStyle = '#dbfcff';
      ctx.lineWidth = Math.max(0.1, 4 * (1 - impactP));
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        Math.max(0.1, impactP * 320),
        Math.max(0.1, impactP * 90),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();

      // Comic Action Flying Stars & Puffs
      ctx.fillStyle = '#ffd556';
      for (let puff = 0; puff < 8; puff++) {
        const pang = (puff / 8) * Math.PI * 2;
        const pdist = impactP * 180;
        ctx.fillRect(Math.cos(pang) * pdist, Math.sin(pang) * pdist * 0.35 - 15, 6, 6);
      }

      ctx.restore();
    }
  }

  ctx.restore();
}
export function drawUltimateTitle(ctx, label, p, width, height) {
  if (p <= 0 || p > 0.12) return;
  ctx.save();
  const t = p / 0.12; // 0 -> 1
  const alpha = t < 0.2 ? t / 0.2 : t > 0.75 ? (1 - t) / 0.25 : 1.0;
  const easeX = 1 - Math.pow(1 - t, 3);
  const slide = (1 - easeX) * 200;

  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // Golden Diagonal Slicing Ribbon
  const cy = height * 0.22;
  ctx.beginPath();
  ctx.moveTo(-100, cy - 45 - slide * 0.2);
  ctx.lineTo(width + 100, cy - 15 - slide * 0.2);
  ctx.lineTo(width + 100, cy + 35 - slide * 0.2);
  ctx.lineTo(-100, cy + 5 - slide * 0.2);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, cy - 30, width, cy + 30);
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
  grad.addColorStop(0.3, 'rgba(255, 213, 86, 0.45)');
  grad.addColorStop(0.7, 'rgba(255, 213, 86, 0.45)');
  grad.addColorStop(1, 'rgba(212, 0, 75, 0.05)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Top & Bottom Sharp Neon Hairlines
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#dbfcff';
  ctx.beginPath();
  ctx.moveTo(0, cy - 30);
  ctx.lineTo(width, cy - 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, cy + 20);
  ctx.lineTo(width, cy + 44);
  ctx.strokeStyle = '#ffd556';
  ctx.stroke();

  // Speed Action Lines
  ctx.strokeStyle = 'rgba(219, 252, 255, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const lx = ((i * 140 + t * 400) % (width + 200)) - 100;
    ctx.beginPath();
    ctx.moveTo(lx, cy - 25);
    ctx.lineTo(lx + 70, cy + 35);
    ctx.stroke();
  }

  // Title Text Render (Chinese Calligraphic / Sci-Fi Anime Typography)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.min(36, Math.max(14, (width - 32) / Math.max(1, label.length)))}px sans-serif`;

  // Outer Glow Halo
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#05070c';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffd556';
  ctx.strokeText(label, width * 0.5, cy, Math.max(1, width - 32));

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, width * 0.5, cy, Math.max(1, width - 32));

  ctx.restore();
}

// The final cleave occupies the viewport rather than the caster's local rectangle.
// Opposing edges expose the dark aperture, then close; no page content is captured.
export function drawScreenRift(ctx, p, width, height) {
  if (p < 0.6 || p >= 1) return;
  const t = (p - 0.6) / 0.4,
    gap = Math.sin(t * Math.PI) * Math.min(50, height * 0.07);
  const y1 = height * 0.42,
    y2 = height * 0.58;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.86)';
  ctx.beginPath();
  ctx.moveTo(-20, y1 - gap);
  ctx.lineTo(width + 20, y2 - gap);
  ctx.lineTo(width + 20, y2 + gap);
  ctx.lineTo(-20, y1 + gap);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.strokeStyle = side < 0 ? '#fff1fc' : '#ff3366';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20 + side * gap, y1 + side * gap);
    ctx.lineTo(width + 20 + side * gap, y2 + side * gap);
    ctx.stroke();
  }
  ctx.restore();
}

export function createRevisionAttack(ctx, options, onImpact) {
  if (!['barrage', 'orbital'].includes(options.effect)) return null;
  const { from, to, width, height } = options;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dist = Math.hypot(dx, dy);
  const unit = Math.min(1.2, Math.max(0.5, height / 600));
  let hit = false;
  return (elapsed) => {
    if (elapsed < 0 || elapsed > 3600) return;
    const p = elapsed / 3600;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - p) / 0.15);
    if (options.effect === 'orbital') ctx.translate(to.x, to.y);
    else {
      ctx.translate(from.x, from.y);
      ctx.rotate(Math.atan2(dy, dx));
    }
    ctx.scale(unit, unit);
    drawUltimateRevision(ctx, options.effect, p, options.effect === 'orbital' ? 0 : dist / unit);
    ctx.restore();
    if (!hit && p >= (options.effect === 'orbital' ? 0.22 : 0.45)) {
      hit = true;
      onImpact();
    }
  };
}

/* Final volley source: Stitch 083d2b84174047d8891ab099aaf49f2a.
 * Hold made readable before four waves; no second damage for the Ea finale. */
export function drawBabylonVolley(
  ctx,
  p,
  targets = [
    { x: 650, y: -130 },
    { x: 720, y: 30 },
    { x: 560, y: 180 },
  ],
  orientation = 0,
) {
  p = Math.max(0, Math.min(1, p));
  ctx.save();

  // 安全限制最多 32 個目標
  const activeTargets = targets && targets.length > 0 ? targets.slice(0, 32) : [{ x: 700, y: 0 }];
  const numTargets = activeTargets.length;

  // -------------------------------------------------------------
  // 1. 生成 59 門黃金空間門（去除頂端孤立門，平衡多層環抱雙弧）
  // -------------------------------------------------------------
  const DOORS = [];
  const numDoors = 59; // 59 個門扉

  // 內環 19 門：半徑約 140~220，角度 -115度 ~ +25度 (弧心在 (-30, -50))
  for (let i = 0; i < 19; i++) {
    const t = i / 18;
    const angle = (-118 + t * 142) * (Math.PI / 180);
    const rad = 145 + Math.sin(t * Math.PI) * 45;
    const x = -30 + Math.cos(angle) * rad;
    const y = -60 + Math.sin(angle) * rad;
    DOORS.push({
      x: Math.round(x),
      y: Math.max(-360, Math.round(y)),
      scale: 0.85 + (i % 3) * 0.12,
      type: i % 8,
      wave: (i * 0.19) % 1.0,
      tier: 0,
    });
  }

  // 中環 22 門：半徑約 230~320，角度 -122度 ~ +30度
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const angle = (-125 + t * 150) * (Math.PI / 180);
    const rad = 235 + Math.sin(t * Math.PI) * 55;
    const x = -40 + Math.cos(angle) * rad;
    const y = -70 + Math.sin(angle) * rad;
    DOORS.push({
      x: Math.round(x),
      y: Math.max(-360, Math.round(y)),
      scale: 0.95 + (i % 4) * 0.1,
      type: (i + 2) % 8,
      wave: ((i + 7) * 0.17) % 1.0,
      tier: 1,
    });
  }

  // 外環 18 門：半徑約 330~410，左右包夾向上延伸，頂部壓在 Y=-360 內
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const angle = (-128 + t * 154) * (Math.PI / 180);
    const rad = 330 + Math.sin(t * Math.PI) * 45;
    const x = -50 + Math.cos(angle) * rad;
    let y = -80 + Math.sin(angle) * rad;
    if (y < -360) y = -360 + Math.abs(y + 360) * 0.25; // 限制高度絕不超過 -360
    DOORS.push({
      x: Math.round(x),
      y: Math.round(y),
      scale: 1.05 + (i % 3) * 0.12,
      type: (i + 5) % 8,
      wave: ((i + 13) * 0.23) % 1.0,
      tier: 2,
    });
  }

  // Three overhead arcs stay above the actor in screen space, regardless of aim.
  DOORS.forEach((door, index) => {
    const count = door.tier === 0 ? 19 : door.tier === 1 ? 22 : 18;
    const offset = door.tier === 0 ? index : door.tier === 1 ? index - 19 : index - 41;
    const a = -Math.PI + ((offset + 0.5) / count) * Math.PI;
    const x = Math.cos(a) * (185 + door.tier * 110);
    const y = -85 + Math.sin(a) * (120 + door.tier * 85);
    door.x = x * Math.cos(orientation) + y * Math.sin(orientation);
    door.y = -x * Math.sin(orientation) + y * Math.cos(orientation);
  });
  // 輔助繪製單一神兵（8 款造型差異顯著）
  function drawWeapon(wctx, type, length, widthScale = 1.0) {
    wctx.save();
    wctx.lineWidth = 1.5;

    switch (type) {
      case 0: {
        // 0. 長柄菱刃槍 (Spear): 碧金交織長桿、長菱形銳利槍頭、槍纓
        wctx.strokeStyle = '#c49742';
        wctx.fillStyle = '#f8ecd0';
        // 桿身
        wctx.beginPath();
        wctx.moveTo(-length * 0.75, 0);
        wctx.lineTo(length * 0.25, 0);
        wctx.stroke();
        // 槍纓
        wctx.fillStyle = '#ff2a4b';
        wctx.beginPath();
        wctx.ellipse(length * 0.25, 0, 7, 3.5, 0, 0, Math.PI * 2);
        wctx.fill();
        // 菱刃頭
        wctx.fillStyle = '#ffffff';
        wctx.strokeStyle = '#ffd556';
        wctx.beginPath();
        wctx.moveTo(length * 0.25, -4);
        wctx.lineTo(length * 0.55, -7);
        wctx.lineTo(length, 0);
        wctx.lineTo(length * 0.55, 7);
        wctx.lineTo(length * 0.25, 4);
        wctx.closePath();
        wctx.fill();
        wctx.stroke();
        // 脊線血槽
        wctx.strokeStyle = '#00f0ff';
        wctx.beginPath();
        wctx.moveTo(length * 0.25, 0);
        wctx.lineTo(length * 0.9, 0);
        wctx.stroke();
        break;
      }

      case 1: {
        // 1. 寬十字巨劍 (Claymore): 厚實雙刃、寬護手鑲紅寶石
        wctx.strokeStyle = '#e6c364';
        // 劍柄與劍首
        wctx.fillStyle = '#222533';
        wctx.fillRect(-length * 0.45, -2.5, length * 0.45, 5);
        wctx.fillStyle = '#ffd556';
        wctx.beginPath();
        wctx.arc(-length * 0.45, 0, 4.5, 0, Math.PI * 2);
        wctx.fill();
        // 寬十字護手
        wctx.fillStyle = '#d4af37';
        wctx.fillRect(-2, -14, 5, 28);
        wctx.fillStyle = '#ff2a4b';
        wctx.beginPath();
        wctx.arc(0, 0, 3, 0, Math.PI * 2);
        wctx.fill();
        // 寬厚劍刃
        const grad = wctx.createLinearGradient(0, -9, 0, 9);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#dbe2ef');
        grad.addColorStop(1, '#8f9db5');
        wctx.fillStyle = grad;
        wctx.beginPath();
        wctx.moveTo(3, -8);
        wctx.lineTo(length * 0.82, -7);
        wctx.lineTo(length, 0);
        wctx.lineTo(length * 0.82, 7);
        wctx.lineTo(3, 8);
        wctx.closePath();
        wctx.fill();
        wctx.stroke();
        break;
      }

      case 2: {
        // 2. 彎月曲刀 (Scimitar): 弧形反曲金色刀刃、東方單手柄
        wctx.strokeStyle = '#e0b84c';
        wctx.fillStyle = '#ffeed0';
        wctx.beginPath();
        wctx.moveTo(-length * 0.35, 2);
        wctx.quadraticCurveTo(-length * 0.15, -2, 0, 0);
        wctx.stroke();
        // 彎刀身
        wctx.fillStyle = '#f5f7fa';
        wctx.beginPath();
        wctx.moveTo(0, -2);
        wctx.quadraticCurveTo(length * 0.45, -16, length, -6);
        wctx.quadraticCurveTo(length * 0.6, 6, 0, 3);
        wctx.closePath();
        wctx.fill();
        wctx.stroke();
        // 刀背金飾
        wctx.strokeStyle = '#ffd556';
        wctx.beginPath();
        wctx.moveTo(length * 0.2, -7);
        wctx.lineTo(length * 0.7, -11);
        wctx.stroke();
        break;
      }

      case 3: {
        // 3. 巨大雙刃斧 (Battleaxe): 兩側半月弧形重斧刃、厚實鋼脊
        wctx.strokeStyle = '#8d99ae';
        // 柄
        wctx.fillStyle = '#5c4033';
        wctx.fillRect(-length * 0.5, -2, length * 0.9, 4);
        // 雙刃斧頭
        wctx.fillStyle = '#c0d6df';
        wctx.strokeStyle = '#ffd556';
        wctx.beginPath();
        // 上刃
        wctx.moveTo(length * 0.35, -3);
        wctx.quadraticCurveTo(length * 0.2, -18, length * 0.55, -20);
        wctx.quadraticCurveTo(length * 0.65, -10, length * 0.45, -3);
        // 下刃
        wctx.lineTo(length * 0.45, 3);
        wctx.quadraticCurveTo(length * 0.65, 10, length * 0.55, 20);
        wctx.quadraticCurveTo(length * 0.2, 18, length * 0.35, 3);
        wctx.closePath();
        wctx.fill();
        wctx.stroke();
        // 頂部破甲刺錐
        wctx.fillStyle = '#ffffff';
        wctx.beginPath();
        wctx.moveTo(length * 0.4, -3);
        wctx.lineTo(length, 0);
        wctx.lineTo(length * 0.4, 3);
        wctx.closePath();
        wctx.fill();
        break;
      }

      case 4: {
        // 4. 三叉戟 (Trident): 三叉海神戟、海藍寶石能量
        wctx.strokeStyle = '#00b4d8';
        wctx.lineWidth = 1.6;
        // 柄
        wctx.beginPath();
        wctx.moveTo(-length * 0.6, 0);
        wctx.lineTo(length * 0.35, 0);
        wctx.stroke();
        // 三叉頭
        wctx.fillStyle = '#caf0f8';
        wctx.strokeStyle = '#ffd556';
        // 中刺
        wctx.beginPath();
        wctx.moveTo(length * 0.35, -2);
        wctx.lineTo(length, 0);
        wctx.lineTo(length * 0.35, 2);
        wctx.fill();
        wctx.stroke();
        // 上下弧叉
        wctx.beginPath();
        wctx.moveTo(length * 0.35, -2);
        wctx.quadraticCurveTo(length * 0.5, -12, length * 0.85, -11);
        wctx.lineTo(length * 0.8, -7);
        wctx.quadraticCurveTo(length * 0.5, -7, length * 0.4, -2);
        wctx.fill();
        wctx.stroke();

        wctx.beginPath();
        wctx.moveTo(length * 0.35, 2);
        wctx.quadraticCurveTo(length * 0.5, 12, length * 0.85, 11);
        wctx.lineTo(length * 0.8, 7);
        wctx.quadraticCurveTo(length * 0.5, 7, length * 0.4, 2);
        wctx.fill();
        wctx.stroke();
        break;
      }

      case 5: {
        // 5. 方頭戰鎚 (Warhammer): 重型立體方槌塊、尖銳破甲錐
        wctx.strokeStyle = '#c49742';
        wctx.fillStyle = '#3a3d4d';
        wctx.fillRect(-length * 0.5, -2, length * 0.9, 4);
        // 鎚身
        wctx.fillStyle = '#8f9db5';
        wctx.strokeStyle = '#ffd556';
        wctx.beginPath();
        wctx.roundRect(length * 0.32, -12, length * 0.38, 24, [2]);
        wctx.fill();
        wctx.stroke();
        // 尖頭破甲刺
        wctx.fillStyle = '#ffffff';
        wctx.beginPath();
        wctx.moveTo(length * 0.7, -4);
        wctx.lineTo(length * 0.98, 0);
        wctx.lineTo(length * 0.7, 4);
        wctx.closePath();
        wctx.fill();
        wctx.stroke();
        break;
      }

      case 6: {
        // 6. 倒鉤鐮刃 (War-Scythe): 翡翠青綠飾邊、兇狠內勾死神鐮
        wctx.strokeStyle = '#2ec4b6';
        wctx.fillStyle = '#1b1b1e';
        wctx.fillRect(-length * 0.5, -2, length * 0.8, 4);
        // 倒鉤巨大鐮刀
        wctx.fillStyle = '#eaf4f4';
        wctx.strokeStyle = '#ffd556';
        wctx.beginPath();
        wctx.moveTo(length * 0.3, 0);
        wctx.quadraticCurveTo(length * 0.55, -22, length * 0.95, -16);
        wctx.quadraticCurveTo(length * 0.65, -10, length * 0.4, 3);
        wctx.closePath();
        wctx.fill();
        wctx.stroke();
        // 內側青綠鋒刃
        wctx.strokeStyle = '#00f0ff';
        wctx.beginPath();
        wctx.moveTo(length * 0.45, -2);
        wctx.quadraticCurveTo(length * 0.65, -12, length * 0.92, -15);
        wctx.stroke();
        break;
      }

      case 7:
      default: {
        // 7. 雙尖刺細劍 (Estoc/Rapier): 圓盤護手、極致修長穿刺金刃
        wctx.strokeStyle = '#ffd556';
        wctx.fillStyle = '#1a1c23';
        wctx.fillRect(-length * 0.38, -1.5, length * 0.38, 3);
        // 圓盤護手碗
        wctx.fillStyle = '#d4af37';
        wctx.beginPath();
        wctx.ellipse(0, 0, 4, 10, 0, 0, Math.PI * 2);
        wctx.fill();
        wctx.stroke();
        // 細劍身
        wctx.fillStyle = '#ffffff';
        wctx.beginPath();
        wctx.moveTo(0, -2.5);
        wctx.lineTo(length, 0);
        wctx.lineTo(0, 2.5);
        wctx.closePath();
        wctx.fill();
        // 核心光槽
        wctx.strokeStyle = '#ff2a4b';
        wctx.beginPath();
        wctx.moveTo(2, 0);
        wctx.lineTo(length * 0.8, 0);
        wctx.stroke();
        break;
      }
    }
    wctx.restore();
  }

  // -------------------------------------------------------------
  // 階段 0: 0% – 20% 門扉展開 (門扉光芒 + 空間漣漪)
  // 階段 1: 20% – 40% 門前露刃蓄力 (神兵完全移出門口停留，朝向分配目標)
  // 階段 2: 40% – 74% 四批分批飛向對應目標 (命中火花與軌跡)
  // 階段 3: 74% – 100% 乖離劍 Ea 三節逆向旋轉與空間撕裂
  // -------------------------------------------------------------

  // 計算各門扉展開度 portalProgress
  const portalAlpha = p < 0.05 ? p / 0.05 : p > 0.78 ? Math.max(0, 1 - (p - 0.78) / 0.12) : 1.0;

  // 繪製門扉 (Portals)
  DOORS.forEach((d, idx) => {
    const appearDelay = (idx / numDoors) * 0.15; // 0.0 ~ 0.15 逐門點亮
    if (p < appearDelay) return;

    const doorP = Math.min(1, (p - appearDelay) / 0.1);
    const radius = 18 * d.scale * doorP;

    ctx.save();
    ctx.translate(d.x, d.y);

    // 空間漣漪金色漸層 (Ripple)
    const pulse = 1 + Math.sin(p * 20 + d.wave * Math.PI * 2) * 0.12;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 1.5 * pulse);
    grad.addColorStop(0, 'rgba(255, 255, 255, ' + 0.95 * portalAlpha + ')');
    grad.addColorStop(0.3, 'rgba(255, 225, 90, ' + 0.85 * portalAlpha + ')');
    grad.addColorStop(0.7, 'rgba(220, 150, 20, ' + 0.45 * portalAlpha + ')');
    grad.addColorStop(1, 'rgba(180, 80, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 同心水波金色光環
    ctx.strokeStyle = 'rgba(255, 235, 130, ' + 0.9 * portalAlpha + ')';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 180, 50, ' + 0.6 * portalAlpha + ')';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  });

  // -------------------------------------------------------------
  // 繪製 59 把神兵 (分配至 activeTargets)
  // -------------------------------------------------------------
  if (p >= 0.18 && p < 0.78) {
    DOORS.forEach((d, idx) => {
      // 分配目標 target
      const target = activeTargets[idx % numTargets];
      const dx = target.x - d.x;
      const dy = target.y - d.y;
      const targetAngle = Math.atan2(dy, dx);
      const totalDist = Math.hypot(dx, dy);

      // 4 批次時間 (Batching: 4 batches)
      const batchId = idx % 4; // 0, 1, 2, 3
      const fireStart = 0.42 + batchId * 0.07; // 0.40, 0.48, 0.56, 0.64
      const fireDuration = 0.08; // 飛馳時間

      ctx.save();

      if (p < fireStart) {
        // 20% – 40% 階段：神兵緩緩從門口探出、停在門前蓄力
        // 露刃率：0.20 到 0.35 伸出並停滯
        const emergeProgress = Math.min(1, Math.max(0, (p - 0.18) / 0.08));
        // 伸出位置 (停在門前方約 24px 處)
        const emergeDist = emergeProgress * 26;
        const wx = d.x + Math.cos(targetAngle) * emergeDist;
        const wy = d.y + Math.sin(targetAngle) * emergeDist;

        ctx.translate(wx, wy);
        ctx.rotate(targetAngle);

        // 刀刃高光光閃 (Charge Glint)
        if (p > 0.32) {
          const glint = Math.sin((p - 0.32) * 45 + idx) * 0.5 + 0.5;
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 10 * glint;
        }

        drawWeapon(ctx, d.type, 38 * d.scale);
      } else if (p >= fireStart && p < fireStart + fireDuration) {
        // 飛馳發射中 (Flight)
        const flightP = (p - fireStart) / fireDuration;
        const easeP = flightP * flightP; // 加速直衝
        const curDist = 26 + (totalDist - 26) * easeP;
        const curX = d.x + Math.cos(targetAngle) * curDist;
        const curY = d.y + Math.sin(targetAngle) * curDist;

        // 金黃與青藍離子拖尾
        ctx.strokeStyle = idx % 2 === 0 ? 'rgba(255, 213, 86, 0.7)' : 'rgba(0, 240, 255, 0.7)';
        ctx.lineWidth = 2.5 * d.scale;
        ctx.beginPath();
        ctx.moveTo(curX - Math.cos(targetAngle) * 60, curY - Math.sin(targetAngle) * 60);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        ctx.translate(curX, curY);
        ctx.rotate(targetAngle);
        ctx.shadowColor = '#ffd556';
        ctx.shadowBlur = 14;
        drawWeapon(ctx, d.type, 40 * d.scale);
      } else {
        // 命中後 (Hit Spark & Imbed Flash)
        const hitTime = p - (fireStart + fireDuration);
        if (hitTime < 0.12) {
          const hitAlpha = 1 - hitTime / 0.12;
          // 在目標位置爆發放射火花
          ctx.translate(target.x, target.y);
          ctx.strokeStyle = 'rgba(255, 230, 110, ' + hitAlpha + ')';
          ctx.lineWidth = 2;
          for (let k = 0; k < 6; k++) {
            const sparkAngle = (k / 6) * Math.PI * 2 + idx * 0.7;
            const sparkDist = hitTime * 220 + 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(sparkAngle) * 4, Math.sin(sparkAngle) * 4);
            ctx.lineTo(Math.cos(sparkAngle) * sparkDist, Math.sin(sparkAngle) * sparkDist);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    });
  }

  // -------------------------------------------------------------
  // 階段 3: 74% – 100% 乖離劍 Ea (三節逆旋赤黑神劍 & 天地裂界空間風暴)
  // -------------------------------------------------------------
  if (p >= 0.73) {
    const eaP = (p - 0.73) / 0.27; // 0.0 -> 1.0

    ctx.save();
    // 乖離劍基點：施法者前方 (x: 90, y: -20)
    const eaOriginX = 90;
    const eaOriginY = -20;

    // Ea 旋轉速度 (三節逆向研磨，轉速漸劇)
    const spinSpeed = 15 + eaP * 45;
    const roll1 = p * spinSpeed;
    const roll2 = -p * (spinSpeed * 1.15);
    const roll3 = p * (spinSpeed * 1.3);

    ctx.translate(eaOriginX, eaOriginY);

    // 1. 乖離劍本體 (劍柄、金色繁複護手、無刃三節圓柱)
    // 劍柄
    ctx.fillStyle = '#11131b';
    ctx.strokeStyle = '#ffd556';
    ctx.lineWidth = 2;
    ctx.fillRect(-50, -4, 45, 8);
    ctx.strokeRect(-50, -4, 45, 8);

    // 金色寶石劍首
    ctx.fillStyle = '#ff2a4b';
    ctx.beginPath();
    ctx.arc(-54, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 奢華金色羽翼護手
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(-5, -24);
    ctx.lineTo(8, -8);
    ctx.lineTo(8, 8);
    ctx.lineTo(-5, 24);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 三節圓柱體 (赤黑相間，刻劃古老神代血紅符文紋理)
    const segWidth = 32;
    const segHeight = 15;
    const segConfigs = [
      { x: 12, roll: roll1, rad: 8.5 },
      { x: 48, roll: roll2, rad: 7.8 },
      { x: 82, roll: roll3, rad: 6.8 },
    ];

    segConfigs.forEach((seg, sIdx) => {
      // 圓柱底色：黑曜鐵色
      ctx.fillStyle = '#0f1118';
      ctx.strokeStyle = '#ffd556';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(seg.x, -seg.rad, segWidth, seg.rad * 2, [3]);
      ctx.fill();
      ctx.stroke();

      // 逆旋表面赤紅符文線 (透過 sin/cos 模擬立體旋轉掃掠)
      ctx.strokeStyle = '#ff2a4b';
      ctx.lineWidth = 2.0;
      for (let m = -1; m <= 2; m++) {
        const stripeX = seg.x + ((((m * 12 + seg.roll * 8) % segWidth) + segWidth) % segWidth);
        ctx.beginPath();
        ctx.moveTo(stripeX, -seg.rad + 1);
        ctx.lineTo(stripeX + 4, seg.rad - 1);
        ctx.stroke();
      }

      // 節與節之間的赤金能量輝光環
      ctx.fillStyle = '#ffd556';
      ctx.beginPath();
      ctx.arc(seg.x + segWidth, 0, seg.rad + 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. 空間撕裂風暴發射 (Enuma Elish 風暴)
    if (eaP > 0.25) {
      const blastP = (eaP - 0.25) / 0.75; // 0.0 -> 1.0
      const stormLength = blastP * 820;

      // 核心赤黑螺旋風暴 (Cylindrical Void Tornado)
      ctx.save();
      ctx.translate(118, 0);

      // 外層三色螺旋氣浪 (赤紅、黑曜、熾金)
      const spiralCount = 18;
      for (let sp = 0; sp < spiralCount; sp++) {
        const st = sp / spiralCount;
        const distOnAxis = st * stormLength;
        const spreadRad = 12 + Math.pow(st, 1.4) * 85;

        const ang1 = blastP * 30 + st * Math.PI * 8;
        const ang2 = ang1 + Math.PI;

        // 赤金光流
        ctx.fillStyle = sp % 2 === 0 ? 'rgba(255, 42, 75, 0.75)' : 'rgba(255, 213, 86, 0.85)';
        ctx.beginPath();
        ctx.arc(distOnAxis, Math.sin(ang1) * spreadRad, 4 + st * 9, 0, Math.PI * 2);
        ctx.fill();

        // 虛空黑曜斷層粒
        ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
        ctx.beginPath();
        ctx.arc(distOnAxis, Math.sin(ang2) * spreadRad * 0.8, 5 + st * 11, 0, Math.PI * 2);
        ctx.fill();
      }

      // 中心黑洞直柱光束 (Singularity Core)
      const coreGrad = ctx.createLinearGradient(0, -22, 0, 22);
      coreGrad.addColorStop(0, 'rgba(255, 42, 75, 0)');
      coreGrad.addColorStop(0.2, 'rgba(255, 42, 75, 0.85)');
      coreGrad.addColorStop(0.5, '#05070c'); // 漆黑內核
      coreGrad.addColorStop(0.8, 'rgba(255, 213, 86, 0.85)');
      coreGrad.addColorStop(1, 'rgba(255, 213, 86, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(stormLength, -45 * blastP);
      ctx.lineTo(stormLength, 45 * blastP);
      ctx.lineTo(0, 14);
      ctx.closePath();
      ctx.fill();

      // 終端空間斷裂震波 (Dimensional Fracture Rings)
      if (blastP > 0.45) {
        const shockCount = 4;
        for (let sc = 0; sc < shockCount; sc++) {
          const shockP = ((blastP - 0.45) * 2 + sc * 0.25) % 1.0;
          const ringX = stormLength * 0.95;
          const rX = shockP * 70;
          const rY = shockP * 140;

          ctx.strokeStyle =
            sc % 2 === 0
              ? 'rgba(255, 42, 75, ' + (1 - shockP) + ')'
              : 'rgba(255, 255, 255, ' + (1 - shockP) + ')';
          ctx.lineWidth = 3.0 * (1 - shockP);
          ctx.beginPath();
          ctx.ellipse(ringX, 0, rX, rY, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  ctx.restore();
}
