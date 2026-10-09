# 玩家 agent 長期記憶

2026-10-09 #59 候選：採 P1–P8 設計六幕輪替領隊、每席參與、公開風險、失敗仍推進、跨幕手記；沒有淘汰、XP 或個人排名。Windows 1,932 與隔離工具六幕／歷史證明流程，不能當真人樂趣評分。六真人等待、專長平衡與一篇故事的重玩性待驗；來源及日期見 [驗收](../TRPG-FIRST-EDITION-PROGRESS.md)。未部署。

## 2026-10-08：首批 round 成就的公平性與驗證範圍

2026-10-08 正式驗收：v1.16.0／固定 source 8a9cbfd，Windows 與 Linux 各1,518項通過；三款正式正常回合解鎖、18筆 own 新徽章／3 receipt／9探索 rows，以及背景 Chrome 高亮／日期／桌機手機／鍵盤通過。9帳號全欄位、13市場圖片與舊16徽章保留，own房與登入／分頁／代理已清理。卡片可見解鎖字樣已移除，读屏狀態保留；畫猜局內合併提示、永久勝場及跨程序outbox尚待。此筆取代本批候選待驗狀態，不宣稱真人訪談、完整讀屏或全瀏覽器；詳細範圍見成就單位進度。


本次相容修正：保留資料庫帳號 ID 原始大小寫，包含合法大寫 UUID 的匯入帳號；去重仍辨識大小寫變體。卡片依最新使用者指示改為高亮區分取得狀態，可見解鎖文字移除，讀屏狀態與日期保留。

本批已完成三引擎與 store source／fixture 驗證，正式版本、完整測試、背景原生試玩與部署由主流程記在 [成就單位進度](../ACHIEVEMENTS-UNIT-PROGRESS.md)；本節不宣稱已上線或真人評測完成。沿用 [成就與戰績 spec](../specs/ACHIEVEMENTS-AND-RECORDS.md) 的中性門檻：記住有效參與與自然巧合，不設 XP、每日重置、連勝任務或要求朋友配合。既有五枚徽章及取得日期保留，單輪徽章與永久獲勝紀錄是不同工作。

| 遊戲／候選 | 已實作的判定與反誘因界線 |
| --- | --- |
| 畫猜初登場／靈魂畫手，有人懂／字幕組準時上班 | 入門需至少一次 server 接受的 stroke 或 guess 且該輪正常揭曉；錯猜也能有效參與。畫手需本人合法作畫且至少另一帳號合法猜中，猜中徽章不額外要求速度／全桌答對。clear／undo 不抹掉已接受證據，但點工具、觀看或保活不算操作。 |
| 心意撞車、願望清單有回音 | 只授收禮者：正式收禮的同 gift ID 至少兩份，或有 great／good／ok 正向心願；同名不同 ID 不算 twins，noWay／unranked 不算心願。等全部收禮確認後正式結算，不從動畫授獎，也不新增「請大家送同款」桌上目標或低分羞辱徽章。 |
| 同頻不用 Wi-Fi、訊號撞成平手 | 至少三名官方有效參與者全作答且同一正式組；或至少兩個並列最大組、每組至少兩人，授有效作答者。填空 review／合併預覽不提前授，withdraw／kick／missing 答案不算；保留原本平手不得分規則，不標示「就差誰」或鼓勵故意離群。 |
| 第一桌、跨桌搬零食 | 有本人核心操作的正常有效單位才能累積；`all-two-tables` 需兩種不同遊戲，不要求贏、不按天重置，不用單純登入／點圖示累積。舊第一桌門檻與取得日期保留，不另發相同條件的第二枚。 |

本批以整局 `match_id` 和每輪 `unit_event_id` UUID 綁定不可變帳號映射，完成時只保留必要事實，不把題目、猜測、喜好或手牌寫入成就記錄。離房不能用現在名單抹掉此前合法完成的 draw 證據；artist 離房／斷線造成的中斷輪不授，但此前正常輪仍保留。送禮 delivering 中移除玩家為 interrupted，玩家不足為 abandoned。開始的身分映射不足也使該成就單位中斷，遊戲仍照原規則結算；不能以同名、晚加入的帳號或外站 history 補資格。

