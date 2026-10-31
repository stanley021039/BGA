# CEO 邀請異常 J4／J1 衍生本機 F1（2026-10-31）

本批接續 #291，僅設計候選與差異核對，未修改產品。參考固定 main `4127a035`／3.12.1，不冒稱目前最新 main；沿用 [J1](ceo-j1-review.md) 已匯出的 Stitch 邀請彈窗與 H1 等待室底稿，依真實 `RoomInvite`／invitations store 補五種異常。**沒有重新生成 Stitch 原稿**，本機修訂明確標為未核定，不能當成產品已實作或人工驗收。

## 狀態與實際行為

| 狀態 | 真實元件文案 | 控制狀態 |
| --- | --- | --- |
| empty | 目前沒有可邀請的線上朋友。 | 允許重新取得，沒有朋友列 |
| loading | 正在取得線上朋友… | 重新取得停用 |
| load-error | 線上朋友暫時無法載入。 | alert，允許重新取得 |
| sending | 正在送出邀請… | Dana 邀請 pending／停用，Emery 已邀請停用 |
| send-error | 邀請未成功，請重新整理。 | alert，Dana 可重試、Emery 仍停用 |

實際 `send()` 在 POST 結束後先重新取得候選，再寫入最終成功／失敗文案；合成參考依此等待，沒有把載入中的中間畫面當失敗完成。POST 僅限 loopback mock、房號 CE0291、targetId synthetic-dana；其他寫入全部拒絕，不會通知真人。30 組真實元件參考涵蓋 1920×1080／390×844／320×844、深淺色；確認文案、pending、disabled 與彈窗在視窗內，無橫向越界。不是正式網路或多人測試。

### 已確認產品差異

`RoomInvite` 的兩個 `StatusSlot` 未傳 persistent，`UiNotice` 預設 4000ms 後隱藏，error 也不例外。瀏覽器已確認載入失敗 alert 在等待後隱藏；20 秒輪詢模式用 fixture 的 roomStream=live 標記模擬，沒有建立真 socket。一般 5 秒輪詢會重新載入並重啟提示，第一次較晚讀回空名單仍可見，因此**不把那次讀回算成空名單持續顯示通過**。載入中前後讀值跨過八秒 mock 回應，後者已是名單，也不能當成載入提示計時驗證。依程式確認所有非 persistent 提示共用此計時路徑。

候選讓空名單、處理中及失敗資訊保留到狀態改變，提示槽固定 96px，朋友清單保留 256px；空名單僅保留透明槽位，沒有假朋友。真實彈窗桌機空／載入失敗高 272px、有朋友時 440px；候選固定外框、局部捲動，減少狀態切換位移。這些是待核定設計差異，沒有偷偷修產品。

## 候選驗證與失敗保留

30 組候選（五狀態×三尺寸×深淺）彈窗內文字至少 14px、可見按鈕至少 44px、無橫向溢出。提示槽均 96px；相同尺寸的重新取得按鈕 Y 一致：桌機約 731.6，390／320 約 599.6。30 組雙向 Tab 在彈窗內循環、Esc 關閉後回入口。第一次 Esc 後立刻讀 activeElement 有六組尚未收到原生 close 事件；保留初讀檔，改等待入口 :focus 後完整重跑 30 組通過，沒有把競態初讀隱藏。

第一版 512px 彈窗被舊 ID selector 的 max-width 覆蓋，手機右側裁切；已於 ID selector 修正 max-width，增加固定高度至 744px 並保留局部捲動，完整重跑才計入通過。候選重新取得／邀請按鈕只展示；切頁、關閉與鍵盤可操作，不宣稱有真實傳送、重新載入或 Figma prototype。

本機證據位於忽略目錄 `work/design-291/`：`ceo-j4-reference-checks.json`、`ceo-j4-error-timer.json`、`ceo-j4-loading-timer.json`、`ceo-j4f1-candidate-checks.json`、`ceo-j4f1-focus-first-read.json`、`ceo-j4f1-focus-checks.json`。建置 fixture 的初次 Python 預設 cp950 讀檔失敗，改明確 UTF-8 後執行；不算產品失敗。

## Figma 保存

[第三份 04 比較框 2448:8090](https://www.figma.com/design/swrZgTpIsRS4JSGBa4mQhq?node-id=2448-8090)，X316000／Y60000，19680×2180。20 張為五狀態×深淺×1920×1080／390×844；320 是布局驗證，未另重複匯入。Bridge 完整讀回 **20 FRAME、788 TEXT、零 Component／Instance**，SVG 無 image，不是整頁 bitmap。

實際 Figma PNG 發現單側 border-bottom 未被 SVG 匯出器保留，選取分頁缺黃色底線。依實際 DOM 幾何補 20 條可編輯 Rectangle，保留全部外框與文字；最終深色手機 PNG 已確認底線。修正前 PNG 保留，不冒稱第一次匯出即通過。字體基線、單側細邊與原生控制仍有近似，不宣稱像素完全一致。

獨立內建瀏覽器從雲端重開，逐張等待正確 selected-root、Width／Height，**20/20 外框尺寸通過**；另抽查第一張新底線 92×2.4 已在雲端保存，不把外框尺寸等同所有內文逐層檢查。證據：`figma-ceo-j4-ready-final-readback.json`、`figma-ceo-j4-tab-line-repair.json`、`figma-ceo-j4-cloud-twenty.json`、`figma-ceo-j4-cloud-line-sample.json`、`figma-ceo-j4-send-error-dark-mobile-final.png`。本輪沒有操作桌面 Figma；讀寫走 gethopp Bridge，瀏覽器用於本機驗證與雲端保存核對。

沒有 auto-layout、token 變數綁定、元件實例或 prototype；前端沒有 Code Connect 檔，Bridge 此工作流未提供元件庫搜尋／實例匯入，不把向量候選稱為共用元件化完成。

## 交付範圍與後續

本批只修改四份 Markdown，純文件不升版。格式與 affected 選取依交付記錄；沒有重跑前批產品全套，沒有 CI／合併／部署。#291 保持 in progress，沿用 Draft #294。

下一批核對換遊戲人數不符及進行中條件，之後整理兩款遊戲尚缺的公開階段與最終差異。邀請異常候選已補齊，仍待人工核稿，不能據此宣稱 #291 或 #283–#291 全部完成。
