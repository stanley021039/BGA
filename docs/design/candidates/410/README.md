# Boss 招式 Stitch R2 來源（2026-11-15）

- 專案：[Boss VFX Combat Laboratory](https://stitch.google.com/projects/2224308089524822640)。
- 初稿畫板：`9e8a76ef5be94a2583b9148c3bae587d`；修訂畫板：`f9c0c67633164424a98fba37fe4f423b`。
- 原站已觀察「Downloaded screen」，ZIP 包含 code.html、screen.png、DESIGN.md，保存於本機 work/scene-bosses-410/stitch-r2；不把原型的 CDN、全域鍵盤事件或無限動畫載入正式網站。Figma 沿先前指示延後。
- ZIP SHA256：`db720973c65fd040930854161fdfc5bb61fc383a4dae4d710fbe313d8bb71b11`。
- code.html SHA256：`60263a5a1a815c1cafc615627098e1c1c463e822d3678fe603272ac5687356b4`。
- screen.png SHA256：`d4e6ee9d61efe46e97c555a4e1b124e2f0c5666363254a9b9b0739f37d1c3365`。

初稿偏儀表板，修訂後擴大戰鬥舞台、移除偽 GPU 數據與事件日誌；可用參考為觸鞭伸展回收、三顆星核拋射、三次環形爆破、明確發射部位及獨立長血條。原型角色過度簡化，十一隻仍共用 whip／gravity_orbs／void_donut 三種技能模板，部分名稱及中央安全區與既有玩法不符，因此不直接整頁移植，也不當成十一隻獨立招式設計皆完成。

正式接入保留既有十一張 Boss 圖、33個技能名稱、權威幾何／時間／傷害與原靜態地面預警。使用 boss-strike-art.js 在同一既有畫布做專屬觸手、鏈節、螯爪／重拳、星核、無人機、飛彈、異瞳、翼刃、光束、裂隙、蒸汽、碎石、螺旋及六寶石光束；實體圖的不同發射位置接現有 readCaster，擊中落點維持施放時固定座標。原型示範 HP／假傷害／震屏不加入正式資料；血條讀取伺服器現值。