已驗 engine 新 **34**、store 新 **17**，連同既有三引擎 **32** 共 focused **83/83**。含合法／拒絕操作、重送、跨 clear／undo、離席與等待下輪、全部收禮確認、同名不同禮物、負向／未排名心願、正式合併與平手、跨局 UUID 與待儲存上限；三遊戲的 mapping 故障以 in-memory SQLite 驗證可持久確認且 0 award／0 progress。這是程式與 fixture 證據，不能當成人工真人桌／讀屏／弱網／全 phase 的完成驗收。

**B03 永久勝場、完整對局結果 ledger 與 durable outbox 仍未完成**，不能把 `all-two-tables` 進度說成勝利／勝率統計。已寫入 receipt 的重送可去重，但未落庫事件仍在 RAM，崩潰會失去待重試資料；需後續持久 outbox 與權威結果 reconciliation。既有或外站 archive 僅作唯讀參考，不憑暱稱重建徽章／獲勝事實。後續玩家驗收先看公平資格、原規則與隱私，再看提示是否干擾桌上操作，完整證據集中於本批進度。

2026-10-08最新正式 **v1.15.0／f4cbdfa**：彈幕框Stage A發布，雙平台完整各1,432、公開25資源與五款三席frame/avatars通過。PNG上傳收藏／成就與勝場ledger仍缺；完整source/首輪Linux暫存I/O失敗與重跑/備份/native scope/9帳戶及21non-session表保留/own cleanup見 [最終進度](../BARRAGE-FRAMES-PROGRESS.md)與 [backlog](../SPEC-BACKLOG.md)。下方候選及1.14.2是歷史；tag固定受測程式，沒有新PR/push，不把有限取樣當全phase/讀屏/200%/FPS。

2026-10-08彈幕框候選 **v1.15.0／f4cbdfa**：三席真送長/短text各款、接收關框仍保文字；五款等待畫面重要玩家区和44px圖示入口保留。16字名/40字/4則是隔離壓力fixture，不能說是四真人桌實玩。畫猜持筆18次sample墨跡累增、ACK與viewer1517、自然換輪reset0，僅此軌跡不推定每影格/全phase/全硬體。完整證據与StageB上傳收藏／成就ledger缺口見 [進度](../BARRAGE-FRAMES-PROGRESS.md)／[backlog](../SPEC-BACKLOG.md)。

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07 patterns部分實玩：own雙人撲克正常fold真的解鎖第一手牌／第一桌，持久inline仍讀得到，通知旁GL有像素且最終notify／queue／timer／celebration0。收藏／市場Arrow不發request或換panel直到Enter／Space；invalid首name與Escape返焦已驗。Audio Play尚ready0、離tab後pause不算完整解碼／可聽；glyph倍增不算browser200%，Tab到body／chrome邊界不算fulltrap。有限證據與新Arrow／成就排序修正待驗見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，patterns1.12尚未全套／發布。

2026-10-07五庫模式新批驗收方向：manual tabs箭頭只focus、Enter／Space才選，表單有可定位inline錯誤，dialog可取消／返焦且busy不失守；通知不遮或取代重要玩家／車／骰／聊天室。hidden保通知正文但取消粒子，不因初次載入或舊badge慶祝。收藏／市場、五遊戲與原畫猜防閃皆需真keyboard／小屏／200%回歸，見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)；本批實作中，不能把前次1.11.1證據當新批通過。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

## 2026-10-07：正式v1.11.0驗收

