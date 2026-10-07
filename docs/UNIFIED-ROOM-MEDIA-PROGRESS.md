# 統一房間媒體與房間角色進度

日期：2026-10-07。基線正式 v1.7.2；本批候選 v1.8.0。九項需求的共用程式已完成，完整 Windows／Linux、真正 Chrome 與正式發布驗收由主任務執行，目前待結果；尚未以這份文件宣稱部署成功。規格見 [共用媒體契約](specs/UNIFIED-ROOM-MEDIA.md)，外部播放政策的研究與未驗範圍見 [政策查核](research/ROOM-MEDIA-AUTOPLAY-POLICY.md)。

## 九項需求對照

| # | 需求 | 已完成程式行為 | 驗證與狀態 |
| --- | --- | --- | --- |
| 1 | 音樂與影片只能同時播一個 | 每房只有一個 current；切換類型先停止 Audio 或卸載 YouTube，player epoch 防止舊 play Promise／ready callback 回播。舊 API 接管後只能讀同一 current。 | Node／真前端 VM 回歸已涵蓋；真正 Chrome 雙席音樂→影片→音樂及正式站待驗。 |
| 2 | 同一播放清單列名稱、點播人與類型 | MusicStore 提供歌曲可信名稱／時長；YouTube 可填名稱或有界 metadata fallback；混排待播列显示名稱、點播人及歌曲／影片。 | 回歸涵蓋來源名稱、混排與配額；實際外部名稱、長名稱排版與雙席同步待驗。 |
| 3 | 播放清單可拖曳排序 | host／manager 可拖、鍵盤上下及按鈕移動；一次送完整待播集合，current 不加入待播排序。dragstart 凍結版本與集合，途中清單改變提示重拖，不將舊意圖套在新清單。 | 真模組 VM stale drop／完整順序／權限回歸通過；真正拖曳、鍵盤返焦及另一席觀察待驗。 |
| 4 | 點媒體直接顯示一個完整視窗與音樂進度 | 一次開啟可拖移／縮放的非 modal 浮窗，current、進度、操作、歌庫、URL及queue直接可見；位置／尺寸只存个人 `bga.media.window.v1`／`bga.media.size.v1`。 | VM 保留 player／零尺寸網路操作已涵蓋；桌機、窄屏、200%字級與遊戲重要資訊不被遮住待真 Chrome 驗。 |
| 5 | 入房詢問接受影片或暫不觀看 | 每個 room instance／seat 詢問一次；拒絕不建 iframe／載 Google API，之後可重新接受。保留 autoplay blocked 提示、原生控制與本機播放入口。 | VM 拒絕、後續加入、現有 modal／hidden、個人關閉及idle後新片不自開已涵蓋；實際瀏覽器拒播／恢復待驗。 |
| 6 | 房主／管理者可切下一筆 | skip 改 current／session；可信歌曲可由既有請求按時長惰性推進。前端 ended 只在有權且共享 playing／有效時長接近結束時送，不以本機提前拖到終點切全桌。 | Node ACL／session／去重及VM paused／早到／未知／超限時長回歸已涵蓋；實播與切歌雙席待驗。 |
| 7 | host／manager／member 房間權限 | host 在管理升降其他真人；manager 可控媒體、踢一般真人，不能升人或踢 host／同級／自己／bot。角色只在當前 room 記憶體，leave／kick清除，有效 seat 的短暫重連保留。 | helper＋HTTP＋真RoomHost VM 已涵蓋；三席實際升降／踢人／重连及各遊戲重要控件待驗。 |
| 8 | 管理按鈕和其他工具同色 | 管理／離房及共用媒體工具沿用中性 surface／text／border tokens，管理不是高亮主操作；manager 也有管理入口。 | 程式已接共用樣式；實際五款配色、hidden／pending及窄屏待驗。 |
| 9 | 表情集中在同一 emoji 彈幕入口 | 同 popover 先一般 emoji，分隔線後有名稱與 hover 的角色表情；保留原 social kind 與有聲表情，不另占角色工具。 | 真GameShell VM已驗一般emoji／角色payload與單一入口；實際popovers定位、圖示、音效與五款操作待驗。 |

## 共用實作

