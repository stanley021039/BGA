# YouTube 共看實作進度

2026-10-06 最新整合：候選 **v1.4.0**、[PR #43](https://github.com/stanley021039/BGA/pull/43) 已建立，受測程式及本地tag為 `bdd77d146ef8f207c8d94c06390aefd2a857d986`。Windows／Linux完整各 **790/790**、schema15兩種舊14布局及完整移轉回歸通過；既有帳戶／音效／市場資料保留。已接main `b744464`，後續只含README／驗收文件，執行程式未變。正式仍v1.3.0，排版及整合候選尚未切換；先前PR及測試數字保留為歷史，送審狀態以PR頁及下方最新整批進度為準。

本輪 source、schema 相容性、測試及送審狀態見 [整批 PR 進度](PARTY-PR-INTEGRATION-PROGRESS.md)。

2026-10-06正式 **v1.1.4**：將PR #36相容修正`d4020ef`只取runtime與三份回歸／helper檔整合至現有遊戲分支，不用PR的1.0.0歷史整包覆蓋目前版。PR來源Windows／Linux各552/552；正式整合Windows／Linux各 **663/663**，失敗／取消／跳過0。新增38項，前端90/90、共看／音訊focused123/123。PR #34另補Windows／Linux442/442及背景Chrome四席四輪、跨輪／完局回看與收藏、3/4禁題；#34在驗收期間由另一端合併main，沒有由本任務合併。#36已非force推送至`5f2dd93`、base改main、Ready且無合併衝突，未由本任務合併。

背景Chrome在隔離非loopback `http://192.168.232.1:3203`、正常1794×1010，用合成帳戶實際送出影片與全桌播放。CDP只讀驗`isSecureContext=false`、`randomUUID`未提供、`getRandomValues`可用；提案與播放POST200。加入YouTube後原生播放器實際播放，同帳戶另一端API暫停及停止，各預置單次GET503；同revision下一次GET200恢復，暫停時原生播放器paused，停止後本機iframe移除。沒有手動重開／返回進度或新revision；永久失敗／上限、關窗／晚回應等另由真模組VM測。受控故障只在私有QA server request wrapper，不改產品source或正式站。私有畫面`work/pr36-http-pause-recovered.jpg`、`pr36-http-stop-recovered.jpg`及去敏CDP紀錄`pr36-pause-retry-network.json`、`pr36-stop-retry-network.json`。這是同帳戶另端API＋一席UI，不宣稱兩台真人設備／弱網／GPU測試。

正式發布證據：受測提交`93ba3501aaca22768c8605609637fbdf0df2d557`、不可覆寫的本地annotated tag `v1.1.4`；後續純驗收文件不移動tag，發布分支及tag未push。發布包SHA-256 `aaa165bf4c58b7bad80af2d5bb05dcc0949b9a8071b46fad1b81b64d9e77d968`，未含本機私人偏好或QA資料。Linux約116秒，完整log`work/pr36-production-linux.log`，Windows`work/pr36-production-windows.log`。schema13隔離副本15表逐列一致、完整性ok、外鍵0、啟動成功；線上SQLite與持久檔案另備份`shared/backups/pre-party-93ba350-20261006T022835Z`（UTC），不宣稱同一原子時間點。

切換前房間0；正式current `releases/93ba350`，PID42200→48811，service／tunnel active。7帳戶全欄位保留、schema13、既有session有效；公開版本1.1.4且no-store、race HTML及8份JS／CSS（包含table-watch）與受測碼一致，背景Chrome設定實際顯示「版本 v1.1.4」。正式未新建遊戲房間，HTTP失聯錄影／驗收屬本機隔離案例，不冒稱正式實玩；兩個QA服務已正常停止。截圖`work/pr36-production-version.jpg`，去敏公開驗證`work/version-production-verification.json`。

## 2026-10-06：PR #36 審查修正（回歸階段紀錄）

在隔離 checkout 整合最新 `feat/draw-review-motion`／main 後修正 [兩項 P2](https://github.com/stanley021039/BGA/pull/36#issuecomment-6007722283)。下列是本次修正的證據，不取代後文原實播紀錄，也不代表已推送或部署。

| 問題 | 修正與驗收 |
| --- | --- |
| 開窗後新 marker 的 GET 暫時失敗，使同 revision 永遠無法重新同步 | 每個 room instance／revision 最多首取加兩次自動重試；第一次失敗後至少 1 秒、第二次後至少 4 秒，只有既有遊戲 state 的 `update` 到來才會重試。成功穩態零額外 watch GET，沒有新增 watch 網路 timer、polling 或 heartbeat。初始無快照／無 watch marker 也能恢復；同時抵達的 marker 合併並追最新 revision。 |
| 重複失敗與失效請求 | 網路、5xx、408、429、回覆解析錯誤及落後於所請 marker 的快照使用同一有界預算；其他 4xx 立即停止自動重試。額度耗盡顯示重開／返回全桌進度的復原入口，明確重開或重新加入可重置預算。關閉、換房、換 instance 清掉預算與 pending，abort 舊 GET；晚到失敗不能改掉新視窗的狀態或重試額度。 |
| 非 loopback HTTP 缺少 `crypto.randomUUID`，操作在送出前拋錯 | 優先使用原生 `randomUUID`；缺少時由 `getRandomValues` 產生 16 bytes 並設定 UUID v4 version／variant。沒有安全亂數源或 API 拋錯時，在共看狀態區提示，不送 POST、不留下 rejected command promise；不使用 `Math.random`。 |
| 不確定網路結果的安全重送 | 同一明確操作復用原命令及 UUID，重試不要求再產生安全亂數；不同操作或收到 HTTP 拒絕後的新操作建立新 UUID。維持原 server 去重及 revision／epoch 驗證。 |

Windows Node 24.14.0：`node --test tests/table-watch*.test.js` **90/90 通過**（原 52 項，加 38 項回歸，包含子測試）；併同 `room-watch`、`audio-settings`、`music` 的 focused **123/123 通過**。測試執行真正 `table-watch.js` 模組，以 VM DOM／fake monotonic clock／deferred GET 驗證遠端 pause／stop 失聯恢復、重試上限與門檻、初次無 marker、latest pending、換房／關窗／舊回覆、原生與 fallback UUID、缺安全亂數及相同操作重送。這一筆未宣稱本次 Linux、真正 Chrome 或正式站驗收；完整整合驗證由父任務另記。



2026-10-05 使用者U33已要求發PR：[PR #36](https://github.com/stanley021039/BGA/pull/36)，head `2eeb398`、base `feat/draw-review-motion`（接續待合#34）。本次送審前Windows focused81項及背景Chrome兩帳號驗收；未合併／部署。下文「未PR」是早期U29實作階段紀錄；新六項需求另在本地 `feat/party-content-and-race-paths`，不包含在#36，見 [進度](PARTY-UPGRADE-PROGRESS.md)。

整合驗收補充（2026-10-06）：修正程式`d4020ef00e4054263d1329d3e030f7053d784959`包含main `1447430`（#34在驗收期間由另一端合併）；Windows Node24.14.0／隔離Linux Node22.22.1完整各 **552/552**，失敗／取消／跳過0，Linux約112秒。archive SHA-256 `4d9369fd86bd588929c529cd338de39a85b0ba34b2510b669faddf7fb94f244d`，只在專用source目錄測試，不帶.env/work/私人資料、不碰正式服務與DB。後續帶入#34 `cc771b8`僅驗收文件；文件首段衝突保留watch修正與main鎖／draw驗收，runtime/tests沒有改變。獨立複查另抓到response已超過pending marker仍多GET，先重現3GET再修至2GET，已含於d4020ef及新增第38項回歸。

原Chrome背景、正常1794×1010、隔離非loopbackHTTP：只讀CDP驗secure=false、randomUUID未提供、getRandomValues可用，實際影片提案／播放POST200，加入影片後原生YouTube播放。由同帳戶另端API發暫停與停止，各預置下一GET503；同revision下一GET200後原生播放器paused／iframe移除，不須手動重開或新revision。被動CDP後續穩態watch事件0、無truncated或剩餘page；受控失敗只在私有server request wrapper，不改產品碼。未以一席UI＋另端API宣稱兩名真人設備或GPU/弱網驗收。證據在ignored `work/pr36-full-{windows,linux}.log`；Chrome圖及去敏網路證據在主QA的`work/pr36-http-*-recovered.jpg`、`pr36-*-retry-network.json`。正式部署使用另一本地整合分支，不將本PR的歷史1.0.0整包覆蓋現有站點；部署結果獨立記錄。

日期：2026-10-05。使用者 U29 要求開始實作，以最低伺服器負擔優先，其他玩家能自行關閉影片，先不要 PR。後續 U30 要求整合音樂入口、每個 client 自行調位置，直接拖曳頂端工具列，移除移動按鈕。基線 `585eb63`，已驗收本地程式 `631eabf`，分支 `feat/youtube-watch`。未推送、未建立或更新 PR、未部署；測試使用隔離資料與原 Chrome 背景。

## 本批設計

| 分類 | 適用遊戲 | 實作與驗收條件 | 進度 |
| --- | --- | --- | --- |
| 伺服器負擔 | 整體遊戲（畫猜／送禮／雷霆／同頻／撲克） | 沿用遊戲既有 state 更新，附帶小型影片版本標記；未開共看不新增 watch 請求。共看沒有另開 SSE、WebSocket、輪詢、心跳或每秒進度回報。 | 完成；實播62秒零新增watch請求 |
| 時間軸同步 | 整體遊戲 | 明確播放／暫停／跳轉／換片時才修改伺服器 anchor；開著視窗的玩家遇版本改變才取得快照，平常以本機單調時鐘計算進度。確認跳轉才送一次命令。 | 完成；一次seek一POST、另一席取一快照 |
| 個人選擇 | 整體遊戲 | 自行加入才載入 YouTube；关閉／Escape／隱藏只停止個人播放器，不改全桌，也不被遠端重新開啟。重新加入才對齊最新進度。 | 完成；Chrome及VM驗證 |
| 控制權 | 整體遊戲 | 採用影片的提出者控制全桌，房主可接管。其他人可提案；房員驗證、版本／epoch 比對與命令去重由伺服器裁決。 | 完成；三席HTTP、兩個Chrome身分與VM |
| 共用介面 | 整體遊戲 | 同一「媒體」入口區分音樂與影片。非modal影片浮窗直接拖曳頂端工具列，本機記憶位置；桌機優先，原生控制完整可見。遊戲及名單保持原位置。 | 完成；五款入口、桌機及手機幾何 |
| 本機播放 | 整體遊戲 | 音量與靜音只影響自己，本桌音樂暫時在本機停止；原生 YouTube 操作不自動發全桌指令，緩衝／廣告／播放失敗不影響其他人。 | 完成；音訊11項、原生callback零POST |
| 生命週期 | 整體遊戲 | 換房、舊回覆、重連、隱藏、其他dialog、清房與控權移交隔離舊事件。關閉視窗清時計；僅退出影片保留選片視窗。 | 完成；前端52項、後端18項 |

此實作以 [原共看 spec](specs/SHARED-YOUTUBE-PLAYER.md) 為起點，U29 的負擔優先要求取代其中獨立 SSE、fallback polling、觀看 presence 與周期網路校正提案。影片直接由每個玩家的官方 YouTube IFrame 載入，本站不代理／下載影片、不請求影片 metadata、不需要 YouTube Data API key。暫存播放資訊隨房間清除，不新增 DB schema 或備份內容。

## 協議

既有遊戲 state 增加 `watch:null` 或 `{roomInstanceId,revision,hasVideo,controllerId,controllerName}`。共看視窗關閉時只更新入口文字；視窗開啟且 marker 變動才 `GET /api/room-watch?code`。首次開啟及明確重新加入也取得快照。這會沿用遊戲原有輪詢延遲，不承諾即時到每幀。

快照包含房間 instance、影片 session、revision、controllerEpoch、controller／selectedBy、影片 ID、`playback:{state,anchorPositionSec,anchorServerMs,rate:1}`、serverNowMs、有界 proposals 與觀看者權限。身分使用既有 seat ID，不接受客戶端自報房主。

`POST /api/room-watch` 帶 `code/roomInstanceId/watchSessionId/requestId/expectedRevision/controllerEpoch/action`，另帶該動作的參數。支援提出網址、採用提案、全桌播放／暫停／跳轉／重播／停止、房主接管／交棒。接受命令後回完整快照；409 附最新快照。相同命令重送只執行一次，去重記憶有界。

自然時間流逝只改變瀏覽器推算的顯示進度，沒有 watch API 流量；控制權離線期限只借既有房間活動检查，不另開計時器。個人關閉、YouTube 原生 controls、buffer／ended／error 等事件不回報伺服器，也不改全桌。

## 操作

1. 在房間工具列點「媒體」，同一面板有「影片」及既有「音樂」操作；點「YouTube 共看」開啟浮窗。
2. 貼上 HTTPS YouTube 網址並送出。第一部直接選用且暫停；之後加入有界提案清單，控制者或房主可選用。各人自行按「加入觀看」。
3. 提案者控制被選用的影片；工具列設定圖示展開「全桌播放／暫停／跳转／重播／停止」。房主不是控制者時可先接管。「在這裡開始播放」只顯示給房主；觀看者若遇瀏覽器自動播放阻擋，提示改為使用 YouTube 播放器內的播放按鈕。原生YouTube控制只影響自己，想跟回時按「返回全桌進度」。
4. 按住頂端工具列（標題／空白處）拖曳；方向鍵每次20px、Shift為50px，Home或重設圖示回預設位置。按鈕及其圖示不觸發拖曳。`bga.watch.window.v1`只存在自己的localStorage，不發網路命令。
5. 加入後自動採精簡影片浮窗，設定圖示可展開選片及全桌控制。暫時展開或縮小螢幕只限制當下位置，再回復時保留原偏好；視窗不阻擋遊戲操作。
6. 視窗右上X或Escape關閉自己的影片視窗；播放器下方「關閉自己的影片」只退出影片，保留選片介面。其他玩家繼續觀看；別人的換片／播放不會重新打開已關閉的影片。分頁隱藏及其他modal也退出本機播放，需要時自行重新加入。

## 驗收與限制

| 驗收 | 證據及範圍 |
| --- | --- |
| 自動測試 | `npm test`：Windows Node24.14.0及Linux Node22.22.1各503/503。新增／相關focused81/81，其中前端52、後端18、音訊11。477檔源碼跨平台逐檔SHA256一致；不是只在Linux跑基線。 |
| 請求量 | 實播觀察62.159秒，watch維持12筆、browser GET10／POST2皆未變。明確跳120秒後browser POST2→3、GET不增加；個人關閉不增加watch請求。另一席開窗後遠端跳240秒，該席只新增1GET，無callback POST。原有遊戲／音樂及YouTube影音請求不在「零watch」範圍。 |
| 實際同步 | 第二個Chrome登入身分是觀眾，遠端跳轉後全桌4:15，原生video.currentTime約255.14秒、paused=false。選片後觀眾取得控制；房主接管後控制按鈕disabled。部分遠端命令由HTTP helper送出，不宣稱兩名真人同时操控。 |
| 雙帳號 UI 重測（2026-10-05） | 同一 Chrome 以 localhost／127.0.0.1 分開登入房主及觀看者。兩邊實際 video 都在播放；房主透過 UI 暫停、跳至120秒再播放後，實際進度126.20／126.13秒，該次差約0.07秒。觀看者的全桌控制disabled。觀看者只退出自己的影片後 iframe=0，房主仍播放137.74秒；watch請求51筆、browser GET26／POST9皆未變。帳號分頁保留，未設定viewport override；此結果只代表本次本機觀察，不是持續同步保證。 |
| 房主本機播放按鈕（2026-10-05，400cb6d） | 依快照 isHost 隱藏「在這裡開始播放」，初始未知身分也隱藏，事件處理同步檢查房主身分。播放提示依角色提供可見入口。Windows 共看前端52/52通過；兩個背景 Chrome 帳號實際加入後，房主按鈕可見、觀看者 hidden=true 且不可見，觀看者仍可返回全桌進度及個人關閉。此增量沒有重跑 Linux／全套；前列503項是原基線證據。 |
| 畫面 | 五款遊戲入口都在同一媒體slot，桌機dock高44px；未自行加入時沒有YouTube script／iframe。1280×720精簡播放器526×295.875，390×844播放器348×200，無橫向溢出。實際Chrome拖曳頂端標題成功，無移動按鈕；播放器外有重設及控制圖示。 |
| 初始化與清理 | 初始paused用cue→pause，避免unstarted的seek自行播放；API等待中退出立即取消script／20秒timeout。亂序回覆、同UUID重試、房碼重用、離線控權、marker追新、兩client位置互不影響、pointer capture及焦點回復都有回歸。 |
| 預覽及證據 | 本機3194隔離預覽保留供使用者查看，使用合成帳戶及API keepalive。帳密／cookie、原始計數、截圖和private交接只在ignored `work/`。正式服務／DB／PR未變更。Linux owned測試checkout完成後清理。 |

測試viewport曾暫留造成使用者看到左上角小畫面；已用官方viewport reset及逐tab clearDeviceMetricsOverride還原所有owned tabs，DOM驗證正常視窗尺寸。後續響應式驗收每個尺寸測完立即還原，不把測試模擬留到整輪結束。

低負擔優先會沿用遊戲既有state通知延遲；廣告、網速、浏览器自動播放政策及個人原生控制可造成進度差，按「返回全桌進度」重新對齊。未驗真實大量房間、所有影片／直播／受限內容、所有瀏覽器或文字放大200%；不承諾逐幀同步，也不新增永久播放清單、聊天訊息內嵌、投票換片或自動下一片。既有音樂SSE及fallback維持原行為，本批沒有把音樂同步改成新的影片協議。

外部文件與開源做法另見 [研究記錄](research/YOUTUBE-WATCH-IMPLEMENTATION-REFERENCES.md)。


## 2026-10-06 最新 main 合併驗證

2026-10-06 PR #36 合併準備：整合最新 main `9dd6282`（含 #38），靜態資源衝突保留 YouTube 與 market 路由及 market 登入返回路徑；記憶保留雙方決策，重複編號以 U29-market 區分。Windows Node 26.2.0 完整 573/573 通過，失敗／取消／跳過 0。本輪未重跑 Linux 或瀏覽器；使用者已明確授權推送與合併 main，未部署。
