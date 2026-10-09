# 畫猜同步生命週期抽離（Issue 75，本機候選）

2026-10-09，AI 實作及兩回合自審；尚未推送、建立 PR、合併或部署。

- 需求：[Issue 75](https://github.com/stanley021039/BGA/issues/75)、[作畫順暢度](specs/DRAWING-SMOOTHNESS.md)、[途中畫面／時序驗收](DRAW-TIMED-PLAYBACK-PROGRESS.md)
- main 基準：`2a5a197094c254d4a16cdec682d441af31692c76`
- 相依：Issue 72 `72981f5d2c1ceed7e8e5fd9eb3052411375dedbc`；可選 reconnect signal 的共用相依為 `ce43e9b`，與 Issue 76 的 `89204da6ee7d366995f5da7752c7f97bb614579e` 相同 patch，整合只取一次
- 本切片 code base／merge-base：`ce43e9b`；受測 code head：`b4f0582fe281308773ca98fdf1a8c8aebb6c6f1b`
- 同一未發行批次沿用 1.23.1，不另改 package、lock 或已存在 tag

## Ownership 與最小界面

開工時以「同步／取消 ownership」為界線；沒有搬走整頁控制器或 renderer。

| 資料／工作 | owner | 取消／更新方式 |
| --- | --- | --- |
| room/session、state、canvasEpoch／round／version、canonical strokes、quota／totals | draw.js | 原 receive／snapshot／stroke validation 及 RoomHost freshness；換輪清理保持原順序 |
| 畫布 GET、pending promise、AbortController、10 秒 timeout | DrawController | job identity + room／epoch／round + lifecycle generation；取消先解除 ownership，舊 finally 不清新 job |
| state GET、single-flight poll guard | DrawController | signal、room／epoch／round／generation；dispose 後晚 success/error 不呼叫頁面 |
| SSE source、stroke/reset/ready/error listener | DrawController | 一個 source；既有 JSON／version 路由及頁面 canvas 驗證不變；dispose close，舊 source callback 無效 |
| 每秒 poll／250ms tick | DrawController | start 冪等、dispose 清除；舊 generation 已排 callback 不作用；沒有新增頻率 |
| 初始找回座位 | DrawController + RoomReconnect | controller 擁有 restore job／signal，helper 保留原 retry；pagehide 取消網路及 retry wait，BFCache 重啟；晚結果不覆蓋新 seat |
| active draft、pending points/times、pointer preview RAF、140ms flush、drawing-fit RAF | draw.js | controller 的 cancelWork callback 使用原取消函式，不搬 input／座標邏輯 |
| immutable batch、pending ACK、request ID、重試、pacing／backpressure | DrawTransport | 模組未改；cancelWork 沿用 cancel，reset 的 retainInFlight 路徑未改 |
| viewer 逐點 queue／RAF | DrawPlayback | 模組未改；頁面原 reset／finish；pagehide callback 取消 |
| renderer cooperative jobs、epoch、whenIdle、原子畫面／cache | StrokeCanvas + draw.js | 模組未改；頁面仍負責 pagehide reset 及復原 |
| canvas command epoch／busy、command barrier、回看／收藏、倒數／motion／sound | 原頁面及專用模組 | 保留原邊界；沒有將 UI、規則或作品格式移入 controller |

`DrawController.create` 明確注入 context、request、receive、applySnapshot、receiveStroke、restoreSession、onRestored、cancelWork、tick 及連線回饋 callbacks。只公開 start／dispose、poll／restore、connectEvents、syncCanvas／cancelSync／cancel，以及唯讀 pendingSync。測試可注入 stream/timer，實際頁面用原生實作。`draw.html` 於 draw.js 前載入模組，靜態白名單僅新增此檔。

## 第一回合：規格符合性

對上列同一 code base/head 逐項讀 diff、呼叫端及測試。

- 符合：切片範圍、明確注入、同步／取消 ownership、重複 start/dispose、兩 controller 隔離、poll／SSE 及晚結果防護
- 符合（自動測試範圍）：canvasEpoch／round／version、quota、pending ACK／active tail、immutable transport、cooperative renderer、逐點回放、pagehide／BFCache、初始 reconnect 取消；舊測試 assertions 保留，僅 pendingSync ownership 查詢改到 controller
- 符合：API／wire／request ID／retry 次數／輪詢頻率不改，專用 renderer/input/playback responsibilities 不搬，無新功能／schema／設定／部署
- **待驗證：真瀏覽器途中 frame、畫者持筆／ACK／換輪無閃白、觀看者時序與倒數、桌機／手機／touch／keyboard 矩陣**。VM／raster harness 不能代替實玩
- **交付受阻：完整 suite 仍有基線 runtime failure；沒有達到可推送／合併門檻**

## 第二回合：程式品質與風險

同一 code base/head 獨立沿實際呼叫路徑檢查：首次 join/restore、poll→receive、stroke ACK/SSE、snapshot timeout/cancel、phase/epoch 轉換、kick、pagehide→pageshow、queued interval、舊 source callback、雙 instance、現有 command barrier。

- 實作中新增測試揭露 context callback 可能回傳同一 mutable object；已改為 request 開始時淺複製所需 context，再以原始 epoch／round／room 比對，新增邊界 assertions 保留且通過
- 取消使用 AbortSignal；RoomApi 的 abort 防止 redirect／kicked 類作用沿用 Issue 72，不重寫 fetch/parse 或繞過原 helper
- sync promise、poll、restore 的 finally 都只釋放自己；old source／interval 均帶 generation guard。dispose 冪等；phase-only cancel 保留既有 `cancelSync:false`
- transport／playback／stroke-canvas／API 檔對切片 base 沒有差異；無新 POST retry、server scheduler、schema 或資料遷移
- 新測試資料為合成值；差異沒有憑證、正式資料或安全設定。變更靜態路由不擴大任意路徑存取
- 本次已檢查程式範圍未發現尚未解決的程式缺陷；這不表示所有裝置／native 畫面已驗證

## 驗證紀錄

環境：Linux 6.18.44 x86_64、Node v24.19.0、npm 11.9.0；隔離資料，未部署。實作階段執行：

- `npm ci`：首次 offline cache miss（sharp 0.35.5）失敗；正常官方 registry、獨立 cache 重跑成功，12 packages。沒有以 stub／skip 取代依賴
- 抽離前：既有相關 focused 58/58；新增 characterization 3/3（共用 canvas read、取消/新 read ownership、單 stream malformed recovery、busy/single-flight poll）
- 抽離後同三項 characterization 3/3；再增加 dispose/restore/late result/雙 instance/timeout/partial playback 等 regression
- 最終 focused：`node --test tests/draw-{controller,controller-characterization,canvas-epoch,cooperative-recovery,input-transport,renderer-sync,timed-playback,game-sounds,guess}.test.js tests/*reconnect*.test.js`，85/85，fail/cancel/skip/todo 0
- `npm run release:check`、`node --check`（draw.js、draw-controller.js、room-reconnect.js、src/app.js）、`git diff --check` 通過
- 最終完整 `npm test`：1,861/1,862 pass，fail 1、cancel/skip/todo 0。唯一失敗為既有 `tests/web-features.test.js:2` 的 `/api/info` 回 INTERNAL_ERROR／500（預期 200）；該測試與 `/api/info` 實作未在本切片修改，維持 failure，不修補 OS 或產品程式來掩蓋
- 中間版完整 suite 曾有 2 fail（上述 mutable-context 新測試 + 既有 web-features runtime）；修正 context 後該新增測試通過。沒有刪除 assertions、排除檔案或把 failure 標成 pass
- Windows 與 GitHub CI：未執行；未推送因此沒有 final-head CI 或 PR review 狀態

### 原生瀏覽器阻礙與剩餘範圍

啟動真 createApp，獨立合成帳戶／SQLite／history/community，externalSideEffectsEnabled=false、marketAutomationEnabled=false、achievementPurpose=test，host 0.0.0.0。受支援的 dot cloud browser 導航到該隔離 server 的 localhost 時回 ERR_CONNECTION_REFUSED，未取得實際 app 畫面。讀取支援的 browser troubleshooting 後未改用其他控制管道、OS stub、使用者桌面或正式環境。

已停止自有隔離 server。關閉失敗導覽 tab 的綁定步驟遭 error-page URL protocol security policy 拒絕，因此停止，不繞過；不能聲稱該 tab 已關。沒有可用途中 screenshot，required native matrix 全部保留待驗。

回退只需 revert 本 controller 切片；共用 optional reconnect signal 若仍由其他切片使用則保留。無 schema／備份格式變更，不需正式資料 restore。下一步是在可運行原生 OS API 且可由受支援瀏覽器連入的隔離環境重跑完整 suite 和完整途中畫面矩陣；通過前保持未推送。
