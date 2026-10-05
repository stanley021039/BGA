# 房間 YouTube 共看播放器規格

狀態：研究／待實作；2026-10-05。本文件沒有修改公開播放器、正式帳號或服務。方案以官方 IFrame Player API、一般隨選影片（VOD）為第一版；所有房員收到相同影片與時間軸，提出並被選用影片的玩家取得控制權。每個瀏覽器仍需自行允許播放，無法保證每人都有聲音或逐幀同步。影片清單不預設永久保存或公開。

## 房內共看視窗與幾何

1280×720的320–360px遊戲側欄放不下建議480×270播放器；第一版不把影片塞入側欄，也不為影片隱藏常駐玩家／角色／剩車／骰子。固定utility區放44px「共看」入口、外部簡短狀態與controller姓名，點開獨立native dialog。

- 桌機dialog `width:min(720px,calc(100vw - 32px))`、`max-height:calc(100dvh - 32px)`，24px padding可提供約672px內容；播放器區上限650px×366px。標頭約44px、當前回合摘要24px、控制列44px、同桌狀態列24px與8–16px gap；低高度時body可捲、close及主要操作列保持可見，不縮文字／controls。
- 手機dialog全寬扣兩邊16px，內部padding按可用寬調整；390px時player維持至少358×202（避免又扣雙倍padding導致不足200高）。必要時播放器改非16:9盒以保200×200，極窄畫面可用單欄捲動／外部觀看提示，不載入不足尺寸player。
- dialog序列：標頭「共看」＋close→控制者/目前遊戲回合提示→完整IFrame→外部全桌play/pause/seek與本機聲音→同桌joined/needsGesture/blocked狀態。外部seek與emoji不蓋IFrame；popover須留在播放器外安全區，空間不足時先pause並退出本機播放器再開選單，不能把pause當作允許遮擋的例外。
- 開任何其他modal前先pause本機player並關閉共看dialog／卸載IFrame，避免堆疊在player前方；回到共看後按需重新加入／取最新anchor。關閉共看只退出本機觀看，不提交全桌pause；原常駐名單仍留在遊戲頁，modal關閉返焦到原入口。
- 複用 `GameUI`／ui-components控制與dialog focus contract、`UIPopover`處理真正小選單；GameShell提供一致utility入口。不能以既有320px「音樂popout」直接換成YouTube；真正player都在dialog內。減動同步圖示在IFrame外，不遮擋品牌或控制。

這是具體提案，仍須以五款遊戲與200%字體驗幾何；不聲稱已渲染通過。

## 現況與接點

| 檔案 | 現況 | 規劃 |
| --- | --- | --- |
| `src/app.js` | `rooms`、`seats`、`musicRooms` 都是程序內 Map；帳號 UUID 對房間座位的映射只在 `seats` | 共看按 room instance 建 store，授權從 session／seats 推導，清房時關閉 stream 並清 store |
| `src/music/room.js` | `position/startedAt/playing/version/serverNow` 已有 server 時間軸 | 共看採相同 anchor 概念，另加 session UUID／controller epoch／命令去重 |
| `public/shared/table-music.js` | HTML Audio；本機收聽開關、SSE、1 秒校正、偏差 .8 秒 seek | 不把 Audio 校正頻率直接套用 YouTube；另建 adapter，避免每秒強制 seek |
| `src/http/security.js` | `Referrer-Policy: same-origin`；CSP 只有 `frame-ancestors/base-uri/object-src` | IFrame 明訂 `referrerpolicy="strict-origin-when-cross-origin"`，確認最終 request 有 Referer；必要時僅共看頁改 response policy |

`X-Frame-Options: DENY`／`frame-ancestors 'none'` 是阻止本站被嵌入，毋須為本站嵌入 YouTube 而移除。若日後收緊 CSP，新增明確的 YouTube script/frame allowlist；不要把所有第三方來源開成 `*`。

## 官方限制與產品取捨

