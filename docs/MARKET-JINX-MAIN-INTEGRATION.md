# 股市冥燈與最新 main 的相容整合

日期：2026-10-06。Draft PR #38 審查修正 `ff3b7ad` 整合 main `144743065d78944a8eca947fb71ba23e002f62a5`（已包含 PR #34）。本輪只操作獨立 checkout 及合成資料，不操作 D:\BGA、正式資料、正式備份或其他 PR；#38 未合併或部署。

main 的 schema 13 是禁題版，原 #38 的 schema 13 是市場版；相同版本不能當成相同布局。整合版升為 **schema 14**：保留 main 的禁題 migration，新增市場 migration；完整舊禁題版／市場版 13 均可升級，已有行、帳號 hash／UUID／role 不變。市場版 13 的空禁題表相容處理只限完整 legacy 布局，缺表／部分市場布局不會被當成有效來源。14 不自動修復缺表。

冷備份驗證允許兩種完整 legacy 13，市場資料存在時仍檢查原逐版計分／撤銷語意；14 必須具備禁題表及全部市場表。export／verify／預演／restore 後，來源保持原 13，只有還原副本升至 14；資料原樣保留、sessions 撤銷。完整14混合備份同時驗證禁題稽核與更正積分。沒有降版 migration；回退需對應舊程式與升級前完整備份一併恢復。

實際六個衝突的處理：

- `src/db/index.js`：保留禁題表欄位與 constraints，市場五表改為 14；拒絕不完整 legacy13。
- `src/data/validation.js`：兩個完整13布局辨識、14要求兩方、已有市場語意檢查保留。
- `src/app.js`：同時保留 #34 draw-results／motion-policy 路由及市場路由；原登入返回處理保留。
- `public/index.html`：保留 MotionPolicy 載入、第六張市場卡與共用頁首。
- `tests/data-transfer.test.js`：舊版 fixture 確實移除兩方新表；保留禁題完整備份及缺表拒絕回歸。
- `docs/agents/MEMORY-LEDGER.md`：完整保留 main U26–U28，市場決策改編 U29；其他角色檔保留兩方段落，新增最新版本說明。

`AGENTS.md`、資料／歷史鎖、`src/data/transfer.js`、畫猜引擎／store／前端及共用 MotionPolicy 與最新 main 相同，未覆蓋 #34 的回看／收藏、禁題或動效實作。Git 自動合併另造成六份測試重複匯入 SCHEMA_VERSION，全套首次偵測後已移除重複宣告；保留失敗紀錄，不歸因於環境。

已完成市場＋資料移轉 **47/47**，市場21項包含三項審查缺陷、兩個 legacy13 的原地升級與完整冷還原、來源不變／重啟、混合14保存兩方資料，以及不完整布局／13損壞積分拒絕。Windows Node 26.2.0 完整 `npm test` 最終 **463/463**，失敗／取消／跳過皆0，约41秒。62個實際 listener 的唯讀記錄均非 Fetch 禁用埠。

第一次整合全套449項／6失敗是上述重複宣告，修正後另一次463項／4失敗為 Fetch `bad port`；該次 listener 記錄明確包含6665、6666、6667、6668，對應市場、移轉及資源測試。原失敗輸出保留，未改OS埠範圍、產品或埠分配策略；再跑原全套得到463/463。Windows原動態埠範圍風險仍存在，不能把隨機埠成功解釋為環境問題已永久消除。結構化驗收見 [整合證據](evidence/market-jinx/main-integration.json)。

最新整合版背景 Chrome、全新暫存 profile、localhost 合成帳號：登入／空狀態、手動建日、投票／修改／重載、精確截止、預覽／結算／更正、個人 ledger／管理歷史、會員權限，再驗全部通過。手動更新延遲實際 fetch 時全部操作鎖定，requestSubmit 造成0寫入，放行後更新及原選項焦點恢復。1280×720／390×844／320×740 大廳↔市場往返無水平溢出，等尺寸圖片佔位及桌機主要按鈕可見，exception 0。驗收預覽標示虛構日期／受控時間，沒有正式調時入口。

未驗 Linux、Safari、真實行情、公開負載或 #34 的完整 canvas 像素／多設備實玩；#34 自動回歸包含於完整測試。GitHub CI 狀態須另讀取，不能以本地結果宣稱遠端 CI 通過。
