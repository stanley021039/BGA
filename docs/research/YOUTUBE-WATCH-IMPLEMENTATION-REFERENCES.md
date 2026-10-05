# YouTube 共看：低伺服器負擔參考與實作取捨

查核：2026-10-05；範圍：U29。使用者要求開始實作、先不要 PR，以最低伺服器負擔優先，其他玩家可自行關閉影片。本文記錄外部來源與設計推論，**不是實作完成或正式部署證明**；實際驗收另見 [進度](../YOUTUBE-WATCH-PROGRESS.md)。舊 [共看 spec](../specs/SHARED-YOUTUBE-PLAYER.md) 的 SSE／心跳／觀看者回報是被本輪取代的提案。

## 官方 API 與嵌入條件

| 查核項目 | 已查證來源事實 | 本專案採用方式／驗收重點 |
| --- | --- | --- |
| 基本控制與事件 | 官方提供 cue、play、pause、seek、destroy，與 ready、state change、error、autoplay blocked 事件。`getDuration()` 在 metadata 未到前為 0；直播回傳的是已直播時間。 | 只用官方 IFrame；V1 面向一般 VOD。本機 duration 只作 UI 範圍提示，不作伺服器信任依據。ready／失敗事件不能自行取得全桌控制權。[IFrame API](https://developers.google.com/youtube/iframe_api_reference) |
| 來源識別 | 嵌入需要 HTTP Referer，官方推薦 `strict-origin-when-cross-origin`。無 Referer 或等效身分可能產生 error 153。 | 既有 `same-origin` 不能直接沿用到跨站 iframe 載入；在設定 src 前設定 iframe referrer policy，並實際檢查網路。`origin` 不能籠統視為瀏覽器中 Referer 的替代品。[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality#api-client-identity-and-credentials) |
| 播放器幾何與覆蓋 | viewport 至少 200×200；16:9 建議 480×270。程式自動播放須超過半數可見；自訂圖層不得遮住播放器任一部分。 | 個人共看 dialog，手機也保留至少 200px 高度；彈幕、提示與同步按鈕都在 iframe 外。另一個 dialog 要開啟時卸載本機影片，不把暫停當成可覆蓋的例外。[官方最低功能](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-youtube-player-size) |
| Player 參數 | `enablejsapi=1` 啟用控制；API 使用時應指定 `origin`。`controls=1` 顯示原生控制；`modestbranding` 已廢棄，`rel=0` 不會完全移除推薦影片。 | 本專案選擇保留原生控制與品牌，另外把「全桌」操作列放在外面，清楚區分個人操作；不依賴無效參數來清理畫面。[Player parameters](https://developers.google.com/youtube/player_parameters) |
| 自動播放失敗 | 瀏覽器是否允許有聲播放與個人互動／偏好有關；父頁可向 iframe 委派 autoplay capability，但不能保證播放成功。 | 每人自行加入；blocked 顯示可重試的個人開始按鈕。不要把 server intent 的 playing 當成本機已在播。[Chrome autoplay](https://developer.chrome.com/blog/autoplay) |
| 廣告與背景播放 | 不得修改／阻擋廣告、遮品牌、拆出音軌、繞地區限制或提供隱藏播放器的背景播放。 | 不代理影片，影片流直接由 YouTube 到各人瀏覽器。關閉／背景狀態停本機，buffer／廣告／播放完畢不推動全房。外部限制只說明可觀察的失敗，不宣称能辨識所有廣告。[Developer Policies](https://developers.google.com/youtube/terms/developer-policies#i.-additional-prohibitions) |
| Privacy Enhanced Mode | 官方使用 `youtube-nocookie.com` 作隱私強化嵌入；其觀看資料不拿來個人化之後的 YouTube 體驗。這不等於完全不傳資料。 | 尚未加入前不載入 iframe／API 或第三方縮圖；加入處告知會連到 YouTube，關閉後釋放 iframe。[YouTube 嵌入說明](https://support.google.com/youtube/answer/171780?hl=en) |

上表的 API／政策是來源事實；「個人 dialog」「不定時回推」「原生操作只改本機」是本專案依 U29 作的產品決策，不是官方自動替應用程式完成的功能。

## 現有專案的同步做法

查的是作者文件與原始碼，未安裝或壓測這些產品，也未把其 README 的「perfect sync」當成量測結論。固定 commit 供日後重現；只參考協議概念，本轮不複製第三方程式碼。

| 來源與固定版本 | 可直接核對的做法 | 借鑑與不採用的部分 |
| --- | --- | --- |
| [react-youtube-sync](https://github.com/bramvdg/react-youtube-sync/tree/7b395fa2ab72a92bb04b0acf09886d8fc7a78f90) | `server/sockets/party.js` 接收明確 player state action，再由 party 層廣播；`server/core/party.js` 另用每房 1 秒 interval 累加 `timeInVideo`。加入時可收到當前 player state；前端將個人 player state 與 party state 分开。 | 參考明確控制事件及個人／全桌 state 分離。**不要照搬每房每秒加一的時鐘**：server 忙碌或 timer 延遲會失去真實經過時間，而且多房持續喚醒。程式來源：[party.js](https://github.com/bramvdg/react-youtube-sync/blob/7b395fa2ab72a92bb04b0acf09886d8fc7a78f90/server/core/party.js)、[VideoPlayer.js](https://github.com/bramvdg/react-youtube-sync/blob/7b395fa2ab72a92bb04b0acf09886d8fc7a78f90/src/components/videoPlayer/VideoPlayer.js)。 |
| [WatchSync](https://github.com/Houdini99/WatchSync/tree/c1a235ad551772ace6345cc92baf89b229f4b317) | `state.rs` 把 `current_time` 凍結在 `last_update`，讀取時加經過時間；動作才重設基準。`ws.rs` 另有週期 drift heartbeat；README 預設 4 秒，也支援一人 buffer 時全桌暫停。 | 參考 **anchor＋elapsed** 及伺服器驗證意圖。U29 不用它的心跳、buffer 群體暫停、串流代理或額外服務；本專案既有 game state 已可通知 revision。程式來源：[state.rs](https://github.com/Houdini99/WatchSync/blob/c1a235ad551772ace6345cc92baf89b229f4b317/backend/src/state.rs)、[ws.rs](https://github.com/Houdini99/WatchSync/blob/c1a235ad551772ace6345cc92baf89b229f4b317/backend/src/ws.rs)。 |
| [CyTube](https://github.com/calzoneman/sync/tree/a6561272463367a05f83b6cc6031813ec7288f77) | playlist 的 `handleUpdate` 先確認發送者是 leader、影片 id 相符才接受；無 leader 模式每秒跑 `_leadLoop`，用 Date 差更新時間，再按設定週期廣播。 | 借鑑「只接受明確控制者＋目前影片」；本專案額外用 room instance／session／epoch／revision 避免舊分頁命令。CyTube 的自動換下一片、週期廣播不符合這次最低負擔優先。程式來源：[playlist.js](https://github.com/calzoneman/sync/blob/a6561272463367a05f83b6cc6031813ec7288f77/src/channel/playlist.js)。 |
| [Watch Together 自家文件](https://docs.watchtogetherplayer.com/watch_groups.html#synchronization) | 先複製 play/pause/seek，之後每位觀看者持續回傳時間、用小幅變速校正；hot-join 會全桌暫停等加入者準備好。 | 此來源作為取捨對照：比較高同步強度需要額外狀態和訊息。派對遊戲不能因某人不看影片、關閉或網慢而暫停全房；不照搬。 |

## 本輪建議協議

以下是設計推論與實作準則，不是外部專案效能保證。

1. 既有遊戲 state 只附小型 marker，例如 room instance、revision、是否有影片。未開共看的使用者不為它新增 request，也不取得第三方內容。
2. 開啟共看時 GET 一次 snapshot；其後僅遇 marker 變動、主動返回進度、重開／回前景／需要恢復時重取。marker 與 snapshot 不一致時合併請求，避免同一 revision 每個遊戲 poll 都重抓。
3. 只有明確提案、選片、全桌 play/pause/seek、接管等操作 POST。range 拖曳的 `input` 只改本機顯示，放開／確認時送一次；不要每一像素送 request。
4. server 保存 `state + anchorPositionSec + anchorServerMs`。playing 時用 `anchorPositionSec + max(0, estimatedServerNow - anchorServerMs) / 1000` 推算；paused 保持原值。GET 不把時間寫回，沒有播放 tick／全桌進度資料庫寫入。
5. snapshot 同時給 `serverNowMs`。客端用該次 HTTP 往返中點估計時差，再用單調時鐘推算本機經過時間；不用每秒同步系統時鐘。睡眠後可重取一次，不能信任睡前計時器準點執行。
6. 同一房間的 epoch／revision 比較及 request 去重必須在 server 完成；明確控制者才能改播放。不得接受 body 自報 host/userId。舊片／舊房碼重用／舊控制者命令回衝突而非覆寫。
7. `onStateChange`、buffer、error、ended 只更新本機資訊；**不回報全桌**。收到遠端控制後發生的 callback 也不能形成 request 回聲。原生播放器個人暫停／拖曳不連動全桌；需要跟回時按「返回全桌進度」。
8. 個人關閉 destroy iframe、清 local timer/listener/未完成 load generation，不 POST leave-watch／pause。即使別人換片或播放，也不把已關閉者重新打開。其他玩家继续觀看及遊戲。
9. bounded proposals／request ledger、每帳號操作限流、最後真人離房清 store。房間共看是暫存，不新增 watch log／觀看行為DB；不增加資料移轉負擔。

時間同步的限制須明示：既有遊戲輪詢會帶來通知延遲；拿到新 snapshot 後可按當下 anchor 對齊，但不承諾每端同一毫秒起播。廣告、不同網速、瀏覽器政策及原生個人操作可能造成差距，使用者仍可自行返回全桌進度。低伺服器負擔優先意味着接受這個取捨。

## 負擔與驗收方法

令 `N` 為已打開共看的觀眾數、`E` 為一段時間內 accepted 控制變更、`J` 為加入／恢復次數。忽略衝突重試與合併，額外 snapshot GET 的量級約 `N×E + J`，POST 約 `E`；不操作時沒有共看專用定時流量。每次既有 game state 仍會增加 marker 的幾十至百餘 bytes，不能宣稱完全零負擔。這是模型估算，真正 byte 數與 request 數要記錄實測值。

| 驗收 | 應取得的證據 |
| --- | --- |
| 待機與穩態播放 | 開啟前與播放穩態的網路請求分類；沒有 `/room-watch/events`、固定頻率 GET 或 callback POST。YouTube 本身的影音請求與本站同步 API 分開計數。 |
| 同步控制 | 控制者一次全桌 seek → 一次 POST、每個已開 viewer 至多按 revision 取快照；position 按 anchor 計算，舊 ACK 不倒退。 |
| 自由關閉 | A 關閉後 iframe 不存在；沒有 POST；B 持續播放；下一個遠端動作不重建 A iframe。重新自願加入才取最新 snapshot。 |
| 原生操作與失敗 | native pause／seek／buffer／error／ended 皆不寫 server。autoplay blocked 有本機重試；任何一人不可播不影響其他席。 |
| 生命周期 | 關閉時尚在載入 API、換片時舊 onReady、房主接管、離席／踢人、房碼重用、背景／BFCache 回來；過時事件不得復活 player 或命令。 |
| 幾何及音訊 | 桌機1280×720、手機390×844；iframe 兩軸≥200；彈幕與其他 dialog 無覆蓋。影片個人加入暫停本機桌上音樂，退出後尊重原本收聽設定。 |

研究角色已將「react-youtube-sync 仍有 server 每秒 tick」「WatchSync anchor 可借用、heartbeat 不採用」「referrer／自動播放／遮擋」訊息交給主 agent 與前後端 agent。這些是實際提出的建議；不等於所有項目已由程式與真人實播驗收。
