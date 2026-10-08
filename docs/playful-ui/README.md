# 2026-10-08 紙卡大廳改版（Draft，尚未部署）

## 正確專案與範圍

shhuang.cc 的 Linux Git 專案，基於正式部署 commit `8a9cbfd`（1.16.0），獨立工作樹 `/home/ccc/apps/afterhours/worktrees/playful-ui`，分支 `codex/playful-board-game-ui`。Windows BGA-main 舊三款遊戲版本不是修改目標。本地鏡像只作編輯及截圖保存，Linux Git 是正式修改來源。

使用者已接受前面的紙卡範本，要求保留原有大廳角色移動功能、六款遊戲及原本玩法。這輪只啟用大廳主題與輪播；其他頁面的視覺擴展仍待確認。沒有部署、重啟正式服務或讀寫正式資料。

## 修改檔案與原因

- `public/index.html`：六款原有遊戲入口改成大卡片輪播；原有 name/roomName/create 放入建立房間 dialog；code/join 常駐；完整保留可移動的大廳與公開房間列表。
- `public/shared/playful-theme.css`：米白、粉彩、深色外框、繁體中文字型、卡片與控制項樣式。所有規則以 `data-visual-theme="playful"` opt-in；這輪只有大廳啟用。內含其他頁面擴展用表面規則，尚未宣稱已驗收那些頁面。
- `public/shared/game-card-carousel.js`：拖曳、觸控、方向鍵/Home/End、首尾 disabled、reduced motion、dialog 及原有 GameUI 控制圖示。選中房間遊戲仍呼叫原 hub 點擊 handler，股市冥燈仍直接導向 `/market`。
- `public/shared/ui-components.js`：共用 previous 圖示；其他控制使用原 registry。
- `public/assets/playful/game-{thunder,poker,majority,gift,draw,market}.svg`：原創本地向量插畫，前三張沿用使用者接受範本；未使用 Concept Capers 品牌／插畫／程式碼。
- `src/app.js`：僅新增兩個静態資源與六個已檢視 SVG 白名單；SVG 保持 restrictive CSP。沒有變動 API handlers。
- `tests/playful-assets.test.js`：HTTP MIME、正確內容、SVG CSP、未知資源拒絕與無主動 SVG 內容驗證。
- package/version/CHANGELOG：相容新功能 minor 至 1.17.0，尚未發行或打 tag。

## 已驗證

- **Verified**：Linux 隔離預覽伺服器、全新暫存 SQLite/history/community/music，`externalSideEffectsEnabled:false`；沒有使用正式 cookie 或資料庫。
- **Verified**：1440×900、768×1024、390×844，六張卡片與原有 lobby 都存在，無 document 水平溢出及 pageerror。改版前後證據：`before/`、`after/`。
- **Verified**：滑鼠拖曳、Chromium CDP 觸控滑动、方向鍵/Home/End、有限首尾、market 導航不建立房間。
- **Verified**：五款房間遊戲皆透過實際 UI 呼叫原 `/api/create`，正確 type、session 及等待房路徑；原公開房間列表顯示測試建立房間。
- **Verified**：dialog Escape 回到觸發鈕，手機 dialog 無 document 溢出，reduced motion 的卡片 transitionDuration=0s。
- **Verified**：兩個独立測試帳號，原 lobby move/emote endpoint、另一帳號讀取移動狀態及看見同步表情。
- **Verified**：Git diff 確認 hub.js、lobby.js、src/games、src/rooms、src/auth、src/db 均未變動。
- **Verified**：release:check `--base 8a9cbfd --type minor` 通過，git diff --check 通過。
- **Unavailable**：真實 iOS/Safari、Android 硬體觸控；Chromium 模擬不等同真機。
- **Unavailable**：全站主題及遊戲中實玩視覺驗收，本輪未修改 renderer、SSE/多人傳輸或遊戲規則，不能把等待頁檢查稱為完整實玩驗收。

## 測試與未完成事項

原版完整測試：1,518 項，1,517 通過、1 失敗。失敗是 `market-images.test.js` 的 `backup validator rejects per-author/gallery/storage quotas before decoding rows`，SQLite `disk I/O error`；原版單獨重跑 23 項，22 通過、同項失敗。此問題在修改前即存在，未改動該測試或 market 儲存模組。

改版完整測試結果另見 `test-results.md`。保留 Draft，不以已知失敗宣稱全部通過，未建立發行 tag。下一階段：確認實際大廳視覺後擴展等待房、角色／成就／收藏、各遊戲工具列、dialog 及其他頁面，再做全站 responsive/accessibility/遊戲實玩檢查。
