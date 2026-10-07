# 共用房間媒體、播放清單與權限

2026-10-07，基線為正式 v1.7.2，整合候選為 v1.8.0。九項功能程式已完成，本輪完整 Windows／Linux、真正 Chrome 與正式發布驗收由主任務執行，尚待結果；不能把 scoped 回歸當成全部已驗。需求、程式位置與逐項結果見 [統一媒體進度](../UNIFIED-ROOM-MEDIA-PROGRESS.md)。第6點已確認為切歌／跳過；房主與房間管理者可控制播放，一般房員可點播。房間管理者不同於網站管理員，不提升帳戶或網站權限。

| 使用者需求 | 共用實作與驗收契約 |
| --- | --- |
| 音樂與影片只播一個 | 每房只有一個權威current；每client切換type前先停止／卸載另一種player。舊music／watch入口也不得繞過互斥。音效仍保留獨立效果音。 |
| 播放清單 | 同一queue混排上傳歌曲及YouTube；列名稱、點播人、類型。歌曲從可信MusicStore取名稱／時長；YouTube只驗ID，不代理影片，名稱可填或固定來源metadata取得。 |
| 拖曳排序 | 房主／管理者拖曳待播列，鍵盤上下移動亦可；一次送完整itemId順序、驗current revision與完整集合，不允許重複／漏項／未知ID。一般人看清單、可點播，不可改序。 |
| 扁平媒體介面與音樂進度 | 一次「媒體」開同一個可拖移／縮放非modal窗；目前播放、共用進度、控制、曲庫／網址輸入與queue直接可見，沒有再選音樂／影片的入口。共享seek／play／pause／skip由管理者操作，音量及個人退出不影響全桌。 |
| 入房影片接受選擇 | 每個room instance／seat詢問一次接受影片或暫不觀看；拒絕不建立iframe／載入Google API，之後可重新開啟。接受不是永久autoplay保證，HTMLAudio.play拒絕與YouTube onAutoplayBlocked要有可操作fallback，保持原生YouTube控制。 |
| 切歌 | 房主／管理者可skip目前項目，切下一筆；一般人不能用ended等API繞過切歌權限。音樂可信時長可在既有房間請求中惰性前進；影片時長／ended只由有權控制者明確回報，不作client進度心跳。 |
| 房間權限 | host／manager／member；host在「管理」升／降一般人，manager可操作媒體及踢一般玩家，不能踢host／同級manager或再提升別人。遊戲開始／玩法設定仍依既有host規則。role只存當前room instance，離房／踢出清除，短暫重連保留，換房不繼承。 |
| 管理按鈕顏色 | 使用同一個room-tools按鈕樣式，不作特殊高亮；管理者也看得到。 |
| 表情入口 | 只留emoji彈幕按鈕；同一popover先一般emoji，分隔線後角色表情，保留有聲角色表情、名稱／hover與可讀按鈕，不另占「角色」入口。 |

## 共用資料與API（agent實作契約）

`GET /api/room-media?code=...`：有效座位才可讀。回schemaVersion1、roomInstanceId、revision、playbackSessionId、current、queue、playback、serverNowMs、canControl、canManageQueue、isHost、isManager、myPlayerId。

item：id(UUID)、type(music/video)、title、requestedById、requestedByName，以及music的trackId／durationSec或video的videoId／可選durationSec。playback：state(playing/paused)、anchorPositionSec、anchorServerMs、rate1。既有遊戲快照附`media:{roomInstanceId,revision,hasCurrent}` marker，不額外輪詢或回報每秒播放進度。

`POST /api/room-media`：code、requestId(UUID)、roomInstanceId、playbackSessionId、expectedRevision、action。action為enqueue／play／pause／seek／skip／remove／reorder／ended／duration／stop；enqueue帶type與trackId或url及可選title，seek帶positionSec，remove帶itemId，reorder带orderIds。stale回409及state供重新確認，不覆蓋別人的新排序；同requestId同effective payload冪等，不同payload拒絕。permission直接由server有效seat與host／manager判斷，不信任payload角色。bounded queue／每人配額／rate／request cache、leave／cleanup及禁用帳戶／kicked檢查沿用。

`POST /api/room-role`：code、playerId、role(manager/member)，只host可改有效一般座位，不改自己／bot或網站帳戶；回共用遊戲snapshot。共用snapshot加`permissions:{role,canManageMedia,canManagePlayers,canPromote,isHost}`及players各`roomRole`。

permissions共用模組 `src/rooms/permissions.js` 提供 `roomRole(room,id)`、`isRoomManager(room,id)`、`canKick(room,actorId,targetId)`、`setRoomRole(room,actorId,targetId,role,activeIds)`、`pruneRoomRoles(room,activeIds)`、`permissionsView(room,id)`。manager kick先通過共用ACL，再由既有引擎執行，不修改真host身分。

## 已實作的共用邊界

每房的 `RoomMediaRegistry` 綁實際 room 物件及 UUID；六碼重用會得到全新 instance，房間刪除與 app.close 清空。媒體 current／queue／播放錨點及 `room.managerIds` 都只在房間記憶體，沿用 schema 15、既有音樂庫及音檔；沒有把房間角色寫成網站帳戶權限或完整移轉資料。