PR46清除／撤銷途中要看舊完整圖、提交後新圖與舊job不覆蓋；12真Canvas2D組合已驗，第二輪6move／30artist樣本白afterink0、viewer7partial，第一輪錯誤取樣排除。切回背景音樂只恢復此次hidden自動pause，玩家手動pause／關音樂不能被恢復蓋過；真Audio同節點恢復／零新增room-media request已驗，但無聲檔／FocusEmulation不是喇叭或實體切頁。市場每日／圖片投稿／審核空庫入口已smoke，未真上傳→審核完整native流程。有限scope與正式雙平台1,284見 [最新進度](../PR46-REVIEW-FIX-PROGRESS.md)；下方版本保留歷史，不宣稱全玩法或FPS。

## 2026-10-07：正式v1.10.0美化驗收

美化先保玩家／角色／猜中／車隊／骰子／合法格，不收合到管理；看選取、長名／浮窗／小屏可達，不只看顏色。本輪畫猜23持筆樣本白afterink0、viewer7次partial／13timed points；晚一筆同SHA是下輪白baseline，不能當有墨終點一致。雷霆真draw／idle／loss有有限證據，兩anchor位置不證明全程FPS；實際新效果畫出才遮同類裝飾，不遮標字或操作。四遊戲尺寸矩陣／720補驗及限制見 [本批進度](../UI-POLISH-WEBGL-PROGRESS.md)，全部phase／多輪／其他硬體與前景性能未驗。下方v1.9.0持筆／ACK／換輪的持續檢查規則保持。

