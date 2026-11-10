import { heroFlightArc } from './hero-flight-path.js';
import { drawHeroFlyingStatue, drawHeroLandedStatue } from './attack-colossus.js';
/* Adapted from actual Stitch 14297655819267599636 / 4c267cf915084dfea662d2d6071a62af.
 * UI and driver removed. No fallback targets or fake caster, real receipts only. */
export function drawGateOfHeroes(ctx, options, elapsedMs) {
  if (!ctx || elapsedMs < 0 || elapsedMs > 4200) return;

  // 1. 解構與安全防護
  const opt = options || {};
  const isAlt = !!opt.alternate;
  const from =
    typeof opt.readCaster === 'function' ? opt.readCaster() : opt.from || { x: 240, y: 320 };
  const to = opt.to || { x: 880, y: 330 };
  const hits = typeof opt.readHits === 'function' ? opt.readHits() : [];

  // 2. 調色盤定義
  const pal = isAlt
    ? {
        stone: '#180b26',
        stoneHighlight: '#3c1859',
        gold: '#b388ff',
        goldLight: '#d1b3ff',
        goldGlow: 'rgba(179, 136, 255, 0.45)',
        shieldCore: 'rgba(124, 77, 255, 0.22)',
        energyRay: 'rgba(179, 136, 255, 0.75)',
        shockwave: '#7c4dff',
        crack: '#651fff',
      }
    : {
        stone: '#fdfbf7',
        stoneHighlight: '#ffffff',
        gold: '#ffca28',
        goldLight: '#ffe082',
        goldGlow: 'rgba(255, 202, 40, 0.45)',
        shieldCore: 'rgba(255, 213, 79, 0.22)',
        energyRay: 'rgba(255, 224, 130, 0.8)',
        shockwave: '#ffd54f',
        crack: '#ffa000',
      };

  ctx.save();

  // ==========================================
  // 【時序分流 1: 目標落點召喚法陣 (0ms ~ 2800ms)】
  // ==========================================
  if (elapsedMs <= 2800) {
    ctx.save();
    ctx.translate(to.x, to.y);

    const summonProgress = Math.min(1, elapsedMs / 600);
    const fadeOut = elapsedMs > 2100 ? 1 - (elapsedMs - 2100) / 700 : 1;
    const globalAlpha = summonProgress * fadeOut;

    if (globalAlpha > 0.01) {
      ctx.globalAlpha = globalAlpha;

      // 旋轉符文刻度
      const rotSlow = (elapsedMs / 1000) * 0.8;
      const rotFast = -(elapsedMs / 1000) * 1.6;

      // 外同心圓
      ctx.save();
      ctx.rotate(rotSlow);
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.strokeStyle = pal.gold;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6, 2, 6]);
      ctx.stroke();

      // 刻度圈
      for (let i = 0; i < 12; i++) {
        const rad = ((Math.PI * 2) / 12) * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * 88, Math.sin(rad) * 88);
        ctx.lineTo(Math.cos(rad) * 98, Math.sin(rad) * 98);
        ctx.strokeStyle = pal.goldLight;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // 內外旋反向魔法陣
      ctx.save();
      ctx.rotate(rotFast);
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.strokeStyle = pal.goldLight;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // 內六芒聖印
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = ((Math.PI * 2) / 6) * i;
        const x = Math.cos(a) * 45;
        const y = Math.sin(a) * 45;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = pal.gold;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 聚能柱光束 (600ms ~ 2100ms 快速縮放閃爍)
      if (elapsedMs >= 600 && elapsedMs < 2100) {
        const beamIntensity = 0.5 + 0.5 * Math.sin((elapsedMs - 600) * 0.02);
        const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 80);
        grad.addColorStop(0, pal.goldLight);
        grad.addColorStop(0.3, pal.goldGlow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = globalAlpha * beamIntensity;
        ctx.beginPath();
        ctx.ellipse(0, 0, 80, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==========================================
  // 【時序分流 2: 施法者天門與展翼 (0ms ~ 1800ms)】
  // ==========================================
  if (elapsedMs <= 1800) {
    ctx.save();
    ctx.translate(from.x, from.y);

    const gateScale = Math.min(1, elapsedMs / 500);
    const gateAlpha =
      elapsedMs > 1300 ? 1 - (elapsedMs - 1300) / 500 : Math.min(1, elapsedMs / 300);

    if (gateAlpha > 0.01) {
      ctx.globalAlpha = gateAlpha;

      // 1. 白石金邊拱形英靈天門 (置於角色背後 Y - 65)
      ctx.save();
      ctx.translate(0, -65);
      ctx.scale(gateScale, gateScale);

      // 外拱門陰影輪廓
      ctx.beginPath();
      ctx.arc(0, -35, 48, Math.PI, 0, false);
      ctx.lineTo(48, 55);
      ctx.lineTo(-48, 55);
      ctx.closePath();
      ctx.fillStyle = pal.stone;
      ctx.strokeStyle = pal.gold;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.fill();

      // 內雕花拱心
      ctx.beginPath();
      ctx.arc(0, -35, 34, Math.PI, 0, false);
      ctx.lineTo(34, 55);
      ctx.lineTo(-34, 55);
      ctx.closePath();
      ctx.fillStyle = isAlt ? '#240f3b' : '#efe8d5';
      ctx.strokeStyle = pal.goldLight;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fill();

      // 聖堂立柱橫樑雕花刻線
      ctx.beginPath();
      ctx.moveTo(-45, -30);
      ctx.lineTo(45, -30);
      ctx.moveTo(-45, 10);
      ctx.lineTo(45, 10);
      ctx.strokeStyle = pal.gold;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 門內金色光幕虛空
      const portalGrad = ctx.createLinearGradient(0, -80, 0, 50);
      portalGrad.addColorStop(0, pal.goldLight);
      portalGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = portalGrad;
      ctx.globalAlpha = gateAlpha * 0.7;
      ctx.fill();

      ctx.restore();

      if (elapsedMs < 600) {
        ctx.save();
        ctx.translate(0, -70);
        ctx.globalAlpha = gateAlpha;
        drawHeroFlyingStatue(ctx, pal, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ==========================================
  // 【時序分流 3: 施法者本體保真與幾何護盾 (0ms ~ 4200ms)】
  // ==========================================
  ctx.save();
  ctx.translate(from.x, from.y);

  // 1. 繪製施法者本體 (頭像或高精度精靈圖標)
  if (opt.images && opt.images.avatar) {
    try {
      ctx.drawImage(opt.images.avatar, -28, -56, 56, 56);
    } catch (e) {}
  } else {
  }

  // 2. 幾何立體護盾紋章 (600ms 開始凝聚，持續至 4200ms 收斂)
  if (elapsedMs >= 600) {
    const shieldTime = elapsedMs - 600;
    const shieldEnter = Math.min(1, shieldTime / 400);
    const shieldExit = elapsedMs > 3800 ? 1 - (elapsedMs - 3800) / 400 : 1;
    const shieldAlpha = shieldEnter * shieldExit;

    if (shieldAlpha > 0.01) {
      ctx.save();
      ctx.translate(0, -26);
      ctx.globalAlpha = shieldAlpha;

      const shieldAngle = (elapsedMs / 1000) * 1.2;

      // 內層多邊形稜鏡
      ctx.save();
      ctx.rotate(shieldAngle);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const r = 38 + Math.sin(elapsedMs * 0.005 + i) * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = pal.shieldCore;
      ctx.strokeStyle = pal.goldLight;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 外層逆向旋轉符文環
      ctx.save();
      ctx.rotate(-shieldAngle * 0.7);
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.strokeStyle = pal.gold;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8, 3, 8]);
      ctx.stroke();

      // 四方加護節點
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 48, Math.sin(a) * 48, 3, 0, Math.PI * 2);
        ctx.fillStyle = pal.stoneHighlight;
        ctx.strokeStyle = pal.gold;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();
    }
  }
  ctx.restore();

  // ==========================================
  // 【時序分流 4: 英雄石像躍升天際至重砸 (600ms ~ 2100ms)】
  // ==========================================
  if (elapsedMs >= 600 && elapsedMs < 2100) {
    const flightNorm = (elapsedMs - 600) / (2100 - 600); // 0.0 -> 1.0

    // 拋物線彈道計算
    const startX = from.x;
    const startY = from.y - 70;
    const endX = to.x;
    const endY = to.y;

    // 向上衝起再極速下墜
    const apexHeight = opt.flightLift;
    const currentX = startX + (endX - startX) * flightNorm;
    const baseLinearY = startY + (endY - startY) * flightNorm;
    const arcOffset = apexHeight * heroFlightArc(flightNorm);
    const currentY = baseLinearY - arcOffset;

    // 尾跡金色流光與羽毛 (≤ 16 顆)
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const trailNorm = Math.max(0, flightNorm - i * 0.02);
      const tx = startX + (endX - startX) * trailNorm + Math.sin(i * 1.5) * 6;
      const ty =
        startY +
        (endY - startY) * trailNorm -
        apexHeight * heroFlightArc(trailNorm) +
        Math.cos(i * 1.5) * 6;
      const alpha = (1 - i / 14) * 0.6;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(1, 4 - i * 0.25), 0, Math.PI * 2);
      ctx.fillStyle = pal.gold;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.restore();

    // 繪製空中的飛躍石像姿態 (迎風下撲傾角)
    ctx.save();
    const visibleY = Math.max(105, currentY);
    const flightSize = Math.min(1, visibleY / 224);
    ctx.translate(currentX, visibleY);
    ctx.scale(flightSize, flightSize);
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX) + 1) * 0.38;
    const opening = Math.min(1, Math.max(0, (flightNorm - 0.07) / 0.27));
    const spread = opening * opening * (3 - 2 * opening);
    const dive = Math.max(0, (flightNorm - 0.62) / 0.38);
    const lean = Math.sign(endX - startX) * (angle - 0.16 + dive * 0.56);
    ctx.rotate(lean);
    drawHeroFlyingStatue(ctx, pal, spread * (1 - dive * 0.35));
    ctx.restore();
  }

  // ==========================================
  // 【時序分流 5: 2100ms 瞬間震撼衝擊波與石片、受擊擊飛】
  // ==========================================
  if (elapsedMs >= 2100) {
    const postTime = elapsedMs - 2100;

    // A. 局部落點地面震波 (2100ms ~ 2300ms 局部震盪，拒絕全屏抖動)
    let shockOffsetY = 0;
    if (postTime <= 200) {
      shockOffsetY = Math.sin(postTime * 0.1) * (1 - postTime / 200) * 5;
    }

    ctx.save();
    ctx.translate(to.x, to.y + shockOffsetY);

    // B. 雙重同心金光衝擊波環 (2100ms ~ 3000ms)
    if (postTime <= 900) {
      const wave1Norm = postTime / 900;
      const radius1 = wave1Norm * 180;
      const alpha1 = Math.max(0, 1 - wave1Norm);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, radius1, radius1 * 0.38, 0, 0, Math.PI * 2);
      ctx.strokeStyle = pal.shockwave;
      ctx.lineWidth = Math.max(1, 4 * (1 - wave1Norm));
      ctx.globalAlpha = alpha1;
      ctx.stroke();

      if (postTime > 80) {
        const wave2Norm = (postTime - 80) / 820;
        const radius2 = wave2Norm * 140;
        const alpha2 = Math.max(0, 1 - wave2Norm);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius2, radius2 * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = pal.goldLight;
        ctx.lineWidth = Math.max(1, 3 * (1 - wave2Norm));
        ctx.globalAlpha = alpha2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // C. 立體白石碎塊與多邊形石片迸射 (≤ 18 塊，無界定錨粒子)
    if (postTime <= 1200) {
      const fragNorm = postTime / 1200;
      const fragAlpha = Math.max(0, 1 - fragNorm);
      ctx.save();
      ctx.globalAlpha = fragAlpha;

      for (let i = 0; i < 16; i++) {
        const angle = ((Math.PI * 2) / 16) * i + (i % 3);
        const dist = fragNorm * (70 + (i % 5) * 22);
        const px = Math.cos(angle) * dist;
        const py =
          Math.sin(angle) * (dist * 0.45) - Math.sin(fragNorm * Math.PI) * (30 + (i % 4) * 15);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(fragNorm * (i % 2 === 0 ? 4 : -4));
        ctx.beginPath();
        ctx.moveTo(-4, -3);
        ctx.lineTo(3, -5);
        ctx.lineTo(5, 4);
        ctx.lineTo(-2, 5);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? pal.stone : pal.gold;
        ctx.strokeStyle = pal.stoneHighlight;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // D. 聖光地裂紋 (2100ms ~ 3800ms)
    if (postTime <= 1700) {
      const crackFade = postTime > 1100 ? 1 - (postTime - 1100) / 600 : 1;
      ctx.save();
      ctx.globalAlpha = crackFade * 0.85;
      ctx.beginPath();
      // 輻射地裂折線
      const branches = [
        [
          [0, 0],
          [25, 8],
          [55, 12],
          [80, 20],
        ],
        [
          [0, 0],
          [-30, 6],
          [-65, 15],
          [-95, 22],
        ],
        [
          [0, 0],
          [15, -8],
          [40, -18],
          [65, -24],
        ],
        [
          [0, 0],
          [-20, -7],
          [-50, -16],
          [-75, -20],
        ],
        [
          [0, 0],
          [0, 12],
          [8, 30],
          [12, 45],
        ],
      ];
      branches.forEach((branch) => {
        ctx.moveTo(branch[0][0], branch[0][1]);
        for (let b = 1; b < branch.length; b++) {
          ctx.lineTo(branch[b][0], branch[b][1]);
        }
      });
      ctx.strokeStyle = pal.crack;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 核心金光裂縫微光
      ctx.strokeStyle = pal.goldLight;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // E. 英雄落地單膝跪地英武姿態 (2100ms ~ 3500ms，羽化淡出)
    if (postTime <= 1400) {
      const heroAlpha = postTime > 800 ? 1 - (postTime - 800) / 600 : 1;
      ctx.save();
      ctx.globalAlpha = heroAlpha;
      drawHeroLandedStatue(ctx, pal);
      ctx.restore();
    }

    ctx.restore(); // 退出 to 局部落點

    // F. 敵人受擊擊飛動線：真實命中座標殘影 (Upward Launch Streamline Trails)
    if (postTime <= 1100 && hits && hits.length) {
      const hitProgress = postTime / 1100;
      const launchHeight = 120;

      hits
        .filter((target) => !target.pending && !target.missed && target.at <= elapsedMs)
        .slice(0, 8)
        .forEach((target, idx) => {
          const tx = target.x;
          const ty = target.y;
          const upY = ty - Math.sin(hitProgress * Math.PI * 0.75) * launchHeight;
          const alpha = Math.max(0, 1 - hitProgress);

          ctx.save();
          ctx.globalAlpha = alpha;

          // 向上的受擊衝擊光束 (Launch Streamlines)
          ctx.beginPath();
          ctx.moveTo(tx - 6, ty + 10);
          ctx.lineTo(tx, upY);
          ctx.lineTo(tx + 6, ty + 10);
          ctx.fillStyle = pal.energyRay;
          ctx.fill();

          // 垂直流光線
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx, upY);
          ctx.strokeStyle = pal.goldLight;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();

          // 受擊目標半透明輪廓殘影 (幾何靶標)
          ctx.save();
          ctx.translate(tx, upY);
          ctx.beginPath();
          ctx.ellipse(0, 0, 16, 26, 0, 0, Math.PI * 2);
          ctx.strokeStyle = pal.gold;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 衝擊星芒
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fillStyle = pal.stoneHighlight;
          ctx.fill();
          ctx.restore();

          ctx.restore();
        });
    }

    // G. 石像羽化升騰羽毛與光塵 (2100ms ~ 3800ms, ≤ 26 顆)
    if (postTime >= 200 && postTime <= 1700) {
      const featherTime = postTime - 200;
      const featherNorm = featherTime / 1500;
      const featherAlpha = featherTime > 1000 ? 1 - (featherTime - 1000) / 500 : 1;

      ctx.save();
      ctx.globalAlpha = featherAlpha * 0.8;
      for (let i = 0; i < 22; i++) {
        const seed = (i * 97) % 360;
        const speed = 60 + (i % 7) * 20;
        const xOffset = Math.sin(seed + featherNorm * 2) * (40 + (i % 4) * 25);
        const yOffset = -featherNorm * speed * 2 - (i % 5) * 12;

        ctx.save();
        ctx.translate(to.x + xOffset, to.y - 30 + yOffset);
        ctx.rotate(featherNorm * 3 + seed);

        // 升騰羽毛輪廓
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.quadraticCurveTo(4, -2, 0, 6);
        ctx.quadraticCurveTo(-4, -2, 0, -6);
        ctx.fillStyle = i % 2 === 0 ? pal.goldLight : pal.goldGlow;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  ctx.restore(); // 結束頂層繪圖保護
}

/**
 * 輔助函式：預設施法者外觀 (在無 avatar 圖片時保持清晰優雅)
 */
function drawDefaultCaster(ctx, pal) {
  ctx.save();
  // 身軀斗篷剪影
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(16, -10);
  ctx.lineTo(20, 6);
  ctx.lineTo(-20, 6);
  ctx.lineTo(-16, -10);
  ctx.closePath();
  ctx.fillStyle = pal.stone;
  ctx.strokeStyle = pal.gold;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // 頭部兜帽與法師面容
  ctx.beginPath();
  ctx.arc(0, -32, 11, 0, Math.PI * 2);
  ctx.fillStyle = pal.stoneHighlight;
  ctx.fill();
  ctx.stroke();

  // 雙手法杖或施法聚能核心
  ctx.beginPath();
  ctx.arc(0, -18, 4, 0, Math.PI * 2);
  ctx.fillStyle = pal.goldLight;
  ctx.fill();
  ctx.restore();
}
