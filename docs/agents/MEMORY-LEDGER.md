# 共用偏好與已知決策

2026-10-07 PR46第三P2／正式1.11.1：使用者指定先修PR再繼續UI，patterns工作暫停未發布；修正較新native Pause被晚queue GET／舊visibility resume覆蓋及pending中斷settlement，保manual／mute意圖且不加poll／seek。cf64bfc PR1.9.2雙平台1,278與df983da正式1.11.1雙平台1,299、真controls與受控promise／資料核對見 [最新進度](../PR46-REVIEW-FIX-PROGRESS.md)。正式保UI／WebGL，PR尚待推送／Ready／再次請審查，未合併；研究／舊版證據保留歷史，不當所有玩法／物理切頁已驗。

2026-10-07 U44-media-height-native-publish：使用者直接要求影片填滿主區與可用高度、移除本站外開影片提示／共用seek；保留clock及canControl-only「同步我的播放進度」。原生slider／本機video或audio時間先只改自己，按publish才一次seek全桌，ticks不讀時間或seek；一般席可點播，無全桌發布權。影片底列桌機compact、手機／coarse保操作大小，toolbar不縮。YouTube原生branding／letterbox保留，縮放只自己；原生DOMRect取四欄位而不spread。正式v1.9.0實作與有限native證據見 [媒體spec](../specs/MEDIA-ICON-WINDOW-UI.md)／[進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)。

2026-10-07 U43-draw-atomic-timed-playback：使用者回報畫者閃白，要求每輪之後檢查、接收端按真點時間逐步出現且允許少量延遲，時間條平滑下降；追加移除「輪到你畫圖」「操作已完成」「猜測已送出」。正式v1.9.0採opaque staging完整才present、brush／erase optional pointTimes與有界viewer回放，artist不重播ACK；baseline操作取消尾巴，cache含stage≤8MiB、無server逐frametimer，不改權限／PR30額度／score／DB。CountdownBar保server deadline；必要錯誤／設定／重連與玩家資訊不隱藏。每輪持筆／ACK／揭曉／換畫者必查中途白底與終點完整、舊尾／草稿／frame／timer清理；單trace不代表所有裝置／自然多輪或60fps。最新證據只集中於 [進度](../DRAW-TIMED-PLAYBACK-PROGRESS.md)／[spec](../specs/DRAWING-SMOOTHNESS.md)，不抄本機私有偏好或把歷史PR事實當永久偏好。

2026-10-07 U42-playback-expression-ui：全桌與本機播放需用不同圖意；桌機控制列同一行，窄版允許換行且保持操作尺寸。角色表情卡只放圖片，名稱用共用hover/focus提示與中文aria；選單內部scroll不重定位，不透過暫時放寬高度量測而破壞scrollTop。見 [實作進度](../MEDIA-EMOJI-POLISH-PROGRESS.md)。

2026-10-07 U41-media-icon-window-ui：使用者指定操作按鈕盡量只用圖示，hover顯示功能；共享GameUI圖示與提示，保留中文可讀名稱、keyboard／touch操作，不隱藏label、正文與重要玩家資訊。媒體名稱單行省略、hover才跑馬；視窗從邊緣縮放，清單左把手排序、右側移除。追加點播與清單獨立寬視窗、單行小間隔；播放器下方只留清單入口，音樂下拉第一項文字「上傳歌曲」。最新實作與發行證據以 [spec](../specs/MEDIA-ICON-WINDOW-UI.md)／[進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)為準，不把中間候選當正式或宣稱全站button已搬完。

2026-10-07 U40-drawing-smoothness-implementation：第一批P0時間flush／有界未送buffer／rAF與coalesced、有限local-draft P1 **完成並正式v1.8.1**。source 6707a9edf07839c3307dd230ff6eeca5fa92bf62，Windows／Linux各1076，UTC03:30:44.024Z零房間guard發布。P1只有有限明確local draft且未fill才layer，完成／viewer同surfaceclassic、fill sticky至reset、單組15checkpoints＋1base≤8MiB；不變更API／codec／PR30額度。P2並行排序／P3抽稀未做，immutable ID-body／epoch／command／filled／保存契約維持。