| 邊界 | 最終程式契約 |
| --- | --- |
| 權限 | 所有有效房員可 enqueue；play／pause／seek／skip／stop／reorder／remove／duration／ended 僅 host／manager。角色變更只 host，可升降其他有效真人；manager 僅踢 member，不能踢 host／同級／自己／bot。host 原有踢 bot 行為保留。 |
| 身分 | 不信任客戶端 isHost／role。有效座位來自 canonical account→seat 及未停用帳戶；leave／kick prune角色，同一有效座位暫時斷線保留，離房再加入不繼承 manager。 |
| 操作去重 | requestId 與有效 action／item／instance／session／revision 的 fingerprint 綁定；同 requestId 的其他有效內容回 409，不把 stale 排序自動重送。資料庫及持久音檔不由共用媒體同步複製。 |
| 容量 | 待播最多 50 筆，每位點播人最多 10 筆（包含 current）；accepted request cache 最多 256 筆／10 分鐘 TTL。queue 刪除離席點播與已刪歌曲；current 由共享控制或可信歌曲時長推進。 |
| 名稱與外部請求 | 歌名／時長取 MusicStore。影片 URL 只解析 HTTPS YouTube 白名單及11字 videoId；自填名稱略過 metadata。其餘名稱由固定 YouTube oEmbed endpoint 查詢，拒 redirect，最多 32 KiB／2 秒、cache 256／同時 32，失敗或停用外部副作用則用可讀 fallback。metadata await 後再驗 session／disabled、原 room 物件、seat／kicked及最新 revision／session／ACL。 |
| 結束與切歌 | 可信歌曲時長只由既有房間請求惰性推進；影片不靠週期回報。前端只在仍有權、同 current／session、playing、有有效時長且共享錨點距結束不超過 2 秒時送 ended；本機 paused／提早拖原生進度到終點／未知或超限時長不切全桌。server 仍驗 ACL、item、session、revision 及去重。 |
| 排序競態 | dragstart 凍結 generation／instance／session／revision／完整待播集合；drop 前再比較，若途中有人加歌或改序，提示重新拖曳且零舊排序 POST。鍵盤上下鍵與上下移動按鈕送完整集合，鍵盤操作完成回焦原項目。 |
| 快照重試 | 只有成功回覆才記已取得 marker；同 instance／revision 最多首取＋2次，失敗後至少 1 秒／4 秒，由既有遊戲 update 驅動，沒有網路 timer 或新增輪詢。其他4xx永久停重試（408／429除外）；明確重開或新 marker 重置預算。關窗取消該 GET，換 room／seat／instance 清理整個 generation；舊失敗不能污染新 ACK 或重試額度。 |
| 個人關閉 | 關閉自己的影片或視窗不發共享 pause／stop；同一 instance 的 current 暫時為空，再收到新影片也不擅自重新開窗，需自己重新加入。影片接受選擇、聲音／音量、window 位置／大小都是個人端。 |

舊 API 相容：第一次使用 `room-media` 時採納既有單一 music／watch 的 current、進度及影片提案；接管後，舊 `room-music`／`room-watch` POST 一律回 `409 MEDIA_API_REQUIRED`，GET 只投影同一權威 current。接管前，舊 API 的一般人只能在無其他 current 時首次點播或追加影片提案，不能用 select／replay／ended 類操作切換、重播或控制已有項目。新五款頁面只 mount TableMedia，不同時 mount 舊 TableMusic／TableWatch，也不建立舊音樂 SSE。

## 程式與測試入口

- Server：`src/media/room.js`、`src/media/youtube-title.js`、`src/rooms/permissions.js`，共用路由與 snapshot 在 `src/app.js`。
- Client：`public/shared/table-media.js`／`.css`、`room-host.js`／`.css`、`game-shell.js`／`.css`；五款 HTML 載入共用模組。
- 回歸：`tests/room-media.test.js`、`room-media-http.test.js`、`room-media-metadata.test.js`、`room-permissions.test.js`、`room-host.test.js`、`table-media.test.js`、`game-shell-media.test.js`。前端 VM 覆蓋真模組與 callback，並非 CSS 排版或真正 YouTube 跨設備證據。

## 外部政策與驗證

已讀[Chrome autoplay](https://developer.chrome.com/blog/autoplay/)、[YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)與[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)。可聽autoplay取決於gesture／origin engagement／iframe授權；入房按鈕不能承諾日後跨來源影片都可自動播放。保留onAutoplayBlocked／play Promise錯誤及原生player fallback。YouTube可見player至少200×200，沿用210px餘量、拖移／縮放／文字放大clamp；不能用隱藏或微小YouTube播放器播放音樂。拒絕／關閉自己的影片只改個人端，不停全桌。

驗收至少含雙／三席、跨五款房間、同時音樂→影片→音樂、guest點播、host提升manager／降級、越權API、拖曳與鍵盤／stale reorder、skip／ended去重、metadata失敗fallback、autoplay被擋、首次拒絕再接受、晚加入對齊進度、seek與paused、window位置／大小互不影響，以及old-room回覆不能污染新room。單一全桌current不保證每台影音零毫秒同時開始，錨點同步不新增頻繁上報。

開發保留舊API相容需明列行為；既有frontend modules不應在新五款頁面同時mount／發SSE。新版候選依release規範升minor，完成測試與實際Chrome證據後才標完成；PR依當次指示，不把新功能混入PR43。
