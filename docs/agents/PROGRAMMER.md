# 程式架構 agent 記憶

## 2026-10-08：成就單位事件的來源與持久邊界

2026-10-08 正式驗收：v1.16.0／固定 source 8a9cbfd，Windows 與 Linux 各1,518項通過；三款正式正常回合解鎖、18筆 own 新徽章／3 receipt／9探索 rows，以及背景 Chrome 高亮／日期／桌機手機／鍵盤通過。9帳號全欄位、13市場圖片與舊16徽章保留，own房與登入／分頁／代理已清理。卡片可見解鎖字樣已移除，读屏狀態保留；畫猜局內合併提示、永久勝場及跨程序outbox尚待。此筆取代本批候選待驗狀態，不宣稱真人訪談、完整讀屏或全瀏覽器；詳細範圍見成就單位進度。


本次相容修正：保留資料庫帳號 ID 原始大小寫，包含合法大寫 UUID 的匯入帳號；去重仍辨識大小寫變體。卡片依最新使用者指示改為高亮區分取得狀態，可見解鎖文字移除，讀屏狀態與日期保留。

本批已實作 source 與 focused 測試，正式版本、完整 suite、原生瀏覽器與部署結果由主流程更新 [成就單位進度](../ACHIEVEMENTS-UNIT-PROGRESS.md)，不能從本節推定已發布。對應 [成就與戰績 spec](../specs/ACHIEVEMENTS-AND-RECORDS.md) 的第一批 round 成就；下方「成就／ledger 仍缺」須拆成已完成的單位 receipt／探索進度與仍未完成的永久勝場／durable outbox。

`src/games/draw-guess.js`、`gift.js`、`majority.js` 每整局產生 `match_id` UUID（draw 沿用 `gameRunId`），每輪另產生 `unit_event_id` UUID。可選、非列舉的 `achievementUnitStart` 同步返回 canonical 座位／帳號映射，開始時複製並凍結；不能在結束時從名字或現在名單補身分。帳號 UUID 保留資料庫原始大小寫，去重時辨識大小寫變體並拒絕同帳號／同座位重複；缺失、throw、partial 或無效映射使該成就單位降為 `interrupted`，原遊戲仍照原規則結算。`participantCount` 只計凍結映射覆蓋的官方有效真人，不大於映射人數；不足映射的同頻趣味 predicates 為 false。最小 facts 僅含身分、UUID、round、品質狀態、ISO 完成時間、參與 booleans 與必要 metrics，不含題目、猜測內容、喜好、禮物 ID、畫布或手牌。

完成事件由權威操作建立，不用 `phase==='reveal'` 推測。draw 的 server 接受 stroke／guess 才留證據，clear／undo 不退款或刪資格，duplicate／拒絕操作不增加證據；artist 離房／offline auto reveal 為 `interrupted`，正規 timeout／all-guessed 為 `rules_completed`，玩家不足提前結束為 `abandoned`。正常輪保留此前已離席者的合法證據，重新入席等待下輪不加入這輪 current count。gift 僅在最後收禮確認後的正式 `finishDelivery` 建立 facts，同一收禮者的正式 entries 按 exact gift ID 判 twins，`great/good/ok` 判正向心願；delivering 移除玩家為 interrupted，少於三人為 abandoned。majority 只採正式 score 的 groups，填空合併預覽不發事件；withdraw／kick／missing 答案無資格，全有效同組需至少三人，並列最大需至少兩組且每組 count 至少二。

引擎先 latch 深凍 snapshot，再呼叫 `achievementUnitCompleted` 通知；同步 throw／Promise rejection 不回滾已接受玩法。`pendingAchievementUnits()`／`drainAchievementUnits()` 皆非破壞性讀取，成功持久化後才 `acknowledgeAchievementUnit(id)`。每房私有 pending 上限 256；滿額時下一輪／新局在 mutation 前拒絕，不淘汰未儲存事件，整局最後正常結束仍可完成。無 hooks 的既有 fixture 玩法不累積 pending，也不受此上限阻擋。

Store 的 `processed_unit_events` 按 UUID、單位唯一關係與 facts 指紋去重；相同 UUID 不同內容是衝突，不覆寫。只有 `game_server`／`production`／`rules_completed` 的有效參與者授予徽章與 `achievement_progress`；兩種不同遊戲的有效單位可授 `all-two-tables`，不靠登入、點擊或勝場。五枚舊徽章 ID 與取得日期保留。已驗 engine 新 34、store 新 17、既有三引擎 32，共 focused **83/83**；engine 的三遊戲 × 五類 mapping 故障真實寫入 in-memory SQLite receipt、duplicate 與 ack，均 0 award／0 progress。語法及 owned diff 檢查通過；這不是完整 suite、真人試玩或正式資料驗收。

**B03 永久獲勝 ledger 與 durable outbox 尚未完成。** 已提交的單位 receipt／進度能跨 store 重開去重，但引擎／app 待處理清單仍在 RAM，程序崩潰前尚未落庫的事件會丟失，不能宣稱 crash-safe／exactly-once 全流程。後續須補持久 outbox 與 history／SQLite reconciliation；不能從暱稱、外站或不可驗身份的 archive 補授獎、補勝場。來源與限制保留在本批進度，避免把既有角色文件的歷史版本當當前完成狀態。

2026-10-08最新正式 **v1.15.1／c1e59d4**：使用者要求先撤回不一致的局部手繪風格，已恢復原大廳及四房標題外觀；保留v1.15彈幕框與既有功能，SVG/credits僅歷史留存。双平台各1,432、公開27資源、原生首頁／四房waiting通過，9帳戶allfields及21non-session表/BLOB保留；詳細source/部署SIGTERM逾時與proxy drain/不可覆寫receipt修正/備份/有限native/own cleanup見 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)。下面手繪與候選狀態屬歷史；後續局部美化须驗整體一致性，不由素材研究直接推定成熟全站方案。沒有新PR/push。

2026-10-08使用者回饋：局部手繪畫風造成網站整体不一致，先撤回手繪主題。候選 **v1.15.1／c1e59d4**恢復大廳及四房導入前的外觀，v1.15彈幕框及既有WebGL/共看/排版功能保留；素材與授權只作歷史留存。後續變更須以大廳、房間、設定、其他頁面的整體一致性評估，不把素材研究或局部preview當成全站成熟方案。Windows1,432／有限native與正式結果以 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)最新節為準；下面v1.14.2的「正在使用手繪」是歷史。

2026-10-08最新正式 **v1.15.0／f4cbdfa**：彈幕框Stage A發布，雙平台完整各1,432、公開25資源與五款三席frame/avatars通過。PNG上傳收藏／成就與勝場ledger仍缺；完整source/首輪Linux暫存I/O失敗與重跑/備份/native scope/9帳戶及21non-session表保留/own cleanup見 [最終進度](../BARRAGE-FRAMES-PROGRESS.md)與 [backlog](../SPEC-BACKLOG.md)。下方候選及1.14.2是歷史；tag固定受測程式，沒有新PR/push，不把有限取樣當全phase/讀屏/200%/FPS。

2026-10-08彈幕框 Stage A已實作候選 **v1.15.0／f4cbdfa**：server exact builtin ID→frozen {kind,id,version}，只text事件；local frame prefs獨立於MotionPolicy，關框不可clear文字。首建按真height做interval placement／gap8，不足直接false不排queue；show false／同步finish／throw釋放lane和timer，過期finish不得刪新借用者。resize只在尺寸變時清理，不做每frame layout；新增PNG upload仍StageB，不能把現catalog說成schema/ACL完成。Windows1,432與有限native證據見 [彈幕框進度](../BARRAGE-FRAMES-PROGRESS.md)；Linux/正式結果以最新節為準，基線正式仍v1.14.2。本輪不改drawing renderer/codec/transport，持筆樣本與最終一致需分開記錄。

2026-10-08最新正式 **v1.14.2／8ae5c4f**：Freehand官方SVG／紙卡大廳發布，最終Windows/Linux各1,415通過；v1.14.1 archive行尾失敗留歷史未部署，tag不移。Windows core.autocrlf會影響git archive輸出；SVG provenance需要.gitattributes text eol=lf與canonical export，originalSHA和modifiedSHA分開。固定路由／SVG CSP，不能開任意SVG或user upload執行；公開測試清理須容許房間已404，且try/finally保own logout。 正式22資源exactbytes/no-store/MIME、21non-session表rows+BLOB/9帳戶allfields保留；sessions232→238為6次測試登入，都已revoked，own4房/代理/tabs已清理。精確source/備份/例外與限制見 [本批進度](../FREEHAND-UI-PROGRESS.md)、[spec](../specs/FREEHAND-UI.md)、[資產評估](../research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](../research/FREEHAND-UI-VISUAL-REFERENCES.md)。下方1.14.0/候選狀態為歷史，沒有新PR/push；不宣稱全playing/200%/讀屏/FPS完成。

