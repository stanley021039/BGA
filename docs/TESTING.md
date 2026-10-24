# 本機受影響測試與 CI 全套測試

2026-10-16 使用者確認：本機預設跑受影響測試，完整測試可由同一個 commit 的 CI 滿足；規格與程式品質兩輪審查仍必須完成。本文件取代「每次本機與 CI 都重跑全套」的解讀，不取消適當回歸、UI 驗收或合併門檻。

## 日常指令

```powershell
git fetch origin
npm run test:affected
npm run test:affected -- --list
npm run --silent test:affected -- --json
npm run test:affected -- --base origin/main
```

預設基準為 `origin/main` 與 HEAD 的 merge-base，不會自動 fetch。切分支或準備交付前先更新遠端。`--base` 可指定其他已存在 ref；例如 `--base HEAD` 只看工作區，若要包含最後一次提交可用 `--base HEAD~1`。工具輸出 HEAD、merge-base、工作區是否乾淨、每個變更的選取原因與測試清單。

`--list`／`--json` 僅預覽選取，不執行測試或 release check，不能記為測試通過。正常執行先檢查版號一致性，再用目前 Node 的 `--test` 執行選中檔案；錯誤碼向外傳遞，失敗、無法啟動或訊號終止均不視為通過。只有文件或無差異時可能選到零測試；會明說沒有執行自動測試，正常模式仍執行 release check。

## 第一版選取範圍

工具是保守的路徑對照表，位於 `tools/test-affected.cjs`；不是完整相依圖，也不保證選取涵蓋所有間接回歸。

| 變更 | 本機選取 |
| --- | --- |
| `public/login.html`、`public/login.js`、`public/assets/auth/` | auth／圖片／HTTP 與跨頁資源、主題、共用 UI 契約測試 |
| `tools/test-affected.cjs`、`tools/release.cjs`、現有 `.github/workflows/ci.yml` | 選取工具與打版測試；CI 修改另需人工審查、實際 CI 驗證 |
| 既有或新增的頂層 `tests/*.test.js` | 該測試檔，與其他規則取聯集 |
| `package.json`／lock 僅版號變更，或僅接上指定的 `test:affected` 指令 | 打版與選取工具測試 |
| `AGENTS.md`、`README.md`、`docs/**/*.md` | 無自動測試；保留文件／規格審查 |
| 其他來源、共用 CSS／JS、核心、依賴、測試 helper、已刪除測試、未知路徑 | 回退完整套件，列出原因 |

初版刻意沒有將每個遊戲硬配到同名前綴：HTTP、成就、讀檔測試與共用流程可能跨模組。要增加窄範圍規則，先核對實際消費端、補選取回歸並經兩輪審查；不要為了減少數量直接排除測試。對照表指向的測試若消失，也回退全套。

選取合併「分支已提交差異、暫存區、未暫存內容、未追蹤且未被 ignore 的檔案」；不是只看淨差異。停用 rename 合併並以 NUL 分隔路徑，保留刪除來源與含空白名稱。套件窄範圍例外同時檢查 HEAD、index 與工作區，不能用未暫存的還原掩蓋暫存依賴變更。無預設 Git 基準時保守跑全套；明確指定錯誤 ref 或存在未解衝突則報錯停止。

選完仍要看清單：可補 `node --test tests/<相關>.test.js`，必要時主動跑 `npm test`。工具回退全套時不得自行略過。UI、同步時序、真實播放器等驗收不會因有單元測試或 CI 而取消；受影響頁面仍依 AGENTS 驗桌機／手機與狀態。本次只修改開發測試工具與協作流程，沒有產品功能／執行期變動，不升產品版號。

## CI 與提交身分

1. 需求確認後建立或沿用 Issue，實作開始前檢查 `in progress`：若已存在，先提醒使用者確認是否重複開發，確認可接續或分工後才開始；尚未標示時先加上標籤。本機執行受影響測試，記錄指令、選取範圍、head／工作區與結果；未提交狀態的測試不是另一個 commit 的 CI 證據。
2. 第 4 階段可先 commit、push 到功能分支，交使用者驗收，但不觸發 CI；已有 PR 保持 Draft。已有 PR 的更新提交使用 `[skip ci]`，實際方式與例外依 [AGENTS.md](../AGENTS.md)。只有使用者明確要求「直接提 PR」或「合併」才略過前置人工驗收。
3. 第 5 階段完成規格及程式品質兩輪審查，分別留下同一組 base／head 與證據；修正後複驗受影響部分並更新審查。影響已驗收行為時先重做人工驗收，此階段仍不觸發 CI。
4. 第 6 階段才以不含跳過標記的最終提交建立或更新原 PR，啟動完整 CI；只有階段切換時可用空提交，記錄程式樹相同並將審查更新至最終 head。`.github/workflows/ci.yml` 對 PR 明確 checkout `pull_request.head.sha`，push／手動執行使用該事件 SHA。核對目前 PR head、workflow／job 與真正 checkout SHA；Linux 必要檢查 `test-linux-node22` 必須完整成功。Windows 在 main push／手動執行另跑，不擋 PR 合併。舊 head、pending、取消、跳過、缺少或無法查看均不算通過，本機不必重跑相同完整套件。CI 失敗後先修正、複驗及更新審查，再跑新 head 的 CI。
5. 合併前 fetch main。若 base 前進，整合新 main、複驗受影響部分並更新兩輪審查，再跑新 head 的 CI；影響已驗收行為時先重新驗收。所有必要檢查通過且無未解重大問題後才轉 Ready／合併。