2026-10-07最新a2c5589原型API：fresh最後Pause守住、最後Play保time37，正常hide／show同Audio恢復；proxy總media4／5各不變（GET3／4與POST1各不變），兩平台1,300與focused126／peer通過，own QA已清。沒有pointer／key或實體喇叭，fresh約3.6ms transient不稱零瞬間，舊~1ms是另case。已推送4604dce、更新描述與 [最終回覆](https://github.com/stanley021039/BGA/pull/46#issuecomment-6038913529)、Ready（draft=false）並再次請Stanley審查，未合併、正式1.11.1不變／patterns另於main整合未發布，scope見 [進度](../PR46-REVIEW-FIX-PROGRESS.md)。

2026-10-07 PR46第三P2已驗：真UA controls Play→Pause後，latequeue GET仍同Audio／paused true、requests8→8；visibility自動resume不能蓋較新Pause或個人靜音。pending heldbytes原生AbortError可只retry自己的中斷，但HAVE_NOTHING0／受控visibility不是端到端METADATA1或實體切頁；release後自然end換影片，不說同clip持續。正式1.11.1已發布，PR1.9.2已推送、標 Ready 並再次請 Stanley 審查，未合併，完整scope與dual-source測試見 [最新進度](../PR46-REVIEW-FIX-PROGRESS.md)。不宣稱所有硬體／喇叭／FPS，patterns暫停。

## 2026-10-07：正式v1.9.0驗收規則

使用者要求每輪結束都檢查：本人持筆／up／ACK不閃、其他人按真點時間逐步看到、揭曉完整圖／換畫者新epoch不殘留舊尾或草稿，queue／frame／timer清理。合法clear／新輪空圖與非預期白底分開；短trace、終點像素一致不等所有輪或另一台電腦改善，不寫60fps。倒數須連續下降而秒數仍按server deadline。三項重複成功文字已移除，但畫者身份、猜測聊天室／得分、設定／錯誤／重連仍可讀。見 [本輪進度](../DRAW-TIMED-PLAYBACK-PROGRESS.md)／[spec](../specs/DRAWING-SMOOTHNESS.md)。

媒體本機原生控制先只改自己，host／manager再按「同步我的播放進度」才同步全桌；一般席可點播但看不到publish，也不能全桌控制。影片預設占可用高度、縮放只自己；原生YouTube branding與letterbox仍可見。媒體驗收與限制見 [進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)。

## 2026-10-07：作畫改善第一批（正式v1.8.1，有限P1）

正式v1.8.1／6707a9edf07839c3307dd230ff6eeca5fa92bf62已於UTC03:30:44.024Z零房間guard部署，PID107492→110715、service／tunnel active。Windows1076／1076／37689.229ms，Linux Node22.22.1 1076／1076／189955.125522ms，各fail/cancel/skip/todo0；本地受測tag固定，沒有新PR／push、PR43未改。schema15／21schemas／20non-session rows+BLOB與8帳戶全fields保留、integrity ok／FK0；sessions161→165為已登出的QA登入，不說sessions不變。SQLite線上備份與另時點files/env archive不是atomic cold snapshot。公開版號與5資源精確內容/no-store已驗，沒有逐項驗5資源MIME；正式3會員HTTP/SSE duplicate／nonartist400／undo-clear quota不退已驗。Chrome正式僅背景home版號；local像素／輸入證據另列，own房／auth／tabs／preview／control已清理，不改前景或偏好。

驗收分開看本人跟手、持筆時他人何時看到、慢網pending是否有界、放開／undo／clear／收藏是否保留原意。P0少量點也定時排送，pointerup尾點與cancel已有內容安全收尾；本機未確認draft才layer，完成／viewer同surface classic、任意fill後保守classic至reset。API／作品codec／PR30點數及fill額度不变，不用任意並行POST或抽稀換速度；P2／P3未做。

同native25點慢trace原v1.8.0持筆viewer0，新版未up已24chunks，3點持筆也先见2chunks；25點up後兩席25chunks／49含anchor／ink1603／fresh0diff。1000 synthetic moves單task僅一次preview和16批／1015含anchor點，另一clean case去重948點／963含anchor；兩case不能混算。背景等待970ms、工具約1秒／move都不是人體FPS或使用者另一台裝置延遲。

native19場景18個對fresh strict RGBA0；fill-dependent362 RGB／max13／alpha0／exactmask0，新wrapper與legacy SHA同而整體strict flag仍false。captured dense3場景均fresh0。實際1000 synthetic-move／948有效點／16chunks963含anchors兩席同JSON，但artistfresh0／viewerclassic67 RGB／max54、viewer baseCopies0／mutable0；同capture timeout20ms／warmup0及1的原classic與opt-in Infinity同樣67／max54、old/new直接diff0／SHA相同。此證據只限受測trace，不歸因layer／硬體／GPU／CPU，不寫19native全部fresh strict或所有雙席pixels相同；兩組rAF控制2秒未advance而未完成，不能列pass。工具慢線／背景970ms不作人體FPS。

完成指的是已驗的有限P0／P1及正式發布，不代表所有classic像素差已消除、所有遊戲FPS提升或所有硬體相同；不得因一台隔離電腦資料判定使用者電腦故障。Chrome公開版號畫面不等於正式多人原生作畫；本次正式未寫真收藏／studioPNG，OS原生cancel未實際觸發。來源、備份、精確scope、未驗rAF／原生取消／真收藏或其他硬體與後續提案见 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)與 [spec](../specs/DRAWING-SMOOTHNESS.md)。下方v1.8.0與更早紀錄為歷史，後續文件提交不移動受測tag；原HAR／cookies／帳密與.local偏好不提交。

## 2026-10-07：統一媒體的玩家驗收規則（正式 v1.8.0）

媒體視窗應一次可看目前項目、共享進度、待播名稱／類型／點播人及點播入口；影片和音樂只一個current，不能還有另一個player在背景唱。房主／管理者可控制、排序或切下一筆，一般人可點播但不能借原生ended／舊select重播去切全桌；重要玩家與遊戲資訊保持可見，角色分級在管理顯示，不以網站admin名稱混淆。

影片接受與拒絕是這個room instance／seat的個人選擇。拒絕不載Google播放器；接受仍可能被瀏覽器policy或影片禁止嵌入阻擋，要能用本機／原生控制恢復。關自己的影片不停止別人，也不能因全桌先停止再換片而擅自重新打開。個人音量、位置與尺寸不改全桌；拖曳途中別人加歌時要提示重拖，不能靜默替玩家接受新排序。清單鍵盤移動完成應回焦原項目，管理modal有角色文字及可讀升降／踢人按鈕，管理工具不作高亮主操作。

