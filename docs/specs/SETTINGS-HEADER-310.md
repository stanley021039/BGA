# 設定頁導覽列與大廳一致（#310）

2026-10-27：使用者要求處理 #310。範圍為共用導覽列的高度、邊距、背景、Logo／導覽／右側操作對齊，不改設定內容或新增大廳專屬功能。

## 原因及實作

兩頁已共用 SiteHeader C03，但設定頁的內容容器帶50px桌機邊距，大廳緊湊桌機模式為24px；設定頁還套用實底與底線，大廳是透明導覽列。修正前1920／1366量測：Logo與右側帳號相差26px；手機390／900幾何相同但背景及底線仍不同。另外實際hover量測確認設定頁受legacy `.club-page button:hover`影響，帳號按鈕向上移2px（y=6），大廳固定y=8；共用C03帳號按鈕明確保持transform:none，避免頁面規則移動共用導覽控制。

兩頁使用共用 `.vue-site-shell`，把大廳桌機導覽列24px邊距搬到共用頁首樣式，並共用現有透明頁首語意。設定頁導覽列與內容容器分離，原本設定內容的容器、寬度與操作保持不變。沿用既有Stitch C03稿與共用元件，不新增外觀設計；大廳的背景檢視只在大廳提供，不在設定頁放無作用的按鈕。

## 驗收

- 1920／1366／900／390／320，深淺色逐頁對照：頁首高度、左右邊距、背景／底線、品牌圖像、導覽、切換主題與帳號位置。
- 設定內容改前改後的尺寸／位置相同；設定分類、修改儲存、主題、帳號與導覽選單可操作；無水平溢出或頁面例外。
- 窄螢幕、短桌機及粗指標保留原本共用斷點；大廳場景對比與房間頁首不倒退。

## 驗證紀錄

候選3.11.1；基底main `36431201fa60ead6a8b5f80dcdee7d7980333284`；分支`codex/settings-header-310`。

- `npm run test:affected`因共用樣式／HTML等路徑保守回退246個後端測試檔，2094 pass，0 fail/cancel/skip（435253.130ms），`/tmp/bga-310-affected.log`。後續僅補共用帳號按鈕hover樣式，無後端變更。
- 前端全套232 pass，0 fail/cancel/skip（113964.251ms），`/tmp/bga-310-frontend.log`。最後hover修正以最終build的瀏覽器回歸複驗。
- 最終型別／Vite build、UI、正式build效能預算、相對main的patch release check通過：`/tmp/bga-310-build-final.log`、`/tmp/bga-310-ui-final.log`、`/tmp/bga-310-perf-final.log`、`/tmp/bga-310-release-final.log`。
- 持久化瀏覽器回歸：`node tools/qa/settings-header-310.cjs`。需既有Playwright與系統Chromium，預設`/usr/bin/chromium`，可用`BGA_CHROMIUM_PATH`指定其他安裝路徑；不新增產品依賴。使用臨時SQLite與合成帳號，結束時清理，不操作正式資料。
- 固定最終build，1920×1080、1366×1080、900×1080、390×844、320×844、1366×500短視窗、1366×844粗指標，共7情境×深淺色＝14組／28次頁面驗收，腳本退出0。每組明確比對兩頁header／content／Logo圖像／nav／主題與帳號的幾何及computed style；hover帳號同位置，無水平溢出或pageerror。14組結果在`work/issue-310/after.json`，`/tmp/bga-310-after-final.log`。
- 設定主內容幾何：在瀏覽器將頁首放回原本設定容器、量測再還原，14組before／after矩形完全相同。帳號／題庫選單與Esc關閉、設定分類切換通過；桌機與手機各一次真HTTP儲存暱稱並重載確認持久化。
- 修正前`work/issue-310/before.json`與before截圖保留；另一個hover查核直接量到原設定y=6／大廳y=8。初期比對曾被主題按鈕hover狀態影響，已在比較前將游標移開；批次對同帳號重複儲存超過限制出現429，改為只在桌機／手機各儲存一次，未放寬服務端限制，初期失敗不作通過證據。
- 桌機及手機深淺色截圖含完整設定頁與頁首crop，`work/issue-310/after-1920-light-settings.png`、`after-390-dark-settings.png`等。已實際檢視桌機淺色與手機深色的完整內容。
- format／format:check及diff check通過；交付前文件更新後再次執行。沒有改ui baseline、跳過hook或新增媒體資源。

限制：這是Chromium瀏覽器與粗指標模擬；未新增實體手機、Safari或特殊場景全矩陣驗收，特殊場景／房間只核對既有CSS分支保持原行為。

## 狀態

本機實作及代理驗收完成，待使用者驗收。尚未授權本次PR，未開PR、未觸發CI、未合併或部署。

