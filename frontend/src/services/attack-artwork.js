import { createAreaAttack } from './attack-area.js';
import { createRevisionAttack } from './attack-revision.js';
import attackEffects from '../../../public/shared/attack-effects.json';
/* Adapted from user 攻擊.zip: 15_4 full artwork plus 8 independent obsidian crescent variants.
 * Static reviewed drawing code only: no export UI, global inputs, dummy, shake or endless demo. */
import { motionAllowed, watchMotionCancellation } from './motion-lifetime.js';
import { createStitchAttack } from './attack-stitch.js';
import combatRules from '../../../public/shared/scene-rules.json';
import attackTiming from '../../../public/shared/attack-timing.json';
export function playAttackArtwork(surface, options) {
  if (!motionAllowed()) return () => {};
  // Previews use the same phase schedule; real scenes only show server-settled hits.
  if (options.preview && !options.readHits && !['shield', 'sphere'].includes(options.effect)) {
    const area = attackEffects.find((effect) => effect.id === options.effect)?.area;
    const base =
      ((combatRules.damage.min + combatRules.damage.max) / 2) *
      combatRules.unitScale *
      (area ? combatRules.areaDamageMultiplier : 1) *
      (options.effect === 'explosion' ? 1.5 : 1);
    const points = options.hits?.length ? options.hits : [options.to];
    const hits = (attackTiming[options.effect] || []).flatMap(([delayMs, weight, phase]) =>
      points.slice(0, 32).map((point, index) => ({
        ...point,
        toId: String(index),
        phase,
        delayMs,
        damage: Math.round(base * weight),
        critical: false,
      })),
    );
    options = { ...options, readHits: () => hits };
  }
  const ctx = surface.getContext('2d');
  if (!ctx) return () => {};
  const width = options.width,
    height = options.height,
    quality = Math.min(1, 1280 / width, 900 / height);
  surface.width = Math.max(1, Math.round(width * quality));
  surface.height = Math.max(1, Math.round(height * quality));
  ctx.setTransform(quality, 0, 0, quality, 0, 0);
  const defensive = ['shield', 'sphere'].includes(options.effect),
    from = options.from,
    to = defensive ? from : options.to;
  const state = {
    energyColor: options.color,
    speed: 1.2,
    bloom: 24,
    density: 1,
    damageMult: 1,
    damageShown: false,
    screenShake: false,
    showDmgPopups: !defensive,
    autoSparks: true,
    shakeAmount: 0,
    combo: 0,
    dpsWindow: 0,
    bladeMode: options.effect === 'blade_aura_crimson' ? 'crimson' : 'azure',
    crescentRadius: 75,
    voidOpacity: 0.95,
    dummy: { x: to.x, y: to.y, radius: 35, hitFlash: 0 },
  };
  const particles = [],
    projectiles = [],
    floatingTexts = [],
    shockwaves = [],
    lightningBolts = [],
    hexDeflectSparks = [],
    iceShardBursts = [],
    spaceCuts = [];
  const RAINBOW_PALETTE = [
    '#00f0ff',
    '#ff2a5f',
    '#ffea00',
    '#a855f7',
    '#10b981',
    '#ff007f',
    '#ff8800',
  ];
  let stopped = false,
    frame = 0;
  const timers = new Set();
  function later(callback, ms) {
    if (stopped) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!stopped) callback();
    }, ms);
    timers.add(timer);
  }
  function getActiveColor(alpha = 1) {
    if (state.energyColor === 'rainbow') {
      const hue = (Date.now() / 15) % 360;
      return `hsla(${hue}, 100%, 65%, ${alpha})`;
    }
    if (alpha === 1) return state.energyColor;
    let c = state.energyColor.replace('#', '');
    if (c.length === 3)
      c = c
        .split('')
        .map((x) => x + x)
        .join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }
  function triggerShockwave(x, y, maxRadius = 180, color = null, width = 6) {
    shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      width,
      color: color || getActiveColor(0.8),
      alpha: 1,
      decay: 0.03,
    });
    if (state.screenShake) state.shakeAmount = Math.min(state.shakeAmount + 7, 24);
  }
  function spawnDamageText(x, y, dmg, isCrit = true, customLabel = null, targetHit = null) {
    if (options.readHits && (!targetHit?.phase || targetHit.pending || targetHit.missed)) return;
    const authoritative = targetHit || options;
    if (!state.showDmgPopups) return;
    if (Number.isFinite(authoritative.damage)) {
      if ((!targetHit && state.damageShown) || authoritative.damage <= 0) return;
      if (!targetHit) state.damageShown = true;
      isCrit = authoritative.critical === true;
      customLabel = null;
    }
    const minimum = combatRules.damage.min * combatRules.unitScale;
    const previewBase =
      minimum +
      Math.floor(
        Math.random() *
          ((combatRules.damage.max - combatRules.damage.min) * combatRules.unitScale + 1),
      );
    const amount = Number.isFinite(authoritative.damage)
      ? authoritative.damage
      : Math.round(
          previewBase *
            (attackEffects.find((effect) => effect.id === options.effect)?.area
              ? combatRules.areaDamageMultiplier
              : 1) *
            (isCrit ? combatRules.damage.criticalMultiplier : 1),
        );
    const number = amount.toLocaleString();
    const textStr = customLabel
      ? customLabel.replace(/\d[\d,]*/g, number)
      : isCrit
        ? `CRITICAL ${number}!`
        : number;
    floatingTexts.push({
      x: x + (Math.random() - 0.5) * 44,
      y: y - 20 + (Math.random() - 0.5) * 24,
      vx: (Math.random() - 0.5) * 3.5,
      vy: -(Math.random() * 4 + 4.5),
      text: textStr,
      alpha: 1,
      scale: isCrit ? 1.35 : 1.0,
      color: isCrit ? '#ffd556' : '#ffffff',
    });
    state.dpsWindow += dmg * state.damageMult;
    state.combo++;
  }
  function spawnImpactSparks(x, y, count = 18, color = null) {
    if (!state.autoSparks) return;
    const col = color || getActiveColor();
    for (let i = 0; i < count * state.density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 7 + 2) * state.speed;
      particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 1.5,
        color: col,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  }
  function createLightningBolt(x1, y1, x2, y2, depth, col) {
    lightningBolts.push({
      segments: generateLightningSegments(x1, y1, x2, y2, depth),
      color: col || '#7df4ff',
      alpha: 1,
      width: 4,
    });
  }
  function generateLightningSegments(x1, y1, x2, y2, depth) {
    if (depth === 0) return [{ x1, y1, x2, y2 }];
    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 60;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 60;
    return [
      ...generateLightningSegments(x1, y1, midX, midY, depth - 1),
      ...generateLightningSegments(midX, midY, x2, y2, depth - 1),
    ];
  }
  function fireVfxNode(vfxId, originX, originY, targetX, targetY) {
    const angle = Math.atan2(targetY - originY, targetX - originX);
    const col = getActiveColor();

    switch (vfxId) {
      case 1: // 01 // 連射／散射能量彈 (Barrage)
        for (let i = -3; i <= 3; i++) {
          const spreadAngle = angle + i * 0.09 + (Math.random() - 0.5) * 0.04;
          projectiles.push({
            type: 'barrage',
            x: originX,
            y: originY + i * 5,
            vx: Math.cos(spreadAngle) * (18 + Math.random() * 4) * state.speed,
            vy: Math.sin(spreadAngle) * (18 + Math.random() * 4) * state.speed,
            color: RAINBOW_PALETTE[(i + 3) % RAINBOW_PALETTE.length],
            life: 65,
            trail: [],
          });
        }
        break;

      case 2: // 02 // 超人力霸王十字光線 (Specium Cross Beam)
        projectiles.push({
          type: 'specium_beam',
          x: originX,
          y: originY,
          targetX: targetX,
          targetY: targetY,
          life: 36,
          maxLife: 36,
          color: col,
        });
        triggerShockwave(originX, originY, 70, col, 5);
        spawnImpactSparks(targetX, targetY, 40, col);
        spawnDamageText(targetX, targetY, 158000, true);
        state.shakeAmount = 14;
        break;

      case 3: // 03 // 六角形能量蜂巢護盾 (Hex Shield with Deflection and Crystal Shards)
        shockwaves.push({
          type: 'hex_shield',
          x: targetX,
          y: targetY,
          radius: 18,
          maxRadius: Math.min(125, height * 0.35, width * 0.13),
          alpha: 1,
          decay: 1 / 120,
          color: col,
          hitCount: 0,
        });
        // Spawn incoming hostile bullets that get deflected and shattered into crystals
        for (let b = 0; b < 6; b++) {
          later(() => {
            const bY = targetY + (Math.random() - 0.5) * 110;
            projectiles.push({
              type: 'deflect_bullet',
              x: originX + 50,
              y: bY,
              vx: 19 * state.speed,
              vy: 0,
              shieldX: targetX - 50,
              targetY: bY,
              color: '#ff3366',
              life: 40,
            });
          }, b * 90);
        }
        break;

      case 6: // 06 // 天降神聖光柱 (Orbital Judgment Pillar)
        projectiles.push({
          type: 'orbital_pillar',
          x: targetX,
          y: 0,
          targetY: targetY,
          width: 95,
          life: 40,
          maxLife: 40,
          color: col || '#ffd556',
        });
        triggerShockwave(targetX, targetY, 170, col, 9);
        spawnDamageText(targetX, targetY, 280000, true);
        state.shakeAmount = 18;
        break;

      case 8: // 08 // 黑洞引力坍縮 (Singularity Black Hole)
        projectiles.push({
          type: 'singularity_hole',
          x: targetX,
          y: targetY,
          life: 95,
          maxLife: 95,
          color: col || '#bd00ff',
          rotation: 0,
        });
        triggerShockwave(targetX, targetY, 220, '#000000', 14);
        spawnDamageText(targetX, targetY, 588888, true);
        state.shakeAmount = 22;
        break;

      case 11:
        spawnCrescentSlash(originX, originY - 15, targetX, targetY - 15, state.bladeMode, -0.05);
        later(
          () =>
            spawnCrescentSlash(originX, originY + 20, targetX, targetY + 20, state.bladeMode, 0.07),
          120,
        );
        break;
      case 12: // 12 // 連鎖狂暴雷霆 (Fractal Lightning Tempest)
        for (let b = 0; b < 3; b++) {
          later(() => {
            createLightningBolt(
              targetX + (Math.random() - 0.5) * 60,
              0,
              targetX + (Math.random() - 0.5) * 40,
              targetY + (Math.random() - 0.5) * 30,
              6,
              col,
            );
            triggerShockwave(targetX, targetY, 130, col, 7);
            spawnImpactSparks(targetX, targetY, 20, '#ffffff');
            spawnDamageText(targetX, targetY, 210000, true);
            state.shakeAmount = 16;
          }, b * 110);
        }
        break;

      case 14: // 14 // 光輝天降神聖箭雨 (Celestial Rain of Arrows)
        projectiles.push({ type: 'burning_bow', x: originX, y: originY, life: 45 });
        for (let i = 0; i < 18; i++) {
          later(() => {
            const rx = targetX + (Math.random() - 0.5) * 180;
            projectiles.push({
              type: 'sacred_arrow',
              x: rx - 120,
              y: -50,
              tx: rx,
              ty: targetY + (Math.random() - 0.5) * 50,
              speed: Math.max(26 * state.speed, Math.hypot(120, Math.abs(targetY) + 75) / 42),
              color: '#ff5a24',
              life: 60,
            });
          }, i * 35);
        }
        break;

      case 15: // 15 // 炎獄黑紅烈焰龍捲 (Inferno Fire Tornado)
        projectiles.push({
          type: 'inferno_vortex',
          x: targetX,
          y: targetY,
          life: 80,
          maxLife: 80,
          color1: '#ff3366',
          color2: '#ffd556',
          radius: 95,
        });
        for (let satellite = 0; satellite < 3; satellite++)
          later(
            () => {
              projectiles.push({
                type: 'inferno_vortex',
                x: targetX,
                y: targetY,
                life: 72 - satellite * 8,
                maxLife: 80,
                color1: '#ff3366',
                color2: '#ffd556',
                scale: 0.42 + satellite * 0.07,
                orbit: (satellite * Math.PI * 2) / 3,
              });
            },
            130 * (satellite + 1),
          );
        spawnDamageText(targetX, targetY, 360000, true);
        state.shakeAmount = 16;
        break;
    }

    // Dummy Reaction
    state.dummy.hitFlash = 1.0;
  }
  function spawnSpaceCut(x1, y1, x2, y2, color, coreColor) {
    spaceCuts.push({ x1, y1, x2, y2, color, coreColor, alpha: 1, width: 8, decay: 0.035 });
  }
  function spawnCrescentSlash(originX, originY, targetX, targetY, variant, angleOffset = 0) {
    const baseAngle = Math.atan2(targetY - originY, targetX - originX);
    const isCrimson = variant === 'crimson';

    // 嚴格單色定義：絕對無雙色混雜
    const config = isCrimson
      ? {
          glowColor: '#ff0f3f',
          bladeLight: '#ffffff',
          darkCore: '#090003',
          label: 'CRITICAL CRUSH (赤黑)!',
          textColor: '#ff2a5f',
          tag: 'CRIMSON',
        }
      : {
          glowColor: '#00d0ff',
          bladeLight: '#ffffff',
          darkCore: '#000714',
          label: 'ABYSSAL SLASH (藍黑)!',
          textColor: '#00f0ff',
          tag: 'AZURE',
        };

    const slashRadius = state.crescentRadius;
    const slashSpeed = Math.max(
      26 * state.speed,
      Math.hypot(targetX - originX, targetY - originY) / 75,
    );

    projectiles.push({
      type: 'abyssal_crescent',
      variant,
      bornAt: performance.now() - Math.max(0, options.ageMs || 0),
      originX,
      originY,
      targetX,
      targetY,
      x: originX,
      y: originY,
      vx: Math.cos(baseAngle) * slashSpeed,
      vy: Math.sin(baseAngle) * slashSpeed,
      angle: baseAngle,
      radius: slashRadius,
      config,
      life: 52,
      ghosts: [],
    });

    triggerShockwave(originX, originY, 65, config.glowColor, 4);
    spawnSpaceCut(
      originX - Math.cos(baseAngle) * 50,
      originY - Math.sin(baseAngle) * 50,
      originX + Math.cos(baseAngle) * 90,
      originY + Math.sin(baseAngle) * 90,
      config.glowColor,
      config.darkCore,
    );
  }
  function drawCrescentArc(x, y, angle, radius, config, alpha = 1.0, isGhost = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const rOuter = radius;
    const rInner = radius * 0.68;
    const arcSpread = Math.PI * 0.62;

    if (!isGhost) {
      ctx.shadowBlur = state.bloom;
      ctx.shadowColor = config.glowColor;
    } else {
      ctx.shadowBlur = 8;
      ctx.shadowColor = config.glowColor;
    }

    // Crescent Path
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, -arcSpread / 2, arcSpread / 2, false);
    ctx.quadraticCurveTo(
      rOuter * 0.92,
      0,
      rInner * Math.cos(arcSpread / 2),
      rInner * Math.sin(arcSpread / 2),
    );
    ctx.arc(0, 0, rInner, arcSpread / 2, -arcSpread / 2, true);
    ctx.quadraticCurveTo(
      rOuter * 0.92,
      0,
      rOuter * Math.cos(-arcSpread / 2),
      rOuter * Math.sin(-arcSpread / 2),
    );
    ctx.closePath();

    // Material Fill: Deep Obsidian Void Core with radiating selected monochrome edge
    const grad = ctx.createRadialGradient(rInner * 0.5, 0, rInner * 0.4, 0, 0, rOuter);
    grad.addColorStop(0, config.darkCore);
    grad.addColorStop(0.38, config.darkCore);
    grad.addColorStop(0.78, config.glowColor);
    grad.addColorStop(1, '#ffffff');

    ctx.fillStyle = state.bladeMode === 'azure' ? config.darkCore : grad;
    ctx.fill();

    // White-Hot Incandescent Cutting Blade Edge
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, -arcSpread / 2, arcSpread / 2, false);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isGhost ? 1.5 : 3.5;
    ctx.stroke();

    // Outer Aura Rim (Single Pure Color)
    ctx.beginPath();
    ctx.arc(0, 0, rOuter + 2, -arcSpread / 2, arcSpread / 2, false);
    ctx.strokeStyle = config.glowColor;
    ctx.lineWidth = isGhost ? 3 : 7;
    ctx.stroke();

    // Void Inner Pitch-Black Arc
    ctx.beginPath();
    ctx.arc(0, 0, rInner, -arcSpread / 2.3, arcSpread / 2.3, false);
    ctx.strokeStyle = config.darkCore;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }
  const ids = {
    barrage: 1,
    beam: 2,
    shield: 3,
    chains: 4,
    sphere: 5,
    orbital: 6,
    funnel: 7,
    singularity: 8,
    explosion: 9,
    blade_aura: 11,
    blade_aura_crimson: 11,
    chain_lightning: 12,
    frost_spikes: 13,
    arrow_volley: 14,
    flame_vortex: 15,
  };
  const definition = attackEffects.find((effect) => effect.id === options.effect);
  const area = definition?.area;
  const areaImpact = () => {
    if (options.readHits) return;
    const hits = options.hits || [
      { x: to.x, y: to.y, damage: options.damage, critical: options.critical },
    ];
    for (const hit of hits.slice(0, 32)) {
      triggerShockwave(hit.x, hit.y, 95, options.color, 4);
      spawnImpactSparks(hit.x, hit.y, 8, options.color);
      spawnDamageText(hit.x, hit.y, 1, hit.critical === true, null, hit);
    }
  };
  const advanced =
    createAreaAttack(
      ctx,
      { ...options, area, label: definition?.label, range: combatRules.areaAttackRange },
      areaImpact,
    ) ||
    createRevisionAttack(ctx, options, () => {
      triggerShockwave(to.x, to.y, 105, options.color, 4);
      spawnImpactSparks(to.x, to.y, 22, options.color);
      spawnDamageText(to.x, to.y, 1, options.critical === true);
    }) ||
    createStitchAttack(ctx, options, () => {
      triggerShockwave(to.x, to.y, 105, options.color, 4);
      spawnImpactSparks(to.x, to.y, 22, options.color);
      spawnDamageText(
        to.x,
        to.y,
        1,
        options.effect !== 'chains' && options.effect !== 'frost_spikes',
      );
    });
  if (!advanced) fireVfxNode(ids[options.effect], from.x, from.y, to.x, to.y);
  const start = performance.now() - Math.max(0, Math.min(4100, options.ageMs || 0));
  const emitted = new Set();
  let last = -Infinity;
  let releaseMotion = () => {};
  function stop() {
    if (stopped) return;
    stopped = true;
    releaseMotion();
    cancelAnimationFrame(frame);
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    ctx.clearRect(0, 0, width, height);
  }
  function tick(now) {
    if (stopped) return;
    if (document.hidden || now - start > 4200) {
      stop();
      return;
    }
    if (now - last >= 1000 / 60 - 1) {
      last = now;
      for (const pool of [
        particles,
        projectiles,
        floatingTexts,
        shockwaves,
        lightningBolts,
        spaceCuts,
      ])
        if (pool.length > 220) pool.splice(0, pool.length - 220);
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      advanced?.(now - start);
      for (const hit of options.readHits?.() || []) {
        const key = hit.toId + ':' + hit.phase;
        if (
          emitted.has(key) ||
          hit.pending ||
          hit.missed ||
          !hit.damage ||
          now - start < hit.delayMs
        )
          continue;
        emitted.add(key);
        triggerShockwave(hit.x, hit.y, 80, options.color, 4);
        spawnImpactSparks(hit.x, hit.y, 8, options.color);
        spawnDamageText(hit.x, hit.y, 1, hit.critical, null, hit);
      }

      // Apply Screen Shake

      // 1. Render Target Dummy

      for (let i = spaceCuts.length - 1; i >= 0; i--) {
        const sc = spaceCuts[i];
        sc.alpha -= sc.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, sc.alpha);
        ctx.shadowColor = sc.color;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = sc.color;
        ctx.lineWidth = sc.width * sc.alpha;
        ctx.beginPath();
        ctx.moveTo(sc.x1, sc.y1);
        ctx.lineTo(sc.x2, sc.y2);
        ctx.stroke();

        ctx.strokeStyle = sc.coreColor;
        ctx.lineWidth = Math.max(1, sc.width * sc.alpha * 0.6);
        ctx.stroke();
        ctx.restore();
        if (sc.alpha <= 0) spaceCuts.splice(i, 1);
      }

      // 2. Render & Update Projectiles
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.life--;

        ctx.save();
        ctx.shadowBlur = state.bloom;
        ctx.shadowColor = p.color || getActiveColor();

        if (p.type === 'abyssal_crescent') {
          // Reach the frozen target within 520ms regardless of screen size or FPS.
          const travel = Math.min(1, Math.max(0, (now - p.bornAt) / 520));
          p.x = p.originX + (p.targetX - p.originX) * travel;
          p.y = p.originY + (p.targetY - p.originY) * travel;

          p.ghosts.push({ x: p.x, y: p.y });
          if (p.ghosts.length > 6) p.ghosts.shift();

          for (let g = 0; g < p.ghosts.length; g++) {
            const gh = p.ghosts[g];
            const gAlpha = (g / p.ghosts.length) * 0.45;
            drawCrescentArc(
              gh.x,
              gh.y,
              p.angle,
              p.radius * (0.88 + g * 0.02),
              p.config,
              gAlpha,
              true,
            );
          }

          drawCrescentArc(p.x, p.y, p.angle, p.radius, p.config, 1.0, false);

          const dist = Math.hypot(p.x - state.dummy.x, p.y - state.dummy.y);
          if (dist < state.dummy.radius + p.radius * 0.45 || p.life <= 0) {
            triggerShockwave(p.x, p.y, 110, p.config.glowColor, 7);
            spawnImpactSparks(p.x, p.y, 32, p.config.glowColor);
            spawnDamageText(p.x, p.y, 168000, true);
            spawnSpaceCut(
              p.x - Math.cos(p.angle) * 70,
              p.y - Math.sin(p.angle) * 70,
              p.x + Math.cos(p.angle) * 90,
              p.y + Math.sin(p.angle) * 90,
              p.config.glowColor,
              p.config.darkCore,
            );

            projectiles.splice(i, 1);
          }
        } else if (p.type === 'barrage') {
          p.x += p.vx;
          p.y += p.vy;
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 8) p.trail.shift();

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          for (let t = p.trail.length - 1; t >= 0; t--) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          const dist = Math.hypot(p.x - state.dummy.x, p.y - state.dummy.y);
          if (dist < state.dummy.radius || p.life <= 0) {
            spawnImpactSparks(p.x, p.y, 16, p.color);
            spawnDamageText(p.x, p.y, 22000, Math.random() > 0.4);
            projectiles.splice(i, 1);
          }
        } else if (p.type === 'deflect_bullet') {
          p.x += p.vx;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          // When hits hex shield barrier
          if (p.x >= p.shieldX) {
            triggerShockwave(p.x, p.y, 50, '#00f0ff', 3);
            spawnImpactSparks(p.x, p.y, 15, '#7df4ff');
            spawnDamageText(p.x, p.y, 0, false, 'DEFLECTED!');
            projectiles.splice(i, 1);
          } else if (p.life <= 0) {
            projectiles.splice(i, 1);
          }
        } else if (p.type === 'specium_beam') {
          const progress = 1 - p.life / p.maxLife;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.strokeStyle = '#ffffff';
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 24;
          ctx.lineWidth = 4;
          ctx.globalAlpha = Math.max(0, 1 - progress);
          ctx.beginPath();
          ctx.moveTo(-25, 0);
          ctx.lineTo(25, 0);
          ctx.moveTo(0, -38);
          ctx.lineTo(0, 38);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 26 * Math.sin(progress * Math.PI);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.targetX, p.targetY);
          ctx.stroke();

          // Core hot-white line
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 8 * Math.sin(progress * Math.PI);
          ctx.stroke();

          // Double spiral electric overlay
          ctx.strokeStyle = '#7df4ff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          const beamDist = Math.hypot(p.targetX - p.x, p.targetY - p.y);
          const beamAngle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
          for (let s = 0; s < beamDist; s += 14) {
            const spiralY = Math.sin(s * 0.12 - now * 0.03) * 22;
            const px = p.x + Math.cos(beamAngle) * s - Math.sin(beamAngle) * spiralY;
            const py = p.y + Math.sin(beamAngle) * s + Math.cos(beamAngle) * spiralY;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();

          if (p.life <= 0) projectiles.splice(i, 1);
        } else if (p.type === 'orbital_pillar') {
          const progress = Math.sin((1 - p.life / p.maxLife) * Math.PI);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = progress * 0.85;
          ctx.fillRect(p.x - (p.width * progress) / 2, 0, p.width * progress, p.targetY);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(p.x - 12, 0, 24, p.targetY);
          if (p.life <= 0) projectiles.splice(i, 1);
        } else if (p.type === 'singularity_hole') {
          p.rotation += 0.09;
          const progress = p.life / p.maxLife;
          const radius = 75 * Math.sin((1 - progress) * Math.PI);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          const grad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.5);
          grad.addColorStop(0, '#000000');
          grad.addColorStop(0.5, p.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 1.35, radius * 0.4, 0.4, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
          if (p.life <= 0) projectiles.splice(i, 1);
        } else if (p.type === 'crescent_slash') {
          p.x += p.vx;
          p.y += p.vy;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, 0, 56, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();

          const dist = Math.hypot(p.x - state.dummy.x, p.y - state.dummy.y);
          if (dist < state.dummy.radius || p.life <= 0) {
            triggerShockwave(p.x, p.y, 90, p.color, 5);
            spawnImpactSparks(p.x, p.y, 22, p.color);
            spawnDamageText(p.x, p.y, 115000, true);
            projectiles.splice(i, 1);
          }
        } else if (p.type === 'burning_bow') {
          ctx.translate(p.x, p.y);
          ctx.scale(Math.min(1, height / 240), Math.min(1, height / 240));
          ctx.globalAlpha = Math.min(1, p.life / 12);
          ctx.shadowColor = '#ff5a24';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(0, -42);
          ctx.quadraticCurveTo(46, 0, 0, 42);
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.strokeStyle = '#ff5a24';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -42);
          ctx.lineTo(-12, 0);
          ctx.lineTo(0, 42);
          ctx.strokeStyle = '#fff1dc';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          if (p.life <= 0) projectiles.splice(i, 1);
        } else if (p.type === 'sacred_arrow') {
          const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
          p.x += Math.cos(angle) * p.speed;
          p.y += Math.sin(angle) * p.speed;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(angle);
          // Dark outline keeps the shaft, broad head and split fletching
          // legible inside the orange-red glow.
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 9;
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(-44, 0);
          ctx.lineTo(0, 0);
          ctx.stroke();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-6, -6);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-6, 6);
          ctx.closePath();
          ctx.fillStyle = '#fff1dc';
          ctx.fill();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-30, 0);
            ctx.lineTo(-43, side * 7);
            ctx.lineTo(-38, 0);
            ctx.fillStyle = p.color;
            ctx.fill();
          }
          ctx.restore();

          const dist = Math.hypot(p.x - p.tx, p.y - p.ty);
          if (dist < 18 || p.life <= 0) {
            spawnImpactSparks(p.tx, p.ty, 14, p.color);
            spawnDamageText(p.tx, p.ty, 48000, false);
            projectiles.splice(i, 1);
          }
        } else if (p.type === 'inferno_vortex') {
          const elapsed = 1 - p.life / p.maxLife,
            growth = Math.min(1, elapsed * 3.5),
            fade = Math.min(1, p.life / 16);
          const tower = Math.min(230, height * 0.65, Math.max(35, p.y + 42 - 28)) * growth,
            baseY = p.y + 42,
            spin = elapsed * Math.PI * 11;
          ctx.save();
          const satelliteScale = p.scale || 1;
          const orbitX = p.scale ? Math.cos(spin * 0.3 + p.orbit) * Math.min(110, width * 0.18) : 0;
          const orbitY = p.scale ? Math.sin(spin * 0.3 + p.orbit) * 18 : 0;
          ctx.translate(
            Math.max(30, Math.min(width - 30, p.x + orbitX)),
            Math.min(height - 8, baseY + orbitY),
          );
          ctx.scale(satelliteScale, satelliteScale);
          ctx.globalAlpha = fade;
          const glow = ctx.createRadialGradient(
            0,
            -tower * 0.45,
            5,
            0,
            -tower * 0.45,
            Math.max(10, tower * 0.65),
          );
          glow.addColorStop(0, 'rgba(255,190,30,0.22)');
          glow.addColorStop(1, 'rgba(255,40,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(-120, -tower - 30, 240, tower + 70);
          for (let strand = 0; strand < 5; strand++) {
            ctx.beginPath();
            for (let step = 0; step <= 60; step++) {
              const t = step / 60,
                radius = (18 + 65 * t) * growth,
                phase = spin + strand * Math.PI * 0.4 + t * Math.PI * 6;
              const x = Math.sin(phase) * radius,
                y = -t * tower + Math.cos(phase) * radius * 0.18;
              if (step === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = strand % 2 ? p.color1 : p.color2;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 18;
            ctx.lineWidth = 5 + (strand % 2) * 2;
            ctx.stroke();
          }
          for (let j = 0; j < 30; j++) {
            const t = (elapsed * 1.8 + j / 30) % 1,
              phase = spin + j * 2.4 + t * 8,
              radius = (15 + 60 * t) * growth;
            const x = Math.sin(phase) * radius,
              y = -t * tower + Math.cos(phase) * 7;
            ctx.fillStyle = j % 3 ? '#fb923c' : '#fff7b2';
            ctx.shadowColor = '#ff6b00';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(x, y, 2.5, 5 + (j % 3), phase, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          if (p.life <= 0) projectiles.splice(i, 1);
        }

        ctx.restore();
      }

      // 3. Render Shockwaves & Shields
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += (sw.maxRadius - sw.radius) * 0.12;
        sw.alpha -= sw.decay;

        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = sw.color;

        if (sw.type === 'hex_shield') {
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 3.5;
          ctx.globalAlpha = Math.max(0, sw.alpha);
          ctx.save();
          ctx.translate(sw.x, sw.y);
          // 3D Hexagonal Honeycomb Matrix
          for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            const r = sw.radius * (ring * 0.4);
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2;
              const px = Math.cos(a) * r;
              const py = Math.sin(a) * r;
              if (k === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = sw.width;
          ctx.globalAlpha = Math.max(0, sw.alpha);
          ctx.stroke();
        }

        ctx.restore();
        if (sw.alpha <= 0) shockwaves.splice(i, 1);
      }

      // 4. Render Lightning Bolts
      for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const lb = lightningBolts[i];
        lb.alpha -= 0.07;
        ctx.save();
        ctx.strokeStyle = lb.color;
        ctx.lineWidth = lb.width;
        ctx.globalAlpha = Math.max(0, lb.alpha);
        ctx.shadowColor = lb.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        lb.segments.forEach((seg) => {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        });
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
        if (lb.alpha <= 0) lightningBolts.splice(i, 1);
      }

      // 5. Render Spark Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
        pt.alpha -= pt.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (pt.alpha <= 0) particles.splice(i, 1);
      }

      // 6. Render Floating Damage Numbers
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.x += ft.vx;
        ft.y += ft.vy;
        ft.vy += 0.14;
        ft.alpha -= 0.02;

        ctx.save();
        ctx.font = `bold ${Math.floor(18 * ft.scale)}px 'Space Grotesk', sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        const textWidth = ctx.measureText(ft.text)?.width || 0;
        ctx.fillText(
          ft.text,
          Math.max(10, Math.min(width - textWidth - 10, ft.x)),
          Math.max(28, Math.min(height - 12, ft.y)),
        );
        ctx.restore();

        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
      }

      // Update Particle Counter

      ctx.restore();
    }
    frame = requestAnimationFrame(tick);
  }
  releaseMotion = watchMotionCancellation(stop);
  if (!stopped) frame = requestAnimationFrame(tick);
  return stop;
}