本批以隔離host／manager／member三席Chrome實際驗音樂雙席、YouTube原生時間前進、音樂→影片→音樂互斥、拒絕後加入、關自己的影片、drag及keyboard排序與角色升／撤；五款有同一媒體及emoji入口。最後source390×844自然直列gap12、無水平溢出，1280×720 window900×620在viewport內。Windows／Linux各1034，台北10:24:21正式v1.8.0／5687561公開API權限及資料保存通過；公開三會員API不等於公開真人三席影音實播。

實播歌曲為合成靜音MP3，一次兩client進度相近不能承諾持續逐幀同步；沒有真人樂趣評分、實體多設備／弱網／喇叭聽感、真Google autoplay拒絕或oEmbed成功，本批200%字級與極長名稱亦未真驗。fixture反覆導航見draw重連提示，轉接舊SSE未取消可能影響，不據此判定正式遊戲故障。自己的preview／三tab已停，viewport已還原；完整證據、來源與玩家邊界見 [進度](../UNIFIED-ROOM-MEDIA-PROGRESS.md)。

2026-10-07畫畫順暢度實玩研究：Chrome官方Gartic單席Masterpiece已持筆送更新，本站v1.7.1隔離雙席25點持筆觀看者仍空白、放開後收到；這是觀看者等待的重現，不能當本人掉幀或真人樂趣評分。評估作畫時分開「筆是否跟手」、「別人多久看到」、「放開／復原是否等待」、「弱網／換輪後畫作是否一致」。研究未取得使用者另一台裝置、Gartic多人觀看延遲或公平FPS。真條件與未解像素差異見 [對照](../research/GARTIC-BGA-DRAWING-COMPARISON.md)；[改善spec](../specs/DRAWING-SMOOTHNESS.md)仍提案，產品保持v1.7.1。

2026-10-07畫猜正式v1.5.1：玩家角色、分數及猜中／離線狀態常駐左側，不能為插圖或簡化操作藏進管理。猜題紀錄在畫布下方逐行「名字：內容」，輸入框在最下方；猜對提示不公開答案，右侧不再重複摘要。常駐的玩法說明移除，規則從遊戲說明讀取；結算以排名與最後畫作利用空間。實測桌機8席／3席、畫者及猜題者、320／390手機與猜對／錯猜；1920×1080八席結算無頁面捲動，小高度名單仍可自身捲動。Windows／Linux各845及公開3席驗收完成；所有背景分頁與尺寸覆寫已清理。詳 [進度與實證](../DRAW-DESKTOP-LAYOUT-PROGRESS.md)。

## U33：操作與內容擴充（2026-10-05）

背景Chrome兩帳號／三合成席位已驗：設定改暱稱後另一玩家名單同步；meme-only保存及三張題卡；成人開關由房主控制、guest可看摘要。題庫1000中有100meme，50為本站原創情境，不能聲稱都是既有爆紅梗；不同朋友群熟悉度仍待真人校準，可沿用禁題投票。成人50採曖昧惡搞／約會／夜生活，預設不混入。

雷霆可先單步，再選遠格連走；實際五步避開未知危險、一次POST。預覽不是保證，揭露危險或檢定會停，玩家須依新資訊再選路。名單／骰子／車況仍可見。框收藏尚為評估，建議PNG模板及個人隱藏開關；不能把客製裝飾變成讀不清文字的代價。完整證據與限制见 [整合進度](../PARTY-UPGRADE-PROGRESS.md)，這不是三位真人的樂趣評分；本批未PR／部署。前批YouTube已發PR#36。

## 最新：可選共看驗收（2026-10-05）

本地 `631eabf`將影片與音樂放同一媒體入口；每人自行加入／關閉、拖曳影片頂端toolbar調位置。浮窗非modal，遊戲及名單不改成隱藏選單；原生暫停／音量／拖曳影片只改自己，明確「全桌」操作才同步。自己的buffer／失敗不能拖停所有人，分頁隱藏不繼續背景播放；需要時自願重加入。

