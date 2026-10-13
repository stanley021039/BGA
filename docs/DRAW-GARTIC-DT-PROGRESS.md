# 畫猜連續曲線與 dt 同步

日期：2026-10-13。2.1.0 實作與本輪驗證；合併、CI 與公開站發布狀態以本輪 PR 紀錄為準。

## 已實作

- 新畫筆以可選 `curve: "quadratic"` 保留中點二次曲線格式。只合併相鄰、同 strokeId／顏色／筆寬／filled、首尾重合的曲線 chunks；不修改權威 points 或舊直線作品。畫者、觀看者、快照、結果及 PNG 用同一個 renderer。橡皮擦、圖形與填色保留原畫法。
- 活動 brush／erase 在 16 點或 80 ms 排入 sender；pointerup 立即排送剩餘點。原 115 ms 開送間隔、單一 in-flight、64 點 wire 上限、immutable batchId／body 重送及既有 lifetime quota 不變。慢網仍可合併尚未送出的相鄰資料，所以實際 wire 不承諾每包恰為 16 點或 80 ms 內對方可見。
- 接收端以跨包的原始點時間延續播放，只有新筆預留 60 ms；已收到的相鄰點在 rAF 中插值。插值只作用於 view，不加入權威點或作品。晚到續包不重新加入整批接收等待。
- 未播放時程超過 450 ms 時，將剩餘未來時程壓縮到 180 ms；保留點與順序、維持已完成前綴，單一異常點間隔上限 1,000 ms。這是即時呈現的延遲界線，不是完整筆速錄影或網路延遲保證。
- reset／fill／undo／clear／reconnect／reveal／hidden／pagehide 沿用立即權威基線及取消回放。新曲線 metadata 在額度／版本變更前驗證；accepted-ID duplicate 仍優先。DB/schema、權限、POST／SSE 與收藏 PNG 格式不變。

## 驗證

Linux Node 22.22.1 完整 `npm test`：2,081／2,081 通過，fail／cancel／skip／todo 均 0；使用本輪 ext4 暫存目錄。初次 `/tmp` focused 的 HTTP 案例遇 SQLite I/O error，完整初跑中止；隔離暫存重跑 HTTP 7／7 與完整套件通過，沒有修改產品程式掩蓋環境失敗。Windows 原生 Canvas2D 與 GitHub Windows／Linux CI 分別記錄，不混成相同環境。

新增回歸覆蓋 dt 每幀插值與 canonical 不變、晚到續包同時鐘、保點追趕、reset 舊尾取消、曲線分包與單筆像素一致、atomic／draft settlement、工具／樣式／anchor barriers、原始工作上限及曲線格式／去重／結果保存。HTTP／SSE／公開結果測試驗證曲線與 pointTimes 共同保留；既有持筆、重送、換 epoch、quota、fill、取消及倒數回歸仍通過。

隔離原生兩席在 140 ms 開發工具延遲條件下作畫：兩席各 25 個接受 chunks，非空最終 RGBA SHA 一致；觀看端 191 個採樣中 72 個有待播放點與可見筆跡，畫者 176 個採樣有持筆筆跡，兩席受測 drawing／epoch 中 white-after-ink 為 0。接收畫面與完整 canonical 重播 RGBA 差 0；隊列與 frame 排空。一次較早的採樣跨入下一輪，空畫布 hash 一致不算畫作一致證據。換輪空畫布屬正常基線，不計為閃白。

上述是有限原生輸入與取樣；不宣稱所有硬體 60 fps、真人跨裝置弱網、真實觸控或完整錄影保真。桌機／手機版面與發布公開站的證據另列於 PR。

參考來源為 2026-10-13 實際讀取的 Gartic 房間 client：`https://gartic.io/_next/static/chunks/pages/room-3be36ccf3a3828bde5af.js`；僅自行實作分包、播放與曲線原理，沒有將第三方壓縮程式或使用者 HAR 納入專案。
