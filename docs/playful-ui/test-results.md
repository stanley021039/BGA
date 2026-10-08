# 2026-10-08 驗證紀錄

Linux commit 基底 8a9cbfd，候選版本 1.17.0 Draft。完整測試修改前、後均在 Linux 執行。

| 檢查 | 結果 |
| --- | --- |
| 原版 npm test | 1,518 項，1,517 通過、1 失敗；229,959ms |
| 原版 market-images 單獨重跑 | 23 項，22 通過、同項失敗 |
| 改版 npm test | 1,519 項，1,518 通過、1 失敗；230,303ms |
| 新增 playful-assets.test.js | 通過，HTTP 資源內容/MIME/CSP/白名單範圍 |
| release:check --base 8a9cbfd --type minor | 通過 |
| git diff --check | 通過 |
| 三種 viewport，改版前後 | 通過，六張卡與原 lobby 保留、无水平溢出、無 pageerror |
| 瀏覽器原房間流程 | 五款房間遊戲 create/type/session/等待房導向通過；真實列表呈現已建立桌 |
| Carousel 操作 | 滑鼠／Chromium觸控拖曳、方向鍵/Home/End、首尾、market無create通過 |
| Dialog/mobile/reduced motion | Escape焦點返回、手機無水平溢出、transition=0s通過 |
| 兩帳號大廳同步 | 原移動請求、觀察帳號狀態、表情請求與可見同步通過 |

唯一失敗原版與改版均為：`market-images.test.js:188`，`backup validator rejects per-author/gallery/storage quotas before decoding rows`，`ERR_SQLITE_ERROR: disk I/O error`，stack 在 `:195:68`。沒有修改 market 儲存或該測試，也沒有把失敗略過。未宣稱完整 suite 通過。

截圖與 JSON：`before/desktop.png`、`before/tablet.png`、`before/mobile.png`，對應 `after/` 及 `create-mobile.png`、`interaction-results.json`、`touch-multiplayer-results.json`。畫面中的帳號／房間均來自隔離暫存資料，不是正式使用者資料。

未測：真實手機硬體、Safari、全站新主題、每款遊戲實際完整回合。本輪不修改棋盤／renderer／多人傳輸；等待房檢視不能替代完整遊戲實玩。
