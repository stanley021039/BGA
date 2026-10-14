# 郎中闖江湖：人物按鈕與爆鍋橫幅

2026-10-14；本機候選 2.4.0，同一批尚未發布的煉金術士版本。

使用內建 image_gen 工具，沒有使用 CLI／API key。角色飲酒圖與雙手食指打叉圖使用使用者附件作編輯目標，僅輕微 Q 化；喝啤酒字幕依最新指示為「還要爽爽」。爆鍋沿用使用者提供的第二張合成圖，檔案原樣保存，僅在網頁容器顯示左半哭哭表情。這些 PNG 是使用者提供及其改製圖；不是本站原創角色或可宣稱的開放授權素材。沒有改寫原附件。

|用途|專案保存路徑|
|---|---|
|繼續抽藥，字幕還要爽爽|public/assets/quacks/draw-portrait-v1.png|
|停止抽藥，雙手食指交叉|public/assets/quacks/stop-portrait-v1.png|
|爆鍋哭哭來源，網頁顯示左半|public/assets/quacks/explosion-reference-v1.png|

## 最終製圖提示詞

以會話內可見附件提供編輯參考；本機路徑方式首次失敗後，改用近期圖片參考成功，沒有變更服務或改走 CLI。

### draw

```text
Use the recent image of the drinking man as the edit target; ignore the split image. Use case: style-transfer. Edit target: the supplied anime screenshot of the black-haired adult man joyfully drinking from a silver beer can. Produce one finished landscape game-button illustration with the SAME character, facial expression, green clothing, hand holding the can, perspective, and composition. Make it ONLY very slightly more chibi, about 10 percent: subtly rounder face and softened clean anime outlines, otherwise retain the original look and normal hand anatomy. Do NOT replace the subject with an unrelated mascot or overly baby-like chibi. Replace the original bottom Chinese subtitle entirely with exact Traditional Chinese text "還要爽爽" in bold white with dark outline, at the bottom center, readable at small sizes. No other text. Keep the entire can and drinking gesture recognizable. No watermark. Opaque original-like background. One standalone image, not a collage.
```

### stop

```text
Use the recent split image as the edit target. Use case: style-transfer. Edit target: ONLY the right half of the supplied split anime screenshot, the pale green-haired girl with golden eyes crossing the index fingers of her two hands in front of her chest. The crying male on the left must be entirely removed from this output. Produce one standalone landscape game-button illustration of that SAME girl, beige/black clothes, gentle serious expression and EXACT two-index-fingers-crossed X gesture, with both hands anatomically plausible and visible. Make it ONLY very slightly more chibi, about 10 percent: gently rounded face and softened clean anime outlines, preserve original hairstyle, identity and expression, do not turn into unrelated cartoon mascot. Upper body and hands fit completely in a landscape frame, with hands taking enough space to be legible in a small button. No subtitle, no other text, no watermark. Opaque original-like dark background. One image, not a collage.
```

## 行為與驗證

- 原有抽／停請求、同步抽藥屏障、私有資訊與藥水瓶回袋規則保持不變。按鈕保留中文可讀名稱、忙碌禁用與滑過／聚焦提示；喝啤酒字幕在小按鈕額外以同文字幕層確保清楚。
- 新橫幅使用所有人可見的服務端 explosionId；不受正在查看哪個大釜影響。初載／重連／背景不補播、重複版本不重播。接近同時爆炸會列出玩家名字；新的哭哭橫幅清除當時抽卡／骰子的視覺殘留，避免多層動畫遮住。
- 約2.8秒側邊登場／退場，無快速閃光，不移動遊戲狀態或強制搶焦點；可關閉。關閉動畫或減少動態時仍以靜態圖通知爆鍋，音效與動畫偏好獨立。爆炸聲沿用本站原創 WAV 與共用音量／靜音、播放數量與去重限制。
- 受影響 Node 測試88/88，fail/cancel/skip/todo0，23503.9596ms；包含引擎、九輪真人HTTP、煉金術士、共用音效與HTTP資源。最後字幕字級及清除重疊動畫後，再執行真Edge双視窗驗收。
- tools/qa/quacks-explosion.cjs：隔離DB、兩名合成真人由API正常抽至真正爆鍋；兩端哭哭圖可見，各取得1次原生 Audio playing，25%音量；持續更新不重播，重新整理不補播。PNG固定路徑200／image/png／位元組一致；390px專注與減少動態的靜態圖、無橫向溢出、0頁面錯誤。手機縮減動態額外案例使用明示的合成呈現快照，不當作服務端真爆鍋。
- tools/qa/quacks-workshop.cjs 亦通過設定／病患／特效藥／原生抽停／藥水瓶回袋／下一輪／專注／390px驗收。證據與截圖在ignored work/qa/quacks-explosion及work/qa/quacks-workshop。
- 最後測試站3005確認只有等待房、沒有進行中遊戲，重啟載入新增固定PNG路徑，沿用同一SQLite與帳號；其他站未動。新的房號以ignored runtime為準，舊3E01C1已失效。
- 沒有原生喇叭主觀聽感、實機觸控、Safari或OS全螢幕的新增結論。沒有推送、發PR、標Ready、合併或部署。

最後複驗：18/18呈現／素材相關檢查，139.2721ms；3005 API版本2.4.0，3PNG＋controller／CSS／FX共6資源与工作區逐位元組一致。新等待室已建立，資料與帳號未重置。

### 2026-10-14 特效藥自動格數、分明圖示與抽藥／抽卡音效
特效藥結算自動推到本輪上限但須本人確認，可選低格，瓶身顯示公式及凍結加總；抽停照片縮小，分數星星／藥材杵臼／占卜卡牌分開，哭哭圖大、文字小、卡片字體更清楚。私有draw事件逐個排隊播原創音效，爆鍋提示優先且同批合併。完整2181及最後35／真Edge每端8抽藥＋1抽卡＋1爆炸原生playing通過。新3006隔離站保留3005牌局；詳[本輪規格與證據](QUACKS-ESSENCE-AUDIO-REFINEMENTS.md)。候選2.4.0本機未發布。
