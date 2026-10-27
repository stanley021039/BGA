/* Finite artwork adapted from Stitch project 14297655819267599636.
 * Ea / Excalibur: 98d87eda37064a8d9a0009a974a3bd6a.
 * Phoenix / fists / nine tails: latest source in docs/specs/AREA-ULTIMATES-269.md.
 * Explosion: 27bf69065f5744ebb6b7ab7f891ba3c6.
 * Demo avatars, fixed victims, labels and invented damage removed; authoritative
 * hit locations and numbers belong to attack-artwork. No UI or animation loop. */
/**
 * drawFateAttack(ctx, kind, p)
 * 獨立共用 Canvas2D 繪製器純函式
 * @param {CanvasRenderingContext2D} ctx - 目標 Canvas 上下文
 * @param {'gate_of_babylon' | 'excalibur'} kind - 奧義類型
 * @param {number} p - 動畫進度 (0.00 ~ 1.00，時長4秒映射)
 *
 * 內部局部坐標系：施法者 (0,0)，攻擊方向朝右 (+X)，最遠攻擊距離 X=760，Y 範圍 ±220。
 * 無計時器、無 rAF，純數學幾何繪製，嚴格控制粒子在上限 96 顆以內。
 */
export function drawFateAttack(ctx, kind, p) {
  p = Math.max(0, Math.min(1, p));

  if (kind === 'gate_of_babylon') {
    // -------------------------------------------------------------
    // 01. GATE OF BABYLON & ENUMA ELISH (EA)
    // -------------------------------------------------------------
    // Phase 1: 0.00 - 0.20 金色空間門逐一展開 (12門)
    // Phase 2: 0.20 - 0.65 6種金屬兵裝分批齊射
    // Phase 3: 0.65 - 1.00 乖離劍 Ea 三節逆旋 + 空間風暴
    // -------------------------------------------------------------
    const gateCount = 12;
    const gatePositions = [
      { x: -40, y: -160, r: 24, delay: 0.0 },
      { x: -15, y: -120, r: 28, delay: 0.02 },
      { x: -60, y: -80, r: 22, delay: 0.04 },
      { x: -25, y: -45, r: 30, delay: 0.05 },
      { x: -55, y: -10, r: 25, delay: 0.07 },
      { x: -30, y: 35, r: 26, delay: 0.08 },
      { x: -65, y: 70, r: 28, delay: 0.1 },
      { x: -20, y: 110, r: 24, delay: 0.12 },
      { x: -50, y: 150, r: 32, delay: 0.13 },
      { x: -80, y: -130, r: 20, delay: 0.14 },
      { x: -75, y: 20, r: 22, delay: 0.15 },
      { x: -85, y: 115, r: 22, delay: 0.16 },
    ];

    // 1. 繪製金色空間門與水波漣漪
    gatePositions.forEach((g, idx) => {
      const gProgress = Math.max(0, Math.min(1, (p - g.delay) / 0.14));
      if (gProgress <= 0) return;

      ctx.save();
      ctx.translate(g.x, g.y);

      // 金色水波環與金黃漸層
      const radius = g.r * Math.min(1, gProgress * 1.2);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, 'rgba(255, 245, 180, 0.95)');
      grad.addColorStop(0.4, 'rgba(255, 215, 0, 0.7)');
      grad.addColorStop(0.75, 'rgba(218, 165, 32, 0.35)');
      grad.addColorStop(1, 'rgba(184, 134, 11, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // 水波紋同心圓
      ctx.strokeStyle = `rgba(255, 235, 140, ${0.8 * (1 - (p % 0.2) / 0.2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.3 + 0.6 * ((p * 4 + idx * 0.1) % 1)), 0, Math.PI * 2);
      ctx.stroke();

      // 金色螺旋法陣細線
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });

    // 2. 6種不同真實金屬武器 (直劍、曲劍、雙刃斧、長槍、三叉戟、戰鎚) 齊射 (p: 0.20 - 0.65)
    if (p >= 0.2 && p <= 0.72) {
      const wpProgress = Math.min(1, (p - 0.2) / 0.45);
      const weapons = [
        { type: 'straight_sword', gate: 1, angle: -0.08, delay: 0.0, targetX: 680, targetY: -90 },
        { type: 'curved_saber', gate: 3, angle: 0.02, delay: 0.05, targetX: 720, targetY: -20 },
        { type: 'battle_axe', gate: 4, angle: -0.03, delay: 0.08, targetX: 660, targetY: 40 },
        { type: 'lance', gate: 5, angle: 0.07, delay: 0.12, targetX: 740, targetY: 100 },
        { type: 'trident', gate: 6, angle: 0.11, delay: 0.16, targetX: 700, targetY: 130 },
        { type: 'warhammer', gate: 2, angle: -0.12, delay: 0.2, targetX: 650, targetY: -140 },
        // 第二波交錯
        { type: 'straight_sword', gate: 7, angle: 0.06, delay: 0.22, targetX: 710, targetY: 70 },
        { type: 'lance', gate: 0, angle: -0.06, delay: 0.25, targetX: 750, targetY: -70 },
      ];

      weapons.forEach((w) => {
        const localP = (wpProgress - w.delay) / 0.65;
        if (localP <= 0 || localP >= 1.2) return;

        const g = gatePositions[w.gate];
        const flyT = Math.min(1, localP * 1.5);
        const curX = g.x + (w.targetX - g.x) * flyT;
        const curY = g.y + (w.targetY - g.y) * flyT;

        ctx.save();
        ctx.translate(curX, curY);
        ctx.rotate(w.angle);

        // 金色破空拖尾
        const tailLen = Math.min(140, 180 * flyT);
        const tailGrad = ctx.createLinearGradient(-tailLen, 0, 10, 0);
        tailGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
        tailGrad.addColorStop(0.6, 'rgba(255, 215, 0, 0.45)');
        tailGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
        ctx.fillStyle = tailGrad;
        ctx.fillRect(-tailLen, -3, tailLen, 6);

        // 依類型畫實體金屬輪廓 (金色鍍層與銀鋼本體)
        ctx.fillStyle = '#e5e7eb';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5;

        switch (w.type) {
          case 'straight_sword':
            // 雙刃直劍
            ctx.beginPath();
            ctx.moveTo(35, 0);
            ctx.lineTo(15, -4);
            ctx.lineTo(-20, -3);
            ctx.lineTo(-20, 3);
            ctx.lineTo(15, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 劍格與劍柄
            ctx.fillStyle = '#b45309';
            ctx.fillRect(-22, -8, 4, 16);
            ctx.fillRect(-32, -2, 10, 4);
            break;

          case 'curved_saber':
            // 弧月曲劍
            ctx.beginPath();
            ctx.moveTo(36, -2);
            ctx.quadraticCurveTo(15, -10, -18, -2);
            ctx.lineTo(-16, 3);
            ctx.quadraticCurveTo(15, -4, 36, -2);
            ctx.fill();
            ctx.stroke();
            // 圓形護手
            ctx.beginPath();
            ctx.arc(-18, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

          case 'battle_axe':
            // 雙刃戰斧
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(-25, -2, 45, 4); // 柄
            ctx.beginPath();
            // 左前半月弧斧
            ctx.moveTo(12, -2);
            ctx.quadraticCurveTo(18, -18, 5, -20);
            ctx.quadraticCurveTo(10, -8, 8, -2);
            // 右下弧斧
            ctx.quadraticCurveTo(10, 8, 5, 20);
            ctx.quadraticCurveTo(18, 18, 12, 2);
            ctx.fill();
            ctx.stroke();
            break;

          case 'lance':
            // 穿甲長槍
            ctx.beginPath();
            ctx.moveTo(42, 0);
            ctx.lineTo(15, -6);
            ctx.lineTo(10, -2);
            ctx.lineTo(-30, -2);
            ctx.lineTo(-30, 2);
            ctx.lineTo(10, 2);
            ctx.lineTo(15, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;

          case 'trident':
            // 三叉戟
            ctx.fillRect(-28, -2, 40, 4);
            // 中間主刃
            ctx.beginPath();
            ctx.moveTo(38, 0);
            ctx.lineTo(15, -3);
            ctx.lineTo(15, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 上下側刃
            ctx.beginPath();
            ctx.moveTo(32, -8);
            ctx.lineTo(15, -8);
            ctx.lineTo(15, -2);
            ctx.moveTo(32, 8);
            ctx.lineTo(15, 8);
            ctx.lineTo(15, 2);
            ctx.stroke();
            break;

          case 'warhammer':
            // 破陣戰鎚
            ctx.fillRect(-28, -2, 42, 4);
            ctx.fillStyle = '#6b7280';
            ctx.beginPath();
            ctx.rect(10, -10, 16, 20);
            ctx.fill();
            ctx.stroke();
            break;
        }

        ctx.restore();
      });
    }

    // 3. Phase 3: 0.65 - 1.00 乖離劍 Ea 三節逆向旋轉 + 撕裂空間風暴
    if (p >= 0.6) {
      const eaP = (p - 0.6) / 0.4;
      ctx.save();
      ctx.translate(50, 0); // 施法者前方手持 Ea

      // 劍身三節圓柱 (Ea的特殊無刃三段式圓柱)
      const segW = 32;
      const segH = 22;
      const rotBase = eaP * 30; // 旋轉角度

      // 劍柄與黃金神聖護手
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-45, -4, 25, 8);
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.ellipse(-20, 0, 6, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 第一段圓柱 (順轉)
      drawEaSegment(ctx, -10, 0, segW, segH, rotBase, 1);
      // 第二段圓柱 (逆轉)
      drawEaSegment(ctx, 24, 0, segW, segH, -rotBase * 1.25, -1);
      // 第三段圓柱 (順轉)
      drawEaSegment(ctx, 58, 0, segW - 4, segH - 2, rotBase * 1.5, 1);

      // 劍尖開闢頂部金錐
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.moveTo(88, 0);
      ctx.lineTo(82, -8);
      ctx.lineTo(82, 8);
      ctx.closePath();
      ctx.fill();

      // 4. 紅黑扭曲螺旋空間風暴 (噴射向 +X，覆蓋至少半屏)
      if (eaP > 0.15) {
        const stormP = (eaP - 0.15) / 0.85;
        const stormLen = 700 * Math.min(1, stormP * 1.3);
        const stormW = 190 * Math.min(1, stormP * 1.2);

        // 核心紅黑撕裂光錐
        const stormGrad = ctx.createLinearGradient(90, 0, 90 + stormLen, 0);
        stormGrad.addColorStop(0, 'rgba(255, 42, 75, 0.95)');
        stormGrad.addColorStop(0.3, 'rgba(120, 0, 20, 0.85)');
        stormGrad.addColorStop(0.7, 'rgba(255, 190, 40, 0.7)');
        stormGrad.addColorStop(1, 'rgba(255, 42, 75, 0.05)');

        ctx.fillStyle = stormGrad;
        ctx.beginPath();
        ctx.moveTo(88, 0);
        ctx.lineTo(88 + stormLen, -stormW * 0.7);
        ctx.lineTo(88 + stormLen * 1.05, 0);
        ctx.lineTo(88 + stormLen, stormW * 0.7);
        ctx.closePath();
        ctx.fill();

        // 螺旋撕裂風暴雙色流線 (紅黑相間扭曲幾何)
        ctx.lineWidth = 3;
        const coils = 6;
        for (let i = 0; i < coils; i++) {
          const shift = (stormP * 4 + i / coils) % 1;
          const coilX = 90 + stormLen * shift;
          const coilYRadius = shift * stormW * 0.8 + 10;

          ctx.strokeStyle = i % 2 === 0 ? '#ff2a4b' : 'rgba(20, 0, 5, 0.95)';
          ctx.beginPath();
          ctx.ellipse(coilX, 0, 22 * shift, coilYRadius, i % 2 === 0 ? 0.3 : -0.3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 末端空間裂痕與環狀震波
        ctx.strokeStyle = 'rgba(255, 235, 120, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(90 + stormLen * 0.92, 0, stormW * 0.85, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
      }

      ctx.restore();
    }
  } else if (kind === 'excalibur') {
    // -------------------------------------------------------------
    // 02. EXCALIBUR (SWORD OF PROMISED VICTORY)
    // -------------------------------------------------------------
    // Phase 1: 0.00 - 0.28 風之結界 (Invisible Air) 螺旋包覆與剝離
    // Phase 2: 0.28 - 0.50 聖劍舉起、白金聖光匯聚、地面風壓
    // Phase 3: 0.50 - 1.00 揮劍，超粗白熱光束 + 雙層噴射錐
    // -------------------------------------------------------------
    const isWindsBound = p < 0.28;
    const isLifting = p >= 0.28 && p < 0.5;
    const isSlashing = p >= 0.5;

    ctx.save();

    // 依階段決定聖劍角度與位置
    let swordX = 20,
      swordY = 0,
      swordAngle = 0;

    if (p < 0.28) {
      // 0-28% 水平持劍，風之結界剝離
      swordX = 40;
      swordY = 0;
      swordAngle = 0;
    } else if (p < 0.5) {
      // 28-50% 舉劍過頂蓄力 (角度從 0 -> -0.85 弧度向上揚起)
      const liftT = (p - 0.28) / 0.22;
      swordX = 40 - 15 * liftT;
      swordY = -20 * liftT;
      swordAngle = -0.85 * Math.sin(liftT * Math.PI * 0.5);
    } else {
      // 50-100% 猛烈揮落朝右正前方噴發
      const slashT = Math.min(1, (p - 0.5) / 0.12);
      swordX = 45;
      swordY = 5;
      swordAngle = -0.85 + 0.95 * slashT; // 揮至微向下傾角
    }

    ctx.translate(swordX, swordY);
    ctx.rotate(swordAngle);

    // 1. 繪製真實金色誓約勝利之劍本體 (黃金劍身 + 藍琺瑯飾紋 + 金色十字護手)
    drawExcaliburSword(ctx, isWindsBound, p);

    // 2. 風之結界 (Invisible Air) 螺旋包覆與高速環繞飄帶 (0.00 - 0.28)
    if (p <= 0.32) {
      const windP = p / 0.28;
      const ribbonCount = 5;
      ctx.lineWidth = 2.5;

      for (let r = 0; r < ribbonCount; r++) {
        const offset = (windP * 3 + r / ribbonCount) % 1;
        const ribbonX = 10 + 130 * offset;
        const peelOff = Math.max(0, (windP - 0.6) * 120); // 0.6後開始擴大剝離

        // 青白半透明風壓條帶
        ctx.strokeStyle = `rgba(180, 245, 255, ${0.75 * (1 - windP * 0.7)})`;
        ctx.beginPath();
        ctx.ellipse(ribbonX, 0, 16 + peelOff * 0.4, 24 + peelOff, windP * 4 + r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 旋風核心氣流罩
      const windGrad = ctx.createLinearGradient(0, 0, 140, 0);
      windGrad.addColorStop(0, 'rgba(224, 247, 250, 0.4)');
      windGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.2)');
      windGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
      ctx.fillStyle = windGrad;
      ctx.beginPath();
      ctx.ellipse(75, 0, 80, 22 * (1 + (windP > 0.6 ? (windP - 0.6) * 2 : 0)), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 聖光匯聚 (28% - 50%)
    if (isLifting) {
      const gP = (p - 0.28) / 0.22;
      // 劍身綻放高溫白金輝光
      const glowGrad = ctx.createRadialGradient(80, 0, 5, 80, 0, 140 * gP);
      glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      glowGrad.addColorStop(0.3, 'rgba(255, 223, 100, 0.65)');
      glowGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.25)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(80, 0, 140 * gP, 0, Math.PI * 2);
      ctx.fill();

      // 白金光粒子匯入劍身
      for (let i = 0; i < 16; i++) {
        const angle = i * ((Math.PI * 2) / 16) + gP * 3;
        const dist = 130 * (1 - gP);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(80 + Math.cos(angle) * dist, Math.sin(angle) * dist, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // 4. 地面風壓氣流環 (蓄力與斬擊時在地面 X:40, Y:130)
    if (p >= 0.25 && p <= 0.85) {
      ctx.save();
      ctx.translate(40, 120);
      ctx.scale(1, 0.25);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 60 + p * 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. 揮劍噴出超粗白熱光束與雙層噴射錐 (50% - 100%)
    if (isSlashing) {
      const beamP = (p - 0.5) / 0.5;
      const maxBeamLen = 740;
      const currentLen = maxBeamLen * Math.min(1, beamP * 1.5);
      const beamThick = 150 * (1 - Math.max(0, beamP - 0.7) * 0.9); // 末尾微縮

      ctx.save();
      ctx.translate(swordX + 60, swordY);

      // 外層噴射錐 (高飽和金黃與淡青光芒，覆蓋半屏)
      const outerGrad = ctx.createLinearGradient(0, 0, currentLen, 0);
      outerGrad.addColorStop(0, 'rgba(255, 235, 100, 0.95)');
      outerGrad.addColorStop(0.3, 'rgba(255, 215, 0, 0.7)');
      outerGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.4)');
      outerGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.moveTo(0, -beamThick * 0.15);
      ctx.lineTo(currentLen, -beamThick * 0.85);
      ctx.lineTo(currentLen * 1.04, 0);
      ctx.lineTo(currentLen, beamThick * 0.85);
      ctx.lineTo(0, beamThick * 0.15);
      ctx.closePath();
      ctx.fill();

      // 內層雙層噴射錐 (白熱純白熾芯)
      const innerGrad = ctx.createLinearGradient(0, 0, currentLen, 0);
      innerGrad.addColorStop(0, '#ffffff');
      innerGrad.addColorStop(0.5, 'rgba(255, 255, 220, 0.95)');
      innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');

      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.moveTo(0, -beamThick * 0.08);
      ctx.lineTo(currentLen * 0.95, -beamThick * 0.4);
      ctx.lineTo(currentLen, 0);
      ctx.lineTo(currentLen * 0.95, beamThick * 0.4);
      ctx.lineTo(0, beamThick * 0.08);
      ctx.closePath();
      ctx.fill();

      // 金色高密度光束粒子線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      for (let s = -2; s <= 2; s++) {
        ctx.beginPath();
        ctx.moveTo(0, s * 6);
        ctx.lineTo(currentLen * 0.9, s * (beamThick * 0.3));
        ctx.stroke();
      }

      // 末端金色衝擊環 (Impact Rings)
      if (currentLen > 200) {
        ctx.strokeStyle = 'rgba(255, 240, 160, 0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(currentLen * 0.95, 0, 25, beamThick * 0.9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // HELPER 1: 繪製 Ea 三段圓柱
  // -------------------------------------------------------------
  function drawEaSegment(ctx, x, y, w, h, rotAngle, dir) {
    ctx.save();
    ctx.translate(x + w / 2, y);

    // 圓柱體暗紅基底
    ctx.fillStyle = '#1c0407';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.stroke();

    // 旋轉紋理 (赤紅楔形符文與金邊)
    ctx.clip();
    ctx.fillStyle = '#ff1744';
    const offset = rotAngle % 20;
    for (let lx = -w; lx <= w * 2; lx += 12) {
      ctx.fillRect(lx + offset * dir, -h / 2, 4, h);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // HELPER 2: 繪製 Excalibur 聖劍本體
  // -------------------------------------------------------------
  function drawExcaliburSword(ctx, isBound, progress) {
    // 劍柄與劍首 (藍琺瑯 + 金色環)
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(-24, 0, 5, 0, Math.PI * 2); // Pommel
    ctx.fill();

    // 握柄
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-20, -3.5, 20, 7);

    // 金色十字形華麗護手
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(8, -12);
    ctx.lineTo(6, -4);
    ctx.lineTo(12, 0);
    ctx.lineTo(6, 4);
    ctx.lineTo(8, 12);
    ctx.lineTo(0, 18);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 劍身：若完全被風之結界包覆 (p < 0.15) 則半透明隐形，之後漸顯真容
    const revealAlpha = isBound ? Math.max(0.15, (progress - 0.1) * 4) : 1.0;

    ctx.save();
    ctx.globalAlpha = Math.min(1, revealAlpha);

    // 金色聖劍雙刃刃身
    const swordLen = 135;
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(swordLen - 20, -5.5);
    ctx.lineTo(swordLen, 0); // 銳利劍尖
    ctx.lineTo(swordLen - 20, 5.5);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 中央藍色精靈刻印血槽
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(14, -1.5, swordLen - 45, 3);

    ctx.restore();
  }
}

export function drawAreaRefinement(ctx, kind, p, targets) {
  p = Math.max(0, Math.min(1, p));

  // 輔助函式：受限隨機數（基於種子計算，確保幀間一致無垃圾回收）
  function pseudo(seed) {
    let x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  ctx.save();

  // =========================================================================
  // 1. SOLAR PHOENIX (太陽神之翼神龍・不死鳥型態 — 純火焰流體神鳥徹底重構)
  //    徹底移除硬邊金屬刀羽、機械羽甲、硬牙、硬質鳥喙。
  //    由「白金內芯 → 耀眼金黃火膜 → 濃郁橘紅外焰 → 深褐/深紅火影」多重有機貝茲流體組成。
  // =========================================================================
  if (kind === 'solar_phoenix') {
    let birdX = p < 0.2 ? 70 + (p / 0.2) * 30 : 100 + ((p - 0.2) / 0.6) * 580;
    let birdY = Math.sin(p * Math.PI * 2.8) * 18;

    ctx.save();
    ctx.translate(birdX, birdY);

    let flameTime = p * 45;

    // 輔助函式：繪製單條動態有機火舌（具有 sin/cos 波動相位與錐形燃燒端點）
    function drawDynamicFlameTongue(x, y, angle, length, width, phase, colorStop) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      let wave = Math.sin(flameTime * 1.5 + phase) * (width * 0.45);
      let wave2 = Math.cos(flameTime * 2.1 + phase * 1.3) * (width * 0.25);

      let fGrad = ctx.createLinearGradient(0, 0, length, wave);
      if (colorStop === 'gold') {
        fGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        fGrad.addColorStop(0.25, 'rgba(254, 240, 138, 0.85)');
        fGrad.addColorStop(0.65, 'rgba(249, 115, 22, 0.6)');
        fGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
      } else {
        fGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
        fGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.65)');
        fGrad.addColorStop(0.8, 'rgba(185, 28, 28, 0.4)');
        fGrad.addColorStop(1, 'rgba(69, 10, 10, 0)');
      }

      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(0, -width * 0.5);
      ctx.quadraticCurveTo(length * 0.45, -width * 0.25 + wave2, length, wave);
      ctx.quadraticCurveTo(length * 0.55, width * 0.35 + wave, 0, width * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // --- A. 身後與下方如火焰瀑布般傾瀉的燃燒流體長尾羽浪 (Flame Cascade Tails) ---
    ctx.save();
    // 深暗紅/焦褐背影層
    for (let t = 0; t < 11; t++) {
      let tSpread = (t - 5) * 15;
      let tLen = 150 + Math.sin(flameTime * 0.7 + t * 0.8) * 18 + (5 - Math.abs(t - 5)) * 26;
      let tWave = Math.sin(flameTime * 0.65 + t * 0.6) * 24;

      let bgTailGrad = ctx.createLinearGradient(0, 0, -tLen, tSpread + tWave);
      bgTailGrad.addColorStop(0, 'rgba(234, 88, 12, 0.4)');
      bgTailGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.3)');
      bgTailGrad.addColorStop(1, 'rgba(40, 5, 5, 0)');

      ctx.strokeStyle = bgTailGrad;
      ctx.lineWidth = 10 + (5 - Math.abs(t - 5)) * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-15, 15 + tSpread * 0.2);
      ctx.quadraticCurveTo(-tLen * 0.5, tSpread * 1.3 + tWave * 1.3, -tLen, tSpread * 1.5 + tWave);
      ctx.stroke();
    }

    // 金橘白金主尾羽浪
    for (let t = 0; t < 9; t++) {
      let tSpread = (t - 4) * 16;
      let tLen = 135 + Math.sin(flameTime * 0.85 + t * 0.9) * 16 + (4 - Math.abs(t - 4)) * 24;
      let tWave = Math.sin(flameTime * 0.75 + t * 0.7) * 20;

      let tGrad = ctx.createLinearGradient(0, 0, -tLen, tSpread + tWave);
      tGrad.addColorStop(0, '#ffffff');
      tGrad.addColorStop(0.2, '#fef08a');
      tGrad.addColorStop(0.55, '#f59e0b');
      tGrad.addColorStop(0.85, '#dc2626');
      tGrad.addColorStop(1, 'rgba(69, 10, 10, 0)');

      ctx.strokeStyle = tGrad;
      ctx.lineWidth = 4.5 + (4 - Math.abs(t - 4)) * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-15, 15 + tSpread * 0.25);
      ctx.quadraticCurveTo(-tLen * 0.45, tSpread * 1.2 + tWave * 1.3, -tLen, tSpread * 1.5 + tWave);
      ctx.stroke();

      // 核心白熱極亮線
      if (t % 2 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-15, 15 + tSpread * 0.25);
        ctx.quadraticCurveTo(
          -tLen * 0.35,
          tSpread * 1.1 + tWave * 1.1,
          -tLen * 0.75,
          tSpread * 1.35 + tWave * 0.75,
        );
        ctx.stroke();
      }
    }
    ctx.restore();

    // --- B. 雄偉金橘火海巨翼（無硬羽！由流動半透明貝茲火海與十餘道垂落流蘇組成） ---
    let wingFlap = Math.sin(flameTime * 0.5) * 0.14;

    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(1, side);
      ctx.rotate(wingFlap * side);

      // 1. 深褐/深紅底層火影（負形與立體景深）
      let darkWingGrad = ctx.createRadialGradient(-10, -50, 15, 30, -130, 170);
      darkWingGrad.addColorStop(0, 'rgba(234, 88, 12, 0.85)');
      darkWingGrad.addColorStop(0.45, 'rgba(153, 27, 27, 0.7)');
      darkWingGrad.addColorStop(0.85, 'rgba(69, 10, 10, 0.5)');
      darkWingGrad.addColorStop(1, 'rgba(20, 2, 2, 0)');

      ctx.fillStyle = darkWingGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-25, -65, 30, -135, 85, -170);
      ctx.quadraticCurveTo(45, -145, -10, -85);
      ctx.bezierCurveTo(-35, -55, -20, -15, 0, 0);
      ctx.closePath();
      ctx.fill();

      // 2. 主火海巨翼：金黃與熾白多重半透明有機貝茲翼面
      let mainWingGrad = ctx.createLinearGradient(0, 0, 100, -180);
      mainWingGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      mainWingGrad.addColorStop(0.18, 'rgba(254, 240, 138, 0.9)');
      mainWingGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.85)');
      mainWingGrad.addColorStop(0.8, 'rgba(220, 38, 38, 0.6)');
      mainWingGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');

      ctx.fillStyle = mainWingGrad;
      ctx.beginPath();
      ctx.moveTo(15, -10);
      ctx.bezierCurveTo(20, -55, 60, -115, 112, -180);
      ctx.quadraticCurveTo(88, -158, 70, -135);
      ctx.bezierCurveTo(90, -125, 96, -145, 102, -150);
      ctx.bezierCurveTo(65, -115, 35, -75, 20, -30);
      ctx.closePath();
      ctx.fill();

      // 內側熾白流體亮焰覆蓋
      let innerWingGrad = ctx.createLinearGradient(10, -15, 75, -140);
      innerWingGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      innerWingGrad.addColorStop(0.4, 'rgba(254, 240, 138, 0.7)');
      innerWingGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');

      ctx.fillStyle = innerWingGrad;
      ctx.beginPath();
      ctx.moveTo(15, -10);
      ctx.bezierCurveTo(22, -45, 52, -90, 80, -135);
      ctx.quadraticCurveTo(55, -105, 30, -60);
      ctx.closePath();
      ctx.fill();

      // 3. 翼緣下方垂落瀑布般的有機火焰流蘇 (Flame Tendrils)
      for (let f = 0; f < 7; f++) {
        let fRootX = 22 + f * 13;
        let fRootY = -35 - f * 21;
        let fWave = Math.sin(flameTime * 1.1 + f * 1.4) * 14;
        let fLen = 50 + f * 14 + Math.cos(flameTime * 0.9 + f) * 12;

        let fGrad = ctx.createLinearGradient(fRootX, fRootY, fRootX - 25, fRootY + fLen);
        fGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        fGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.85)');
        fGrad.addColorStop(0.65, 'rgba(249, 115, 22, 0.65)');
        fGrad.addColorStop(0.95, 'rgba(185, 28, 28, 0.3)');
        fGrad.addColorStop(1, 'rgba(69, 10, 10, 0)');

        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.moveTo(fRootX, fRootY);
        ctx.bezierCurveTo(
          fRootX + 8,
          fRootY + fLen * 0.35,
          fRootX - 16 + fWave,
          fRootY + fLen * 0.75,
          fRootX - 26 + fWave,
          fRootY + fLen,
        );
        ctx.bezierCurveTo(
          fRootX - 15,
          fRootY + fLen * 0.6,
          fRootX - 6,
          fRootY + fLen * 0.25,
          fRootX - 10,
          fRootY,
        );
        ctx.closePath();
        ctx.fill();

        // 火焰流蘇內部白熱心線
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(fRootX - 3, fRootY + 3);
        ctx.quadraticCurveTo(
          fRootX - 7 + fWave * 0.5,
          fRootY + fLen * 0.45,
          fRootX - 20 + fWave,
          fRootY + fLen * 0.85,
        );
        ctx.stroke();
      }

      ctx.restore();
    });

    // --- C. 修長大器的長頸神龍鳥身形與胸腹白金熾核 ---
    // 1. 焦褐深紅暗部火影（提供雕塑般的深邃感，防止全白過曝）
    let bodyShadowGrad = ctx.createRadialGradient(25, 0, 10, 15, 0, 70);
    bodyShadowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.9)');
    bodyShadowGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.8)');
    bodyShadowGrad.addColorStop(0.85, 'rgba(69, 10, 10, 0.65)');
    bodyShadowGrad.addColorStop(1, 'rgba(20, 2, 2, 0)');

    ctx.fillStyle = bodyShadowGrad;
    ctx.beginPath();
    ctx.moveTo(52, -14);
    ctx.bezierCurveTo(66, 0, 66, 0, 52, 14);
    ctx.bezierCurveTo(22, 32, -28, 36, -38, 20);
    ctx.bezierCurveTo(-55, 0, -55, 0, -38, -20);
    ctx.bezierCurveTo(-28, -36, 22, -32, 52, -14);
    ctx.closePath();
    ctx.fill();

    // 2. 金黃主軀幹流體
    let bodyGrad = ctx.createRadialGradient(32, 0, 5, 20, 0, 50);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.3, '#fef08a');
    bodyGrad.addColorStop(0.65, '#f59e0b');
    bodyGrad.addColorStop(1, '#dc2626');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(46, -10);
    ctx.bezierCurveTo(58, 0, 58, 0, 46, 10);
    ctx.bezierCurveTo(18, 25, -20, 26, -30, 14);
    ctx.bezierCurveTo(-42, 0, -42, 0, -30, -14);
    ctx.bezierCurveTo(-20, -26, 18, -25, 46, -10);
    ctx.closePath();
    ctx.fill();

    // 3. 胸腹中央白金熾核（高溫烈焰核心）
    let coreGrad = ctx.createRadialGradient(32, 0, 0, 32, 0, 26);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.95)');
    coreGrad.addColorStop(0.7, 'rgba(249, 115, 22, 0.5)');
    coreGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(32, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    // --- D. 意識流頭部（徹底告別硬牙硬喙！高聳分叉火焰冠羽、暗部起伏、向下方微曲的火焰長吻負形與金色神性瞳光） ---
    ctx.save();
    ctx.translate(48, 0);

    // 1. 長頸向外延伸的火焰曲頸
    let neckGrad = ctx.createLinearGradient(0, -16, 32, 0);
    neckGrad.addColorStop(0, 'rgba(185, 28, 28, 0.7)');
    neckGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.9)');
    neckGrad.addColorStop(1, 'rgba(254, 240, 138, 0.95)');

    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.bezierCurveTo(10, -20, 26, -15, 34, -7);
    ctx.lineTo(34, 7);
    ctx.bezierCurveTo(26, 15, 10, 20, -10, 16);
    ctx.closePath();
    ctx.fill();

    // 2. 高聳向上分叉的火焰冠羽 (Flame Crest)
    let crests = [
      { len: 62, ang: -0.68, width: 8, phase: 0 },
      { len: 80, ang: -0.34, width: 10, phase: 1.2 }, // 最高天頂冠焰
      { len: 68, ang: 0.04, width: 9, phase: 2.1 },
      { len: 52, ang: 0.4, width: 7, phase: 3.4 },
    ];

    crests.forEach((crest) => {
      ctx.save();
      ctx.translate(14, -6);
      ctx.rotate(crest.ang);

      let cWave = Math.sin(flameTime * 1.3 + crest.phase) * 6;
      let cLen = crest.len + cWave;

      let cGrad = ctx.createLinearGradient(0, 0, -cLen, -cLen * 0.25);
      cGrad.addColorStop(0, '#ffffff');
      cGrad.addColorStop(0.2, '#fef08a');
      cGrad.addColorStop(0.55, '#f97316');
      cGrad.addColorStop(0.85, '#b91c1c');
      cGrad.addColorStop(1, 'rgba(40, 5, 5, 0)');

      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.moveTo(0, -crest.width);
      ctx.bezierCurveTo(
        -cLen * 0.35,
        -crest.width * 1.8,
        -cLen * 0.65,
        -crest.width + cWave,
        -cLen,
        0,
      );
      ctx.quadraticCurveTo(-cLen * 0.6, crest.width * 0.8, -cLen * 0.35, crest.width);
      ctx.lineTo(0, crest.width);
      ctx.closePath();
      ctx.fill();

      // 冠焰金色脊線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-cLen * 0.5, -crest.width * 0.3, -cLen * 0.88, 0);
      ctx.stroke();

      ctx.restore();
    });

    // 3. 意識流神龍鳥面部：以焦褐/深紅負形與向下方微曲的火焰長吻輪廓塑造，絕無生硬骨架
    let faceShadow = ctx.createRadialGradient(28, 0, 3, 20, 0, 32);
    faceShadow.addColorStop(0, '#fff5a0');
    faceShadow.addColorStop(0.4, '#f59e0b');
    faceShadow.addColorStop(0.75, '#c2410c');
    faceShadow.addColorStop(1, '#2a0505');

    ctx.fillStyle = faceShadow;
    ctx.beginPath();
    ctx.moveTo(12, -13);
    ctx.quadraticCurveTo(38, -12, 54, -6);
    // 向下方微曲延伸的烈焰神龍鳥吻意象
    ctx.bezierCurveTo(68, -2, 70, 4, 52, 10);
    ctx.quadraticCurveTo(35, 14, 18, 14);
    ctx.quadraticCurveTo(8, 15, 4, 8);
    ctx.closePath();
    ctx.fill();

    // 吻部深邃暗部凹陷（負形暗示咆哮長嘴）
    ctx.fillStyle = '#1c0303';
    ctx.beginPath();
    ctx.moveTo(38, -4);
    ctx.lineTo(58, 0);
    ctx.lineTo(44, 5);
    ctx.lineTo(52, 8);
    ctx.lineTo(28, 7);
    ctx.closePath();
    ctx.fill();

    // 吻前烈焰氣浪牙鋒暗示（流動半透明焰尖，絕非金屬硬牙）
    let fangFlame = ctx.createLinearGradient(40, 0, 60, 0);
    fangFlame.addColorStop(0, '#ffffff');
    fangFlame.addColorStop(0.6, '#fef08a');
    fangFlame.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = fangFlame;
    ctx.beginPath();
    ctx.moveTo(42, -3);
    ctx.lineTo(54, 0);
    ctx.lineTo(42, 3);
    ctx.closePath();
    ctx.fill();

    // 4. 深邃眼窩與兩點神聖極度熾亮金色瞳光
    ctx.fillStyle = '#0a0101';
    ctx.beginPath();
    ctx.ellipse(26, -5.5, 6, 3, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 瞳光光暈
    let eyeGlow = ctx.createRadialGradient(26, -5.5, 0, 26, -5.5, 5);
    eyeGlow.addColorStop(0, '#ffffff');
    eyeGlow.addColorStop(0.4, '#fef08a');
    eyeGlow.addColorStop(0.8, '#f59e0b');
    eyeGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.arc(26, -5.5, 5, 0, Math.PI * 2);
    ctx.fill();

    // 兩點極亮白色/金黃瞳光焦點
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(25.5, -5.5, 1.4, 0, Math.PI * 2);
    ctx.arc(27.5, -5.0, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // 5. 飄逸金色龍鬚流火 (Flame Tendril Whiskers)
    let wWave = Math.sin(flameTime * 1.4) * 8;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(48, -2);
    ctx.bezierCurveTo(62, -12, 70, 8 + wWave, 84, -4 + wWave);
    ctx.stroke();

    ctx.restore(); // 結束神龍鳥首

    // --- E. 外圍持續噴射有機火舌（40+ 道動態波動火舌，遍布頭冠、兩翼上緣、兩翼外緣、腹側、尾浪） ---
    let flameTongues = [
      // 頭冠與頸部 (8道)
      { x: 55, y: -16, ang: -1.2, len: 38, w: 9, p: 0.1, c: 'gold' },
      { x: 62, y: -12, ang: -0.9, len: 44, w: 10, p: 0.6, c: 'orange' },
      { x: 72, y: -6, ang: -0.5, len: 40, w: 8, p: 1.1, c: 'gold' },
      { x: 80, y: 0, ang: -0.1, len: 46, w: 9, p: 1.7, c: 'gold' },
      { x: 74, y: 6, ang: 0.3, len: 36, w: 8, p: 2.3, c: 'orange' },
      { x: 65, y: 12, ang: 0.7, len: 34, w: 8, p: 2.9, c: 'orange' },
      { x: 48, y: -22, ang: -1.5, len: 32, w: 7, p: 3.4, c: 'gold' },
      { x: 48, y: 22, ang: 1.5, len: 32, w: 7, p: 4.0, c: 'gold' },

      // 左翼上緣與外緣 (10道)
      { x: 35, y: -45, ang: -1.7, len: 42, w: 9, p: 0.3, c: 'gold' },
      { x: 50, y: -80, ang: -1.8, len: 48, w: 10, p: 0.9, c: 'gold' },
      { x: 70, y: -120, ang: -1.9, len: 52, w: 11, p: 1.5, c: 'orange' },
      { x: 92, y: -155, ang: -2.1, len: 56, w: 12, p: 2.1, c: 'gold' },
      { x: 108, y: -175, ang: -2.3, len: 60, w: 12, p: 2.7, c: 'gold' },
      { x: 80, y: -160, ang: -2.6, len: 45, w: 10, p: 3.3, c: 'orange' },
      { x: 55, y: -130, ang: -2.8, len: 40, w: 9, p: 3.9, c: 'orange' },
      { x: 30, y: -95, ang: -3.0, len: 38, w: 8, p: 4.5, c: 'gold' },
      { x: 10, y: -65, ang: 2.9, len: 35, w: 8, p: 5.1, c: 'orange' },
      { x: -5, y: -35, ang: 2.7, len: 32, w: 7, p: 5.7, c: 'gold' },

      // 右翼上緣與外緣 (10道)
      { x: 35, y: 45, ang: 1.7, len: 42, w: 9, p: 0.4, c: 'gold' },
      { x: 50, y: 80, ang: 1.8, len: 48, w: 10, p: 1.0, c: 'gold' },
      { x: 70, y: 120, ang: 1.9, len: 52, w: 11, p: 1.6, c: 'orange' },
      { x: 92, y: 155, ang: 2.1, len: 56, w: 12, p: 2.2, c: 'gold' },
      { x: 108, y: 175, ang: 2.3, len: 60, w: 12, p: 2.8, c: 'gold' },
      { x: 80, y: 160, ang: 2.6, len: 45, w: 10, p: 3.4, c: 'orange' },
      { x: 55, y: 130, ang: 2.8, len: 40, w: 9, p: 4.0, c: 'orange' },
      { x: 30, y: 95, ang: 3.0, len: 38, w: 8, p: 4.6, c: 'gold' },
      { x: 10, y: 65, ang: -2.9, len: 35, w: 8, p: 5.2, c: 'orange' },
      { x: -5, y: 35, ang: -2.7, len: 32, w: 7, p: 5.8, c: 'gold' },

      // 腹側與軀幹四周 (6道)
      { x: 15, y: -25, ang: -1.3, len: 35, w: 8, p: 0.8, c: 'gold' },
      { x: 15, y: 25, ang: 1.3, len: 35, w: 8, p: 1.4, c: 'gold' },
      { x: -10, y: -22, ang: -1.8, len: 30, w: 7, p: 2.0, c: 'orange' },
      { x: -10, y: 22, ang: 1.8, len: 30, w: 7, p: 2.6, c: 'orange' },
      { x: -28, y: -14, ang: -2.4, len: 28, w: 7, p: 3.2, c: 'orange' },
      { x: -28, y: 14, ang: 2.4, len: 28, w: 7, p: 3.8, c: 'orange' },

      // 尾浪後部逸散噴射火舌 (8道)
      { x: -45, y: -18, ang: 3.1, len: 46, w: 9, p: 0.5, c: 'orange' },
      { x: -55, y: -8, ang: -3.0, len: 54, w: 10, p: 1.3, c: 'gold' },
      { x: -60, y: 0, ang: 3.14, len: 62, w: 11, p: 2.1, c: 'gold' },
      { x: -55, y: 8, ang: 3.0, len: 54, w: 10, p: 2.9, c: 'gold' },
      { x: -45, y: 18, ang: 2.9, len: 46, w: 9, p: 3.7, c: 'orange' },
      { x: -38, y: -30, ang: 2.7, len: 36, w: 8, p: 4.3, c: 'orange' },
      { x: -38, y: 30, ang: -2.7, len: 36, w: 8, p: 4.9, c: 'orange' },
      { x: -50, y: 0, ang: 3.14, len: 42, w: 8, p: 5.5, c: 'gold' },
    ];

    flameTongues.forEach((ft) => {
      drawDynamicFlameTongue(ft.x, ft.y, ft.ang, ft.len, ft.w, ft.p, ft.c);
    });

    // 飄散金橘微粒火星 (嚴格控管上限)
    for (let sp = 0; sp < 16; sp++) {
      let sSeed = sp * 7.3;
      let sAge = (flameTime * 0.08 + pseudo(sSeed)) % 1;
      let sRad = 25 + pseudo(sSeed + 1) * 110;
      let sAngle = pseudo(sSeed + 2) * Math.PI * 2;
      let px = Math.cos(sAngle) * sRad - sAge * 45;
      let py = Math.sin(sAngle) * (sRad * 0.6);
      let pSize = (1 - sAge) * 3.2;

      ctx.fillStyle = sp % 2 === 0 ? 'rgba(254, 240, 138, 0.9)' : 'rgba(249, 115, 22, 0.8)';
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // 結束不死鳥主體

    // --- F. 橫掃衝擊與目標爆破（Targets: x=380, 550, 460） ---
    if (p > 0.25) {
    }
  }

  // =========================================================================
  // 2. GUANYIN BARRAGE (百式觀音・寫實霸氣巨拳陣 — 完整保留)
  // =========================================================================
  else if (kind === 'guanyin_barrage') {
    // 背後金色多臂法輪光環 (x=0 施法者身後)
    ctx.save();
    ctx.translate(0, 0);

    // 金色千手光輪背景
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-20, 0, 75, 0, Math.PI * 2);
    ctx.stroke();

    // 輪軸金色射線與多臂背影 (16道向外綻放的法印神臂輪廓)
    for (let a = 0; a < 16; a++) {
      let ang = (a / 16) * Math.PI * 2 + p * 0.5;
      let r1 = 30;
      let r2 = 90 + Math.sin(p * 15 + a) * 8;
      ctx.strokeStyle = a % 2 === 0 ? 'rgba(250, 204, 21, 0.6)' : 'rgba(217, 119, 6, 0.3)';
      ctx.lineWidth = a % 2 === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(-20 + Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(-20 + Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // 輔助函式：繪製具有真實透視、四排指節、拇指、肌腱、前臂的霸氣巨拳
    function drawRealisticFist(fx, fy, scale, rot) {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);

      // 1. 厚實前臂 (Forearm)
      let armGrad = ctx.createLinearGradient(-110, 0, -30, 0);
      armGrad.addColorStop(0, '#451a03'); // 深古銅暗面
      armGrad.addColorStop(0.5, '#b45309');
      armGrad.addColorStop(0.9, '#f59e0b');
      armGrad.addColorStop(1, '#fde047'); // 頂端受光

      ctx.fillStyle = armGrad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-110, -22);
      ctx.lineTo(-30, -32); // 腕骨外側
      ctx.lineTo(-30, 32); // 腕骨內側
      ctx.lineTo(-110, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 手腕骨凸起
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(-32, -26, 6, 0, Math.PI * 2);
      ctx.arc(-32, 26, 6, 0, Math.PI * 2);
      ctx.fill();

      // 2. 拳背主體與肌腱紋理
      let handGrad = ctx.createRadialGradient(0, 0, 5, -10, 0, 50);
      handGrad.addColorStop(0, '#fef08a');
      handGrad.addColorStop(0.3, '#d97706');
      handGrad.addColorStop(0.8, '#78350f');
      handGrad.addColorStop(1, '#451a03');

      ctx.fillStyle = handGrad;
      ctx.beginPath();
      ctx.moveTo(-30, -30);
      ctx.quadraticCurveTo(0, -34, 25, -28);
      ctx.lineTo(25, 28);
      ctx.quadraticCurveTo(0, 34, -30, 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 拳背四道凸起緊繃肌腱
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
      ctx.lineWidth = 1.8;
      for (let tn = 0; tn < 4; tn++) {
        let ty1 = -20 + tn * 13;
        let ty2 = -24 + tn * 16;
        ctx.beginPath();
        ctx.moveTo(-28, ty1);
        ctx.quadraticCurveTo(0, ty1 * 0.9, 22, ty2);
        ctx.stroke();
      }

      // 3. 清楚四排指節與蜷曲手指分節
      for (let f = 0; f < 4; f++) {
        let ky = -24 + f * 16;
        let kGrad = ctx.createLinearGradient(20, ky, 52, ky);
        kGrad.addColorStop(0, '#fef08a');
        kGrad.addColorStop(0.4, '#b45309');
        kGrad.addColorStop(1, '#451a03');

        // 掌指關節凸起
        ctx.fillStyle = kGrad;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(24, ky, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 蜷曲手指分節
        ctx.beginPath();
        ctx.moveTo(28, ky - 7);
        ctx.lineTo(44, ky - 6);
        ctx.arc(44, ky, 6, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(28, ky + 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 分節指褶深陰影線
        ctx.strokeStyle = '#291305';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(36, ky - 6);
        ctx.lineTo(36, ky + 6);
        ctx.stroke();
      }

      // 4. 側邊拇指
      let thumbGrad = ctx.createLinearGradient(5, 12, 35, 28);
      thumbGrad.addColorStop(0, '#fef08a');
      thumbGrad.addColorStop(0.5, '#d97706');
      thumbGrad.addColorStop(1, '#78350f');

      ctx.fillStyle = thumbGrad;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 16);
      ctx.quadraticCurveTo(28, 12, 36, -4);
      ctx.quadraticCurveTo(42, 6, 32, 26);
      ctx.quadraticCurveTo(20, 30, 8, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 拇指高光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(28, 4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 5個多重透視霸氣巨拳連環轟擊
    let fistConfigs = [
      { baseT: 0.05, target: { x: 380, y: -45 }, angle: -0.12, rot: -0.08 },
      { baseT: 0.2, target: { x: 460, y: 50 }, angle: 0.15, rot: 0.1 },
      { baseT: 0.35, target: { x: 550, y: -10 }, angle: 0.02, rot: 0.0 },
      { baseT: 0.5, target: { x: 400, y: -20 }, angle: -0.05, rot: -0.04 },
      { baseT: 0.65, target: { x: 520, y: 35 }, angle: 0.08, rot: 0.06 },
    ];

    // Every palm wave reaches every selected victim, matching the five damage
    // stages. Keep the same 32-target server bound; no extra canvas or timer.
    const waves = targets?.length
      ? fistConfigs.flatMap((cfg) =>
          targets.slice(0, 32).map((target, n) => ({ ...cfg, target, projection: n >= 3 })),
        )
      : fistConfigs;
    waves.forEach((cfg, idx) => {
      let fistProg = (p - cfg.baseT) / 0.32;
      if (fistProg >= 0 && fistProg <= 1.25) {
        let normProg = Math.min(1, fistProg);
        let easeProg = Math.pow(normProg, 2.2);
        let curX = 30 + easeProg * (cfg.target.x - 30);
        let curY = easeProg * cfg.target.y;
        let curScale = 0.3 + easeProg * 1.05;

        if (!cfg.projection) drawRealisticFist(curX, curY, curScale, cfg.rot);
        else {
          // Nearby palms retain full detail; distant crowd targets get a solid
          // palm projection so 32-person waves stay within the drawing budget.
          ctx.save();
          ctx.translate(curX, curY);
          ctx.scale(curScale, curScale);
          ctx.rotate(cfg.rot);
          ctx.fillStyle = '#ffd556';
          ctx.strokeStyle = '#8a5a12';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          for (let finger = 0; finger < 4; finger++) ctx.fillRect(-16 + finger * 8, -22, 6, 20);
          ctx.restore();
        }

        if (fistProg >= 0.85) {
          let impactAge = (fistProg - 0.85) / 0.4;
          ctx.save();
          ctx.translate(cfg.target.x, cfg.target.y);

          ctx.strokeStyle = `rgba(254, 240, 138, ${1 - impactAge})`;
          ctx.lineWidth = 4 * (1 - impactAge) + 1;
          ctx.beginPath();
          ctx.arc(0, 0, impactAge * 80 * curScale, 0, Math.PI * 2);
          ctx.stroke();

          const debris = cfg.projection ? 2 : 12;
          for (let d = 0; d < debris; d++) {
            let dAng = (d / debris) * Math.PI * 2 + idx;
            let dDist = (25 + pseudo(d + idx * 5) * 55) * impactAge;
            let dx = Math.cos(dAng) * dDist;
            let dy = Math.sin(dAng) * dDist;
            ctx.fillStyle = d % 2 === 0 ? '#fef08a' : '#d97706';
            ctx.beginPath();
            ctx.arc(dx, dy, 3 * (1 - impactAge), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    });
  }

  // =========================================================================
  // 3. BIJUU BEAM (尾獸玉・超巨型九尾噴射 — 完整保留)
  // =========================================================================
  else if (kind === 'bijuu_beam') {
    ctx.save();
    ctx.translate(-70, 0);

    // 1. 九條扇形各自獨立可數的巨大尾巴
    for (let t = 0; t < 9; t++) {
      let tailAng = -1.1 + (t / 8) * 2.2;
      let sway = Math.sin(p * 14 + t * 0.8) * 0.15;
      let tailLen = 170 + (4 - Math.abs(t - 4)) * 18;

      ctx.save();
      ctx.translate(-40, 15);
      ctx.rotate(tailAng + sway);

      let tGrad = ctx.createLinearGradient(0, 0, -tailLen, 0);
      tGrad.addColorStop(0, '#ea580c');
      tGrad.addColorStop(0.7, '#f97316');
      tGrad.addColorStop(0.9, '#c2410c');
      tGrad.addColorStop(1, '#000000');

      ctx.fillStyle = tGrad;
      ctx.strokeStyle = '#050505';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(-tailLen * 0.4, -28, -tailLen * 0.8, -12);
      ctx.quadraticCurveTo(-tailLen, 0, -tailLen * 0.8, 12);
      ctx.quadraticCurveTo(-tailLen * 0.4, 28, 0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // 2. 橘色肌肉身體與厚實前爪
    let bodyGrad = ctx.createRadialGradient(20, 10, 10, 0, 10, 90);
    bodyGrad.addColorStop(0, '#fb923c');
    bodyGrad.addColorStop(0.6, '#ea580c');
    bodyGrad.addColorStop(0.9, '#9a3412');
    bodyGrad.addColorStop(1, '#180a04');

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(-50, 45);
    ctx.quadraticCurveTo(0, -25, 45, 0);
    ctx.lineTo(65, 55);
    ctx.lineTo(35, 60);
    ctx.lineTo(15, 38);
    ctx.lineTo(-40, 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#09090b';
    for (let cl = 0; cl < 4; cl++) {
      ctx.beginPath();
      ctx.moveTo(40 + cl * 7, 56);
      ctx.lineTo(44 + cl * 7, 68);
      ctx.lineTo(38 + cl * 7, 60);
      ctx.fill();
    }

    // 3. 清楚威猛獸首
    ctx.save();
    ctx.translate(45, -8);

    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(1, side);
      ctx.fillStyle = '#ea580c';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-5, -15);
      ctx.lineTo(-18, -65);
      ctx.lineTo(12, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.moveTo(-3, -20);
      ctx.lineTo(-14, -56);
      ctx.lineTo(8, -24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#050505';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(35, -12);
    ctx.lineTo(55, -2);
    ctx.lineTo(25, 12);
    ctx.lineTo(48, 26);
    ctx.lineTo(15, 24);
    ctx.lineTo(-15, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 上下口牙
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(35, -8);
    ctx.lineTo(40, -1);
    ctx.lineTo(45, -7);
    ctx.lineTo(50, 0);
    ctx.lineTo(53, -6);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(28, 14);
    ctx.lineTo(33, 7);
    ctx.lineTo(38, 15);
    ctx.lineTo(44, 10);
    ctx.fill();

    // 狹長紅眼
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.lineTo(28, -13);
    ctx.lineTo(32, -8);
    ctx.lineTo(16, -5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(22, -9, 5, 1.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();

    let mouthX = 40;
    let mouthY = 0;

    if (p <= 0.4) {
      let chargeProg = p / 0.4;
      let ballR = chargeProg * 38;

      let ballGrad = ctx.createRadialGradient(mouthX, mouthY, 2, mouthX, mouthY, ballR);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.3, '#c084fc');
      ballGrad.addColorStop(0.7, '#6b21a8');
      ballGrad.addColorStop(1, '#090514');

      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(mouthX, mouthY, ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      for (let q = 0; q < 18; q++) {
        let qAng = (q / 18) * Math.PI * 2 + p * 20;
        let qDist = ballR + (1 - chargeProg) * 80 + pseudo(q) * 20;
        ctx.beginPath();
        ctx.moveTo(mouthX + Math.cos(qAng) * qDist, mouthY + Math.sin(qAng) * qDist);
        ctx.lineTo(mouthX + Math.cos(qAng) * (qDist - 15), mouthY + Math.sin(qAng) * (qDist - 15));
        ctx.stroke();
      }
    } else {
      let beamProg = (p - 0.4) / 0.5;
      let beamAlpha = beamProg < 0.8 ? 1.0 : 1.0 - (beamProg - 0.8) / 0.2;

      ctx.save();
      ctx.translate(mouthX, mouthY);
      ctx.strokeStyle = `rgba(216, 180, 254, ${beamAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      let beamLen = 720;
      let beamThick = 70;

      let outerGrad = ctx.createLinearGradient(mouthX, -beamThick, mouthX, beamThick);
      outerGrad.addColorStop(0, 'rgba(107, 33, 168, 0)');
      outerGrad.addColorStop(0.3, `rgba(168, 85, 247, ${0.8 * beamAlpha})`);
      outerGrad.addColorStop(0.5, `rgba(233, 213, 255, ${0.9 * beamAlpha})`);
      outerGrad.addColorStop(0.7, `rgba(168, 85, 247, ${0.8 * beamAlpha})`);
      outerGrad.addColorStop(1, 'rgba(107, 33, 168, 0)');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.moveTo(mouthX, -beamThick * 0.4);
      ctx.lineTo(mouthX + beamLen, -beamThick);
      ctx.lineTo(mouthX + beamLen, beamThick);
      ctx.lineTo(mouthX, beamThick * 0.4);
      ctx.closePath();
      ctx.fill();

      let coreGrad = ctx.createLinearGradient(mouthX, -18, mouthX, 18);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      coreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${1.0 * beamAlpha})`);
      coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = coreGrad;
      ctx.fillRect(mouthX, -14, beamLen, 28);

      for (let w = 0; w < 6; w++) {
        let wx = mouthX + ((w * 120 + p * 600) % beamLen);
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.7 * beamAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(wx, 0, 12, beamThick * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      let endX = 700;
      let endR = 90 + Math.sin(p * 25) * 15;
      let endGrad = ctx.createRadialGradient(endX, 0, 10, endX, 0, endR);
      endGrad.addColorStop(0, '#ffffff');
      endGrad.addColorStop(0.4, `rgba(192, 132, 252, ${beamAlpha})`);
      endGrad.addColorStop(0.8, `rgba(88, 28, 135, ${0.8 * beamAlpha})`);
      endGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = endGrad;
      ctx.beginPath();
      ctx.arc(endX, 0, endR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

// -------------------------------------------------------------
// Anime VFX Lab: 真紅爆裂魔法・多人核爆 (4.0s Canvas 2D Procedural VFX)
// 純函式架構：無 requestAnimationFrame, 無 DOM 依賴, 單幀確定性渲染
// -------------------------------------------------------------
export function drawExplosionAttack(ctx, p, impactX = 480, radius = 270) {
  // 基礎常數與坐標錨點
  const casterX = 0,
    casterY = 0;
  const targetY = 0;

  // 限制進度 0..1
  p = Math.max(0, Math.min(1, p));

  ctx.save();

  // 2. 施術者 (Caster: 0, 0) 站姿與魔力源
  ctx.save();
  ctx.translate(casterX, casterY);
  // 腳底召喚法陣 (0–40%)
  if (p < 0.45) {
    const cp = p / 0.45;
    const ringAlpha = (1 - cp) * 0.9;
    ctx.strokeStyle = `rgba(255, 42, 95, ${ringAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 20, 48 * (1 + cp * 0.2), 16 * (1 + cp * 0.2), 0, 0, Math.PI * 2);
    ctx.stroke();

    // 旋轉八芒魔術環
    ctx.save();
    ctx.translate(0, 20);
    ctx.scale(1, 0.35);
    ctx.rotate(p * 8);
    ctx.strokeStyle = `rgba(255, 213, 86, ${ringAlpha * 0.8})`;
    ctx.strokeRect(-24, -24, 48, 48);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-24, -24, 48, 48);
    ctx.restore();
  }

  ctx.restore();

  // -----------------------------------------------------------
  // 階段 1: 0–20% 雙位階反向旋轉巨型法陣 (詠唱展開)
  // -----------------------------------------------------------
  if (p <= 0.25) {
    const p1 = p / 0.2;
    const alpha = p <= 0.2 ? Math.min(1, p1 * 1.5) : Math.max(0, (0.25 - p) / 0.05);

    ctx.save();
    ctx.translate(impactX, targetY);

    // 投影扁平化矩陣模擬 3D 地面與高空法陣
    [
      { yOffset: 15, scaleY: 0.35, rotSpeed: 3, col1: '#ff2a5f', col2: '#ffd556', r: 160 },
      { yOffset: -30, scaleY: 0.45, rotSpeed: -4.5, col1: '#ffd556', col2: '#ff7a00', r: 210 },
      { yOffset: -80, scaleY: 0.55, rotSpeed: 6, col1: '#ff2a5f', col2: '#dbfcff', r: 260 },
    ].forEach((tier, i) => {
      ctx.save();
      ctx.translate(0, tier.yOffset);
      ctx.scale(1, tier.scaleY);
      ctx.rotate(p * tier.rotSpeed + i);

      // 外外環
      ctx.strokeStyle = tier.col1;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, tier.r, 0, Math.PI * 2);
      ctx.stroke();

      // 內同心環
      ctx.lineWidth = 1;
      ctx.strokeStyle = tier.col2;
      ctx.beginPath();
      ctx.arc(0, 0, tier.r * 0.72, 0, Math.PI * 2);
      ctx.stroke();

      // 芒星幾何結構
      const spokes = 8;
      for (let s = 0; s < spokes; s++) {
        const ang = (s / spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (tier.r * 0.72), Math.sin(ang) * (tier.r * 0.72));
        ctx.lineTo(Math.cos(ang) * tier.r, Math.sin(ang) * tier.r);
        ctx.stroke();
      }
      ctx.restore();
    });
    ctx.restore();
  }

  // -----------------------------------------------------------
  // 階段 2: 20–40% 奇點聚變 + 聚合魔電電弧 (聚能向內吸入)
  // -----------------------------------------------------------
  if (p >= 0.18 && p <= 0.42) {
    const p2 = (p - 0.2) / 0.2;
    const coreY = targetY - 25;
    ctx.save();
    ctx.translate(impactX, coreY);

    // 奇點半徑：由大收縮至極緊湊
    const orbRadius = Math.max(8, 55 * (1 - p2 * 0.75));

    // 黑紅引力暈環
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, orbRadius * 2.2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, '#ff2a5f');
    grad.addColorStop(0.6, '#74001d');
    grad.addColorStop(1, 'rgba(5, 7, 12, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, orbRadius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 核心黑洞本體
    ctx.fillStyle = '#0c0e16';
    ctx.beginPath();
    ctx.arc(0, 0, orbRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd556';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crackling 雷電魔弧 (向心吸收)
    const boltCount = 14;
    ctx.lineWidth = 1.5;
    for (let b = 0; b < boltCount; b++) {
      const startAngle = (b / boltCount) * Math.PI * 2 + p * 12;
      const dist = 140 * (1 - p2 * 0.5) + (b % 3) * 15;
      let cx = Math.cos(startAngle) * dist;
      let cy = Math.sin(startAngle) * (dist * 0.65);

      ctx.strokeStyle = b % 2 === 0 ? '#ffd556' : '#ff2a5f';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      // 3折折線向中心
      for (let seg = 1; seg <= 3; seg++) {
        const factor = 1 - seg / 3;
        const jitterX = (Math.sin(p * 40 + b * 5 + seg) - 0.5) * 18;
        const jitterY = (Math.cos(p * 40 + b * 7 + seg) - 0.5) * 18;
        const nx = cx * factor + jitterX;
        const ny = cy * factor + jitterY;
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(0, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // -----------------------------------------------------------
  // 階段 3: 40–70% 天基軌道降臨 + 超巨型爆轟 + 3重衝擊波 + 地裂
  // -----------------------------------------------------------
  if (p >= 0.4 && p <= 0.72) {
    const p3 = Math.min(1, (p - 0.4) / 0.2);
    ctx.save();
    ctx.translate(impactX, targetY);

    // 1. 天基天罰光柱 (垂直降下)
    if (p3 < 0.35) {
      const beamAlpha = 1 - p3 / 0.35;
      const beamW = 70 * (1 - p3 * 0.5);
      const bGrad = ctx.createLinearGradient(-beamW / 2, 0, beamW / 2, 0);
      bGrad.addColorStop(0, 'rgba(255, 42, 95, 0)');
      bGrad.addColorStop(0.3, `rgba(255, 122, 0, ${beamAlpha})`);
      bGrad.addColorStop(0.5, `rgba(255, 255, 255, ${beamAlpha})`);
      bGrad.addColorStop(0.7, `rgba(255, 122, 0, ${beamAlpha})`);
      bGrad.addColorStop(1, 'rgba(255, 42, 95, 0)');

      ctx.fillStyle = bGrad;
      ctx.fillRect(-beamW / 2, -560, beamW, 580);
    }

    // 2. 地表裂紋 (熔岩地裂)
    ctx.save();
    ctx.scale(1, 0.4);
    const crackBranches = 16;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 122, 0, 0.85)';
    for (let c = 0; c < crackBranches; c++) {
      const ang = (c / crackBranches) * Math.PI * 2;
      const cDist = Math.min(radius, radius * (p3 * 1.4));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      let px = 0,
        py = 0;
      for (let s = 1; s <= 4; s++) {
        const stepDist = (cDist / 4) * s;
        const jx = Math.sin(c * 13 + s) * 16;
        const jy = Math.cos(c * 17 + s) * 16;
        px = Math.cos(ang) * stepDist + jx;
        py = Math.sin(ang) * stepDist + jy;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 3. 3 重同心衝擊波環 (擴散至 270px 邊界)
    [0, 0.12, 0.25].forEach((delay, idx) => {
      const waveP = Math.max(0, Math.min(1, (p3 - delay) / (1 - delay)));
      if (waveP > 0) {
        const curR = waveP * radius;
        const wAlpha = (1 - waveP) * 0.9;
        ctx.save();
        ctx.scale(1, 0.38);
        ctx.lineWidth = 3 - idx * 0.6;
        ctx.strokeStyle =
          idx === 0 ? `rgba(255, 255, 255, ${wAlpha})` : `rgba(255, 42, 95, ${wAlpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 4. 初階熾熱爆轟火球膨脹
    const sphereR = Math.min(190, p3 * 220);
    const sGrad = ctx.createRadialGradient(0, -30, 10, 0, -30, sphereR);
    sGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    sGrad.addColorStop(0.3, 'rgba(255, 213, 86, 0.9)');
    sGrad.addColorStop(0.65, 'rgba(255, 42, 95, 0.85)');
    sGrad.addColorStop(1, 'rgba(100, 0, 20, 0)');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(0, -30, sphereR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // -----------------------------------------------------------
  // 階段 4: 70–100% 動漫真紅核爆蘑菇雲 (結構化火柱、雲冠翻滾、焦土)
  // -----------------------------------------------------------
  if (p >= 0.65) {
    const p4 = (p - 0.65) / 0.35;
    ctx.save();
    ctx.translate(impactX, targetY);

    // A. 地面冷卻焦土與熔融中心 (0.38 傾角)
    ctx.save();
    ctx.scale(1, 0.38);
    const scorchGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, radius * 0.95);
    scorchGrad.addColorStop(0, 'rgba(255, 122, 0, 0.8)');
    scorchGrad.addColorStop(0.35, 'rgba(80, 10, 20, 0.7)');
    scorchGrad.addColorStop(0.8, 'rgba(15, 17, 24, 0.6)');
    scorchGrad.addColorStop(1, 'rgba(15, 17, 24, 0)');
    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // B. 湍流火柱主幹 (Stem: 向上高速延伸)
    const stemH = 340 * Math.min(1, p4 * 1.4);
    const stemW = 62 + p4 * 35;
    const stemGrad = ctx.createLinearGradient(-stemW, 0, stemW, 0);
    stemGrad.addColorStop(0, 'rgba(40, 10, 18, 0.85)');
    stemGrad.addColorStop(0.25, 'rgba(255, 42, 95, 0.9)');
    stemGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    stemGrad.addColorStop(0.75, 'rgba(255, 122, 0, 0.9)');
    stemGrad.addColorStop(1, 'rgba(40, 10, 18, 0.85)');

    ctx.fillStyle = stemGrad;
    ctx.beginPath();
    ctx.moveTo(-stemW * 0.6, 5);
    ctx.quadraticCurveTo(-stemW * 0.4, -stemH * 0.5, -stemW * 0.9, -stemH);
    ctx.lineTo(stemW * 0.9, -stemH);
    ctx.quadraticCurveTo(stemW * 0.4, -stemH * 0.5, stemW * 0.6, 5);
    ctx.closePath();
    ctx.fill();

    // C. 蘑菇雲頂端巨型翻滾雲冠 (Cloud Cap & Lobes)
    const capCenterY = -stemH;
    const capScale = 1.35 + p4 * 0.8;
    ctx.save();
    ctx.translate(0, capCenterY);
    ctx.scale(capScale, capScale);

    // 定義外層暗紅焦黑滾動煙瓣
    const lobes = [
      { x: 0, y: -45, r: 55, color: '#1d080e' },
      { x: -55, y: -30, r: 50, color: '#2d0b16' },
      { x: 55, y: -30, r: 50, color: '#2d0b16' },
      { x: -95, y: -10, r: 42, color: '#4d101f' },
      { x: 95, y: -10, r: 42, color: '#4d101f' },
      { x: -45, y: 15, r: 46, color: '#ff2a5f' },
      { x: 45, y: 15, r: 46, color: '#ff2a5f' },
      { x: 0, y: 10, r: 52, color: '#ff7a00' },
    ];

    lobes.forEach((l) => {
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 內核熾白能量發光球
    const capCoreGrad = ctx.createRadialGradient(0, -10, 5, 0, -10, 68);
    capCoreGrad.addColorStop(0, '#ffffff');
    capCoreGrad.addColorStop(0.3, '#ffd556');
    capCoreGrad.addColorStop(0.65, '#ff2a5f');
    capCoreGrad.addColorStop(1, 'rgba(255, 42, 95, 0)');
    ctx.fillStyle = capCoreGrad;
    ctx.beginPath();
    ctx.arc(0, -10, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // -----------------------------------------------------------
  ctx.restore(); // 結尾恢復
}