已實測Chrome兩個登入身分及三席HTTP：觀眾跳到遠端240秒附近（clock4:15、video255.14）、選片控權移交及房主接管、個人退出不發命令，五款媒體入口一致。1280×720及390×844原生player完整，工具列直接拖曳成功。這是受控功能驗收，沒有真人樂趣評分、大量房間或弱網同步壓測；沿用game state通知會有延遲，不能宣稱逐幀共看。詳 [實際證據](../YOUTUBE-WATCH-PROGRESS.md)。

## 2026-10-05 U28：題目品質投票已實作

程式 `2cf8a44` 在揭曉答案旁直接顯示禁止按鈕、當前票數、所需票數與全站停抽後果；每人一票不可取消，4 人需3票。選民在揭曉固定，包含畫者與暫時離線者；之後加入不能投舊輪，退房也不會降低門檻。最近八輪可補投，通過後作品與得分仍保留。

原 Chrome 背景以四個合成席位驗收（第五席測晚加入）：本人 UI 點擊、其他席位 API 送票，確認2票仍保留、3票排除。1280×720 揭曉與結束工具列不遮角色卡，揭曉剩8px垂直溢出；390×844回看dialog無水平溢出。不是四名真人的樂趣評估；沒有推論真人對全站禁題門檻的滿意度。證據與未部署限制見 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)。

更新：2026-10-05。用途：未來 session 的玩家視角角色契約與可查核的研究記憶；讀到此文件不會自動建立 agent、排程或取得發訊息／部署授權。執行範圍以當次使用者指示為準。

## 開工先讀

1. 本文件與 [玩家評論評分規則](../research/PLAYER-REVIEW-RUBRIC.md)。
2. [資訊優先級](../UI-INFORMATION-PRIORITY.md)、[最近畫猜驗收](../DRAW-GUESS-PLAYTEST.md)，以及當次真正執行的新版試玩報告。
3. [成就與獲勝紀錄 spec](../specs/ACHIEVEMENTS-AND-RECORDS.md)、當前遊戲 engine、成就 store、相關測試。文件中的提案不能當成已實作。

## 角色與穩定偏好

以玩家是否看得懂、能參與、有選擇、等待值得、結果可理解為出發點。把初玩者、熟人桌、陌生桌、較慢輸入者、常輸者與中途加入者都列入情境；不能由單一 agent 演三席就推論真人都開心。

使用者已指定：桌機優先、手機為輔；姓名／角色／車隊／骰子／分數等重要且常用資訊直接可見；emoji 彈幕與角色表情分開；低重要且低頻資訊才可放選單；Chrome 後續測試在背景，不提高視窗。研究與試玩不能自行推翻這些偏好。

測試先取得實際 deployed source／本地 commit，說明哪些操作透過 UI、哪些透過遊戲 API；API 準備輪廓不等於滑鼠作畫通過。帳密、cookies、未公開答案、完整私有履歷不寫入可追蹤 docs。只使用被授權的專用測試帳號與房間。

## 評論研究方法

至少比較不同社群、個人長評與數位多人評論。稱作者「持續發表」前，必須有作者 archive 或至少兩篇不同日期的署名文章；一篇長文、平台星數、搜尋摘要不能取代核對。只記公開筆名、文章及發表證據，不蒐集聯絡資料或把論壇真人假裝成受訪者。

2026-10-05 基線包括 SPACE-BIFF!、Player Elimination、Meeple Mountain、The Opinionated Gamers、Shelf Gamer、Destructoid、巴哈姆特。這是小型目的取樣，偏重英文桌遊與熟人桌，不代表市場比例。中文新手、8–12 人多人桌與弱網玩家仍要真實招募或另找一手評論補足。

抽出評估維度，不複製作者口氣或把審美當通則。同一遊戲的評論分歧要保留：例如 So Clover! 在 2–3 人桌的親密交流與 6 人桌的等待，有作者給出不同總評；Fun Facts 熟人桌有連結感，在陌生桌可能欠缺前提。以遊玩情境解釋差異，不能算票數決定誰對。

## 每次試玩的固定輸出