2026-10-07最新正式 **v1.14.0／b4ebb15**：圓角骰子與連續暖色WebGL氮氣已發布，雙平台各1,413通過；正式三席13骰／9資源與真nitro移動、21non-session表rows+BLOB／9帳戶allfields保留。sessions225→232是驗證登入變化，own房／登入／代理／tabs已清理。骰子geometry按job cache，shadow與cube各一draw（state.drawCalls只計cube）；氮氣沿同context／program／buffer以6vertices持續畫，只有live callback可continuous，discard stop(eventId)，車尾取carrier CTM(-20,0)。 完整source／備份／原生範圍見 [本批進度](../RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)／[spec](../specs/RACE-FX-VISUAL-REFINEMENT.md)。下方1.13與pending均為歷史，此筆取代其現況；沒有新PR／push。native hidden／200%／讀屏／玻璃跳台道路pan及FPS未驗，不以完整suite推定。

2026-10-07最新正式 **v1.13.0／353d8b6**：雷霆原生WebGL立體骰子／短符號及清理回退已發布；雙平台各1,408、正式三席13骰與7份資源／資料保留通過。17骰450ms原生圖為隔離定格，hidden原生未觸發、無FPS結論；結果和權限由server決定。完整source／備份／邊界見 [骰子進度](../RACE-DICE-WEBGL-PROGRESS.md)／[spec](../specs/RACE-DICE-WEBGL.md)。下方1.12與pending是歷史；tag固定受測程式，沒有新PR／push。


正式 shhuang.cc 已以私有 server token 啟用既有本站→stanley021039/BGA Issue／comment／admin status 同步。程式仍v1.12.0／83ffcab，沒有runtime修改或新PR；設定前outbox空、zero-room guard後重載。Issue48正式新增、同UUID重送不重複、前端reply與adminclose均同步，ordinary status403，3筆done無待處理；沒有GitHub→本站同步或legacy backfill。憑證不得放前端／Git／logs；維護與精確scope見 [同步紀錄](../GITHUB-BOARD-SYNC.md)。

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07 patterns有限原生新知：shared invalid批次先標所有無效欄位，再以單microtask聚焦第一個；focus:false／reset／destroy須取消晚排程，修valid title只清自己的aria描述。manual tabs focus與commit保持分離，rapid Arrow位置立即更新與baseline／earned錯序由中央契約處理，不各caller加poll。widgets focused72和真鍵盤／Escape有限證據見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，新排序修正／全套／公開1.12仍待驗，不稱本批已完成發布。

2026-10-07原生元件新批實作中：widgets只管tabs focus／panel關聯、field feedback與native dialog，不接管submit／API權限／page state；collection原confirm保留，market busy／批次不改。notifications有限queue／seen、GameUI.notify與四款既有server earned差集，不加poll，draw僅toast。hidden保可讀內容並暫停expiry，入口／celebrate取消且不補播；pagehide清理。契約與本批待驗source見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，正式基線1.11.1，未以舊1,284項推定新批通過。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

## 2026-10-07：正式v1.11.0／PR46回歸契約

renderer用`surfaceRevision`／`presentedSurfaceRevision`追staging實寫與可見提交：clear／undo尚未present即使沒有新stroke也須copy，latestjob／generation仍防舊圖覆蓋，settled no-op不copy。音樂`interruptedAudio`只復原此次hidden自動pause的同clip／key／epoch，等fresh marker；manualpause／設定停用／browserreject／sharedpaused／videoexit維持，staleclip不復活、不加poll／seek。main衝突保MarketImageStore／schema16／gallery、pngjs7／sharp0.35.5、market3MiB／approve128KiB、char4MiB與preserveImportedSessions。PR雙平台1,263、正式保UI／WebGL整合雙平台1,284；native12真Canvas2D與Audiovisibility範圍見 [證據](../PR46-REVIEW-FIX-PROGRESS.md)。此筆更新當前schema16，下面schema15與候選狀態為歷史，不能混算source／測試數。

## 2026-10-07：正式v1.10.0局部WebGL

`GameFxLayer`用原生WebGL1、lazy、有界buffer／particles／contexts，idle無rAF；只接公開event／live gate與視覺車位anchor，不改checkpoint、server／DB或畫猜renderer。`onActivity`等成功非零draw才發布kind，僅用`visibility:hidden`遮同類SVG裝飾（opacity會被舊keyframes覆蓋），標字／bullet／trail／spin保留，empty／loss／reduce／clear復原。restore不補播；最終loss probe與較早restore cycle分開，不能拼同次完成。雙平台各1,165、限額／source／native／資料與限制見 [進度](../UI-POLISH-WEBGL-PROGRESS.md)／[spec](../specs/UI-POLISH-WEBGL.md)。此筆取代下方「WebGL未實作」現況，舊研究保留。

## 2026-10-07：正式v1.9.0長期契約

畫猜原子呈現只在opaque staging完成canonical job後commit；visible clear／copyBase後不能yield暴露半幅，ACK mutable→classic也同樣檢查。保留caller原creation options與省略語意，latest job／epoch、取消／reset／whenIdle必守，cache含stage≤8MiB。brush／erase optional pointTimes同長safe integer0..120000、chunk非遞減；duplicate後、額度與version mutation前驗，不增加跨chunk ledger。immutable ID/body及anchor時間保留，server canonical立即、無逐frame點timer；artist不重播ACK，viewer有界回放，snapshot／reconnect／reveal／undo／fill等取消並立即baseline。

CountdownBar以WAAPI linear scaleX表現server deadline，既有更新校正動畫wall drift，不增逐frame JS或poll。每輪持筆／ACK／reveal／換畫者都查中途visible、終點canonical與callback清理。quiet成功文字移除不得連錯誤／重連／設定提示一起清掉。最新實作與驗收統一見 [畫猜進度](../DRAW-TIMED-PLAYBACK-PROGRESS.md)／[spec](../specs/DRAWING-SMOOTHNESS.md)，不能由單trace宣稱所有硬體或60fps。

媒體影片預設使用可用高度；DOMRect取left／top／width／height明確欄位，不spread原生prototype getter。自製共用seek移除，只有canControl可按「同步我的播放進度」讀本機video API／audio.currentTime並一次seek；ticks不讀也不發seek。保留timeline／timeout／stale job／ACL／close-hidden guard及local-only resize。見 [媒體spec](../specs/MEDIA-ICON-WINDOW-UI.md)／[進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)。

2026-10-07 WebGL導入評估（研究，未實作）：優先局部雷霆粒子特效，保留SVG互動與GameUI；現四條transform彈幕及少量卡片不值得先全面換renderer，大廳left/top可先比較transform。畫猜WebGL只能處理本機繪製候選，不解140ms／單in-flight／HTTP-SSE等待；fill readback、白erase／AA／canonical PNG需另驗，Worker也是候選。PixiJS v8查核當日沒有可承諾的自動Canvas fallback，要自行保留原SVG／CSS。未跑WebGL原型／FPS，不外推加速比例，細節與官方來源見 [導入評估](../research/WEBGL-ADOPTION-ASSESSMENT.md)。

## 2026-10-07：作畫順暢度第一批（正式v1.8.1，有限P1）

正式v1.8.1／6707a9edf07839c3307dd230ff6eeca5fa92bf62已於UTC03:30:44.024Z零房間guard部署，PID107492→110715、service／tunnel active。Windows1076／1076／37689.229ms，Linux Node22.22.1 1076／1076／189955.125522ms，各fail/cancel/skip/todo0；本地受測tag固定，沒有新PR／push、PR43未改。schema15／21schemas／20non-session rows+BLOB與8帳戶全fields保留、integrity ok／FK0；sessions161→165為已登出的QA登入，不說sessions不變。SQLite線上備份與另時點files/env archive不是atomic cold snapshot。公開版號與5資源精確內容/no-store已驗，沒有逐項驗5資源MIME；正式3會員HTTP/SSE duplicate／nonartist400／undo-clear quota不退已驗。Chrome正式僅背景home版號；local像素／輸入證據另列，own房／auth／tabs／preview／control已清理，不改前景或偏好。

P0從v1.8.0／5687561基線導入140ms first-new-point timer、40點／up提前flush；115ms开送下限、fill500ms、單in-flight，prepare才UUID／deep-freeze≤64點，同epoch／round／strokeId／tool／style／filled相鄰未送才merge。queued entries≤1000／points≤30000，metrics pendingPoints／bytes只算未送，inFlightPoints另列／oldestAge從最老job入列。stroke與snapshot GET各10秒；snapshot job identity／epoch／round取消防舊finally清新GET，AbortError不全站disconnect。暫時DRAW_RATE_LIMIT／500／網路等最多3attempt同ID/body，永久WORK_LIMIT明確取消未送＋sync；quota只首attempt拒新批，已接受但lostACK且SSE先耗quota的同ID重試仍可去重。

server rolling1000ms最多10批、1000accepted batchIds／30000accepted points／48fill與fill2/s不變，anchor計points，undo／clear不退lifetime quota。batchId只ID去重，已送body不能改；SSE先於HTTP，两次序／gap snapshot保持。command active筆先請完成，之後drain→權威sync→undo/clear→renderer idle；busy期間不新input，epoch清timer／request／舊draft。既有command POST與state poll未新增10秒deadline，不能泛稱所有網路有deadline。