無可用 CI 時不能把受影響測試當作全套驗證。可先完成本機工作並保持 Draft；若需改用本機全套作為例外，必須記錄原因、環境、固定 SHA、缺少的平台與風險並由使用者明確決定，不能自行宣稱符合 Linux 必要 CI 門檻。

## Windows 合併後追蹤與 main 保護設定

PR 僅建立 `test-linux-node22`；main push 與 `workflow_dispatch` 建立 Linux／Windows 兩個 job。兩者保留 SHA 核對、`npm ci`、格式檢查與完整 `npm test`。Windows 不使用 `continue-on-error`，失敗會在 Actions 顯示失敗，依 GitHub 個人 Actions 通知設定接收通知。

main 的 required status checks 必須只留 `test-linux-node22`，保留既有 strict 等其他保護設定。workflow 與必要檢查須配套生效，否則 PR 會卡在不存在的 Windows 檢查。實際設定、PR job 與合併後結果須在 PR 記錄，不以文件文字代替設定驗收。

main 的 Windows job 失敗時，維護者先查看該 run 的 SHA、日誌與 Linux 結果，建立 issue 連結失敗 run 並記錄影響與修復安排，在後續 PR 修復；若為跨平台開發工具問題，使用 Windows 環境複驗。若暴露共用邏輯或正式 Linux 風險，應優先處理，不因 Windows 非必要檢查而忽略。Windows 故障不回溯阻擋已合併 PR；尚未看到合併後 run 時，明確標為待驗證。

此分工取代舊紀錄中的雙平台合併門檻；歷史雙平台結果仍僅作當次證據。CI／文件調整不影響產品，不升產品版號。

## 版號與 tag

產品升版依 [打版規範](RELEASE-POLICY.md)；工具不自動判斷產品相容性。先在本機完成受影響測試與版號檢查，依六階段流程提交／推送、人工驗收、兩輪審查，最後才啟動同一 head 的完整 CI；全部完成後，才在該受測、乾淨提交建立不可覆寫 tag。已改 head 或只測過未提交程式時不能提前打 tag。部署與正式資料操作仍須另有明確授權。

## 備份圖片配額與輕量 fixture

`validateMarketImagesDatabase(db, overrides)` 接受可信任呼叫端提供的收緊限制，沿用 `imageLimits` 的正整數、已知欄位及不得超過預設值驗證。省略參數維持正式預設政策（總容量 256 MiB、圖片 1000 張、每位作者 100 張）；既有備份入口不讀取備份檔提供的限制，也不傳入測試覆寫。此輪為維持正式行為的驗證器整理與測試改善，不升產品版號。

配額回歸使用真 SQLite 與最多三張有效 canonical PNG，分開測單人張數、總張數與容量的低於／等於／超標邊界。容量另驗一位元組邊界；被接受的圖片確實解碼，超標時 PNG decoder 不被呼叫。損壞圖片在未超容量下另測，避免格式錯誤掩蓋遺失的配額檢查。正式 256 MiB 預設值以單獨的聚合數值注入案例驗證，不宣稱該案例真的寫入 256 MiB；真實 `SUM(length(bytes))` 由小圖案例驗證。這取代原先 1065 筆／260 MiB 的單一混合失敗案例。

仍測正式預設張數的 cold-export 整合案例保留真資料與完整拒絕流程，資料準備採 transaction 批次寫入。媒體 HTTP fixture 各自建立資料庫與帳號，批次預建成員並透過真登入取得每位使用者的 session；邀請／註冊流程由 auth 測試覆蓋。郎中三種 purpose 都保留完整九輪、歷史及成就差異，retry 保留刪房後重試與不重複授獎；共通權限／靜態資源檢查集中在 production purpose 執行一次。

不關閉 fsync／SQLite durability、不共用可變資料庫、不縮減 1000 次加入／離開壓力測試；Linux 全套 CI 與兩輪審查門檻維持不變；Windows 依上述分工在合併後追蹤。效能改善應記錄測試範圍與環境，不能把單項或少量並行案例的比例外推為全套收益。

## 2026-10-16 初版驗收
本機Windows Node22.22.3，實際 `npm run test:affected` 選出工具／打版2個測試檔，共17項通過、fail/cancel/skip 0；未在本機重跑完整套件。測試涵蓋暫存／工作區互相抵銷、分支共同祖先、未追蹤與ignore、改名／刪除／空白檔名、套件窄例外、缺基準／衝突、只列計畫、真實失敗CLI及錯誤碼／訊號傳遞。子程序會清除Node內部測試context，避免由測試程序呼叫時反而略過測試。最新固定head兩輪審查、實際受測SHA與雙平台全套結果以本次PR對話為準。這些檢查不宣稱完整相依圖，也不等於已執行產品UI驗收；本次未改產品UI。

## 全專案測試分層（#136）

2026-10-16 使用者確認分層與輕量化；舊文「不縮減 1000 次加入／離開」仍保留其操作數，但本批將記憶體累積驗證與真磁碟輪替分開，不再要求每次操作落盤。規則／邊界用小案例、資料邊界用真整合、保留代表性完整流程與明確壓力保障。每次替換列舊／新斷言對照，關鍵保護以故障注入驗證；不能用減少測試或關閉 durability 宣稱改善。具體對照、計時隔離與限制見 [#136 實作紀錄](TEST-LAYERING-136.md)。