| 區域 | 程式 | 核心契約 |
| --- | --- | --- |
| 權威媒體 | `src/media/room.js` | 單一 current＋混合 queue＋server anchor；UUID instance／session、revision及request fingerprint。待播50、每人含current10、request cache256／TTL10分鐘；registry綁room物件，六碼重用不繼承。 |
| 影片名稱 | `src/media/youtube-title.js` | 固定 YouTube oEmbed URL、11字ID、拒redirect；32 KiB／2秒、cache256／pending32；失敗或外部副作用停用fallback，自填名稱略過查詢。 |
| 角色 ACL | `src/rooms/permissions.js` | 六個共用helpers、non-enumerable `room.managerIds` Set，不寫 users 角色。有效active seat／bot／kicked防護；host即時由room.host判定。 |
| 共用路由 | `src/app.js` | room-media／room-role、canonical membership及snapshot permissions／player.roomRole／media marker；metadata await 後重新驗身份與原room，再act重驗revision；legacy gate／delete／leave／kick清理。 |
| 媒體前端 | `public/shared/table-media.js`／`.css` | 一個 window、混合 queue、個人接受／退出、原生 fallback／Player生命週期、拖移／縮放、stale drag與有界GET重試；既有update帶marker，沒有每秒進度POST或獨立網路poll。 |
| 管理前端 | `public/shared/room-host.js`／`.css` | 同一管理modal、角色標示、升降與kick；pending互斥、原生modal／返焦／44px、snapshot freshness與目前遊戲callback，舊room/seat/instance ACK不覆蓋新畫面。 |
| 遊戲接線 | 五款HTML、`public/shared/game-shell.js`／`.css` | 只mount/update TableMedia，斷線／離頁cleanup；同emoji popover合併兩類social入口，不修改角色表情所有權或效果音模組。 |

schema 仍為 15；曲庫metadata與原音檔仍沿用既有保存／移轉。current、queue、角色、影片接受選擇與window設定不納入跨站帳戶搬移或房間續局。房間manager不等於網站管理員；原有遊戲開始／玩法設定依host規則。管理與一般玩家都能點播，只有host／manager能控制或排序。

## 舊 API 與網路負擔

第一次讀取／操作 room-media 採納舊music／watch的單一current、paused／position與影片提案。接管後舊兩種POST均回 `409 MEDIA_API_REQUIRED`，GET只提供同一權威current的投影；接管前也拒一般席以舊transport替換／重播已有項目。新版五款不mount舊media模組或音樂SSE；舊客戶端相容路由保留，不表示舊頁面具有新版完整queue體驗。

客戶端從既有遊戲state的 `{roomInstanceId,revision,hasCurrent}` marker取快照；明確操作才POST，localTimeline／大小／位置／音量沒有每秒上報。YouTube duration／ended為有權角色的有限通知，前端按current／session／revision去重，server再檢查ACL／item／revision。

獨立複核先重現一次GET503後同marker永久卡死，現已改為首取＋2次、失敗後至少1秒／4秒的update-driven重試；成功後穩態不GET，401／403／404等永久停重試（408／429可有界重試）。manual open／新marker重置預算，關窗取消該GET；晚到失敗不能覆蓋較新command ACK或新room預算。沒有為重試新增網路timer。

## 當前驗證證據

| 驗證 | 結果／限制 |
| --- | --- |
| 房間ACL／管理UI及原遊戲回歸 | 子任務Windows Node24.14.0 focused88/88、0fail／cancel／skip，165.5234ms；log `work/room-permissions-ui-focused.log`。涵蓋角色helper、真RoomHost及五款callback、kick／lifecycle、social freshness與race presentation；不是CSS或跨設備驗收。 |
| 最後前端獨立複核 | `node --test tests/table-media.test.js tests/game-shell-media.test.js` 34/34、0fail／cancel／skip／todo，478.6373ms。實際模組VM覆蓋GET重試／永久錯誤／晚ACK、paused／提早ended／未知或超限時長、frozen drag／keyboard、個人關閉／consent、播放類型互斥及單一GameShell入口。 |
| 本批 Windows 完整 | 待主任務執行／填寫本批結果，不沿用v1.7.2的947项。 |
| 本批 Linux 完整 | 待主任務從受測source執行／填寫。 |
| 真正 Chrome | 待主任務填寫房主／manager／member、跨五款、實際影音／排序／接受與個人關閉、尺寸／字級／popover結果；VM播放替身不代表實際Google或喇叭效果。 |
| 正式發布 | 待主任務填寫受測commit／不可覆寫tag、備份與副本预演、切換房間狀態、公開版本／資源、帳戶與schema／rows／BLOB保存、QA清理。未預填成功。 |

focused證據只對當時working tree與所列模組成立，送審／部署前仍以受測commit及完整驗收為準。YouTube接受不保證可聽autoplay或每部影片可嵌入；影片與歌曲直接由各client載入，同一server anchor不承諾逐幀零延遲同步。已沿用個人音效設定，沒有本批真人多設備／弱網／喇叭聽感證據。