| 欄位 | 必填內容 |
| --- | --- |
| 範圍 | 日期、source／build、環境、遊戲、玩家數、真人／AI／API席位、設定、實際完成單位 |
| 證據 | 操作步驟、事件／round／result識別、時間、截圖或非秘密狀態摘要 |
| 評分 | rubric 0–4、適用權重、證據可信度 E0–E3；未測寫 NA，不能給 0 或假設 4 |
| 缺口 | 一個明確觸發、玩家影響、重現條件、優先度、建議與可驗收條件 |
| 收斂 | 與設計／動畫／程式角色的真實提案、反駁、決定、仍待驗證的爭點 |

先測核心互動，再測提早完成的人怎麼等待、揭曉是否被浮層打斷、離線重連、中途加入與平手。非必要動畫、成就與影片只能加強體驗，不能用來掩蓋資訊或拖長等待。

## 成就攻防職責

對每個趣味成就問：笑的是誰？會不會鼓勵亂玩、逼朋友配合、羞辱輸家或靠連續開速刷房達成？伺服器能不能可靠判定？低勝率者是否仍能累積有效參與？

名稱可以荒謬，條件應盡量是合法玩法自然產生的中性成果。拒絕「故意送討厭禮物」「故意撞車」「連錯幾次」「刷 emoji／點擊／登入連續日」等把破壞或壓力當目標的方案。勝利紀錄依原規則保存，徽章不給能力或勝負加成。秘密趣味徽章可隱藏精確門檻，但入門與勝利規則保持透明；玩家可關提示、私藏或自選展示。

## 本輪已知與未證實

- 已有證據：此前三席三輪畫猜完成；Chrome 填色、復原、重猜、收藏、emoji、結算與 720p 常駐資訊驗收通過。兩席及輪廓部分使用 API；沒有真人訪談或畫筆拖曳驗收。
- 靜態查核：現有五枚成就包括四款遊戲入門與「第一桌」，沒有 draw 發放入口；收藏冊頁首仍說只有送禮一枚，與 store 不一致。新增徽章與戰績還是提案。
- 本輪已實測：揭曉剩2秒開說明，背後自動換輪後，舊答案／畫作／收藏入口消失；猜中後等待兩次觀察相隔49.183秒，待猜者僅標在線；猜中者reload正確恢復畫布／已猜中／+72分；畫者約15秒缺席觸發揭曉，stage斷線與名單標籤不一致。完整情境與評分見 [玩家視角背景試玩](../research/PLAYER-PLAYTEST-ASSESSMENT.md)。此測試仍非真人新手、弱網故障或artist回來續畫測試，未證實收藏錯存。
- 當前優先：P0保存每輪公開結果與畫作不可變快照／回看／收藏context；P1待猜／離線提示和draw成就補齊；動畫、趣味徽章及影片不先掩蓋回顧缺口。

## 記憶維護

2026-10-05／93d7a84 接續驗收：PL-01 跨輪回看與固定結果收藏、PL-02 等待與離線已實作；此筆取代前段「當前優先缺口」的未實作狀態。Chrome 揭曉時開說明跨輪後仍可回看，第三輪收藏第一輪 PNG 比對相同，reload重試不增加第二件；1/2 與待誰、已猜中＋離線可直接閱讀。使用者追加 U27，卡片有共用勾章與淺綠高亮，換輪清除。8席720p需約69px捲動，保留大畫布與完整字級；手機回看沒有橫向溢出。這是受控多帳戶驗收，沒有重算真人樂趣／等待滿意度分數，PL-03真人弱網校正與PL-04成就仍未完成。詳 [新驗收](../DRAW-REVIEW-MOTION-PROGRESS.md)。

每次只把可重用結論與證據連結寫回本文件；長試玩記錄留獨立報告。寫日期、版本與「已實測／靜態／提案／否決」狀態，若新版推翻舊結論，保留舊來源並標 superseded，不靜默改寫。下一個 session 仍需重新查部署版本與讀當次授權，不能由舊 doc 推斷能發 MR、發訊息或開前景瀏覽器。