P1仅有限mutableFrom < strokes.length的明確local draft且本epoch未遇fill使用opaque base＋mutable suffix；無draft／Infinity／全部ACK／viewer用visible同surface原classic。mode切換取消舊layer job、清base checkpoints並完整合作式canonical replay；任何history／draft fill令classic sticky直到reset，不保留server末筆brush永久mutable與promotion。每mode單組15checkpoints＋1base、512×256≤8MiB，不能保留雙cache。白色source-over erase、fill容差24／filled／0.5位置／圓cap-joint及render／cancel／whenIdle／reset不變；活動完整path仍重畫，未消除全部O(N²)。up收實際尾點、cancel／lostcapture只finish已有樣本，非空coalesced與parent擇一；rAF只preview，可靠sender／恢復／save不依賴rAF。

P0已驗native25／3點持筆viewer先見更新；25點up後兩席25chunks／49含anchors／ink1603與fresh0差。trusted down/up＋1000 synthetic moves單task只1preview／999lineTo，400ms延期16requests／1015點／max64；工具約1秒／move及背景970ms排程不作FPS。

native19場景18個對fresh strict RGBA0；fill-dependent362 RGB／max13／alpha0／exactmask0，新wrapper與legacy SHA同而整體strict flag仍false。captured dense3場景均fresh0。實際1000 synthetic-move／948有效點／16chunks963含anchors兩席同JSON，但artistfresh0／viewerclassic67 RGB／max54、viewer baseCopies0／mutable0；同capture timeout20ms／warmup0及1的原classic與opt-in Infinity同樣67／max54、old/new直接diff0／SHA相同。此證據只限受測trace，不歸因layer／硬體／GPU／CPU，不寫19native全部fresh strict或所有雙席pixels相同；兩組rAF控制2秒未advance而未完成，不能列pass。工具慢線／背景970ms不作人體FPS。

原layer在fill底圖白erase及dense已確認圖有差才縮限；first-context frequent診斷雖15pass卻改11case canonical SHA，不能為過關切換全站hint或放寬AA。P2新排序／並行POST與P3抽稀／新codec仍未做。來源、備份、精確scope、未驗rAF／原生取消／真收藏或其他硬體與後續提案见 [本批進度](../DRAWING-SMOOTHNESS-PROGRESS.md)與 [spec](../specs/DRAWING-SMOOTHNESS.md)。下方v1.8.0與更早紀錄為歷史，後續文件提交不移動受測tag；原HAR／cookies／帳密與.local偏好不提交。

## 2026-10-07：共用媒體與房間角色（正式 v1.8.0）

`RoomMediaRegistry`綁room物件，不只六碼；每房一個current、混合queue、播放anchor、UUID instance／session及revision。所有有效座位可enqueue，其他transport／queue／duration／ended只host／manager。`src/rooms/permissions.js`的non-enumerable `room.managerIds` Set只存目前room管理seat；host由room.host即時判斷、role不是siteadmin。leave／kick後prune，短暫重連active seat保留、離房重入不繼承；manager不能升人或踢host／同級／自己／bot，host原有bot管理保留。app先canKick，再以真room.host呼叫原engine，不偽造或交換host。

metadata只對解析過的videoId查固定oEmbed，拒redirect、有界timeout／bytes／cache／pending；await後重查session／disabled、原room物件與canonical seat／kicked，再由media.act再次驗revision／session／ACL。requestId對有效payload fingerprint去重，不修改已送body；不把自報title當可信歌曲名稱。接管後舊music／watch POST均409 MEDIA_API_REQUIRED，GET投影同一current；新版GameShell只mount TableMedia，不並行舊player或SSE。schema15及既有音樂格式保留，queue／角色不是冷移轉或房間續局資料。

GET只有成功才標marker已取；首取＋2次、1秒／4秒門檻由既有game update驅動，不加網路timer。永久4xx停止（408／429除外）；明確重開／新marker重置，關窗取消該GET，room／seat／instance切換清generation。old GET失敗不能改較新ACK／預算。playerEpoch＋currentKey隔離舊Audio.play／YouTube回覆，個人關閉不能因idle→下一片重新開窗；拖曳凍結revision／完整集合，drop失配要求重拖。paused／本機提早seek到終點／未知或超限影片時長不得送共享ended，必須仍有權且playing、有效時長及共享anchor接近結束。

最後CSS驗收修正range的UA margin／box-sizing造成2px外寬，primary clientWidth／scrollWidth451一致；narrow body改自然block與單一scroll，primary／library min-height:auto及12px間隔，避免固定grid列縮小後內容重疊。最後source已重驗390×844無水平溢出、1280×720 window900×620在viewport内；本批200%文字未真正測，不可只由最小player契約推論通過。

正式tag／來源`56875616c9367a25dd369c175c2b949f7861de9c`：Windows／Linux完整各1034、隔離三席Chrome真Audio／YouTube、排序／個人選擇／角色及五款入口通過；原focused88與VM34維持各自scope。台北10:24:21公開6資源／API三會員與資料保存通過，PID107492／services active。schema15／21schemas／20非session rows＋BLOB／8帳戶全欄位相同；sessions157→161已登出，不宣稱session逐列相同。no新PR／push、PR43不混入，後續文件不改tag。真正Google拒播／oEmbed成功、多設備／弱網／喇叭及200%文字未驗；fixture repeated navigation的draw重連提示可能受proxy未取消舊upstream SSE影響，不作正式bug診斷。完整source／備份／scope見 [進度](../UNIFIED-ROOM-MEDIA-PROGRESS.md)與 [spec](../specs/UNIFIED-ROOM-MEDIA.md)，下方v1.7.2與舊控制者／select重播描述為歷史。

2026-10-07 PR43新P2已修／正式v1.7.2：ExpressionSounds controller持有serverAnchor／serverAnchorAt，本機performance非負elapsed推進eventNow；incoming只超前projected才改anchor，old/equal/missing不重設receipt年齡。poll gap用同elapsed；reset/context清serveranchor，hidden/pagehide/gap保留silent baseline与seen。原PR v1.4.2兩平台815、正式兩平台947，t6ACK→t7舊t0播放0／fresh1 Chrome替身通過；21schema／20非sessionrows／BLOB及8帳戶保留。fallback仅稳定wall兼容，未有serveranchor或无performance时不宣称walljump免疫。詳 [修正／證據／限制](../PR43-EXPRESSION-CLOCK-FIX.md)。不用只Math.max固定timestamp而不算elapsed，也不要把clock修正当成已实现作画优化。

2026-10-07繪圖研究（基線v1.7.1／3d82e3f，未改產品）：區分本機input→paint、湊批／queue、SSE→viewer paint。40點才flush或pointerup，25點持筆真雙席0POST；活動長筆真renderer計數1000點499,501 lineTo，不等於CPU毫秒；單in-flight POST被ACK卡住，人工回覆多延400ms／8點queue3,314ms。先有界時間flush＋同stroke未送點合併，再一幀一次preview與活動層；不可任意並行POST、修改已送batchId內容、削去epoch／quota／fill／snapshot防護。8點兩席digest差仍未解，後續空mask跨換輪不能證明吻合。已與研究agent核對方法／限制，來源與具體驗收見 [對照](../research/GARTIC-BGA-DRAWING-COMPARISON.md)、[規格](../specs/DRAWING-SMOOTHNESS.md)。Fabric可借活動層，WBO採獨立實作，採用前重查授權；不是Gartic內部原碼。

2026-10-07正式v1.7.1／`3d82e3f`：social ACK走RoomHost.acceptSnapshot→目前game callback，不能只更新被隱藏的GameShell角色列；race receive same-version更新snapshot／renderCrews，保留track、movement及dice。RoomHost.isStaleSnapshot共用較低version／same-context-version較舊finite serverNow判斷，五game入口重用，避免舊GET在ACK後把圖蓋回；higher version優先，沒有加網路traffic。原faker GIF隔離真UI、正式五款雙席及两平台各940已驗，详 [表情驗收](../CHARACTER-EXPRESSION-SWITCH-PROGRESS.md)。角色表情仍5秒臨時，重送同GIF動畫起點沒有改；全部phase或真人弱網未實玩。下方v1.7.0為歷史。

2026-10-07正式v1.7.0／`82149a4`：TableWatch右下把手及keyboard縮放，size key獨立、舊position key格式保留；viewport暫時clamp不寫偏好，reset移除size。尺寸計算量測header／status／footer／首local button，加210pxplayer餘量；header flex basis160允許工具換行，watch-narrow依窗寬850切換。RO觀察chrome／player、經rAF合併，close釋放capture及frame；CSS高度上限與JS都扣16px。正常resize不重建iframe或呼叫player／watchAPI，權限不變。Windows／Linux各914；公开2會員實播及320／200%／雙欄通過，詳 [尺寸验收](../YOUTUBE-WINDOW-RESIZE-PROGRESS.md)。驗identity以保留Runtime物件與當前iframe嚴格相等，重取DOM frontend ID可能變，不能據此推斷churn。下方v1.6.0為歷史。

2026-10-07正式v1.6.0／`74372ed`：歌庫本來全會員共用，本輪將room-music的select開放同房有效座位；其他transport仍host，auth／leave／kick／rate60／SSE沿用。TableMusic picker所有人可選、guest開始以select當前track重播；每次open明確GET歌庫、request sequence＋roomEpoch擋晚回覆，沒有新增歌庫poll。Windows／Linux各896、Chrome會員上傳→另非房主選播／個人mute／同曲重播、公開兩會員Audio readyState4且時間前進已驗。schema15／8帳戶保留，詳細範圍與來源見 [共用歌曲驗收](../MUSIC-SHARING-PROGRESS.md)。下方v1.5.8及舊僅房主選曲描述為歷史，YouTube控權不隨本次開放。