正式v1.8.1／6707a9edf07839c3307dd230ff6eeca5fa92bf62已於UTC03:30:44.024Z零房間guard部署，PID107492→110715、service／tunnel active。Windows1076／1076／37689.229ms，Linux Node22.22.1 1076／1076／189955.125522ms，各fail/cancel/skip/todo0；本地受測tag固定，沒有新PR／push、PR43未改。schema15／21schemas／20non-session rows+BLOB與8帳戶全fields保留、integrity ok／FK0；sessions161→165為已登出的QA登入，不說sessions不變。SQLite線上備份與另時點files/env archive不是atomic cold snapshot。公開版號與5資源精確內容/no-store已驗，沒有逐項驗5資源MIME；正式3會員HTTP/SSE duplicate／nonartist400／undo-clear quota不退已驗。Chrome正式僅背景home版號；local像素／輸入證據另列，own房／auth／tabs／preview／control已清理，不改前景或偏好。

native19場景18個對fresh strict RGBA0；fill-dependent362 RGB／max13／alpha0／exactmask0，新wrapper與legacy SHA同而整體strict flag仍false。captured dense3場景均fresh0。實際1000 synthetic-move／948有效點／16chunks963含anchors兩席同JSON，但artistfresh0／viewerclassic67 RGB／max54、viewer baseCopies0／mutable0；同capture timeout20ms／warmup0及1的原classic與opt-in Infinity同樣67／max54、old/new直接diff0／SHA相同。此證據只限受測trace，不歸因layer／硬體／GPU／CPU，不寫19native全部fresh strict或所有雙席pixels相同；兩組rAF控制2秒未advance而未完成，不能列pass。工具慢線／背景970ms不作人體FPS。

來源、備份、精確scope、未驗rAF／原生取消／真收藏或其他硬體與後續提案见 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)與 [spec](../specs/DRAWING-SMOOTHNESS.md)。下方v1.8.0與更早紀錄為歷史，後續文件提交不移動受測tag；原HAR／cookies／帳密與.local偏好不提交。

2026-10-07 U39-unified-room-media：本批九項需求為音樂／影片單一current、混合播放清單列點播人及名稱、拖曳與鍵盤排序、一次展開完整媒體窗與音樂進度、每房個人影片接受／拒絕、host／manager切下一筆、host／manager／member房間角色、管理按鈕同工具配色，以及emoji與角色表情同一入口。一般席可點播，host／manager控全桌；房間manager不是網站admin，離席／踢出撤銷，短暫同seat重連保留。個人關閉／音量／位置／尺寸不更改全桌，autoplay被擋須提供個人恢復而非聲稱永久解鎖。正式v1.8.0／5687561已於台北10:24:21發布，完整Windows／Linux各1034、隔離三席真Chrome與公開API／6資源／資料驗收通過；schema15及8帳戶保留，sessions正常QA新增且已登出。沒有新PR或push，不更改PR43，本地tag固定受測程式；本批scope／200%文字、真Google拒播／oEmbed、多設備／弱網／喇叭及fixture draw重連提示限制見 [九項進度](../UNIFIED-ROOM-MEDIA-PROGRESS.md)及 [spec](../specs/UNIFIED-ROOM-MEDIA.md)。此批以host／manager權限取代U29原提案者控權的適用範圍；舊API只有相容投影，不能以它繞過新queue／transport ACL。沒有將角色寫到帳戶權限或新增DB schema。

2026-10-07 U38-pr43-clock：使用者要求處理PR新回覆。對應Stanley的舊快照補播過期音效P2，維持原PR43，修共用server anchor＋mono elapsed，保留原功能與資料。原PR v1.4.2双平台815、正式v1.7.2双平台947及隔離Chrome替身通過，公開資源／帳戶／資料驗收見 [證據](../PR43-EXPRESSION-CLOCK-FIX.md)。未合併，作畫順暢度研究仍未實作；legacy／喇叭／弱網未驗界線不可省略。