- 使用 `YT.Player` 的 cue/play/pause/seek API，從 `onReady/onStateChange/onError/onAutoplayBlocked` 處理本機狀態。`seekTo` 有關鍵影格限制，不能承諾精確到每幀。[官方 IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- IFrame 至少 200×200；16:9 建議至少 480×270。桌機共看區採 480×270 以上；390px 手機扣左右 16px 後可用 358px×202px。更窄畫面先顯示加入卡，展開全寬播放器並維持兩軸至少 200px；不能在 200px 寬度硬維持 16:9 而只剩 112px 高。[Player parameters](https://developers.google.com/youtube/player_parameters)
- API client 要提供 HTTP Referer identity；官方推薦 `strict-origin-when-cross-origin`。自動播放需播放器可見且超過一半可見，任何自訂圖層都不能遮住播放器／控制列。因此角色、emoji 彈幕、同步 badge 和我們的控制列放在 IFrame 外；開 modal 時先停本機播放。[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- 保留 YouTube 原生控制、連結、廣告與品牌，不下載／代理影片、不抽音訊、不把播放器藏起來當背景音樂，也不繞過地區或嵌入限制。[Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- 使用 privacy enhanced embed `youtube-nocookie.com`，但不宣稱「完全不傳資料」。加入共看前不載入第三方 iframe/API，也不偷偷取縮圖；提供 Google／YouTube 隱私連結。[官方嵌入說明](https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en)
- `allow="autoplay; encrypted-media; fullscreen; picture-in-picture"` 只能授予 capability，不能替代每人的手勢／瀏覽器政策。收到 autoplay blocked 顯示「按一下開始觀看」；可選本機靜音，但若 muted play 也失敗仍保留手動入口。[Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)

上述是外部限制；下述權限、時序與偏差門檻都是本專案設計，須實測調整。

## 選片與控制權

1. 任一在房間內的真人可貼影片 URL。第一部影片可直接選用，提出者成為 `selectedByUserId` 和 `controllerUserId`；若已有影片，其他人的新提案先進房間內暫存建議，由現控制者或房主切換。選用後控制权交給該提案者。非永久／公開播放清單。
2. 只有控制者可全桌 play/pause/seek／換片／清空。房主可明確接管、交給在線真人或停止共看。音量、靜音、加入／退出觀看與原生全螢幕都是個人操作。
3. 控制者斷線保留 30 秒（可調）重連租期；逾時且另有真人時，先凍結全桌 anchor 為 paused，再交給房主；房主亦離線則交最早加入且在線的真人。沒有真人就清房／清共看。離房、被踢立即撤銷舊 epoch，不能讓舊分頁重新控制。
4. 房主移交不必奪走仍在線提案者的播放控制。controller 是獨立角色，不用「room.host」布林值直接代替。
5. 全員可收到影片邀請；「加入共看」由每人決定，未加入者仍可玩遊戲。禁止強制打開新分頁／把瀏覽器帶到前景／遠端開啟音量。

## 狀態與 API（提案）

```ts
type SharedWatch = {
  schemaVersion: 1;
  roomInstanceId: string; // 新建房即有 UUID，六位 room code 只供導航
  watchSessionId: string; // 換片／清空後遞換 UUID
  revision: number;
  controllerEpoch: number;
  selectedByUserId: string | null;
  controllerUserId: string | null;
  video: null | { provider: 'youtube'; id: string; title?: string }; // V1沒有權威duration
  playback: { state: 'paused' | 'playing'; anchorPositionSec: number; anchorServerMs: number; rate: 1 };
  serverNowMs: number;
};
// 每人的狀態是非權威報告，不能修改別人的播放器或時間軸
type WatchPresence = {
  userId: string; joined: boolean;
  state: 'needsGesture' | 'ready' | 'playing' | 'buffering' | 'blocked' | 'hidden' | 'unknown';
  reportAtMs: number; errorCode?: number; // no raw IP/cookie, 不永久保存觀看行為
};
```

- `GET /api/room-watch?code=...`：校驗房員、回完整 snapshot；回應不寫狀態。
- `GET /api/room-watch/events?code=...`：SSE 完整 snapshot，連線即送當前狀態，command accepted 立刻 publish，10 秒 heartbeat；離席／踢出／session 過期結束 stream。fallback polling 2–5 秒。
- `POST /api/room-watch`：`{roomInstanceId,watchSessionId,requestId,expectedRevision,controllerEpoch,action,...}`。action 為 propose/select/play/pause/seek/replay/stop/transfer/takeover/join/report。replay為一次原子seek0＋play；report不能被視為控制；requestId為UUID，有限TTL ledger去重。
- URL 只解析 HTTPS 的 `youtube.com/watch?v=...`、`youtu.be/...`、官方 `/shorts/` 或 `/embed/` 形式；嚴格確認精確 host、11 字元 video id `[A-Za-z0-9_-]{11}`，拒絕帳密、任意 iframe HTML、伪裝子域／port／其他外部 URL。丟棄追蹤參數。server 不 fetch 使用者指定 host，因此不引入 SSRF。
- 身份從已登入session和有效席位讀取；拒絕body自報userId/host/controller。所有修改原子比較revision＋epoch，衝突回409＋最新snapshot。V1 server只驗`seek`是有限數、非負且不超硬上界86400秒（24h；產品限制），不信任任何client提供的duration或ended。client的`getDuration()`只是本機UI hint，range可依它限制可見進度；hint未就緒時先cue並禁用本機seek UI，不能拿它決定全桌終點或授權。
- 額外設限：每帳號每分鐘控制／提案限流；每房 stream、近期 request ledger、建議數量都有限，room 清理一起刪除。

V1不需要YouTube Data API key，IFrame回報每端可播狀態；VOD是第一版適用邊界，收到直播／預播跡象提示控制者換片，不宣稱無key即可server可靠分類所有video id。V2若需要server可信duration／直播／可嵌入／地區metadata，使用官方`videos.list`，key保留在環境祕密。記錄`{videoId,durationSec,source:'youtube_data_api',fetchedAt,expiresAt}`，建議初始TTL15分鐘，到期refresh失敗退回無權威duration模式、不能沿用過期資料自動終止。metadata仍不是所有观看者可播保證。[Video resource欄位](https://developers.google.com/youtube/v3/docs/videos)

## 時間同步與回聲抑制

權威是server儲存的anchor。正在播放時`desired = anchorPositionSec + max(0,estimatedServerNow-anchorServerMs)/1000`；暫停時等於anchorPosition。V1只以86400秒產品硬上界夾限，不知道影片實際尾端；client seek可按本機duration hint避免跳過自己可播範圍。server commit控制命令時才重算anchor，不使用任何觀看者的`getCurrentTime()`當全桌真相。

HTTP 取樣記本機單調時間的 send/receive；以往返中點估 server offset，選最近數筆較低 RTT 的樣本。SSE 的 serverNow 只用來識別更新，不把「收到事件時本機 Date.now」視為無延遲的時鐘。長休眠、重連、系統時鐘跳變時重取 snapshot 和 clock sample。

客戶端讀 revision，忽略舊版本；換 watchSessionId 銷毀舊 player/listener/timer。新片先 cue，`onReady` 後以最新 anchor 對準；取得個人手勢後才 play。權威 pause 先暫停再 seek 以保持 paused；不在 buffer／不可播／未加入／隱藏時強求對齊。

一般每 2 秒檢查本機偏差。初版門檻：偏差 ≤1 秒保持；連續兩筆 >1.5 秒才 seek，距離上次校正至少 5 秒；新控制命令／重連可立即校正。這些是驗收起點，不是 API 保證；不做持續 seek 或回推控制事件。V1 固定 rate=1，不靠每人的可用速率清單做加減速。

原生 controls 必須保留：觀看者自行暂停／拖曳只影響自己，顯示 IFrame 外的「返回全桌進度」。controller 的全桌操作明確用外部控制列提交；原生控制不自動廣播，因為 API state change 無法穩定區分原生手勢、廣告、buffer 或我們的程式控制，否則容易產生回聲。用 applyingRevision guard 阻止 adapter 執行觸發重送。

## 播放失敗、廣告與音訊協調

| 情境 | 行為 |
| --- | --- |
| 2／5／100／101／150／153 error | 分別提示輸入／HTML5／不存在或私人／禁止嵌入／來源識別；controller可換片。單端失敗不擅停全桌 |
| 地區、年齡、登入限制 | 顯示此端不能嵌入，允許自願「到YouTube觀看」但離開即失去同步；不代理或繞過 |
| 自動播放或解除靜音失敗 | needsGesture，保留個人開始按鈕；不讓controller反覆play轟炸 |
| 廣告、緩衝、不同網速 | 公共 API 不能可靠偵測每端廣告；不繞過／快轉廣告，不以廣告狀態推動全桌。延長buffer時停本機追趕，恢復後一次對齊；必要時手動返回全桌進度 |
| 背景分頁／收合播放器／播放器不足半數可見 | 本機pause，不促進隱藏背景播放；全桌繼續。回來重新加入、重取anchor並需要手勢時提示 |
| server重啟／房間被刪 | 清watch狀態、停本機、顯示已结束，不保存影片觀看紀錄 |
| 音樂與影片 | 個人加入影片時暫停本機TableMusic，保留原listen偏好；退出共看只依原偏好恢復，必要時重新手勢。不替全房修改音樂state。遊戲音效可選本機duck，不能改其他人的音量 |

client report不可信，不能把廣告／ended回報當強制換片或全桌pause依據。V1本機ended後停追趕／不自動重播，顯示「此端已播放完畢，等待控制者」，server intent可能仍為playing；控制者明確pause/replay/換片。只有V2未過期官方duration且確認適用一般VOD時，才可按server anchor至尾端自動paused；不是任一client宣告尾端。

## 分段實作與驗收

1. 實作 server store／fake clock／授權及去重測試，再接共享視窗與 IFrame adapter。模組卸載要清 iframe、SSE、listeners、timers。
2. 隔離環境以官方可嵌入測試片先驗兩真人＋第三位稍後加入。記録wall-clock offset、各端content time／buffer/blocked，不記cookie或觀看秘密。
3. 覆蓋：兩種選片URL、惡意host、同時提案、owner/host移交、非owner操作、stale revision／epoch／request重送、500ms–2秒網路延遲、斷線30秒內外、背景2分鐘、autoplay禁用、靜音失敗、不可嵌入／私人／error153、廣告期間不干預、音樂恢復、清房／restart。
4. 幾何：1280×720、1440×900、390×844、200%文字；IFrame真實CSS視窗≥200×200、無彈幕／popup覆蓋、主要控制44px、文字16/14。必要內容可捲，不能縮播放器填滿側欄。
5. 建議可接受同步目標：在三端皆ready、無廣告／buffer且RTT<500ms的VOD情境，穩態觀測差多數≤1.5秒，重大seek/重連5秒內回到門檻；報告樣本、最大值與未達條件，不稱frame-perfect。

未完成：實際IFrame試播、跨端政策驗證、正式隱私文案與shared UI整合。以上是規格，不代表已上線。