2026-10-07正式v1.5.8／`470ab26`：角色主圖及固定／自訂表情提高4MiB；保留共用MAX_BYTES=1MiB，imageOf／imageForRequest可信options只由三個角色呼叫端傳4MiB，不能從payload取限制。app只有三圖片POST路由的JSON cap提高至5,600,600；collection.readImage預設1，角色分支傳4。其他圖片、legacy頭像、音效、ACL與count不變。Windows／Linux各889、隔離Chrome三表單及正式4MiB三路由／+1不覆蓋、12MiB角色组加密備份還原已驗；schema15／8帳戶保留，詳細邊界及未驗範圍見 [圖片上限驗收](../CHARACTER-IMAGE-SIZE-PROGRESS.md)。下方v1.5.7為歷史。

2026-10-07姓名修正已正式v1.5.7／`4c5b5e7`：Windows／Linux各883，五款本機姓名欄及八席等卡／手機／200%已驗；公開30資源與3席等卡、16字位移及hover／reduce通過，暱稱與測試席位清理後8帳戶全欄位相同。角色卡尺寸由各頁格線管理，姓名用共用單份text／title，suffix在外；動態不新增poll。下段候選描述仍有效，完整證據及未驗範圍見 [正式姓名驗收](../DRAW-PLAYER-NAME-PROGRESS.md)。

2026-10-07候選v1.5.7：姓名用GameUI.playerName單文字／escaped原生title，超出實際slot才transform；自己／AI後綴在外。RO＋MO單rAF讀寫、同值不寫，hover／focus暫停，MotionPolicy／reduce／hidden停止，移除及BFCache清理。GameShell四款／通用角色及雷霆車隊重用；畫猜名單／排名卡用格線等尺寸，保留全部玩家及分數、56×64結算頭像。12元件＋整合回歸，Windows883及五款背景UI通過，詳細契約、尺寸及正式狀態見 [姓名驗收](../DRAW-PLAYER-NAME-PROGRESS.md)。

2026-10-07已正式v1.5.6／`5941c03`：Windows／Linux各867、公開3席多尺寸／26資源通過。設計師指出不可fit縮到0px的風險由guard修正，125%自然流及恢復已驗；大字／手機不承諾單屏，完整名單／排名不能裁掉。下一段候選描述仍有效，完成證據與限制見 [正式驗收](../DRAW-VIEWPORT-FIT-PROGRESS.md)。

2026-10-07畫猜候選v1.5.6：shell flex及layout剩餘列共同管理高度，玩家/main同列stretch，chat伸展、feed局部scroll、輸入最後。Canvas只改CSS width，backing512×256不改，倒數共用width；ResizeObserver量實際overhead／tools、合併rAF、相同值不寫style，不追加poll。≥1200／680正常字級採fit，手機／大字自然流；工具／聊天室最低高度或240×120canvas放不下就退出fit，budget仍用viewport＋main文件座標避免震盪；125%字級已驗。8席短屏保留完整名單/排名並局部scroll。設計師獨立review及驗收見 [進度](../DRAW-VIEWPORT-FIT-PROGRESS.md)。

2026-10-07正式v1.5.5／`18d21ae`：共用opt-in ui-timebar負責軌道樣式與urgent色，caller沿用server deadline／clockOffset計算value。避免在頻繁更新的原生progress-value做width transition；本機背景Chrome已重現DOM值更新但繪製滿格的滯後，停用後像素與native比例對得上。畫猜將倒數移到畫布欄上方，保留工具／畫布上緣及512×256原生尺寸；drawing hint空且hidden、等待分類保留。小螢幕放大時countdown分行，聊天grid用minmax(0,1fr)避免min-content撐寬。雙平台各864、正式26資源／3席已驗；跨平台字型與其他瀏覽器不可沿用為已驗。詳 [倒數發布](../DRAW-TIMER-VISIBILITY-PROGRESS.md)，下方v1.5.3為共用元件導入歷史。

2026-10-07正式v1.5.3／`0609c01`：以下共用UI契約已實作；背景逐頁發現history宣告header span margin-left:auto算出18px，neutral wrapper reset後中心從+9歸0。Windows／Linux各863、正式3席題卡與25份資源驗畢，8帳戶及schema15保留；原PR43範圍不變。以 [最新UI驗收](../SHARED-UI-ALIGNMENT-PROGRESS.md)及其明列未驗界線為準，後續修改先查registry與共同槽的全部呼叫端。

2026-10-07共用UI契約：全站primitives與GameUI registry／symbol／decorateButton是圖示、單字元及操作槽的共同來源，20HTML共用載入，foundation只保留遊戲tokens及布局。Grid的place-items只處理格內，整組置中还需place-content；正面多區資訊卡保留space-between。wrapper内部margin／padding重設防歷史header span等泛用選擇器污染，外部間距交parent gap；資訊D保留21px、互動按鈕44px，hidden與pending可測。與程式角色的實際攻防、逐頁盤點及未驗邊界見 [規格](../specs/SHARED-UI-ALIGNMENT.md)，程式／背景Chrome／發布事實見 [進度](../SHARED-UI-ALIGNMENT-PROGRESS.md)，未全面玩法／跨平台字形不宣稱驗畢。

2026-10-07正式v1.5.2／`7939090`：race-paths依每步前一格判定跳台進入方向，側面／前方風險1000、提示會淘汰；實際飛躍峽谷同長安全分支驗證存活，已揭露陷阱與起跑規則保留、未揭露內容不洩漏。expression-sounds用回應serverNow判事件新鮮度，本機時間只判連線間隔，game-shell及lobby兩處傳入；五款房間及大廳回應同步補clock。±2／6／60秒、legacy、去重／mute／hidden／reconnect有回歸，沒有新增輪詢。原PR43修正双平台808並Ready；最新正式分支雙平台863、公開資源與serverNow已驗，保留後續畫猜及移轉相容性、8帳戶，未合併原PR。證據見 [修正與同步](../PR43-PRODUCTION-FIX-PROGRESS.md)，下方v1.5.1為版面導入歷史。

2026-10-07正式v1.5.1／`d4e3b4a`：畫猜phase row跨欄、左側常駐玩家、中央畫布＋直列聊天室（input最後）、右側共用操作。工具160px軌與畫布上緣對齊；timer沿用server deadline／clockOffset，以15s選題、options.seconds作畫、8s揭曉計算進度，不因presence poll重置，字型沿用UI＋tabular digits。猜對僅卡片高亮／勾號與chat非答案訊息，右側只保留重要例外。結算按內容高度且顯示最後一幅畫，preview job綁resultId及實際canvas node避免舊回覆畫到新場景。Windows／Linux各845、Chrome不同角色及手機／八席通過；正式schema15、8帳戶保留，無外站匯入／新PR／push。證據及限制見 [完整進度](../DRAW-DESKTOP-LAYOUT-PROGRESS.md)，下列正式1.3敘述為歷史。

