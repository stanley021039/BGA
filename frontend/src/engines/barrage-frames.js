import GameUI from './ui-widgets.js';
let BarrageFrames;
(() => {
  const KEY = 'ah-barrage-frame-settings',
    VERSION = 1;
  const options = Object.freeze(
    [
      { id: 'default', label: '預設' },
      { id: 'paper', label: '紙張' },
      { id: 'comic', label: '漫畫' },
      { id: 'pixel', label: '像素' },
      { id: 'neon', label: '電流霓虹', group: '科幻科技' },
      { id: 'orbit', label: '星際軌道', group: '科幻科技' },
      { id: 'holo', label: '全息故障', group: '科幻科技' },
      { id: 'arcade', label: '街機像素', group: '科幻科技' },
      { id: 'mech', label: '機械核心', group: '科幻科技' },
      { id: 'berry', label: '奶油草莓', group: '可愛療癒' },
      { id: 'cat', label: '貓咪肉球', group: '可愛療癒' },
      { id: 'cloud', label: '軟糖雲朵', group: '可愛療癒' },
      { id: 'jelly', label: '深海水母', group: '可愛療癒' },
      { id: 'shiba', label: '柴犬吐司', group: '可愛療癒' },
      { id: 'forest', label: '森林精靈', group: '奇幻自然' },
      { id: 'dragon', label: '龍焰寶藏', group: '奇幻自然' },
      { id: 'frost', label: '冰晶王冠', group: '奇幻自然' },
      { id: 'moon', label: '月光魔法', group: '奇幻自然' },
      { id: 'potion', label: '蘑菇藥釜', group: '奇幻自然' },
      { id: 'ink', label: '水墨游魚', group: '古典戲劇' },
      { id: 'sakura', label: '御守櫻花', group: '古典戲劇' },
      { id: 'steam', label: '蒸汽郵件', group: '古典戲劇' },
      { id: 'burst', label: '漫畫爆擊', group: '古典戲劇' },
      { id: 'royal', label: '皇家劇院', group: '古典戲劇' },
      {
        id: 'palette',
        label: '彩筆調色盤',
        group: '成就獎勵',
        achievementId: 'draw-regular',
        achievementTitle: '畫猜常客',
      },
      {
        id: 'giftbox',
        label: '心意禮盒',
        group: '成就獎勵',
        achievementId: 'gift-regular',
        achievementTitle: '心意常客',
      },
      {
        id: 'signal',
        label: '默契電波',
        group: '成就獎勵',
        achievementId: 'majority-regular',
        achievementTitle: '同頻常客',
      },
      {
        id: 'ace',
        label: '王牌之夜',
        group: '成就獎勵',
        achievementId: 'poker-regular',
        achievementTitle: '牌桌常客',
      },
      {
        id: 'dust',
        label: '廢土疾風',
        group: '成就獎勵',
        achievementId: 'thunder-regular',
        achievementTitle: '公路常客',
      },
      {
        id: 'cauldro',
        label: '好運藥釜',
        group: '成就獎勵',
        achievementId: 'quacks-regular',
        achievementTitle: '煉藥常客',
      },
      {
        id: 'letters',
        label: '接力信箋',
        group: '成就獎勵',
        achievementId: 'telephone-first-match',
        achievementTitle: '傳情初體驗',
      },
      {
        id: 'lantern',
        label: '霧港骰燈',
        group: '成就獎勵',
        achievementId: 'trpg-first-match',
        achievementTitle: '霧港歸人',
      },
      {
        id: 'geo',
        label: '幾何靈光',
        group: '成就獎勵',
        achievementId: 'minimal-first-match',
        achievementTitle: '幾何初登場',
      },
      {
        id: 'market',
        label: '逆風指標',
        group: '成就獎勵',
        achievementId: 'market-regular',
        achievementTitle: '預測常客',
      },
      {
        id: 'vinyl',
        label: '黑膠星光',
        group: '成就獎勵',
        achievementId: 'musicquiz-first-match',
        achievementTitle: '金曲初登場',
      },
      {
        id: 'mic',
        label: '舞台麥克風',
        group: '成就獎勵',
        achievementId: 'bluff-first-match',
        achievementTitle: '瞎掰初登場',
      },
      {
        id: 'easel',
        label: '知音畫架',
        achievementId: 'draw-soul-artist',
        group: '成就獎勵',
        achievementTitle: '靈魂畫手，有人懂',
      },
      {
        id: 'wish',
        label: '星願信封',
        achievementId: 'gift-wishlist-echo',
        group: '成就獎勵',
        achievementTitle: '願望清單有回音',
      },
      {
        id: 'sync',
        label: '心有靈犀',
        achievementId: 'majority-one-channel',
        group: '成就獎勵',
        achievementTitle: '同頻不用 Wi-Fi',
      },
      {
        id: 'runfive',
        label: '順子王冠',
        achievementId: 'poker-showdown-straight',
        group: '成就獎勵',
        achievementTitle: '好牌不白來',
      },
      {
        id: 'finish',
        label: '終點旗幟',
        achievementId: 'thunder-race-winner',
        group: '成就獎勵',
        achievementTitle: '公路霸主',
      },
      {
        id: 'witches',
        label: '三巫星陣',
        achievementId: 'quacks-three-witches',
        group: '成就獎勵',
        achievementTitle: '女巫全員出動',
      },
      {
        id: 'sketch',
        label: '彩色接力冊',
        achievementId: 'telephone-color-relay',
        group: '成就獎勵',
        achievementTitle: '彩色接力棒',
      },
      {
        id: 'compass',
        label: '同行羅盤',
        achievementId: 'trpg-support-three',
        group: '成就獎勵',
        achievementTitle: '霧中神隊友',
      },
      {
        id: 'triform',
        label: '三筆宇宙',
        achievementId: 'minimal-three-shapes',
        group: '成就獎勵',
        achievementTitle: '三筆傳神',
      },
      {
        id: 'rebound',
        label: '逆勢之翼',
        achievementId: 'market-countertrend',
        group: '成就獎勵',
        achievementTitle: '逆風命中',
      },
      {
        id: 'encore',
        label: '前奏三連星',
        achievementId: 'musicquiz-intro-streak',
        group: '成就獎勵',
        achievementTitle: '前奏三連星',
      },
      {
        id: 'mask',
        label: '千面劇場',
        achievementId: 'bluff-convincing',
        group: '成就獎勵',
        achievementTitle: '這也能唬到你',
      },
    ].map(Object.freeze),
  );
  // Original CSS/SVG artwork adapted from Stitch project 10999676405834166796.
  // Additional challenge rewards use local original SVG artwork.
  const artwork = Object.freeze({
    ...{
      easel:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#d7b3ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 58 20-50 21 50M19 46h31"/><rect x="14" y="12" width="45" height="32" rx="3"/><path d="m21 35 10-12 8 9 10-16"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #d7b3ff;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #d7b3ff22"></div></div>',
      wish: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#ffc5c9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="23" width="59" height="33" rx="5"/><path d="m9 25 29 19 28-19M24 20l6-9 7 9 10-4-3 12"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #ffc5c9;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #ffc5c922"></div></div>',
      sync: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#8ce8da" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="24" cy="32" r="17"/><circle cx="49" cy="32" r="17"/><path d="m20 32 10 9 24-25"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #8ce8da;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #8ce8da22"></div></div>',
      runfive:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#ffe09b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 17 12 13 15-23 15 23 13-13-6 30H16Z"/><path d="M16 54h43"/><circle cx="37" cy="36" r="5"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #ffe09b;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #ffe09b22"></div></div>',
      finish:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#ffc088" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 59V7h43v30H15M16 17h42M16 27h42M27 8v28M47 8v28"/><path d="m8 57 12-3"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #ffc088;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #ffc08822"></div></div>',
      witches:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#c8ed97" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 51 12-31 12 31Zm23 0 15-43 19 43Z"/><path d="M7 54h60M36 39l24-4"/><circle cx="19" cy="12" r="4"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #c8ed97;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #c8ed9722"></div></div>',
      sketch:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#9be5ed" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="13" width="60" height="43" rx="5"/><path d="M20 13v43M31 23h27M31 33h19M31 43h27"/><path d="m56 8 8 5-12 18-8 1 1-8Z"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #9be5ed;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #9be5ed22"></div></div>',
      compass:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#efca8d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="37" cy="32" r="25"/><path d="m37 11 9 21-9 21-9-21ZM13 32h48"/><circle cx="37" cy="32" r="4"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #efca8d;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #efca8d22"></div></div>',
      triform:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#b6cafa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="20" cy="23" r="12"/><path d="m40 9 22 28H30Z"/><rect x="15" y="37" width="21" height="20"/><path d="m45 48 8 8 15-17"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #b6cafa;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #b6cafa22"></div></div>',
      rebound:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#f6d992" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 51h59M15 44V31m14 9V17m14 22V25m14 1V10M11 37l18 8 29-31m-11 1 12-3-2 12"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #f6d992;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #f6d99222"></div></div>',
      encore:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#dbbaff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 42V31a25 25 0 0 1 50 0v11M12 30H7v20h12V30ZM62 30h6v20H56V30Z"/><path d="m27 15 3-7 4 7 8 1-6 5 1 8-7-4-7 4 2-8-6-5Z"/><path d="M28 46v12m9-18v18m9-10v10"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #dbbaff;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #dbbaff22"></div></div>',
      mask: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="#242338" stroke="#ffc1dd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16q29-11 59 0l-5 24q-25 29-49 0Z"/><path d="m17 27 12 4m17 0 12-4M24 43q13-11 27 0"/><path d="m7 9 6 5m48-5 6-5"/></svg></div><div class="reward-glint pointer-events-none">✧</div><div class="reward-surface" style="background:linear-gradient(135deg,#242338,#171b2c);border:2px solid #ffc1dd;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 18px #ffc1dd22"></div></div>',
    },
    ...{
      palette:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><path d="M15 43C-2 29 9 7 30 6c25-2 40 12 32 28-4 8-17 1-20 7-4 9-18 12-27 2Z" fill="#f5d5a1"/><circle cx="19" cy="20" r="5" fill="#ec6b77"/><circle cx="33" cy="14" r="5" fill="#ffd95d"/><circle cx="48" cy="20" r="5" fill="#55c3b0"/><circle cx="22" cy="36" r="5" fill="#769eea"/><path d="m46 48 18-36 6 3-17 37Z" fill="#b57b47"/><path d="m63 13 3-9 6 2-2 10" fill="#f4c4b5"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#2a253e;border:2px solid #c69be6;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #c69be622"></div></div>',
      giftbox:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><rect x="13" y="25" width="48" height="30" rx="4" fill="#db657b"/><rect x="9" y="19" width="56" height="13" rx="3" fill="#f69baa"/><path d="M32 20h10v36H32Z" fill="#ffe5a3"/><path d="M37 20C9 25 12-1 26 8l11 12C65 25 63-1 49 8Z" fill="#fff0bd"/><path d="m37 18-9-7m10 7 10-7" stroke="#c98940"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#492b36;border:2px solid #f5b4a7;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #f5b4a722"></div></div>',
      signal:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><path d="m25 19-8-12m29 12L55 6" stroke="#b8f3e9" stroke-width="4"/><rect x="14" y="18" width="44" height="36" rx="9" fill="#45a798"/><circle cx="29" cy="36" r="10" fill="#143942"/><path d="M23 36h12m-6-6v12" stroke="#9af4d4"/><path d="M47 30v15m-5-12v9m10-9v9" stroke="#ffe4a3" stroke-width="3"/><path d="M8 22Q0 35 8 48M64 22q8 13 0 26" fill="none" stroke="#9af4d4" stroke-width="2"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#143b3d;border:2px solid #86ded0;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #86ded022"></div></div>',
      ace: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><rect x="9" y="9" width="34" height="43" rx="4" fill="#f5e8c8" transform="rotate(-12 26 30)"/><rect x="29" y="6" width="31" height="43" rx="4" fill="#fff8e8" transform="rotate(10 45 28)"/><path d="M44 18c-19 14-7 22 0 14 7 8 19 0 0-14Zm-4 20h8l-4-9Z" fill="#203d36"/><circle cx="56" cy="46" r="12" fill="#bd8b37"/><circle cx="56" cy="46" r="8" fill="#254e41" stroke="#ffe1a1" stroke-dasharray="3 2"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#153d31;border:2px solid #e2bc70;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #e2bc7022"></div></div>',
      dust: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><circle cx="32" cy="31" r="23" fill="#242525" stroke="#986745" stroke-width="5" stroke-dasharray="5 3"/><circle cx="32" cy="31" r="13" fill="#b9a38a"/><circle cx="32" cy="31" r="5" fill="#3c4043"/><path d="m12 45-10 8m23-1-14 5m38-11 17 6m-14-13 16 3" stroke="#edbc72" stroke-width="4" stroke-linecap="round"/><path d="m23 10 9 21 17-10" stroke="#71604c" stroke-width="4"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#34271e;border:2px solid #dba264;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #dba26422"></div></div>',
      cauldro:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><path d="M13 27q-8 30 22 29 30 0 21-29Z" fill="#1f5146" stroke="#e5bb6a" stroke-width="2"/><ellipse cx="35" cy="27" rx="23" ry="8" fill="#8be3a5"/><path d="M15 49 9 58m46-9 7 9" stroke="#cfab68" stroke-width="4"/><circle cx="27" cy="14" r="5" fill="#b7f5aa"/><circle cx="39" cy="6" r="3" fill="#a4e4d4"/><path d="M57 8h8v12l6 12q1 8-10 8-11 0-10-8l6-12Z" fill="#b498e0" stroke="#f5deab"/><path d="M54 29h14" stroke="#f5deab" stroke-width="3"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#153b2b;border:2px solid #a3d77f;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #a3d77f22"></div></div>',
      letters:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><path d="m9 24 46-7 7 36-46 7Z" fill="#f7e1ad"/><path d="m12 27 24 13 21-20m-37 30 12-11m23 4L42 36" fill="none" stroke="#bd895b" stroke-width="2"/><path d="M21 5C7 13 22 34 35 30l4-8-8-4-4 4-8-9 4-2Z" fill="#467b7a"/><path d="m53 42 15-23 5 3-15 23-7 4Z" fill="#e6a151"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#f5e6c9;border:2px solid #a88150;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #a8815022"></div></div>',
      lantern:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><path d="M39 17h24l-2 34H41Z" fill="#25434b" stroke="#cfa756" stroke-width="2"/><path d="M44 20h15v26H44Z" fill="#f4c664"/><path d="M48 14V9q5-8 10 0v5m-21 3h28m-28 36h28" fill="none" stroke="#ddb970" stroke-width="3"/><path d="m6 26 14-11 16 10-2 21-16 9L4 44Z" fill="#6972a0" stroke="#c5c9f1"/><path d="m20 15-7 25 21 6m2-21L13 40l5 15m-14-11 9-4" fill="none" stroke="#c5c9f1"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#182e40;border:2px solid #d5b276;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #d5b27622"></div></div>',
      geo: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><circle cx="21" cy="22" r="14" fill="#e56d66"/><path d="m29 53 24-40 17 40Z" fill="#78b7ba" stroke="#e9f5e8" stroke-width="2"/><path d="m42 46 10-18 8 18Z" fill="#173743"/><path d="M7 51 40 10l5 4-33 42-8 3Z" fill="#f9cf65"/><path d="m40 10 5 4" stroke="#f6f4da" stroke-width="5"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#f3e8d4;border:2px solid #456d72;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #456d7222"></div></div>',
      market:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><path d="M9 16v37m10-27v20m12-39v35m10-15v28" stroke="#6ed1a9" stroke-width="2"/><path d="M6 24h6v16H6Zm10 6h6v9h-6Z" fill="#eb7d79"/><path d="M28 15h6v19h-6Zm10 20h6v13h-6Z" fill="#67d0a8"/><path d="M53 41v-8C34 12 69 3 69 23c0 5-7 9-7 11v7Z" fill="#ffdb83"/><path d="M54 44h9m-8 4h7m-6 4h5" stroke="#d3ac69" stroke-width="3"/><path d="m54 27 5 11 4-11" fill="none" stroke="#b7793a"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#192d36;border:2px solid #e6c476;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #e6c47622"></div></div>',
      vinyl:
        '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><circle cx="28" cy="30" r="25" fill="#181b20" stroke="#bd965e" stroke-width="2"/><circle cx="28" cy="30" r="19" fill="none" stroke="#50545c"/><circle cx="28" cy="30" r="14" fill="none" stroke="#393d48"/><circle cx="28" cy="30" r="9" fill="#cb8744"/><circle cx="28" cy="30" r="2" fill="#f9ebc1"/><path d="M65 7 60 33 47 42" fill="none" stroke="#efd28d" stroke-width="4"/><path d="m60 2 2 6 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#ffe8a3"/><path d="M60 46v-9l10-3v10" fill="none" stroke="#e4bc69" stroke-width="2"/><ellipse cx="57" cy="46" rx="4" ry="3" fill="#e4bc69"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#261e1b;border:2px solid #e3b96b;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #e3b96b22"></div></div>',
      mic: '<div class="barrage-art-root reward-art"><div class="reward-object pointer-events-none"><svg width="76" height="64" viewBox="0 0 76 64" fill="none" aria-hidden="true"><rect x="22" y="5" width="23" height="32" rx="11" fill="#dcbd88" stroke="#fff0c9"/><path d="M25 15h17m-18 6h19m-17 6h16" stroke="#725f4d" stroke-width="2"/><path d="M17 25v5q0 19 33 0v-5M34 42v13m-12 0h24" fill="none" stroke="#e8c789" stroke-width="3"/><path d="M54 16q12 10 0 20m6-27q20 17 0 34" fill="none" stroke="#ec93b6" stroke-width="2"/><path d="M7 7 18 40 1 35Z" fill="#f1cb7b" opacity=".4"/></svg></div><div class="reward-glint pointer-events-none">✦</div><div class="reward-surface" style="background:#362237;border:2px solid #e2a5c7;border-radius:14px;position:absolute;inset:0;box-shadow:inset 0 0 16px #e2a5c722"></div></div>',
    },
    neon: '<div class="barrage-art-root" style="animation: bf-neonPulse 2.4s infinite ease-in-out;"><div class="absolute -top-3 -right-4 pointer-events-none" style="animation: bf-cyberShardFloat 2.4s infinite ease-in-out;"><svg fill="none" height="42" viewbox="0 0 46 42" width="46"><polygon fill="#ff007f" fill-opacity="0.85" points="10,0 46,6 36,36 0,22"></polygon><polygon fill="#00ffff" points="14,4 42,9 33,32 5,20"></polygon><circle cx="34" cy="8" fill="#fff" r="2.5"></circle><path d="M42,9 L46,2" stroke="#ff007f" stroke-width="2"></path></svg></div><div class="absolute -bottom-2 -left-3 pointer-events-none"><svg fill="none" height="26" viewbox="0 0 34 26" width="34"><polygon fill="#00ffcc" fill-opacity="0.9" points="0,0 28,8 22,26 0,16"></polygon><line stroke="#ff007f" stroke-width="2" x1="2" x2="30" y1="20" y2="24"></line></svg></div><div class="absolute inset-0 bg-[#070b14]/90 border-2 border-cyan-400 rounded-lg overflow-hidden shadow-[inset_0_0_15px_rgba(0,255,204,0.3)]" style="clip-path: polygon(0 8px, 8px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 14px 100%, 0 calc(100% - 14px));"><svg class="absolute inset-0 w-full h-full opacity-40 pointer-events-none" xmlns="http://www.w3.org/2000/svg"><path d="M0,20 L40,20 L55,8 L240,8 L255,24 L300,24" fill="none" stroke="#00ffff" stroke-width="1.2"></path><path d="M120,60 L180,60 L195,50 L300,50" fill="none" stroke="#ff007f" stroke-width="1"></path><circle cx="55" cy="8" fill="#ff007f" r="2"></circle><circle cx="240" cy="8" fill="#00ffff" r="2"></circle></svg><div class="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent skew-x-12" style="animation: bf-cyberScan 2.4s infinite linear;"></div></div></div>',
    orbit:
      '<div class="barrage-art-root"><div class="absolute -top-5 -right-5 w-20 h-20 pointer-events-none z-20"><svg class="absolute inset-0 w-full h-full" style="animation: bf-orbitPulse 3s infinite ease-in-out;" viewbox="0 0 80 80"><ellipse cx="40" cy="40" fill="none" rx="34" ry="16" stroke="rgba(147, 197, 253, 0.7)" stroke-dasharray="3 2" stroke-width="1.5" transform="rotate(-25 40 40)"></ellipse><circle cx="40" cy="40" fill="url(#BF_INSTANCE-sunGlow)" r="10"></circle><defs><radialgradient id="BF_INSTANCE-sunGlow"><stop offset="0%" stop-color="#818cf8"></stop><stop offset="100%" stop-color="#312e81" stop-opacity="0"></stop></radialgradient></defs></svg><div class="absolute inset-0 flex items-center justify-center"><div style="animation: bf-planetOrbit 4.5s infinite linear;"><div class="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-amber-300 via-emerald-400 to-cyan-400 shadow-[0_0_8px_#38bdf8] border border-white"></div></div></div></div><div class="absolute inset-0 bg-[#090d21]/85 backdrop-blur-md border border-indigo-400/40 rounded-xl overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.6)]"><div class="absolute top-2 left-6 w-1 h-1 bg-white rounded-full opacity-60"></div><div class="absolute bottom-3 right-16 w-1 h-1 bg-cyan-300 rounded-full opacity-70"></div><div class="absolute top-4 left-32 w-1.5 h-1.5 bg-indigo-300 rounded-full opacity-40"></div><div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"></div></div></div>',
    holo: '<div class="barrage-art-root" style="animation: bf-holoGlitch 3.2s infinite ease-in-out;"><div class="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-emerald-400 pointer-events-none"></div><div class="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-emerald-400 pointer-events-none"></div><div class="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-emerald-400 pointer-events-none"></div><div class="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-emerald-400 pointer-events-none"></div><div class="absolute inset-0 bg-[#06241a]/60 backdrop-blur-sm border border-emerald-400/50 rounded-sm overflow-hidden shadow-[0_0_15px_rgba(52,211,153,0.25)]"><div class="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0)_50%,rgba(6,78,59,0.35)_50%)] bg-[length:100%_4px] pointer-events-none"></div><div class="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-300/20 to-transparent pointer-events-none" style="animation: bf-holoScan 2s infinite linear;"></div></div></div>',
    arcade:
      '<div class="barrage-art-root"><div class="absolute -top-4 -right-2 pointer-events-none z-20" style="animation: bf-pixelBounce 1.8s infinite steps(4);"><svg class="drop-shadow-[0_2px_0_#000]" fill="none" height="24" viewbox="0 0 13 12" width="26"><rect fill="#ff0055" height="2" width="3" x="2" y="0"></rect><rect fill="#ff0055" height="2" width="3" x="7" y="0"></rect><rect fill="#ff0055" height="4" width="6" x="0" y="2"></rect><rect fill="#ff0055" height="4" width="6" x="6" y="2"></rect><rect fill="#ff0055" height="2" width="10" x="1" y="6"></rect><rect fill="#ff0055" height="2" width="6" x="3" y="8"></rect><rect fill="#ff0055" height="2" width="2" x="5" y="10"></rect><rect fill="#ffffff" height="2" width="2" x="2" y="2"></rect></svg></div><div class="absolute -bottom-3 -left-2 pointer-events-none z-20"><svg class="drop-shadow-[0_2px_0_#000]" fill="none" height="24" viewbox="0 0 12 12" width="24"><circle cx="6" cy="4" fill="#ffcc00" r="3"></circle><rect fill="#666" height="4" width="2" x="5" y="6"></rect><rect fill="#222" height="2" width="8" x="2" y="10"></rect></svg></div><div class="absolute inset-0 bg-[#251535] border-4 border-[#ff0077] shadow-[4px_4px_0_#000]" style="clip-path: polygon(0 6px, 6px 6px, 6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px));"><div class="absolute inset-1 border-2 border-dashed border-[#ffcc00] pointer-events-none opacity-60"></div><div class="absolute top-1 left-20 text-[10px] text-yellow-300" style="animation: bf-pixelBlink 1s infinite steps(1);">✦</div><div class="absolute bottom-1 right-16 text-[9px] text-cyan-300" style="animation: bf-pixelBlink 1.4s infinite steps(1);">✦</div></div></div>',
    mech: '<div class="barrage-art-root"><div class="absolute -top-4 -right-4 w-12 h-12 pointer-events-none z-20"><svg class="w-full h-full text-amber-500 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style="animation: bf-gearSpin 4s infinite linear;" viewbox="0 0 40 40"><path d="M18,0 L22,0 L23,5 C25,5.5 27,6.5 29,8 L33,5 L36,8 L33,12 C34.5,14 35.5,16 36,18 L41,19 L41,23 L36,24 C35.5,26 34.5,28 33,30 L36,34 L33,37 L29,34 C27,35.5 25,36.5 23,37 L22,42 L18,42 L17,37 C15,36.5 13,35.5 11,34 L7,37 L4,34 L7,30 C5.5,28 4.5,26 4,24 L0,23 L0,19 L4,18 C4.5,16 5.5,14 7,12 L4,8 L7,5 L11,8 C13,6.5 15,5.5 17,5 Z" fill="currentColor"></path><circle cx="20" cy="21" fill="#1c1917" r="7" stroke="#fbbf24" stroke-width="2"></circle></svg></div><div class="absolute inset-0 bg-[#212429] border-2 border-slate-600 rounded-lg overflow-hidden shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_8px_16px_rgba(0,0,0,0.6)]"><div class="absolute top-1.5 left-2 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-[inset_0_1px_1px_#fff]"></div><div class="absolute top-1.5 right-6 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-[inset_0_1px_1px_#fff]"></div><div class="absolute bottom-1.5 left-2 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-[inset_0_1px_1px_#fff]"></div><div class="absolute bottom-1.5 right-6 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-[inset_0_1px_1px_#fff]"></div><div class="absolute bottom-1.5 left-16 right-16 h-1 bg-amber-500/80 rounded-full shadow-[0_0_8px_#f59e0b]" style="animation: bf-emberFlicker 2s infinite ease-in-out;"></div></div></div>',
    berry:
      '<div class="barrage-art-root"><div class="absolute -top-5 -right-3 pointer-events-none z-20" style="animation: bf-floatGentle 3s infinite ease-in-out;"><svg fill="none" height="44" viewbox="0 0 44 44" width="44"><rect fill="#d97706" height="34" rx="2" stroke="#92400e" stroke-width="1.2" transform="rotate(35 6 2)" width="6" x="6" y="2"></rect><path d="M22,14 C17,14 14,20 16,28 C18,35 24,38 25,38 C26,38 32,35 34,28 C36,20 33,14 28,14 Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.5"></path><circle cx="21" cy="22" fill="#fef08a" r="1"></circle><circle cx="26" cy="25" fill="#fef08a" r="1"></circle><circle cx="28" cy="20" fill="#fef08a" r="1"></circle><circle cx="24" cy="30" fill="#fef08a" r="1"></circle><path d="M20,15 C18,10 14,12 14,12 C16,14 19,16 21,17 Z" fill="#22c55e"></path><path d="M25,14 C25,8 29,10 29,10 C27,13 26,15 25,17 Z" fill="#16a34a"></path><path d="M30,15 C33,12 36,13 36,13 C33,15 31,16 29,17 Z" fill="#22c55e"></path></svg><div class="absolute -top-1 right-2 text-amber-300 text-xs" style="animation: bf-sparkleGlow 2s infinite ease-in-out;">✦</div></div><div class="absolute inset-0 bg-[#fff5f6] border-4 border-[#fed7aa] rounded-2xl overflow-hidden shadow-[0_6px_16px_rgba(244,63,94,0.15)]"><div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-200 via-rose-100 to-amber-100 opacity-80"></div><div class="absolute -bottom-2 -left-2 text-2xl opacity-15 select-none">🍓</div></div></div>',
    cat: '<div class="barrage-art-root"><div class="absolute -top-3.5 left-10 pointer-events-none z-20" style="animation: bf-earTwitch 3.5s infinite ease-in-out; transform-origin: bottom center;"><svg fill="none" height="18" viewbox="0 0 24 18" width="24"><polygon fill="#fed7aa" points="0,18 12,0 24,18" stroke="#fb923c" stroke-width="2"></polygon><polygon fill="#fda4af" points="4,18 12,5 20,18"></polygon></svg></div><div class="absolute -top-3.5 left-24 pointer-events-none z-20"><svg fill="none" height="18" viewbox="0 0 24 18" width="24"><polygon fill="#fed7aa" points="0,18 12,0 24,18" stroke="#fb923c" stroke-width="2"></polygon><polygon fill="#fda4af" points="4,18 12,5 20,18"></polygon></svg></div><div class="absolute -bottom-3 -right-2 pointer-events-none z-30" style="animation: bf-pawPat 3s infinite ease-in-out;"><svg fill="none" height="42" viewbox="0 0 48 42" width="48"><path d="M10,18 C10,10 38,10 38,18 C38,32 34,40 24,40 C14,40 10,32 10,18 Z" fill="#ffffff" stroke="#fed7aa" stroke-width="2"></path><ellipse cx="24" cy="26" fill="#fb7185" rx="8" ry="6"></ellipse><circle cx="16" cy="16" fill="#fb7185" r="3"></circle><circle cx="24" cy="14" fill="#fb7185" r="3.2"></circle><circle cx="32" cy="16" fill="#fb7185" r="3"></circle></svg></div><div class="absolute inset-0 bg-[#fff7ed] border-2 border-[#fdba74] rounded-2xl overflow-hidden shadow-[0_6px_14px_rgba(251,146,60,0.2)]"><div class="absolute top-2 right-16 flex gap-1 opacity-20"><span class="w-4 h-0.5 bg-orange-400 rotate-6"></span><span class="w-4 h-0.5 bg-orange-400 -rotate-6"></span></div></div></div>',
    cloud:
      '<div class="barrage-art-root" style="animation: bf-jellyFloat 4s infinite ease-in-out;"><div class="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none z-20" style="animation: bf-rainbowShift 4s infinite ease-in-out;"><svg fill="none" height="34" viewbox="0 0 100 34" width="100"><path d="M10,34 A40,40 0 0,1 90,34" stroke="#f472b6" stroke-linecap="round" stroke-width="4"></path><path d="M16,34 A34,34 0 0,1 84,34" stroke="#facc15" stroke-linecap="round" stroke-width="4"></path><path d="M22,34 A28,28 0 0,1 78,34" stroke="#38bdf8" stroke-linecap="round" stroke-width="4"></path><path d="M28,34 A22,22 0 0,1 72,34" stroke="#a78bfa" stroke-linecap="round" stroke-width="4"></path></svg></div><div class="absolute -top-3 left-8 text-yellow-300 text-sm">★</div><div class="absolute -top-2 right-10 text-pink-300 text-xs">✦</div><div class="absolute inset-0 bg-gradient-to-r from-sky-50 via-white to-pink-50 border-2 border-sky-200 rounded-3xl overflow-hidden shadow-[0_8px_20px_rgba(186,230,253,0.35)]"><div class="absolute -bottom-6 -left-6 w-24 h-24 bg-pink-200/40 rounded-full blur-lg"></div><div class="absolute -top-6 -right-6 w-24 h-24 bg-sky-200/40 rounded-full blur-lg"></div></div></div>',
    jelly:
      '<div class="barrage-art-root"><div class="absolute -bottom-7 right-6 pointer-events-none z-20" style="animation: bf-jellyfishDrift 3.6s infinite ease-in-out;"><svg fill="none" height="50" viewbox="0 0 42 50" width="42"><path d="M6,22 C6,8 36,8 36,22 C36,25 30,25 26,24 C22,23 20,25 16,24 C12,23 6,25 6,22 Z" fill="url(#BF_INSTANCE-jellyGrad)" stroke="#38bdf8" stroke-width="1.2"></path><path d="M12,24 Q10,36 14,46" stroke="#a5f3fc" stroke-linecap="round" stroke-width="1.2"></path><path d="M18,25 Q22,34 18,48" stroke="#38bdf8" stroke-linecap="round" stroke-width="1.5"></path><path d="M24,25 Q20,35 24,48" stroke="#67e8f9" stroke-linecap="round" stroke-width="1.5"></path><path d="M30,24 Q32,36 28,45" stroke="#a5f3fc" stroke-linecap="round" stroke-width="1.2"></path><defs><lineargradient id="BF_INSTANCE-jellyGrad" x1="6" x2="36" y1="8" y2="25"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"></stop><stop offset="100%" stop-color="#818cf8" stop-opacity="0.5"></stop></lineargradient></defs></svg></div><div class="absolute -top-3 right-20 w-2 h-2 rounded-full border border-cyan-300 pointer-events-none" style="animation: bf-bubbleRise 2.5s infinite ease-in;"></div><div class="absolute -bottom-2 left-20 w-3 h-3 rounded-full border border-sky-300 pointer-events-none" style="animation: bf-bubbleRise 3.2s infinite ease-in; animation-delay: 1s;"></div><div class="absolute inset-0 bg-[#0c1f38]/80 backdrop-blur-md border border-cyan-400/40 rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(6,182,212,0.25)]"><div class="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-cyan-500/20 to-transparent"></div></div></div>',
    shiba:
      '<div class="barrage-art-root"><div class="absolute -top-7 left-12 pointer-events-none z-20"><svg fill="none" height="36" viewbox="0 0 56 36" width="56"><polygon fill="#d97706" points="6,24 12,4 20,24" stroke="#78350f" stroke-width="1.5"></polygon><polygon fill="#d97706" points="36,24 44,4 50,24" stroke="#78350f" stroke-width="1.5"></polygon><polygon fill="#fed7aa" points="9,22 13,8 18,22"></polygon><polygon fill="#fed7aa" points="38,22 43,8 47,22"></polygon><ellipse cx="28" cy="25" fill="#d97706" rx="20" ry="14" stroke="#78350f" stroke-width="1.5"></ellipse><path d="M16,25 C16,22 24,20 28,24 C32,20 40,22 40,25 C40,32 34,35 28,35 C22,35 16,32 16,25 Z" fill="#fffbeb"></path><ellipse cx="28" cy="27" fill="#1c1917" rx="2.5" ry="1.8"></ellipse><path d="M26,29 Q28,31 30,29" fill="none" stroke="#1c1917" stroke-width="1.2"></path><circle cx="21" cy="23" fill="#1c1917" r="2" style="animation: bf-shibaBlink 3s infinite; transform-origin: 21px 23px;"></circle><circle cx="35" cy="23" fill="#1c1917" r="2" style="animation: bf-shibaBlink 3s infinite; transform-origin: 35px 23px;"></circle><circle cx="21" cy="18" fill="#fffbeb" r="1.5"></circle><circle cx="35" cy="18" fill="#fffbeb" r="1.5"></circle></svg></div><div class="absolute -top-2 -right-3 pointer-events-none z-20" style="animation: bf-tailWag 2.6s infinite ease-in-out; transform-origin: bottom left;"><svg fill="none" height="28" viewbox="0 0 28 28" width="28"><path d="M4,24 C4,16 14,8 22,8 C26,8 26,16 18,18 C12,19 8,24 4,24 Z" fill="#d97706" stroke="#78350f" stroke-width="1.5"></path><path d="M18,9 C23,9 25,12 21,15" fill="#fffbeb"></path></svg></div><div class="absolute inset-0 bg-[#fef3c7] border-4 border-[#b45309] rounded-2xl overflow-hidden shadow-[0_6px_16px_rgba(180,83,9,0.25)]"><div class="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-[#d97706]/40 to-transparent"></div><div class="absolute inset-2 border border-dashed border-[#b45309]/30 rounded-xl pointer-events-none"></div></div></div>',
    forest:
      '<div class="barrage-art-root"><div class="absolute -top-5 -left-4 pointer-events-none z-20"><svg fill="none" height="42" viewbox="0 0 50 42" width="50"><path d="M6,36 C6,16 26,4 46,6 C44,26 26,40 6,36 Z" fill="#4d7c0f" stroke="#1a2e05" stroke-width="1.5"></path><path d="M12,32 Q28,20 42,8" fill="none" stroke="#a3e635" stroke-width="1.2"></path><path d="M2,18 C10,12 24,14 26,24 C16,28 6,24 2,18 Z" fill="#65a30d"></path></svg></div><div class="absolute -top-3 right-8 w-2 h-2 rounded-full bg-lime-300 shadow-[0_0_8px_#bef264] pointer-events-none" style="animation: bf-fireflyGlow 3s infinite ease-in-out;"></div><div class="absolute -bottom-2 right-20 w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_#6ee7b7] pointer-events-none" style="animation: bf-fireflyGlow 3.8s infinite ease-in-out; animation-delay: 1.5s;"></div><div class="absolute inset-0 bg-[#142314] border-2 border-lime-700/70 rounded-xl overflow-hidden shadow-[inset_0_0_12px_rgba(101,163,13,0.3)]"><svg class="absolute inset-0 w-full h-full opacity-40 pointer-events-none" xmlns="http://www.w3.org/2000/svg"><path d="M0,60 Q60,50 140,64 T300,58" fill="none" stroke="#84cc16" stroke-width="1.5"></path><path d="M0,8 Q80,18 200,6 T300,10" fill="none" stroke="#4d7c0f" stroke-width="1.5"></path></svg></div></div>',
    dragon:
      '<div class="barrage-art-root"><div class="absolute -top-6 -left-5 pointer-events-none z-20" style="animation: bf-dragonWingBreath 3s infinite ease-in-out; transform-origin: bottom right;"><svg fill="none" height="46" viewbox="0 0 56 46" width="56"><path d="M48,42 C30,30 18,18 2,4 C14,14 26,16 38,20 C32,10 40,2 40,2 C44,14 48,26 48,42 Z" fill="#7f1d1d" stroke="#b91c1c" stroke-width="1.5"></path><path d="M38,20 C42,28 46,36 48,42" stroke="#f59e0b" stroke-width="1.2"></path><polygon fill="#ef4444" points="46,34 50,30 54,34 50,38" stroke="#fbbf24" stroke-width="1"></polygon></svg></div><div class="absolute bottom-1 right-12 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] pointer-events-none" style="animation: bf-emberRise 2s infinite linear;"></div><div class="absolute bottom-4 right-20 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444] pointer-events-none" style="animation: bf-emberRise 2.5s infinite linear; animation-delay: 1.1s;"></div><div class="absolute inset-0 bg-[#160c0c] border-2 border-amber-600/70 rounded-lg overflow-hidden shadow-[inset_0_0_15px_rgba(239,68,68,0.4)]"><div class="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-amber-400 pointer-events-none"></div></div></div>',
    frost:
      '<div class="barrage-art-root"><div class="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none z-20"><svg fill="none" height="28" viewbox="0 0 68 28" width="68"><polygon fill="#e0f2fe" fill-opacity="0.9" points="34,0 42,16 52,4 58,26 10,26 16,4 26,16" stroke="#38bdf8" stroke-width="1.5"></polygon><polygon fill="#bae6fd" fill-opacity="0.6" points="34,6 38,18 46,10 52,24 16,24 22,10 30,18"></polygon><circle cx="34" cy="5" fill="#fff" r="2"></circle></svg></div><div class="absolute -top-2 left-6 text-cyan-200 text-xs" style="animation: bf-frostTwinkle 3s infinite ease-in-out;">❄</div><div class="absolute -bottom-2 right-12 text-cyan-100 text-sm" style="animation: bf-frostTwinkle 4.2s infinite ease-in-out; animation-delay: 1.5s;">✦</div><div class="absolute inset-0 bg-[#0d2238]/75 backdrop-blur-md border-2 border-cyan-200/60 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(186,230,253,0.3)]"><div class="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-white/30 to-transparent pointer-events-none"></div><div class="absolute bottom-0 left-0 w-8 h-8 bg-gradient-to-tr from-white/30 to-transparent pointer-events-none"></div></div></div>',
    moon: '<div class="barrage-art-root"><div class="absolute -top-5 -right-4 pointer-events-none z-20" style="animation: bf-moonSway 5s infinite ease-in-out; transform-origin: top center;"><svg fill="none" height="60" viewbox="0 0 44 60" width="44"><path d="M26,2 C12,8 6,24 14,36 C18,34 22,34 26,36 C18,24 22,12 36,8 C33,4 30,2 26,2 Z" fill="#fde047" filter="drop-shadow(0 0 6px rgba(250,204,21,0.6))" stroke="#eab308" stroke-width="1.2"></path><line stroke="#c084fc" stroke-dasharray="2 2" stroke-width="1.2" x1="20" x2="20" y1="36" y2="52"></line><polygon fill="#a855f7" points="20,52 23,56 20,60 17,56" stroke="#e9d5ff" stroke-width="1"></polygon></svg></div><div class="absolute -top-3.5 left-6 w-7 h-7 pointer-events-none z-20"><svg class="w-full h-full text-purple-300" style="animation: bf-runeRotate 6s infinite linear;" viewbox="0 0 24 24"><circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" stroke-dasharray="3 2" stroke-width="1.2"></circle><polygon fill="none" points="12,4 19,16 5,16" stroke="currentColor" stroke-width="1"></polygon></svg></div><div class="absolute inset-0 bg-[#1e102d] border-2 border-purple-500/60 rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(168,85,247,0.3)]"><div class="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent"></div></div></div>',
    potion:
      '<div class="barrage-art-root"><div class="absolute -bottom-4 -left-4 pointer-events-none z-20"><svg fill="none" height="38" viewbox="0 0 42 38" width="42"><ellipse cx="20" cy="18" fill="#292524" rx="16" ry="12" stroke="#1c1917" stroke-width="2"></ellipse><ellipse cx="20" cy="12" fill="#22c55e" rx="12" ry="5"></ellipse><line stroke="#1c1917" stroke-linecap="round" stroke-width="3" x1="10" x2="6" y1="28" y2="36"></line><line stroke="#1c1917" stroke-linecap="round" stroke-width="3" x1="30" x2="34" y1="28" y2="36"></line></svg><div class="absolute top-0 left-4 w-2 h-2 rounded-full bg-lime-300 opacity-80" style="animation: bf-potionBubble 1.8s infinite ease-out;"></div><div class="absolute top-1 left-6 w-2.5 h-2.5 rounded-full bg-emerald-300 opacity-70" style="animation: bf-potionBubble 2.4s infinite ease-out; animation-delay: 0.8s;"></div></div><div class="absolute -top-5 -right-3 pointer-events-none z-20"><svg fill="none" height="36" viewbox="0 0 40 36" width="40"><path d="M14,18 C14,8 36,8 36,18 Z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"></path><circle cx="20" cy="13" fill="#fff" r="2"></circle><circle cx="28" cy="11" fill="#fff" r="2.5"></circle><circle cx="32" cy="15" fill="#fff" r="1.5"></circle><rect fill="#fef08a" height="12" rx="2" width="6" x="22" y="18"></rect><path d="M4,22 C4,14 16,14 16,22 Z" fill="#a855f7" stroke="#581c87" stroke-width="1.2"></path><rect fill="#fef08a" height="8" rx="1" width="4" x="8" y="22"></rect></svg></div><div class="absolute inset-0 bg-[#271c19] border-2 border-[#78350f] rounded-xl overflow-hidden shadow-[inset_0_2px_4px_rgba(254,240,138,0.1),0_6px_14px_rgba(0,0,0,0.6)]"><div class="absolute top-3 inset-x-0 h-0.5 bg-[#451a03] opacity-60"></div><div class="absolute bottom-3 inset-x-0 h-0.5 bg-[#451a03] opacity-60"></div></div></div>',
    ink: '<div class="barrage-art-root"><div class="absolute -top-4 -right-4 pointer-events-none z-20" style="animation: bf-koiSwim 4s infinite ease-in-out;"><svg fill="none" height="48" viewbox="0 0 52 48" width="52"><path d="M42,12 C44,24 30,34 16,36 C18,30 24,24 28,18 C32,12 38,8 42,12 Z" fill="#18181b" stroke="#3f3f46" stroke-width="1.2"></path><path d="M16,36 C10,40 4,46 2,42 C8,38 12,34 16,36 Z" fill="#ef4444" opacity="0.85"></path><path d="M16,36 C8,34 4,30 6,26 C10,30 14,34 16,36 Z" fill="#27272a"></path><circle cx="36" cy="14" fill="#dc2626" r="2.5"></circle></svg></div><div class="absolute -top-3 left-8 pointer-events-none z-20"><div class="w-6 h-6 border-2 border-red-600 bg-red-700/80 text-white flex items-center justify-center font-serif text-[11px] font-bold rounded-sm shadow-md">\n                  印\n                </div></div><div class="absolute inset-0 bg-[#f4ede2] border-2 border-stone-800 rounded-lg overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.5)]"><div class="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-stone-900/20 to-transparent"></div></div></div>',
    sakura:
      '<div class="barrage-art-root"><div class="absolute -bottom-6 left-6 pointer-events-none z-20" style="animation: bf-tasselSway 3.6s infinite ease-in-out; transform-origin: top center;"><svg fill="none" height="34" viewbox="0 0 24 34" width="24"><circle cx="12" cy="6" fill="#dc2626" r="4" stroke="#991b1b" stroke-width="1.5"></circle><path d="M8,12 L6,30 M12,12 L12,32 M16,12 L18,30" stroke="#dc2626" stroke-linecap="round" stroke-width="2.5"></path></svg></div><div class="absolute -top-3 right-12 w-3 h-2 rounded-full bg-pink-300 pointer-events-none" style="animation: bf-petalDrift 3s infinite linear;"></div><div class="absolute -top-2 right-24 w-2.5 h-1.5 rounded-full bg-rose-200 pointer-events-none" style="animation: bf-petalDrift 4s infinite linear; animation-delay: 1.5s;"></div><div class="absolute inset-0 bg-[#b91c1c] border-2 border-[#fef08a] rounded-xl overflow-hidden shadow-[0_6px_16px_rgba(185,28,28,0.35)]"><div class="absolute inset-0 bg-[radial-gradient(#fde047_1px,transparent_1px)] [background-size:12px_12px] opacity-25"></div></div></div>',
    steam:
      '<div class="barrage-art-root"><div class="absolute -top-5 -right-3 pointer-events-none z-20"><svg class="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" fill="none" height="42" viewbox="0 0 42 42" width="42"><circle cx="21" cy="21" fill="#d97706" r="18" stroke="#78350f" stroke-width="2"></circle><circle cx="21" cy="21" fill="#fef3c7" r="14" stroke="#b45309" stroke-width="1"></circle><line stroke="#78350f" stroke-width="1.5" x1="21" x2="21" y1="9" y2="12"></line><line stroke="#78350f" stroke-width="1.5" x1="21" x2="21" y1="30" y2="33"></line><line stroke="#78350f" stroke-width="1.5" x1="9" x2="12" y1="21" y2="21"></line><line stroke="#78350f" stroke-width="1.5" x1="30" x2="33" y1="21" y2="21"></line><polygon fill="#dc2626" points="21,11 24,21 21,31 18,21" style="animation: bf-compassNeedle 3.5s infinite ease-in-out; transform-origin: 21px 21px;"></polygon><circle cx="21" cy="21" fill="#78350f" r="2"></circle></svg></div><div class="absolute -bottom-3 -left-3 pointer-events-none z-20"><svg class="w-8 h-8 text-amber-600" style="animation: bf-cogRotate 4.5s infinite linear;" viewbox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="currentColor"></path><path d="M10.5 2h3l.5 2.5 2 1 2.5-1 2 2-1 2.5 1 2 2.5.5v3l-2.5.5-1 2 1 2.5-2 2-2.5-1-2 1-.5 2.5h-3l-.5-2.5-2-1-2.5 1-2-2 1-2.5-1-2L2 13.5v-3l2.5-.5 1-2-1-2.5 2-2 2.5 1 2-1L10.5 2z" fill="currentColor"></path></svg></div><div class="absolute inset-0 bg-[#e7d7be] border-2 border-[#92400e] rounded-xl overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.5)]"><div class="absolute top-0 inset-x-0 h-1.5 bg-[repeating-linear-gradient(45deg,#b91c1c,#b91c1c_8px,#1d4ed8_8px,#1d4ed8_16px)]"></div></div></div>',
    burst:
      '<div class="barrage-art-root" style="animation: bf-comicShake 2s infinite ease-in-out;"><div class="absolute -top-6 -right-5 pointer-events-none z-20" style="animation: bf-boltFlash 1s infinite alternate;"><svg fill="none" height="46" viewbox="0 0 46 46" width="46"><polygon fill="#facc15" points="26,2 8,24 22,24 16,44 38,18 24,18" stroke="#000" stroke-linejoin="miter" stroke-width="2.5"></polygon></svg></div><div class="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-black rounded-lg"></div><div class="absolute inset-0 bg-[#fff] border-4 border-black rounded-lg overflow-hidden" style="clip-path: polygon(0% 10%, 8% 0%, 92% 2%, 100% 12%, 98% 88%, 90% 100%, 10% 98%, 0% 86%);"><div class="absolute inset-0 bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:6px_6px] opacity-20 pointer-events-none"></div><div class="absolute -bottom-1 left-24 w-8 h-4 bg-black" style="clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div></div></div>',
    royal:
      '<div class="barrage-art-root"><div class="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none z-20"><svg fill="none" height="26" viewbox="0 0 74 26" width="74"><path d="M25,24 L21,8 L31,16 L37,4 L43,16 L53,8 L49,24 Z" fill="url(#BF_INSTANCE-goldGrad)" stroke="#78350f" stroke-width="1.2"></path><circle cx="37" cy="4" fill="#ef4444" r="2"></circle><path d="M12,20 C16,14 20,20 24,24" fill="none" stroke="#fbbf24" stroke-width="1.5"></path><path d="M62,20 C58,14 54,20 50,24" fill="none" stroke="#fbbf24" stroke-width="1.5"></path><defs><lineargradient id="BF_INSTANCE-goldGrad" x1="21" x2="53" y1="4" y2="24"><stop offset="0%" stop-color="#fef08a"></stop><stop offset="50%" stop-color="#f59e0b"></stop><stop offset="100%" stop-color="#b45309"></stop></lineargradient></defs></svg></div><div class="absolute inset-0 bg-[#4a0414] border-2 border-amber-400 rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.7)]"><div class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#28020a] via-[#5c061a] to-transparent"></div><div class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#28020a] via-[#5c061a] to-transparent"></div><div class="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent pointer-events-none" style="animation: bf-royalShimmer 4.5s infinite linear;"></div></div></div>',
  });
  let artSerial = 0;
  const ids = new Set(options.map((item) => item.id)),
    listeners = new Set();
  function normalize(value) {
    return {
      version: VERSION,
      enabled: typeof value?.enabled === 'boolean' ? value.enabled : true,
      selected: ids.has(value?.selected) ? value.selected : 'default',
    };
  }
  function read() {
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY) || 'null'));
    } catch {
      return normalize(null);
    }
  }
  let prefs = read(),
    dialog = null,
    choices = [],
    entitlements = new Set(),
    mediaEntitlements = new Set(),
    entitlementsLoaded = false;
  function canUse(id, kind = 'barrage') {
    return (
      !options.find((o) => o.id === id)?.achievementId ||
      (kind === 'media' ? mediaEntitlements : entitlements).has(id)
    );
  }
  async function refreshRewards() {
    try {
      const response = await fetch('/api/achievements');
      if (!response.ok) throw Error('load');
      const data = await response.json();
      acceptRewards(data);
      return data;
    } catch {
      return null;
    }
  }
  function acceptRewards(data) {
    entitlements = new Set((data?.rewards || []).filter((r) => r.claimedAt).map((r) => r.frameId));
    mediaEntitlements = new Set(
      (data?.rewards || [])
        .filter((r) => ('mediaClaimedAt' in r ? r.mediaClaimedAt : r.claimedAt))
        .map((r) => r.frameId),
    );
    entitlementsLoaded = true;
    notify();
  }

  function get() {
    return { ...prefs, selected: canUse(prefs.selected) ? prefs.selected : 'default' };
  }
  function notify() {
    document.body?.classList.toggle('barrage-frames-disabled', !prefs.enabled);
    for (const listener of listeners) listener(get());
  }
  function set(patch) {
    if (patch?.selected && !canUse(patch.selected)) return get();
    prefs = normalize({ ...prefs, ...patch });
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {}
    notify();
    return get();
  }
  function subscribe(listener) {
    listeners.add(listener);
    listener(get());
    return () => listeners.delete(listener);
  }
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      prefs = read();
      notify();
    }
  });
  function descriptorId(value) {
    return value?.kind === 'builtin' && value.version === 1 && ids.has(value.id)
      ? value.id
      : 'default';
  }
  function decorate(node, frame, name, message) {
    node.dataset.frameId = descriptorId(frame);
    node.classList.toggle('barrage-frame-ornate', Object.hasOwn(artwork, node.dataset.frameId));
    const backdrop = document.createElement('span'),
      decoration = document.createElement('span'),
      content = document.createElement('span'),
      sender = document.createElement('strong');
    backdrop.className = 'barrage-frame-backdrop';
    decoration.className = 'barrage-frame-decoration';
    content.className = 'barrage-frame-content';
    if (Object.hasOwn(artwork, node.dataset.frameId)) {
      const art = document.createElement('span');
      art.className = 'barrage-frame-art';
      // Only this local allowlisted template is HTML; player names/messages stay text nodes.
      art.innerHTML = artwork[node.dataset.frameId].replaceAll(
        'BF_INSTANCE-',
        `bf-${++artSerial}-`,
      );
      decoration.append(art);
    }
    backdrop.setAttribute('aria-hidden', 'true');
    decoration.setAttribute('aria-hidden', 'true');
    sender.textContent = name + '：';
    content.append(sender, document.createTextNode(message));
    node.append(backdrop, decoration, content);
    return node;
  }
  // Reserve the measured vertical interval once. No queue and no layout work per
  // animation frame; a larger bubble uses as much space as it actually needs.
  function findPlacement(layerHeight, bubbleHeight, occupied = []) {
    if (!Number.isFinite(layerHeight) || !Number.isFinite(bubbleHeight) || bubbleHeight <= 0)
      return null;
    const margin = 12,
      gap = 8,
      limit = layerHeight - margin - bubbleHeight;
    if (limit < margin) return null;
    const spans = occupied
      .filter(
        (span) => Number.isFinite(span.top) && Number.isFinite(span.height) && span.height > 0,
      )
      .sort((a, b) => a.top - b.top);
    let top = margin;
    for (const span of spans) {
      if (top + bubbleHeight + gap <= span.top) break;
      if (top < span.top + span.height + gap) top = span.top + span.height + gap;
    }
    return top <= limit ? top : null;
  }
  function place(layer, bubble) {
    bubble.style.visibility = 'hidden';
    layer.append(bubble);
    const occupied = [...layer.children]
      .filter((node) => node !== bubble)
      .map((node) => ({ top: parseFloat(node.style.top), height: node.offsetHeight }));
    const top = findPlacement(layer.clientHeight, bubble.offsetHeight, occupied);
    if (top === null) {
      bubble.remove();
      return false;
    }
    bubble.style.top = top + 'px';
    bubble.style.visibility = '';
    return true;
  }
  function createPicker() {
    dialog = document.createElement('dialog');
    dialog.id = 'barrage-frame-picker';
    dialog.className = 'barrage-frame-dialog';
    dialog.setAttribute('aria-labelledby', 'barrage-frame-title');
    const header = document.createElement('div'),
      title = document.createElement('h2'),
      close = document.createElement('button'),
      body = document.createElement('div'),
      grid = document.createElement('div');
    header.className = 'barrage-frame-header';
    title.id = 'barrage-frame-title';
    title.textContent = '選擇彈幕框';
    close.type = 'button';
    close.textContent = '關閉';
    GameUI?.decorateButton(close, 'close', { iconOnly: true, label: '關閉彈幕框選擇' });
    close.onclick = () => dialog.close();
    header.append(title, close);
    body.className = 'barrage-frame-body game-dialog-body';
    grid.className = 'barrage-frame-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '內建彈幕框');
    choices = mountChoices(grid);
    body.append(grid);
    dialog.append(header, body);
    document.body.append(dialog);
  }
  function mountChoices(grid, { search = null, filter = null, onSelect = null } = {}) {
    const buttons = [];
    for (const option of options) {
      const button = document.createElement('button'),
        label = document.createElement('span'),
        preview = document.createElement('span'),
        status = document.createElement('span');
      button.type = 'button';
      button.className = 'barrage-frame-choice';
      button.dataset.frameId = option.id;
      button.setAttribute('aria-label', option.label + '彈幕框');
      label.className = 'barrage-frame-label';
      label.textContent = option.label;
      status.className = 'barrage-frame-selection';
      preview.className = 'barrage-frame-preview';
      preview.setAttribute('aria-hidden', 'true');
      decorate(preview, { kind: 'builtin', id: option.id, version: 1 }, '小雨', '這一桌好好玩！');
      button.append(label, preview, status);
      button.onclick = () => {
        if (!canUse(option.id)) {
          location.href = '/achievements';
          return;
        }
        set({ selected: option.id });
        onSelect?.(option);
      };
      grid.append(button);
      buttons.push(button);
    }
    subscribe((value) => {
      for (const button of buttons) {
        const option = options.find((o) => o.id === button.dataset.frameId),
          locked = !canUse(option.id),
          selected = button.dataset.frameId === value.selected;
        button.classList.toggle('reward-locked', locked);
        button.setAttribute(
          'aria-label',
          option.label +
            '彈幕框' +
            (locked ? '，需達成「' + option.achievementTitle + '」並領取' : ''),
        );
        button.setAttribute('aria-pressed', String(selected));
        button.querySelector('.barrage-frame-selection').textContent = locked
          ? '成就獎勵 · ' + option.achievementTitle
          : selected
            ? '✓ 使用中'
            : '套用彈幕框';
      }
    });
    const applyFilter = () => {
      for (let i = 0; i < buttons.length; i++) {
        const option = options[i];
        buttons[i].hidden = !!(
          (search?.value && !option.label.includes(search.value.trim())) ||
          (filter?.value && filter.value !== 'all' && (option.group || '經典內建') !== filter.value)
        );
      }
      const empty = grid.nextElementSibling;
      if (empty?.classList.contains('barrage-frame-empty'))
        empty.hidden = buttons.some((button) => !button.hidden);
    };
    search?.addEventListener('input', applyFilter);
    filter?.addEventListener('change', applyFilter);
    applyFilter();
    return buttons;
  }
  function syncVisibility() {
    document.body?.classList.toggle('barrage-art-hidden', document.hidden);
  }
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  function openPicker(trigger) {
    if (!dialog) createPicker();
    if (GameUI) GameUI.openDialog(dialog, trigger);
    else dialog.showModal();
    choices.find((button) => button.dataset.frameId === prefs.selected)?.focus();
  }
  notify();
  BarrageFrames = {
    get,
    set,
    subscribe,
    options,
    descriptorId,
    decorate,
    findPlacement,
    place,
    openPicker,
    mountChoices,
    canUse,
    refreshRewards,
    acceptRewards,
  };
  refreshRewards();
})();

export default BarrageFrames;
