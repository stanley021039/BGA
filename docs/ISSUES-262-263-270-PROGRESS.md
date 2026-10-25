# #262／#263／#270 本機候選紀錄

## 2026-10-25 PR #281 修訂：3.4.0

本節取代下方 3.2.0 與「#270 無須修改」的現況結論，舊紀錄只保留為歷史。已整合 main `4b53ad5`（3.3.0）；保留休憩區及房間管理者功能。傳情畫意管理者可分別儲存作畫／文字時間，題庫勾選改用現行共用 UiCheckbox 的陣列契約。

PR review 指出 #268 已併入 #270：先前八組透明驗證不足，不能關閉 #270。本輪實際修正頁首前景、混合背景細描邊、hover 與 focus，保持透明；規格及可重跑四十組腳本見[頁首對比](specs/HEADER-SCENE-CONTRAST-270.md)。舊 head `012bae0` 的兩輪審查與 CI 成功不沿用到本次修訂。

修訂候選仍待使用者重新驗收、同一 base／head 的兩輪審查及最終 Linux CI。未標 Ready、合併、部署或關閉 #270。

2026-10-25；目前候選 3.2.0，已整合 main `238f0a4`（3.1.0）。初版基於 `3ddf7c0`，完整驗證後再次 fetch 發現 main 前進 16 個提交，因此先以本機 `840781e` 保存改動，再由 `b19f4cc` 整合最新 main。保留 main 的歷史模組移除、媒體自動開窗、Document PiP 及背景表情修正；本文件記錄本機驗證，發布與最終 CI 狀態以關聯 PR 為準，未部署。

## 已確認與實作

- #262 使用者選擇首批只做傳情畫意。新增不占席位的登入觀戰入口與專用公開投影；傳遞中只讀玩家狀態、階段及倒數，完成後才顯示故事。沒有觀戰聊天或遊戲寫入。
- #263 使用者選擇作畫與猜題時間分開設定。房主可各選 60／90／120 秒，預設 90 秒；開局出題使用文字時間，換頁繼續依共同期限執行。舊房間存檔缺少新欄位時回退 90 秒。
- #270 導覽列與大廳背景融合已在 main 的 `scene-view.scss` 實作，來源為 PR #230。此次沒有重複修改 CSS。隔離 Edge 大廳深淺色實測頁首背景／邊框為透明、陰影 none，背景可連續顯示。未操作正式站或關閉 issue。

## 整合後驗證

- 以 main `238f0a4` 為基準，最終 `test:affected` 選取全部 225 檔，共 1850 項：1849 通過、0 失敗、1 項因本機缺 ffmpeg 而略過，耗時 280.17 秒。
- 相關引擎／HTTP／持久化／串流 55 項及前端全部 140 項通過；Vue 型別、正式建置、模組邊界、907 檔格式檢查、對照 origin/main 的 UI 檢查及 minor release 檢查通過。
- Edge 重新走完觀戰五階段的 1920 × 1080／390 × 844，房主手機設定及各階段亦補拍；觀戰重新整理不占席、題目保密、連續倒數、離開停止輪詢與受控 hidden／visible 暫停／恢復通過，pageerror 為零。#270 深淺色頁首背景仍為透明。
- 整合後證據：ignored `work/telephone-qa-1792913476144/`、`work/telephone-integrated-qa.log`、`work/telephone-integrated-affected.log`、`work/telephone-integrated-focused.log`、`work/telephone-integrated-frontend.log` 及 `work/telephone-integrated-build.log`。隔離 fixture 加速截止、實機觸控及正式站／最終 Linux CI 尚未驗證等限制保留。
- 發 PR 前的兩輪審查另補 #270：原本／法庭背景 × 1920／390 × 深／淺色共 8 組，頁首透明、題庫與帳號選單開啟及 Escape 關閉均通過；也重新執行五階段觀戰流程。證據為 ignored `work/telephone-qa-1792914046193/` 與 `work/telephone-pr-review-qa.log`。格式 write／check、正式 build 效能預算亦通過。

下列 1882／125 結果保留為整合前基線紀錄。

## 整合前驗證

- 傳情畫意及房間持久化／狀態串流回歸 55 項通過，含成功觀戰、未登入／已入座／錯誤 method 拒絕、私有資訊隔離、各階段期限與舊存檔回復。
- 前端測試 125 項通過，含觀戰快照及三席實際 Vue 場景回歸。
- Vue 型別、前端模組邊界、Vite 正式建置、格式、UI 與相對 origin/main 的 minor release 檢查通過。本機使用 Windows／bundled Node 24.22.1，尚未執行最終提交的 Linux Node 22 CI。
- 最終受影響測試因核心及共用路徑選取完整 228 檔，共 1883 項：1882 通過、0 失敗、1 項因本機未安裝 ffmpeg 而略過，耗時 320.37 秒。
- 一次完整驗證出現既有串流測試的排程競態：`setInterval` 巡查後使用 `setImmediate` 送出，固定等待 60ms 在繁忙時可能先結束。僅調整該測試為可控 interval／明確等待 check phase，保留巡查與通知斷言並加驗兩個席位；串流執行期程式未改。修正後串流 6 項針對性測試通過，完整驗證另記最終結果。
- Edge 實際檢查五階段：等待、出題、作畫、猜題、結束；桌機 1920 × 1080／手機 viewport 390 × 844，無水平溢出或 pageerror。倒數在兩次讀取之間由 118 減至 117 秒；重載觀戰仍不占席，離開停止讀取，受控 hidden／visible 停止並恢復輪詢。
- 房主透過實際等待室欄位將作畫改為 60 秒、文字改為 120 秒，兩個值完成儲存並出現在遊戲及觀戰畫面。

隔離驗收使用合成帳號、獨立 SQLite、一位操作席與兩位 AI；由 fixture 加速作畫及猜題截止。非真實時間全場、三名真人或實機觸控驗收。沒有新增 Safari、網路斷線／恢復與觀戰速率壓力測試結論。

本機證據位於 ignored `work/telephone-qa-1792890110574/`：五階段桌機與手機 PNG、房主手機設定及各階段 PNG、`report.json`；`work/telephone-final-tests.log`、`work/telephone-frontend-tests.log`、`work/telephone-affected-final.log`（含排程測試失敗）及 `work/telephone-affected-verified.log`（修正後重跑）為測試輸出。這些本機檔案不隨 PR 發布。

## 左右框層的來源核對

十一款房間遊戲都只掛載一組共用 `RoomSceneLayout`：十款透過 `GameRoomPage`，你畫我猜直接掛載；每組包含左玩家列表與右聊天室兩個 `RoomSidePanel`。截圖箭頭及兩側框條來自收合側欄，未在模板發現重複掛載。`room-space.scss` 的 `--room-panel-peek: 32px` 讓收合後的面板保留整條表面。

Edge 傳情畫意房主手機畫面實際重現左右 32px 框條覆蓋頁首與部分遊戲文字邊緣；新時間選單仍可操作，觀戰頁未掛載此元件，因此不受該遮擋影響。此為 main 既有共用布局問題，本批只記錄來源與範圍，沒有修改十一款的側欄設計；未逐款重跑十一款的完整遊戲階段，也不將房主手機布局記為完全正常。
