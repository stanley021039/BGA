# 架構候選 2／3／4：實作與測試站驗收

2026-10-15；基於 `cf80116`／2.8.0，加上前輪未提交的郎中房間操作修改。只有測試站採用本輪程式，沒有 PR、main 合併或正式發布。

## 2. 郎中局內呈現

`quacks.js` 建立具名 presentation，明確交付 stage、dock、extras、potion、witches 與女巫動作。`quacks-stitch.js` 只按槽位配置畫面：已移除操作中文 regex、藥水瓶／預算文字搜尋、購買按鈕 dataset 回讀後二次重畫，以及 `native.onclick()`。

採購的價格、選取標記、購買／取消與 disabled 決策在建立卡片時一次完成；普通與獨立預算分開傳入。女巫視窗直接呼叫遊戲動作並隨 busy 狀態同步可用性。動作以穩定 key 保留焦點，在送出前先保存 key，等 busy 結束再返回，避免 disabled 造成焦點先丟失。

本輪未重寫所有藥材效果選項的圖示語意；既有依效果文案挑選圖示的邏輯仍在遊戲呈現內部。

## 3. 房間狀態變更

新增 `src/rooms/transitions.js`，由玩家入口、AI 與計時器共用 `transact`，集中歷史寫入及完成後的成就處理。`leave` 與 `kick` 同時收納座位、重入／踢出紀錄、媒體成員與串流清理的順序。

歷史仍是 intent／result 記錄，不是能回滾遊戲狀態的資料庫交易。歷史寫入失敗仍暫停普通操作；離席保留例外路徑，不重做已完成的 leave，並回報未完整保存，最後一席仍能釋放房間。SQLite、JSONL、單程序及原成就重試機制未變。

## 4. 畫布 session

新增 `public/shared/draw-canvas-session.js`，集中權威筆跡、epoch／round／version、lifetime quota、未確認草稿、ACK／SSE／snapshot 調和、播放與 renderer 工作世代。頁面保留 pointer 座標、輸入節流與工具畫面，透過 begin／append／finish draft、enqueue、command、transition 等 interface 操作 session，不再直接修改 pending／ACK／reset 欄位。

- `view()` 提供不可變的狀態與計數，不暴露可變草稿 Map。
- `whenIdle()` 等待已排 transport 與最新 renderer，仍不代表未完成的持筆輸入已結束。
- preview frame 的排程與取消也由 session 持有；controller 保留輪詢、SSE 與 snapshot GET 的生命週期。
- ACK／SSE 先後皆只接受一次；reset 保留必要的 in-flight 草稿追蹤，舊 ACK 不得讓已清除筆跡重新出現。
- undo／clear 不退還 lifetime quota；換 epoch、phase 及離頁仍會取消不適用的工作。
- 保留既有 wire 格式、曲線／pointTimes 與原子 renderer，沒有變更繪圖算法。

## 實際驗收

使用 Chromium 真瀏覽器連上 VM 測試站；帳號與房間為合成驗收資料。沒有執行 `test` 指令或完整測試套件。

| 範圍 | 已觀察結果 |
| --- | --- |
| 前輪房間操作 | 設定失敗恢復、連點防重、非房主限制、結束重載再開局、撲克舊接線通過 |
| 郎中局內 | 病患、占卜、抽／停、女巫視窗直接使用、結算、特效藥、骰、獎勵、採購及回合完成 |
| 採購 | 橘色 1 藥材真實購買／取消、精確退款、同 action key 的焦點返回 |
| 畫者／觀看者 | 延遲 HTTP ACK、SSE 先到、持筆至 ACK 完成；214／215 個採樣 frame，觀看者 16 種 ink count；此 trace 無 ink 後全白，最終畫布摘要一致 |
| ACK 無 SSE | 中斷畫者 SSE 後仍由 ACK／snapshot 接受筆跡，重載恢復 baseline |
| reset／in-flight | 伺服器已接受筆跡、HTTP ACK 延遲時從另一連線 clear；reset 後採樣無殘筆，晚 ACK 未恢復舊圖 |
| 命令／重連 | 真 UI undo、clear，lifetime quota 不回退；觀看者重載與畫者最終摘要一致 |
| 換輪／倒數 | 跳過、下一輪新 epoch、計時器自動選題後畫布為空；倒數 transform 在時間推進時持續下降 |
| 歷史失敗 | 另啟隔離資料 HTTP app，將 match 上限設為 1 byte：start 被 HISTORY_QUOTA 阻止，兩席仍能依序離開，最後一席刪房，回報 historyPersisted=false |
| 版面 | 桌機、390／320 寬度檢查與截圖；修正郎中窄版頁首縮排及畫猜調色盤 specificity／窄版頁首換列，無頁面水平溢出 |
| 瀏覽器錯誤 | 受測流程未收到 pageerror |

上述 frame 數是有限背景瀏覽器 trace，不是 FPS、真人手感或全裝置保證。未驗真實觸控、Safari、完整九回合、所有遊戲、自然弱網或所有競態排列。

## 重現與維護

- `tools/qa/architecture-234.cjs`：指定隔離站 `QA_BASE`、私有管理者帳號檔 `QA_CREDENTIALS_FILE`、選用 `QA_OUTPUT`／`BROWSER_EXECUTABLE`。`QA_DRAW_ONLY=1` 僅跑畫猜。驗收後離開自有房間並停用自建會員。
- `tools/qa/room-transitions-http.cjs`：建立獨立 OS 暫存資料與臨時 HTTP app，驗證歷史額度失敗時的離席，不讀寫測試站或正式資料。
- 原畫猜 fixture 改從 session 的公開唯讀 view、whenIdle 與捕捉到的 renderer／transport／playback adapter 診斷；不再存取頁面私有 canonical／draft Map。這些套件測試本輪未執行。
- 產品 JS 語法檢查、變更檔案 whitespace 檢查通過。