2026-10-06 最新整合：候選 **v1.4.0**、[PR #43](https://github.com/stanley021039/BGA/pull/43) 已建立，受測程式及本地tag為 `bdd77d146ef8f207c8d94c06390aefd2a857d986`。Windows／Linux完整各 **790/790**、schema15兩種舊14布局及完整移轉回歸通過；既有帳戶／音效／市場資料保留。已接main `b744464`，後續只含README／驗收文件，執行程式未變。正式仍v1.3.0，排版及整合候選尚未切換；先前PR及測試數字保留為歷史，送審狀態以PR頁及下方最新整批進度為準。

本輪 source、schema 相容性、測試及送審狀態見 [整批 PR 進度](../PARTY-PR-INTEGRATION-PROGRESS.md)。

2026-10-06正式 **v1.3.0**：畫猜本人猜中／畫者輪次及雷霆骰聲／shot／slam／nitro／skid已接共用事件音效。Windows Node24.14.0 **761/761**（25286ms）、Linux Node22.22.1 **761/761**（130827ms），失敗／取消／跳過均0。受測程式 `4732450fe44d2640ecaf961cf2d8dee9d8bd5e95` 與本地 annotated tag `v1.3.0`，正式 current `releases/4732450`；零房間切換，PID50471→52510，service／tunnel active。schema14不變、integrity ok、外鍵錯誤0，原7帳戶全欄位保留；預演副本16張既有表逐列一致。匿名no-store版號、既有session、7份HTML、24份資源（含7WAV的精確bytes及MIME）一致，背景Chrome設定顯示「版本 v1.3.0」。7短音（2Kenney CC0改作＋5固定seed原創）、兩個新聲音模組、遊戲2／總4段上限及1秒載入timeout已驗；Chromeplaying／清理／靜音及所有限制見 [音效實證](../GAME-SOUNDS-PROGRESS.md)。第二批遊戲候選仍為規格，沒有真人聽感／喇叭測試；無新PR／push，純驗收文件不移動tag。

2026-10-06正式 v1.2.0：角色既有非neutral自訂表情可POST canonical base64音效／remove，作者控制；browser用OfflineAudioContext decode並轉24kmonoPCM16WAV，server按真sample數驗≤240000／480044bytes，不信duration宣稱。schema14 FK保存；gallery.sound只有url/duration，發送時綁bytes hash與actualaudience grants。共用ExpressionSounds新事件一次、baseline／hidden／reconnect不補播，AudioSettings effects統一音量／mute／4段cap，load10s與play≤10s分開deadline，lateplay不再啟timer。profile save晚回覆需綁selection generation，不能覆寫新角色並鎖住soundPending。Windows Node24.14.0 **727/727**（24185ms）、Linux Node22.22.1 **727/727**（125824ms），失敗／取消／跳過均0。ChromeWAV11秒拒／10秒保存及1秒trialstop，房／大廳一次GET、mute0。受測程式 `9b1fdd4148ea9e1ceec5215f8ca112ffd99cd893` 與本地 annotated tag `v1.2.0`；正式 current `releases/9b1fdd4`，零房間切換，PID 48811→50471，service／tunnel active。正式 schema14、integrity ok、外鍵錯誤0，原7帳戶全欄位完整保留；預演時15張既有表逐列一致，只新增空 `character_sounds` 第16表。匿名 no-store 版本API、既有session、7份HTML及14份資源比對通過，背景Chrome設定顯示「版本 v1.2.0」。詳 [音效契約與實證](../CHARACTER-ASSET-TEMPLATE.md)。

2026-10-06正式 v1.1.4：PR #36 `d4020ef`修GET失敗同marker永久失同步及HTTP缺randomUUID。每instance/revision最多3次，1s／4s門檻只由既有update觸發；其他4xx終止、初始無marker亦可恢復，snapshot追上目前marker不再取舊pending。force手勢可重啟budget，close/generation隔離舊回覆；成功穩態零新增watch GET。UUID用原生或getRandomValues v4，缺安全源可控提示，uncertainretry復用原body/ID。新增38回歸，PR來源雙平台552、正式整合雙平台663；Chrome非loopback HTTP真實缺randomUUID仍POST200，加入實播後暫停／停止各503→200同revision恢復。正式受測93ba350／本地v1.1.4 tag，零房間切換；current releases/93ba350，7帳戶／schema13／公開版本與8資源已驗。#34本次雙平台442及Chrome四輪回看收藏禁題均驗，另一端已merge main1447430。本段不授權或宣稱本任務合併。詳 [共看進度](../YOUTUBE-WATCH-PROGRESS.md)。

2026-10-06正式 v1.1.3：Thunder `event()`最後寫入`afterMotion`，extra不可覆寫；car／target捕捉當下公開x／y，顯式x／y保留。公開events由12增至64筆，玻璃在下一forced move前記checkpoint；嵌入教學引擎同步。前端一般checkpoint1600ms／道路3200ms，同checkpoint批次文字、位移FX由`onMove`觸發；presence不隱藏／不延長事件，event-onlyhold及skip只控制事件停留，不跳位移／dice。完成後才開下一步，鎖動作但poll／roster／chat繼續；hidden／reduced／停用／重連不補播。引擎逐格drain及原地形／碰撞優先順序不改，dice／pending丟棄舊route，accept後需重選。事件payload增加，但不新增HTTP、伺服器timer或DB；客戶端排程只延遲呈現。Windows／Linux各625/625；背景Chrome火焰、玻璃→地雷→打滑及油漬→跳台已驗。正式受測22a9d6f／本地v1.1.3 tag，current releases/22a9d6f，schema13／15表副本／7帳戶完整保留，公開版本與7資源一致。詳 [進度](../RACE-MULTI-MOVE-PROGRESS.md)。

2026-10-06 v1.1.2正式，已更新shhuang.cc：ThunderRoom公開motions journal為`[{id,kind,moves:[{car或player,from,to}]}]`，64groups／128transfers完整group淘汰，serial跨start單調；view深拷貝，只含公開身份與座標，不加HTTP、伺服器timer、log或額外version增量。moveEffect統一記錄玻璃／油漬／slam／jump／blast／skid／dazed等實際段落，出界／終點earlyreturn前記attempt；quake一次同group並排除preplaced重記，airplace記入口或真舊點。race.html教學引擎已同步。前端每格240ms依序、quake並行、jump／blast弧線、dead ghost／終點landing／chopper及480ms road pan；等待位移再開dice／controls／winner／教學，鎖動作但不阻斷poll／roster／chat。hidden／reduced／停用／重連跳過舊journal；不能因dead或attempt末點不同於權威car座標丟棄確認位移。取代v1.1.1的末點推算及不鎖操作限制。Windows／Linux591/591通過，11項真引擎回歸及控制器／render順序／延後骰子回歸已驗；主agent背景Chrome確認碰撞／推移／玻璃／六車地震出界／道路換片／終點；跳躍、拋飛、直升機仍以回歸驗證。正式API／資源／設定與7帳戶已核對。詳 [最新正式進度](../RACE-MULTI-MOVE-PROGRESS.md)。

2026-10-06 v1.1.1修正雷霆逐格動畫：共用race-movement控制器只演確認步驟、每格240ms，保留elapsed跨SVG重建，排接連續指令。新靜態檔必須同時接race.html及app白名單；快照深複製cars，避免教學引擎原物件變更令差異判斷失效。6項控制器回歸、Windows／Linux各554項及背景Chrome證據見 [移動進度](../RACE-MULTI-MOVE-PROGRESS.md)。程式2eb4104／本地annotated v1.1.1已更新shhuang.cc，正式API／資源／設定及7帳戶核對完成，無新PR／push。v1.1.0 tag不移動，後續純驗收文件不改tag。

## 版號規則（2026-10-06）

新功能必須升minor、相容修正升patch、不相容契約升major，純文件不升。唯一来源package.version；匿名/api/version僅回版號且no-store。共用設定首次開啟讀取，成功後同頁不再請求；沒有新poll。`release:bump`同步package／lock／CHANGELOG，`release:check --base <正式版ref> --type minor`阻止忘記打版或幅度不足；npm test自動基本check。工具不自動commit／tag／push／部署，正式tag不可覆寫；本批候選1.1.0與最新驗收見 [版本進度](../RELEASE-PROGRESS.md)，規範見 [打版規範](../RELEASE-POLICY.md)。下列較早部署狀態依最新驗收文件為準。

## U33：改名、擴題與路徑（2026-10-05）

`POST /api/profile/name`只改持久display_name，同步現有五款座位及大廳；username／UUID／session／歷史結果保留。使用Unicode code point驗1–16字，create／join不可再次UTF-16截斷合法emoji；header／大廳回焦點讀最新本人，序號隔離晚回覆，不加帳戶timer。共看只刷新既有revision，不改時間錨點／控權。

`public/shared/race-paths.js`讓Node及瀏覽器只用masked地形共同規劃；遠目標只送car/version/x/y，server重算逐步drain，任何揭露／dice／位置意外／道路切換就丟掉後續，不能acceptDice後自動續跑。原move逐格照常。限制16點／3000狀態；hover不送請求；靜態route白名單及教學引擎副本一致性要保留。

內建draw1000／meme100（50模板、50原創情境），原120ID不重排；gift350，成人50另組、includeAdult預設false且同步過濾投稿，原300ID不改。以上無新schema；框收藏方案將需要成熟PNG解碼器、schema／受眾／移轉驗證，尚未實作。來源、Chrome觀察及最新整合測試见 [本批進度](../PARTY-UPGRADE-PROGRESS.md)。U29共看已依新授權發PR#36；本批六項仍本地未PR／部署。

2026-10-06 PR #36 合併準備：整合最新 main `9dd6282`（含 #38），靜態資源衝突保留 YouTube 與 market 路由及 market 登入返回路徑；記憶保留雙方決策，重複編號以 U29-market 區分。Windows Node 26.2.0 完整 573/573 通過，失敗／取消／跳過 0。本輪未重跑 Linux 或瀏覽器；使用者已明確授權推送與合併 main，未部署。

## 2026-10-06：PR #36 共看失聯與 HTTP 安全亂數

`table-watch.js` 的 failed marker 不能記成永遠已取得。新契約以同 instance／revision 的首取加兩次 update-driven retry，失敗後 1 秒／4 秒門檻、無新增網路 timer；成功同 marker 不發 GET。4xx（408／429 除外）立即停自動重試，明確 open／join／rejoin 可再啟動。cleanup 清預算與 pending，舊 task 的失敗／finally 不能消耗新 task 額度；飛行中接到較新 marker 必須合併追最新。無 watch marker 的首次開窗 GET 失敗也需由既有遊戲 update 恢復。

UUID 優先原生 `crypto.randomUUID`，HTTP 非 loopback 缺少時使用 `getRandomValues` 的 UUID v4 fallback；不降級到 `Math.random`。安全亂數不存在或拋錯需在 async command 內可控回報，不能在 try 外失敗。uncertain retry 先比對同操作／instance 並復用舊 body，不先產生新 UUID；HTTP 拒絕後才建立新操作 ID。Windows 真模組 VM **90/90** 通過；本次 Linux／真瀏覽器／發布由父任務另驗，細節見 [共看進度](../YOUTUBE-WATCH-PROGRESS.md#2026-10-06pr-36-審查修正回歸階段紀錄)。

## 最新：YouTube 共看（2026-10-05）

U32 後續 `400cb6d`：使用者要求非房主隱藏「在這裡開始播放」。初始 hidden、render 依 snapshot.isHost 決定，handler 也核對身分；不能用 canControl 代替房主判斷。自動播放阻擋／對齊提示按角色提供可見入口。Windows 前端52項及原 Chrome 兩帳號可見性／實播驗收通過；本增量沒有重跑Linux／全套，未push／PR／部署。

已本地實作 `631eabf`、U29／U30，未push／PR／部署。`RoomWatch`僅在明確操作改anchor，用既有game state的watch marker通知；閉窗零watch請求，開窗穩態無輪詢／回報。native callbacks只更新本機，requestId去重及instance／session／revision／controllerEpoch隔離舊操作；GET衝突回覆要合併，不能每個game poll重抓失敗marker。初始paused必須cue→pause，unstarted的seek可能自行播放。

TableMusic與TableWatch同媒體入口，加入影片只在本機suspend音樂。非modal浮窗拖曳頂端toolbar，buttons及nested SVG不能起drag；方向鍵位置、preferred與clamped分開，viewport／控制展開不覆寫偏好，關閉釋放pointer capture且晚GET不返焦隱藏按鈕。位置／個人關閉不POST。前端52、後端18、音訊11項，Windows／Linux完整各503項；實播62秒零新增watch請求，詳 [驗收／限制](../YOUTUBE-WATCH-PROGRESS.md)。

使用者因暫留720p模擬看到頁面只在左上；已逐tab清除metrics並驗normal viewport。官方browser viewport capability reset只還原當次目標，不可假設所有owned tabs都還原；每一尺寸測完即reset並DOM查核。測試截圖只證明當次尺寸，不能把fake DOM rect當實際CSS證據。

## 2026-10-06：PR #34 最新提交雙平台複驗

固定來源 `3dde6a4` 包含 main `b843a3f`；Windows Node 24.14.0 與隔離 Linux Node 22.22.1 完整各 **442/442** 通過，失敗／取消／跳過皆 0。鎖程式、移轉及 11 項鎖回歸與 main 完全一致，對 main 的 77 個變更檔未帶入 PR #36 或後續六項功能。Linux 僅展開乾淨 archive 執行測試，未操作正式資料、服務或 current；package 仍為本 PR 的 1.0.0，不能混稱另一開發分支已部署的 v1.1.3。父任務背景Chrome一席UI配合四合成帳戶API已走完四輪，跨輪及完局回看第一輪、收藏及3/4禁題均通過；沒有宣稱多人真機／弱網或GPU驗收。證據與來源 SHA 見 [整合驗證](../PR34-MAIN-INTEGRATION.md#2026-10-06最新整合提交複驗)。本段取代下方「本次無 Linux 證據」的現況，沒有核准／合併／部署。

## 2026-10-06：PR #34 整合 main

原 head `585eb63` 接上 main `b843a3f`，保留 #31 鎖修正、新版 AGENTS 及 #34 回看／收藏／禁題／動效。程式檔無文字衝突，本轮未修改功能邏輯；三份角色記憶檔首保留兩方新增內容。Windows Node 26.2.0 完整 **442/442** 與隔離 HTTP 四輪流程通過，前端測試是 VM harness；本次無真正 browser／Linux 證據。版本、驗收腳本時序限制及複審入口見 [整合驗證](../PR34-MAIN-INTEGRATION.md)，PR 維持 Draft，未核准／合併／部署。

## 2026-10-05：PR #31 鎖競態修正

`0682e43`：`src/data/locks.js` 的資料／發布／legacy PID 鎖只以 `wx` 取得，既有檔一律 `DATA_IN_USE`，不讀 PID 或刪舊鎖。`HistoryStore` 共用 legacy 取得函式；release 冪等，舊實例重複 close 不會刪掉同程序後來取得的鎖。讀取比對後 unlink 不能安全回收另一程序的 stale lock，不能以多一次比對或同步函式當跨程序修復。

`tests/data-locks.test.js`／`helpers/data-lock-worker.cjs` 用兩個 OS 程序在舊 unlink 前加屏障，重現共用 DB、其他目錄不同時仍雙重取得鎖；發布／legacy／HistoryStore 也重現。修後11項回歸及 Windows 完整374項通過。新版 writer 不可與仍自動回收 stale lock 的舊 writer 混跑；人工清理只在全部 writer 停止後進行，詳 [證據及限制](../SERVER-DATA-TRANSFER-PROGRESS.md#pr-31殘留鎖競態修正)。本次沒有 Linux、真實資料夾 chooser 或整合後多人實玩證據。

## 2cf8a44：畫猜過半禁題

2026-10-05 U28 已實作。`publicResults` entry 的 mutable ballot 與 immutable snapshot 分開；揭曉時固定 active 席位，含畫者及暫時離線者。`POST /api/draw/result/ban` 依 resultId 投一票，state 另帶 resultVotes；跨輪八份快照仍可補投，未公開／淘汰／晚加入／踢出不可投。最後一票先 DB transaction 成功才接受；503 可重試，不先發成功事件。

DrawWordStore 以題目 ID 或 normalized title 排除，內建列表、共編列表、後續候選與舊候選選取都要套用，空池安全結束。跨房禁題不一定增加本房 version，前端不可只依版本或快照 ID cache；同版本已知 banned 不因舊 poll 倒退。前端 pending、generation、跨輪 ACK 及獨立收藏狀態已測。

揭曉與結束側欄要讓工具列參與自然高度，不能溢出覆蓋玩家卡；新增投票只改 reveal 排版，原猜題作畫 canvas 規則保留。Windows／Linux 各431項及 Chrome 背景驗收見 [禁題進度](../DRAW-WORD-BAN-PROGRESS.md)，未部署；schema 13 及移轉規則與 SERVER-DATA 同步。

更新：2026-10-05；角色文件是可更新的專案知識，不授權對正式服務操作。

## 93d7a84：公開結果與共用動效

2026-10-05 已實作，取代本批以前的 PL-01／PL-02 提案狀態。DrawGuessRoom 的 `publicResults`、`roundStartScores` 為 non-enumerable Map，最多八份凍結結果＋畫布，view 僅 metadata；收藏依 user/resultId 去重，不能再取 live canvas。當輪基準收錄所有保留座位，避免復座者重算舊分；early finish 不自動公開秘密。完整權限、配額與 PNG 客端信任邊界見 [契約與驗收](../DRAW-REVIEW-MOTION-PROGRESS.md)。這不是 persistent match ledger，尚不支援新勝場統計。

`MotionPolicy` 的同版本 snapshot 仍更新 live heartbeat（social 不一定加 game version），但首次／重連／visibility 恢復先建基準；seen／Animation／lane 必須有界。BFCache persisted pagehide 只暫停、重建基準及 preview，不能永久 dispose gate；離頁清 renderer 時也要清對應 job 指標。新 DrawResults generation/selection 隔離晚到載入，獨立 encoder 保存固定 snapshot，關 dialog 不取消已送出的收藏。Windows／Linux 各402項＋Chrome背景驗收，細節及未測限制見同一進度文件。

## 責任與接手入口

此角色負責API/state、server權威／身份／同步、功能模組邊界、資料與效果的時序、可測性。先讀root AGENTS與角色索引，再按任務讀檔；與玩家agent確認遊戲規則／判定，與美術agent協商資訊階層和原創圖示，與server/data agent確認持久化及切換。

最近規格：[YouTube共看](../specs/SHARED-YOUTUBE-PLAYER.md)、[多環境資料](../specs/MULTI-ENV-DATA-MIGRATION.md)、[成就與戰績](../specs/ACHIEVEMENTS-AND-RECORDS.md)。YouTube共看已實作且隨前輪發布；成就擴充仍為提案。多環境資料的完整備份還原子集已實作，尚未把其他站資料切入本站，見 [工具](../SERVER-DATA-TRANSFER.md)。本輪schema15相容合併正在驗證。

## 已確認架構

- `src/app.js`建立rooms、seats與music/social maps。users UUID、room seat UUID、6位room code是三種身份；永久結果用match UUID／result unit，不能從名字回推canonical user。
- `src/db/index.js`Node DatabaseSync、WAL、同步BEGIN IMMEDIATE migration／transaction，本輪候選schema上限15，正式v1.3.0仍為音效版14；相容布局見SERVER-DATA檔首與移轉指南。async repository升級要重設transaction契約。
- 遊戲state由server裁決；client report是非權威。重送API靠requestId／revision／epoch與永久結果ledger，不只client busy或WeakSet。
- `src/history/store.js`記before/trace/after與enginehash、rng；進行中archive拒讀。不要把秘密歷史預設公開，新增state transition納入transact。
- 成就以玩家spec的server證據判定，不從UI文字／瞬時events判定：poker每個sidepot需winnerIds/refund/tie；race維修僅己方。骰運候選採本人4顆原始移動骰全1的accepted round metric，加上有效manual turn與正常完賽；相同結果重擲候選已否決，不能誘導為成就額外重擲。首次權威finalize凍結winner/participants，rules_completed與timeout等quality_flags分離。
- `public/race.html`內嵌thunder＋tutorial engine副本，修改引擎必須同步並驗embedded source一致。教學不開正式輪詢，非同步規則需bridge timer與換章cleanup。
- `RaceVehicleEffects.mount().show(events,state,{min})`只增SVG effects，不覆蓋外層位置或.race-car-moving；相同事件去重、重繪負delay、hidden cleanup、減少動態。它是已存在模組，新共看不能把這些effects覆蓋iframe。

## 設計與實作慣例

桌機1280×720优先，正文16／次要14、44px操作；保留玩家/角色/骰/剩車常駐，次要內容局部scroll或details。同功能走shared contract，不重複搬DOM猜selector。SVG圖示24 viewBox、stroke1.8/currentColor、round cap/join；原創生成器保存source/provenance、減動靜態、單次按需動畫。

程式/native向量足夠時可用Node內建fs/path/crypto手刻原創SVG與CSS動畫；不是聲稱自己畫了第三方素材。隔離原型[生成器](../../tools/prototypes/generate-motion-art.cjs)與[展示](../prototypes/motion-art.html)，只研究、不被app route引用。沒有適合素材時先確認圖意與可辨識性，不為湊圖下載不明授權資產。

## YouTube最關鍵接手事項

控制者是被選影片的提案者，房主可明確takeover。每位房員自行加入／手勢允許；聲音／全螢幕為個人偏好。使用官方IFrame，保留原生品牌/ads/controls，不能隱藏背景播放或遮擋。既有same-origin Referrer-Policy可能造成153，需按spec驗真實embed request。server anchor+clock samples+revision/epoch是時間權威，不承諾frame-perfect；廣告／buffer／autoplay失敗不可誤回推全桌。

## 必要驗證／交接

驗可判定行為與失敗分支，fake clock／多帳號權限／重送／重連／背景／cleanup，接著隔離UI流程。不新增只比字串的形式測試取代真節點/狀態；不要未驗就宣称視覺完成。明確報 source commit、測試範圍／限制／未完成。2026-10-05研究批次只寫spec與孤立原型；後續使用者已另要求實作畫猜房間修正，依最新範圍執行，不能把研究批次的限制當永久禁令。

## 畫猜房間設定接手補充

2026-10-05修正：新客戶端用非空且不重複的 `options.topics` 多類別清單，八個內建題材加 `custom`；勾選 `custom` 納入全部投稿，獨立於投稿原有的題材標籤。新UI以類別選擇代替投稿比例；舊API及歷史房間仍保留 `topic/customPercent` 原規則。空選擇拒絕，只有自定義且沒有題目不能啟動空輪。

waiting舞台顯示完整玩家角色卡；開局切回原本常駐比分名單。入座／離席用局部更新，保留房主未儲存設定草稿，同時更新開始按鈕；host移交仍需重建權限。共用foundation可能覆蓋遊戲樣式，尺寸必須量實際computed layout，不能僅憑CSS文字。驗收與版本见 [房間修正進度](../DRAW-ROOM-SETUP-PROGRESS.md)。

## 猜題者畫布排版

2026-10-05，基線 `5d1776f` 的本地後續修正：1280×720 猜題者畫布外框 854×427，原本置中於固定高 366 的 board，向上蓋住標題／題材字數／倒數，向下壓到玩家名單。使用者 U23 明確選擇維持畫布大小並隱藏該列；`public/draw.css` 以 `.is-drawing:has(.tools[hidden])` 限定猜題狀態，隱藏 `.board-head`，board 改自然高度，桌機列距 12px。不要改成縮小畫布，也不要靠提高 z-index 疊回提示。遊戲說明同步改為看畫布猜答案。

兩個隔離帳號、隱藏內建瀏覽器驗收：1280×720 外框仍 854×427，玩家名單 y634–705，頁面 scrollHeight 720；1920×1080 外框 1174×587，無頁面捲動；390×844 正常垂直排列、無水平溢出，手機仍需捲動。畫者標題與畫具保留；自然換至選題後資訊列恢復。證據只存 ignored `work/draw-guesser-before.png`、`draw-guesser-after.png`、`draw-guesser-layout-results.json`。本次只修版面與說明，未部署、未更新 PR，未重跑遊戲引擎測試或完成多人完整遊戲。

2026-10-05 送審整合補充：上述 CSS 修正 `22d02c3` 已保留於接續分支；`cc02b56` 接上 PR #30 時 tree 完全不變。最新程式 `6e655de` 另補移轉舊 schema 相容性，完整 Windows／Linux 各335項通過；PR 四項回覆經獨立65項回歸複查。此筆取代上段「未更新 PR」的後续追蹤入口，實際 PR 與驗收狀態見 [最新進度](../SERVER-DATA-TRANSFER-PROGRESS.md#送審前最終複查)，未部署。

## 共用聲音接手補充

2026-10-05、來源 `2e8dc4d`：`AudioSettings.get/set/subscribe/playEffect/stopEffects/bindPreview`集中個人music/effects偏好與音效生命週期。所有頁面先載入模組，靜態路由白名單也要更新。不要再加入遊戲自己的sound flag、volume或下方控制；右上角site-header設定是共用入口。

`ah-audio-settings` version 1是該瀏覽器／網站來源的個人偏好，storage同步其他頁，不是DB跨裝置設定。音樂transport仍由RoomMusic管理；TableMusic只套用個人音量／收聽，保存opt-in等可信手勢才能播放，拒播可恢復。靜音音效立即停止且不重播；隱藏／離頁釋放。音樂庫重繪需釋放bindPreview監聽，原生控制與共用偏好雙向同步。

Windows／Linux各239項通過；實際Chrome解碼／播放／個人暫停、五款設定一致與浮層邊界已驗。限制及證據見 [共用聲音進度](../SHARED-AUDIO-PROGRESS.md)，不要宣稱量測過實體喇叭或主觀聽感。

## 彈幕與設定接手補充

2026-10-05、來源 `15af1dd`：`GameShell.settingsActions()`統一畫猜／送禮／同頻的儲存按鈕及`#roomSettingsFeedback`，欄位與footer必須在同一設定容器；各遊戲保存handler把pending／success／error導向本區，不只側欄。保存重繪後返焦新按鈕。送禮／同頻busy同步須包含舞台內儲存按鈕，create／join的finally也要解除busy，否則剛開房的按鈕會持續disabled。

畫猜用`UIPopover.bindDetails`定位設定body，保存重繪前記open，重建後恢復；入座沿用局部更新保留草稿。空類別在同區報錯。八人1280×720及390×844已驗，送禮／同頻未改入座時表單重繪策略。共用彈幕保留依容器／文字寬計算路程與animationend清理，取消原地淡出分支；不用動畫完成事件推進遊戲規則。Windows／Linux各239項通過，三款背景Chrome保存／公開資源一致性及清理見 [本批進度](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)。

2026-10-05後續卡頓檢查：使用者正在另一台電腦，明確表示控制端沒問題即可保留。來源仍15af1dd，未改正式程式。原Chrome八人畫猜基準／1則／8則／8則＋SSE筆畫同步各10秒，rAF中位7.7ms，作畫最長31ms，無>50ms longtask或LoAF；同時8次開始／结束，没有重播。追加時append→量寬仍有同步layout，但未證實為持續卡頓原因。rAF不是螢幕/GPU實際呈現FPS，不可因此判定別台是硬體問題；完整方法、原始證據及限制見 [效能檢查](../BARRAGE-PERFORMANCE-CHECK.md)。

## 完整資料移轉接手補充

2026-10-05、程式 `c831e87`：`src/data/transfer.js`＋validation／locks 提供加密完整包與新代 restore；AI 入口 `tools/server-data.cjs` 的 stdout 為一筆 JSON、error code／退出碼穩定，stderr 可含 Node experimental warning。帳戶原密碼、UUID、權限與 disabled 原樣保留；還原撤銷舊 token。config 新增 MUSIC_DIR 与严格 true／false 的 EXTERNAL_SIDE_EFFECTS_ENABLED（legacy 預設 true，restore 回傳 false）。SubmissionService 每個公開出站路徑都拒绝 false，不僅依賴沒有 GITHUB_TOKEN。

app constructor 在任何 DB migration／history／community 寫入之前取得資料鎖，app close 與 admin CLI 完成才釋放。restore 發布有 sibling lock 与 marker，未完成的 generation 不能啟動。SQLite schema 仍12；檢查 source 用 readOnly DatabaseSync，migration 只用副本。history 仍 schema1，工具接受額外 header/session 欄位，match header 已帶 setup/source，不要求其舊 session JSONL 永遠存在。

Windows／Linux 各255項（移轉16項），雙向跨 SQLite restore／登入／私有圖庫／音樂 Range 通過；详 [驗收](../SERVER-DATA-TRANSFER-PROGRESS.md)。沒有正式 migration／部署，merge、Postgres 与房間續局未實作；回退須旧 code＋data 一起，新代已寫入時不可直接丟掉新資料。

## PR #30 資源與畫布修正

2026-10-05：PR head `1b8c85d` 已推送，移轉分支backport `db9d0b6`。等待離席移除；進行中身份最多64且自行離席復座用同ID，踢出封鎖不繞過。HistoryStore session輪替及已完成／中斷紀錄淘汰有總量、單局、檔數與保留期；active match不可截斷湊空間。配額／I/O failure暂停時，離席及最後真人清房仍能執行，未完整保存不能回報已落盤；shared RoomApi呈現專用historyWarning。歷史schema仍1，完整header內嵌setup使舊session可回收。

Live StrokeCanvas.createRenderer保留前綴，最多16張／8MiB快取。fill每輪48、每秒2，undo/clear不返還，去重batch及累計point也不返還。HTTP ACK／SSE次序、reset、舊快照與換輪必須測race；optimistic fill最多一筆，brush採version／strokeId鍵，避免每event序列化全部points。Studio原redraw及24容差語意保持。兩平台各260項；原Chrome填色／復原／重連兩席hash一致，第49次429且brush可用。首次完整48fill重連仍約486–524ms，不能宣稱零停頓或推斷其他電腦硬體，詳 [修正證據](../PR30-RESOURCE-LIMITS.md)。

本機移轉UI是獨立工具，不依賴遊戲登入／運作；同源token防護不是隔離本機OS程序。審查發現舊state回應可能解鎖新的POST，須以localSubmitting與查詢epoch忽略過期回應；網路狀態未知時保持鎖住並重新查，不自動重送可能已執行的移轉。

2026-10-05、`47d79c7` 管理 UI 後續：同一 busy／stateEpoch 契約延伸到串流上傳。刷新使用 server uploads 清單恢復或清理；DELETE 可能已成功但 response 遺失，故 idle 清單校正 pending ID，404 視為已清理，不能讓重試永久卡住。預演資格綁 verified bundle UUID 與來源／目的地／選項，改欄位即撤銷；core 在發布前驗 expectedBundleId，不能僅比較 path 或事後檢查 response。五類統計常駐，JSON 除錯資訊收合；手填本機來源驗證成功清掉選檔草稿並顯示實際來源。27 項 VM 測試覆蓋 race、WebKit 相對檔路徑映射、身份與失聯清理，瀏覽器及全套證據見 [移轉進度](../SERVER-DATA-TRANSFER-PROGRESS.md#管理者匯入流程與背景-chrome-驗收)。

上述UI競態已在 `215f82c` 修正，11項VM回歸＋4項HTTP通過；PR／移轉／最新遊戲功能完整整合後 Windows、Linux 各304項通過，詳 [整合證據](../SERVER-DATA-TRANSFER-PROGRESS.md)。移轉工具與UI只在本地分支，PR資源修正已推送，兩者均未部署；不可沿用舊259項數量當作最新總數。

2026-10-05 後續複查，PR 程式 `3b19720`／本地整合 `e71989e`：失敗開局不能留下 `playing` archive；fsync／rename 錯誤後仍需將實際 JSONL／tmp bytes 計入配額。大量 canvas 恢復使用 `renderCooperatively`＋MessageChannel，每批最多 1 fill／16 strokes／約8ms軟預算，最新 snapshot／undo／換輪取消舊 job。`render` 同步契約保留；save 等最新 render，失敗或換輪禁止上傳部分／錯輪畫作。PR Windows／Linux 各279項，本地整合 Windows323項通過；本次沒有重跑整合分支Linux全套，不能寫成Linux323項。Chrome cold48fill三次皆無>50ms長任務，maxBatch15.7–18.4ms、cache8MiB、hash相同；單fill不可搶占，首次排程仍可能56.8ms。詳 [修正證據](../PR30-RESOURCE-LIMITS.md)。

Gartic HAR 尚未取得；[官方錄製方法](../research/GARTIC-NETWORK-REFERENCE.md)已核對 Chrome exporter 的 `_webSocketMessages`，其訊息內容不因 sanitized 就自動匿名。HAR是傳輸證據，不是客戶端 CPU 工作／server 架構證據，不能從UI或payload大小推斷填色實作。

同日 U21 允許換瀏覽器／安裝官方擴充，背景偏好保留。Chrome 擴充已連線，內建瀏覽器隱藏開頁成功；目前官方工具未列出 CDP／HAR 能力，已告知使用者官方 Developer mode 設定並等候回覆。下次先核對設定回覆與實際 capabilities，不能重複安裝、擅自提高視窗或把官方文件能力當成已錄製證據。

後續 U22 明確指示直接開啟；已用設定 UI 啟用完整 CDP，重建 CUA 工作階段後官方 `cdp` capability 可用，取代上一段的等待狀態。Gartic 背景單席採樣已完成，原始事件與截圖只存 ignored work。持久 REPL 跨 cell 的採樣游標使用單一可變物件欄位，避免不同函式保存舊 binding；匯出仍須檢查 sequence 去重、順序、truncated 和時鐘映射，不把設定成功當作資料完整的證據。詳細結果見同一 [網路參考](../research/GARTIC-NETWORK-REFERENCE.md)。

同日追蹤回覆修正 `e60f853`／本地整合 `7c25c7b`：round 會在新對局重回 1，不能單獨作為畫布／配額 identity。server 每新畫布生成 canvasEpoch，POST 必填且在去重／配額修改前驗證；state／snapshot／ACK／SSE 同帶 epoch。client 換 epoch 清零 quota、draft、renderer、sendQueue，所有等待後的發送／套用／儲存重新驗 epoch；command finally 另以操作 token 隔離。clear／undo 不換 epoch、不退額度。舊 client 須重新整理，新舊 server/client 不可混用。Windows PR286／本地整合330項、背景實際新局填色與舊請求拒絕已驗；各平台最終結果見 [PR 修正證據](../PR30-RESOURCE-LIMITS.md#追蹤回覆新對局第-1-輪的配額隔離)，不可沿用舊279／323當最新數量。

2026-10-05、2618c4b 管理UI：`src/data/ui.js` 是獨立localhost HTTP wrapper，static UI 位於tools/data-transfer-ui/，不加入遊戲路由；`tools/server-data-ui.cjs`／npm data:transfer:ui為入口。驗Host/Origin/隨機token、64KiB JSON、source/target停寫ack，互斥工作与記憶體lastResponse。只回傳run/safeError去敏結果，不能寫rawSQLite錯誤／key bytes／users到UI。前端原生required、textContent更新、預演預設、改路徑取消確認，刷新GET state不重送POST。HTTP4項與全套259項在Windows/Linux通過；主agent原Chrome背景完整合成表單流程／reload通過。收合版31c91dd以details隱藏JSON，保留config/nextSteps DOM常駐，統計三欄及140px nowrap標籤；詳進度，無正式資料與服務變更。

## 2026-10-06：股市冥燈本機整合

隔離 main b843a3f，本地 feature/market-jinx-local：/market 沿用既有 session canonical UUID，管理權限重查DB，不採用原型 localStorage。src/market/store.js 以 BEGIN IMMEDIATE、requestId及 expectedRevision 實作日期／投票／結算，取得寫入鎖後采樣截止時間。更正先撤銷舊 award 再保存新 award，失敗原子回復；public/market-rules.js 共用規則，日期保存快照。當前 schema上限13，取代上方12的最新架構描述。Windows Node26.2.0 完整387項、13項市場回歸及背景 Chrome 1280×720／390／320 流程通過；未測Linux／Safari／公開負載。以Draft送審，未合併或部署，證據與接手見 [本機說明](../MARKET-JINX.md)。

同日 PR #38 審查修正：STALE_VOTE 讀新票後須更新待提交草稿 expectedRevision、保留選擇，並要求玩家明確重試。loadSequence 只隔離 GET 套用，不能代替整個操作生命週期的 busy；手動更新先鎖定直到 finally，避免舊清理解鎖新寫入。四項回歸執行實際 market.js＋SQLite store，原程式3失敗／1保護項通過；修後市場17、完整391項通過。Chrome held-fetch 驗真實控件鎖定／0寫入／焦點恢復及三寬度導覽。本筆391取代上段387作最新測試數，詳 [修正證據](../MARKET-JINX.md#2026-10-06pr-38-獨立審查修正)。

同日最新main `1447430` 已包含 #34，#38必要整合改為schema14，原禁題版／市場版13各保留已有資料並補另一方空表。保留main引擎、draw store／前端、MotionPolicy、資料鎖及AGENTS，入口／static路由合併雙方變更。六份測試自動合併的SCHEMA_VERSION重複匯入已消除。市場21／Windows全套463及整合版Chrome完整市場流程、held-fetch與三寬度導覽通過；取代391與最新schema13描述，詳 [相容整合](../MARKET-JINX-MAIN-INTEGRATION.md)，#38仍Draft、未合併部署。

2026-10-08部署教訓：SIGTERM健康逾時不可按原pin盲重啟或刪活data locks；先分current pointer與實際PID cwd/port，保持9帳戶/21表/env核對。已授權zero-room更新可重連已驗UID/command/Restart=always的既有代理協助HTTP drain，保server自然close。writePrivate wx是不可覆寫的證據契約；失敗receipt另存，confirmed另建並以受驗內容原子換入，不可在catch迴圈重複對同名wx寫入或拿verification failure當runtime failure。不要早於activation完成跑dependent公開smoke；本批舊版讀取失敗发生於0登入/0房。詳完整還原進度，不宣稱一般情況都需restart proxy。