2026-10-07 U37-drawing-smoothness：使用者要求研究Gartic作畫傳送順暢原因，可實際遊玩與查GitHub。已完成官方單席Masterpiece封包、本站v1.7.1隔離雙席、真程式計數及四種開源來源研究，提出有界時間flush／未送點合併／frame合併／活動層等規格；不是Gartic內部演算法或使用者硬體診斷。實測／缺漏／未解像素差異見 [研究](../research/GARTIC-BGA-DRAWING-COMPARISON.md)，[spec](../specs/DRAWING-SMOOTHNESS.md)仍提案，沒有產品修改、PR或部署，正式保持v1.7.1。

2026-10-07 U36-expression-switch：使用者回報上傳faker後遊戲角色表情無法切換。原圖片有效；已重現雷霆same-version只改hidden共享角色列。v1.7.1／`3d82e3f`將ACK交回game callback、same-version只更新crew／state，並以共用RoomHost freshness拒舊poll覆蓋；表情仍5秒，不修改預設外觀或分享設定。原GIF隔離雙席／正式五款雙席及Windows／Linux各940通過。未收到原遊戲／房號，不宣稱觀看過原玩家操作；完整證據及界線見 [表情驗收](../CHARACTER-EXPRESSION-SWITCH-PROGRESS.md)。

2026-10-07 U35-watch-resize：使用者要求YouTube播放窗可調整大小，避免200×200限制。已在v1.7.0／`82149a4`提供右下拖曳、方向鍵／Shift及Home恢復，尺寸只記個人localStorage；保護實際player210px高、字級變動重新量測，正常resize不換iframe、不增watch請求或更改其他人。公開兩會員實播／320px／200%字級／雙欄及Windows／Linux各914通過，完整證據與未驗範圍見 [尺寸驗收](../YOUTUBE-WINDOW-RESIZE-PROGRESS.md)。這筆不改原生YouTube控件、房主本機播放按鈕或既有全桌控制者權限。

