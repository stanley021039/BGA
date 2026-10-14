# 離房提醒縮圖 #120

2026-10-14：依使用者提供的 687059.jpg 製作 640×361 JPEG（25,559 bytes，移除 metadata），不裁切字幕。共用 RoomControls 及 GameShell 備援離房確認加入相同縮圖與中文替代文字；共用 ui-primitives 限定離房視窗內圖片最大 360px、隨容器縮放。app 僅新增固定資產白名單與 JPEG MIME，不新增 API／資料庫或改離房狀態機。候選版 2.4.0，尚未部署。

## 實作階段驗證

- Windows Node 22.22.3：`node --test tests/room-leave-thumbnail.test.js tests/unified-room-controls.test.js tests/game-shell-media.test.js`，13/13 通過。
- `npm run release:check -- --base origin/main --type minor` 通過；依相容可見功能擴充升 minor。
- `node tools/qa/room-leave-thumbnail.cjs`：Chromium 真 DOM／正式 CSS 與 controller、隔離合成房間及離房回應，common／fallback × 1440×900／390×844／844×390 × 日／夜共 12 組通過。檢查圖片載入／比例／替代文字、視窗及內容不橫向溢出、取消與焦點恢復、Escape、不送出取消、失敗及重試離房。原生完整截圖已人工檢視手機。第一次 QA 以精確 URL 忽略 `?game=draw` 而逾時，修正檢查 pathname 後 12 組通過；非產品故障。
- 靜態資產 HTTP 測試使用暫存資料庫，驗證 JPEG MIME／exact bytes／無登入可讀與未知圖片 404。來源圖是使用者提供的展示素材，不宣稱原創或第三方授權審核。
- 全套 `npm test` 與遠端 CI 最終數據、固定 SHA 的兩回合審查以本項 PR 留言為準。

## 範圍與限制

十一款入口原本共用 RoomControls，入口載入契約測試通過；瀏覽器是隔離離房視窗 fixture，非逐款完整遊戲實玩。沒有真手機、讀屏、正式環境或真人房驗收。僅修改離房 dialog 內 img，未改作畫、同步、renderer、倒數或專注全螢幕；本輪未重做持筆／ACK／逐點回放／換輪實玩，不以離房 fixture 代替作畫時序驗收。其他本機未提交郎中選藥工作不包含於本分支。
