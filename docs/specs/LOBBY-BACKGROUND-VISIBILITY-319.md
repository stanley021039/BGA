# #319 大廳共用背景與個人顯示偏好

2026-11-05，使用者在核對最新 main 後明確要求接續 #319。沿用已有 in progress 的 Issue，不重開票。基底 `3f21bc48a60013e42e1211a407bb7ec37dc7cc03`，獨立 worktree／分支 `codex/lobby-background-319`；保留另一 worktree 的 #327 未提交修改。候選 3.18.0，未建立 PR、推送、合併或部署。

同日使用者要求與 #327 一起 PR，工作分支改名 `codex/lobby-preferences-319-327`，以相同 main 加入導覽入口修改；本批只升一次 3.18.0。下列原獨立驗證保留，最終整合與發布狀態依 [整合紀錄](../LOBBY-PREFERENCES-319-327-PROGRESS.md)。新 PR 仍須依長期規則完成本次具體發布確認。

## 契約與實作

- 共用背景仍由 `/api/lobby/background` 與伺服器快照控制；同一大廳玩家收到同一背景。既有解鎖、更換與 30 秒冷卻不變。
- 原「個人遊戲設定」的「大廳背景設定」新增共用 `UiCheckbox`「顯示大廳背景」，預設開啟。清楚標示僅影響此瀏覽器，不修改其他玩家的背景。
- `useLobbyBackgroundStore` 的 `visible` 與伺服器 `selected` 分開；本機切換不請求 API、不改共用 ID／changedAt／nextChangeAt。隱藏期間仍收最新共用背景，再開啟顯示最新選擇。
- 本機 `bga-lobby-background-display-v1` 保存 on／off；重新整理、離開再進入保留。儲存受限仍允許本頁切換，介面明確提示可能無法保留；同瀏覽器 storage／clear 更新及 scope dispose 解除監聽已處理。與其他個人偏好一致，這不是帳號雲端同步設定。
- `LobbyBackdrop` 隱藏時使用 default 底色，移除 `LobbyBackgroundArt` 元件，靜態背景圖片與動畫 SVG 都不顯示；元件原有卸載清除閒置 timer、輸入／visibility 監聽與 stepped animation source 的契約保留。角色、攻擊、聊天及移動控制保持掛載。
- 不新增圖片、音效或動畫，不擴大媒體預算。遊戲動畫／reduce／hidden 暫停仍沿用原背景元件；新開關負責完整顯示與卸載，兩者不混用。

## 驗證紀錄

環境：Windows、Node 24.22.1、原生 Edge。使用 `work/bg319-preview.cjs` 新建有 isolated-playtest 標記的 SQLite、兩個合成帳號，開放試玩獎勵而不預填成就。使用動態空閒埠，沒有停掉其他伺服器、改正式資料或複製帳密到公開文件。

- 新增三項真 store 回歸，加原有共用背景／冷卻共 **5／5**：個人切換無請求、另一玩家不變、快照不覆寫個人偏好、重建 store 保留、storage 同步／清除、dispose 清理及受限儲存降級。
- 前端完整 **273／273**，失敗／取消／略過 0。型別與正式 Vite build、模組邊界、格式 write／check、UI ratchet（明確指定上述 base）、minor release check、媒體 build 預算通過。
- `node tools/test-affected.cjs --base 3f21bc48` 因共用來源保守回退 **267／267 檔**。首次 2222 項中 2220 通過、1 失敗、1 缺 ffmpeg 略過（261601.655ms）；失敗為 `tests/second-wind-game.test.js:78`，seed 54 在 1800 步上限後仍為 racing，不能把首次記成通過。
- 獨立重跑運動員測試：目前工作區及從未修改 main `3f21bc48` 匯出的隔離副本各 **5／5 通過**；後端 `src` 及該測試與 main 的差異為空。此結果沒有穩定重現失敗，也不宣稱已修好或找到其根因。
- 同一產品工作區完整重跑 **267 檔、2222 項中 2221 通過、0 失敗、0 取消、1 因缺 ffmpeg 略過**，308674.319ms（`work/bg319-affected-rerun.log`）。這是最終本機完整測試結果；首次失敗紀錄仍保留，沒有改寫成通過。後續只補說明文件，未改產品／測試內容。

雙帳號真伺服器、1920×1080／390×844 × light／dark 四組：

1. 兩個獨立瀏覽器環境收到 castle；A 透過鍵盤 Space（桌機）或 touch tap（手機）關閉背景。A 的靜態背景變 none、動畫元件不存在、角色仍存在，B 保持 castle，伺服器背景與冷卻完全相同。
2. A 重整、離開至設定頁再進大廳仍關閉；設定勾選狀態保持一致。重新開啟恢復背景，無水平溢出，觸控標籤至少 44px。
3. 隱藏期間 B 在原冷卻結束後合法改為 garden；A 仍隱藏，再開啟才顯示 garden。切換個人勾選沒有送出任何共用背景 POST。
4. 四組共八張設定／隱藏畫面；pageerror **0**，設定與文字目視驗收。儲存受限、storage 事件與卸載清理另由上述單元測試驗證，不宣稱已做實體手機觸控或 GPU FPS 測量。

另以全新瀏覽器環境預存關閉偏好，冷載初始動畫 DOM 為 0、底色為 default，未觀察到 castle／garden 對應靜態圖請求。系統 reduce 下重新開啟背景保持 paused，反覆隱藏均移除動畫元件，pageerror 0（`cold-reduce.json`）；沒有據此宣稱磁碟快取命中或量化傳輸／FPS 節省。

證據在 gitignored `work/bg319-browser/report.json`、八張 PNG、`work/bg319-{frontend,affected,build,format-check}.log` 及本機 QA 腳本；登入資訊／資料庫不提交。不以這批本機驗證代替最終 head 的 CI 或使用者人工驗收。