2026-10-06 最新整合：候選 **v1.4.0**、[PR #43](https://github.com/stanley021039/BGA/pull/43) 已建立，受測程式及本地tag為 `bdd77d146ef8f207c8d94c06390aefd2a857d986`。Windows／Linux完整各 **790/790**、schema15兩種舊14布局及完整移轉回歸通過；既有帳戶／音效／市場資料保留。已接main `b744464`，後續只含README／驗收文件，執行程式未變。正式仍v1.3.0，排版及整合候選尚未切換；先前PR及測試數字保留為歷史，送審狀態以PR頁及下方最新整批進度為準。

本輪 source、schema 相容性、測試及送審狀態見 [整批 PR 進度](../PARTY-PR-INTEGRATION-PROGRESS.md)。

更新：2026-10-05。以下來自使用者直接指示，與外部評論或 agent 提案分開保存。

| ID | 使用者偏好／決策 | 後續影響 |
| --- | --- | --- |
| U01 | 桌機優先，手機輔助；主要畫面盡量不用捲頁。 | 桌機至少驗正常寬螢幕與1280×720；手機／文字放大可以重排及捲動。 |
| U02 | 重要且常用資訊不能藏進管理／下拉；玩家名單比插圖重要。 | 保留角色、姓名、分數、回合狀態；雷霆剩車與骰子直接可見。 |
| U03 | 混合數字與文字對齊，橫列盡量上下置中，字體大小穩定。 | 倒數固定字槽與tabular數字，控制44px，沿用共用字級及間距。 |
| U04 | 各遊戲相同功能維持相同位置；emoji 彈幕不是角色表情。 | 共用互動區、emoji選單，角色表情原功能保留。 |
| U05 | 題庫在遊戲內dialog；浮層要跟入口、完整可見且不遮擋操作。 | 新功能要驗定位、視窗邊緣、Escape／關閉返焦與鍵盤操作。 |
| U06 | 畫具在左側，Paint風格圖示；區域填色，描邊／實心形狀各有按鈕。 | 保留可辨識SVG、填色／復原／同步與畫布座標回歸。 |
| U07 | 送禮全員送同一人，該人確認後換下一人；全員收完才總結。 | 等待提示、收禮權限及揭曉節奏不能被動效改寫。 |
| U08 | 雷霆指令不可用時disabled；地形完整名稱、hover功能、車旁動作動畫與文字。 | 圖示不能縮成單字；合法移動有外框；事件字卡閱讀3.2秒。 |
| U09 | 擲骰由指定玩家按鈕，所有人看條件與對抗，約1秒動畫。 | 不提前洩漏結果，確認才套用；四骰同樣有動畫及可辨點數。 |
| U10 | 測試使用原Chrome背景操作，不提高視窗。 | DOM操作，保留實玩截圖；需要其他席時明確記API與UI操作範圍。 |
| U11 | 最後真人離房刪房；返回連結先檢查房間與座位。 | 不把暫時房码當永久成果連結，記憶文件保存穩定證據。 |
| U12 | 本批完成後發MR，再試玩畫猜。 | PR #30已建立且未合併；後續研究另在本地分支，不能混稱既有MR的新實作。 |
| U13 | agents 研究玩家評論、動效與素材、共享YouTube、趣味成就／勝利紀錄及多環境DB轉移，保存在本地docs長期延續。 | 本輪產角色記憶、實玩評估、spec及孤立原型；後续實作需遵守文件狀態與使用者最新範圍。 |
| U14 | 畫猜開房的共編題庫要跟旁邊文字對齊；類別可多選，自定義也是一類；等待畫面的主要區域改放已入座的人。 | 開房／房間設定共用checkbox；自定義是獨立來源，不能偷偷抽未勾的內建類別。完整名單及角色優先於大幅插圖，入座更新不清掉設定草稿。 |
| U15 | 音效控制全遊戲共用，放右上角設定圖案；背景音樂與音效音量各自可調。 | 使用共用AudioSettings，保留跨遊戲偏好及個人收聽。2026-10-07最新歌曲要求已取代原僅房主選曲：正式v1.6.0同房玩家皆可選他人上傳歌曲及重播，其他transport及YouTube控權保留。兩平台896與公開兩會員實播驗收見 [共用歌曲進度](../MUSIC-SHARING-PROGRESS.md)；先前音量基線見 [共用聲音進度](../SHARED-AUDIO-PROGRESS.md)。 |
| U16 | 文字彈幕要飄過畫面，不能原地淡出；房間設定與儲存房間設定放在一起。 | 共用彈幕右向左移動；畫猜／送禮／同頻的欄位、儲存與結果提示同區。畫猜設定浮層保持名單常駐與視窗邊界。實作來源15af1dd，驗收見 [本批進度](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)。 |
| U17 | Server 資料轉移做成 AI 可操作程式；第一版選「完整移轉／備份還原」，帳戶資料也必須搬。 | 全量帳戶 UUID／原密碼 hash／role／disabled／appearance 保存，target 只撤銷 session／邀請／reset。程式c831e87 已在 Windows／Linux 隔離驗收，未實際遷移正式資料；[操作文件](../SERVER-DATA-TRANSFER.md)、[證據](../SERVER-DATA-TRANSFER-PROGRESS.md)。merge／Postgres 不在第一版。 |
| U18 | 移轉方法必須放獨立doc，可以的話提供管理員方便操作的UI。 | docs/SERVER-DATA-TRANSFER.md 是獨立指南；2618c4b 提供localhost表單、JSON預覽及預設dryrun，結果收合／對齊至31c91dd。需自行停writer、不得將管理埠公開；Windows/Linux259項及原Chrome背景完整合成表單流程通過。 |
| U19 | 先修最新 PR 的回覆，可實玩 Gartic Phone／錄 HAR 參考；可平行的工作分配 agent。 | PR #30 回覆的玩家紀錄／歷史及填色成本已修正，來源1b8c85d、兩平台各260項及背景Chrome通過；尚未部署。Gartic單席實玩已觀察填色／復原，工具無HAR匯出，未取得封包。修正已backport至移轉分支db9d0b6，保留較新的類別／聲音／房間設定。 |
| U20 | 繼續透過 computer use 錄製 HAR，並再次修 PR 提到的問題。 | 後續程式3b19720／整合e71989e補失敗開局淘汰、故障容量記帳、分批重連及安全儲存；PR兩平台279項、本地整合Windows323項通過。HAR錄製仍受U10背景偏好限制，前景確認未回覆前不能自行提高視窗；未取得封包不能宣稱Gartic協議已驗證。 |
| U21 | 為繼續測試，可以安裝 Codex 擴充功能或使用不同瀏覽器。 | 放寬 U10 的瀏覽器選擇，保留背景操作偏好。Chrome 擴充已連線，內建瀏覽器可在隱藏分頁開啟 Gartic；目前兩者未提供 CDP／HAR API。官方 Developer mode 開關已告知使用者，等待其回覆與實際能力開放，不代表已取得 HAR 或允許提高視窗。 |
| U22 | 直接用 Computer Use 開啟上述完整 CDP 存取權限。 | 已依明確指示透過 Codex 設定 UI 開啟；重新建立 CUA 工作階段後，官方 tab `cdp` capability 出現且 `Network.enable` 成功。隱藏內建瀏覽器已完成單席 Gartic Masterpiece 畫筆、區域／全畫布填色、undo／redo及相簿，原始紀錄保存在 ignored work；有效作畫採樣區間無 truncated，早期載入／進房有缺漏標記，詳 [網路參考](../research/GARTIC-NETWORK-REFERENCE.md)。這筆取代 U21 的設定等待狀態；背景測試偏好保留。 |
| U23 | 猜題者畫布蓋到資訊列時，維持畫布大小，把被蓋住的元件隱藏即可。 | 作畫期間猜題者隱藏標題、題材／字數及倒數列，容器依畫布自然高度排列；玩家名單仍顯示，畫者與選題／揭曉資訊列保留。這是該列的明確例外，不是普遍隱藏玩家資訊的授權。背景本地驗收見 PROGRAMMER 的「猜題者畫布排版」。 |
| U24 | 確認 PR 問題都修整後發出 PR。 | PR #30 四項回覆已獨立複查，接續分支保留後續遊戲與移轉修改；另補舊 schema 還原問題，程式 `6e655de` 完整 Windows／Linux 各335項通過。送審狀態見 [最新進度](../SERVER-DATA-TRANSFER-PROGRESS.md#送審前最終複查)；發 PR 不代表授權合併或正式部署。 |
| U25 | 將別的站點資料匯入目前站點，提供管理者 UI 並自行測試。 | 沿用 U17 完整移轉／備份還原；`47d79c7` 提供 localhost 選檔／本機路徑、驗證、預演及建立新目錄，原帳戶／密碼保留，未做雙站合併。原 Chrome 背景操作與合成資料隔離驗收見 [最新證據](../SERVER-DATA-TRANSFER-PROGRESS.md#管理者匯入流程與背景-chrome-驗收)。沒有收到實際來源備份，不得把 fixture 成功當成正式資料已匯入或服務已切換。 |
| U26 | 先發 PR，再繼續新動效／共用動畫規則、畫猜等待／離線提示及跨輪回看／收藏。 | 移轉 PR #31 已確認送審；新功能在 feat/draw-review-motion、程式 93d7a84，Windows／Linux 各402項及背景 Chrome 驗收，見 [進度](../DRAW-REVIEW-MOTION-PROGRESS.md)。八輪快照是目前房間內記憶體資料，不是永久賽果；未部署。 |
| U27 | 是否已猜對可在角色卡放 icon 或高亮。 | 已猜中卡用共用 SVG 勾章＋淺綠底／邊框，保留文字及離線狀態，不只依顏色；換輪立即清除，不為標記增加循環動畫或改角色表情。與 U26 同批驗收。 |
| U28 | 畫猜每輪結束有禁止按鈕，房內超過一半的人按下才把題目從題庫移除。 | 實作採揭曉當下固定房員及嚴格過半門檻，每人一票，可從最近八輪補投；通過後全站停用內建／共編同題，保留作品與得分。詳細規則及實際完成狀態見 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)，未部署。 |
| U29 | YouTube 共看開始實作但先不要 PR；最低伺服器負擔優先，其他玩家可自由關閉自己的影片，例如只有房主操作時間軸才送進度；參考網路做法。 | 本地 feat/youtube-watch，不推送／不更新既有 PR。沿用遊戲 state 版本標記，開啟且版本變動才取快照、明確操作才送命令；沒有獨立共看輪詢／心跳或進度回報，關閉不改全桌。驗收狀態見 [共看進度](../YOUTUBE-WATCH-PROGRESS.md)，取代舊 spec 的高頻同步提案。 |
| U30 | 影片跟播放音樂做在一起，各client自行調影片位置；移除移動按鈕，像視窗直接拖曳最上方tool bar。 | `631eabf`同一媒體入口、非modal浮窗；拖曳工具列／方向鍵／重設只寫個人localStorage，不回報server。控權仍依U29，兩client位置及個人退出互不影響。 |
| U31 | 測試時使用者看到頁面集中左上角，要求修正。 | 因agent臨時viewport尺寸模擬未即時還原；已對兩個owned tabs清除。後續尺寸測完立即reset每個tab並查實際viewport，不等整輪測完、不改正式CSS來掩蓋測試設定。背景測試偏好仍有效。 |
| U32 | 非房主隱藏「在這裡開始播放」。 | `400cb6d` 以快照 isHost 判斷顯示及 handler，未知身分預設隱藏；觀看者自動播放阻擋提示改指向 YouTube 原生播放按鈕。Windows 共看前端52項及兩個背景 Chrome 帳號驗收通過，未push／PR／部署；其他共看控制權仍依U29。 |
| U33 | 先發PR，再做可改名、meme及約1000畫猜題、多格移動避障預覽、成人禮物、入大廳過場；彈幕框／收藏／上傳先評估，這六項先不PR。 | 前批已發PR#36（2eeb398，接續#34），取代U29/U32未PR狀態。新六項在本地feat/party-content-and-race-paths：前五項已實作及背景Chrome受控驗收，框評估獨立spec；測試／source／限制见 [進度](../PARTY-UPGRADE-PROGRESS.md)。新功能未push／PR／部署。改名為暱稱；成人風格未回覆，採曖昧惡搞＋夜生活、房主opt-in預設關。 |

| U29-market | 股市冥燈沿用 BGA 每日預測及既有帳號，在隔離 checkout 整合；授權 Issue #37、Draft PR #38，並修正與推送同一 PR 的審查問題及必要main相容整合。 | 六區間、0%和局、+5／−1均勻隨機選擇期望0；管理者手動建立日及收盤結算。schema14保留main #34功能與兩種舊13，Windows463項及整合版背景Chrome已驗，見 [整合接手](../MARKET-JINX-MAIN-INTEGRATION.md)。保持Draft、不合併#38或部署、不操作原始工作目錄或正式資料；發PR或修正授權不代表正式上線。 |
| U34-pr-all | 全部已完成的本地改動一起發一筆 PR。 | 包含改名、迷因題庫、雷霆多格移動及位移事件時序、成人禮物、已完成過場與音效、版本管理及送禮排版修正；尚在提案的彈幕框／第二批聲音候選維持提案狀態。取代 U33 先不 PR 的本批限制，沒有授權合併或中斷現有正式房間；本輪 PR／驗收狀態以 [整批進度](../PARTY-PR-INTEGRATION-PROGRESS.md) 為準。 |

U20 後續驗收補充：最新 PR 追蹤回覆另有「同房重開第 1 輪沿用舊配額」，已由 `e60f853`／本地整合 `7c25c7b` 以 canvasEpoch 修正，舊 POST／ACK／SSE／snapshot／儲存等待均隔離。PR Windows／Linux各286項、本地整合Windows330項及背景新局填色通過；PR已推送至文件提交 `7f44f20`，未部署。證據見 [修正文件](../PR30-RESOURCE-LIMITS.md)。此筆取代「只補歷史與冷恢復即涵蓋全部追蹤回覆」的理解。

已驗收程式基線：公開站來源 `9f041d3`；PR #30 包含後續文件提交 `0aa6c75`。這是本輪的歷史基線，未來不能不查核就當作目前正式版本。完整前輪驗收見 [桌機進度](../DESKTOP-DESIGN-PROGRESS.md) 與 [畫猜三人試玩](../DRAW-GUESS-PLAYTEST.md)。

本輪開始時的程式缺口：`src/achievements/store.js` 只有送禮、同頻、撲克、雷霆四款入門徽章及共用第一桌，沒有畫猜入門徽章，沒有持久勝場總計；此項由本輪成就 spec 提案，不表示已修正。
