# 動畫角色記憶

2026-10-23／2.38.0 本機候選：使用者123.zip的15款Canvas攻擊改為Q/E配裝，移除大廳按鈕；保留附件繪圖，移除工作台假人傷害、全屏震動閃光與全域輸入，播放/計時器有界且可取消。預覽逐款有可見像素，沒有實機/FPS/發布結論。見[操作與驗證](../LOBBY-QE-ATTACKS-20261023.md)。

2026-10-23 決定版：以使用者24_3原稿更新19款並新增4款，合計24款；附件錯置的第6格依使用者確認保留原虛式茈，待補新版。補齊皆盡遺漏動畫，Edge逐款實際播放與R清理通過，沒有實體手機/FPS或發布結論。見 [本輪紀錄](../FINAL-ENTRANCE-VFX-20261023.md)。

2026-10-23／2.37.0 本機候選：大廳四邊以有限逐幀環繞接續移動，不用跨整個畫面的 CSS 插值；F 共用能量球／命中環在大廳同步，兩秒冷卻，初載與重連不補播，減少動態保留靜態命中語意。Edge 雙帳號與390px有限驗證通過，無實體手機／FPS或發布結論。見 [實作與驗證](../LOBBY-WRAP-ATTACK-20261023.md)。

2026-10-21追加：第一批12款成就框使用環境質感，第二批12款使用挑戰主題方向動效，各款pattern與keyframes不同。共享reward-surface::before，減少動態／靜態／背景停止；播放器沿用同一裝飾。未宣稱實機FPS或新瀏覽器驗收，見[範圍](../UI-REFINEMENTS-20261021.md)。

2026-10-21：特效藥精華變化時以700ms有界管線流動呈現；初載不播放，遵循共用MotionPolicy及背景檢查，病患切換／元件卸載取消舊動畫。無瀏覽器動效／FPS驗收，詳[特效藥裝置](../QUACKS-DISTILLERY-20261021.md)。

2026-10-15／2.9.0：新增 Stitch 20 款動態彈幕框與收藏庫分頁，保留原 4 款；靜態模板、框飾動畫與文字分離，沿用白名單事件及本地選框偏好。20 款隔離雙席傳送、現行整合服務代表款及聊天表單、1440／390／320px 選框與收藏庫、長文字／關閉框飾尺寸及減少動態設定已觀察。無測試套件、實體手機、全遊戲階段或 FPS 結論。詳 [設計、實作與驗收](../BARRAGE-STITCH-20.md)。

2026-10-15 候選 2.7.0：郎中 Stitch 與畫猜以同一等待室／聊天室元件整合；採購以圖片、價格與勾選呈現，保留購買取消、最新原生控制器及原音檔。五席、第一輪實際買退、主鍋／放大提示、1280及390／320採購與有限畫猜開局／筆跡已觀察；未新增完整九輪、實機手機或聽感結論。詳 [本輪整合與驗收](../STITCH-QUACKS-INTEGRATION.md)。

2026-10-08最新正式 **v1.15.0／f4cbdfa**：彈幕框Stage A發布，雙平台完整各1,432、公開25資源與五款三席frame/avatars通過。PNG上傳收藏／成就與勝場ledger仍缺；完整source/首輪Linux暫存I/O失敗與重跑/備份/native scope/9帳戶及21non-session表保留/own cleanup見 [最終進度](../BARRAGE-FRAMES-PROGRESS.md)與 [backlog](../SPEC-BACKLOG.md)。下方候選及1.14.2是歷史；tag固定受測程式，沒有新PR/push，不把有限取樣當全phase/讀屏/200%/FPS。

2026-10-08內建彈幕框候選 **v1.15.0／f4cbdfa**：靜態框飾只由外bubble既有8秒translate帶動；以实际測得height預留8px gap、最多4則不補播。個人收框偏好不接MotionPolicy.clear，文字／emoji開關才決定是否收彈幕；OSreduce仍5秒靜態。背景sample初300ms未advance而1秒probe有位移，不拿此說GPU/FPS或診斷使用者別台PC。素材為本站CSS原創；StageB PNG/授權/版本grant尚未做。精確scope/測試/發布見 [進度](../BARRAGE-FRAMES-PROGRESS.md)。

2026-10-07最新正式 **v1.14.0／b4ebb15**：圓角骰子與連續暖色WebGL氮氣已發布，雙平台各1,413通過；正式三席13骰／9資源與真nitro移動、21non-session表rows+BLOB／9帳戶allfields保留。sessions225→232是驗證登入變化，own房／登入／代理／tabs已清理。氮氣改為連續尖尾橙紅外焰／暖黃芯／小halo，跟逐格移動wrapper的CTM車尾；同command只1emitter，phase離開即停止，reduce／loss清理且回退、不補舊動畫。 完整source／備份／原生範圍見 [本批進度](../RACE-FX-VISUAL-REFINEMENT-PROGRESS.md)／[spec](../specs/RACE-FX-VISUAL-REFINEMENT.md)。下方1.13與pending均為歷史，此筆取代其現況；沒有新PR／push。native hidden／200%／讀屏／玻璃跳台道路pan及FPS未驗，不以完整suite推定。

2026-10-07最新正式 **v1.13.0／353d8b6**：雷霆原生WebGL立體骰子／短符號及清理回退已發布；雙平台各1,408、正式三席13骰與7份資源／資料保留通過。17骰450ms原生圖為隔離定格，hidden原生未觸發、無FPS結論；結果和權限由server決定。完整source／備份／邊界見 [骰子進度](../RACE-DICE-WEBGL-PROGRESS.md)／[spec](../specs/RACE-DICE-WEBGL.md)。下方1.12與pending是歷史；tag固定受測程式，沒有新PR／push。


2026-10-07雷霆立體骰子新批（研究／實作中、尚未native驗收）：WebGL只承擔約一秒cube翻滾及權威結果面，沿用id＋startedAt cycle、server結果mask／owner確認；同cycle不重播，動畫完成不送accept。17骰共用一個canvas，與GameFxLayer共享全頁optional兩context預算；真draw才遮原骰面，hidden／reduce／loss／失敗立即fallback、idle停frame。特殊faces保留六面重複配比，文字／條件／可讀結果仍DOM。來源、renderer/dialog協商、CSS tumble與body scroll風險及待驗矩陣見 [新規格](../specs/RACE-DICE-WEBGL.md)／[本次進度](../RACE-DICE-WEBGL-PROGRESS.md)；沒有新FPS或發布證據，不用舊車旁粒子測試代替骰子驗收。

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07元件回饋新批實作中：卡片／通知僅短回饋，新earned通知旁才用已有原創GameFxLayer短粒子；不加長背景、常駐ticker或逐frame API。只有server既有新earned差集才慶祝，initialbaseline／舊結果不播；hidden保通知可讀正文、取消入場／粒子並不補motion，reduce保靜態語意。真GPU／idle／畫猜途中回歸待驗，見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，正式基線1.11.1，未發布新批或宣稱FPS收益。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

## 2026-10-07：正式v1.11.0可見提交與音樂恢復

畫猜不只比version／終點圖：staging因clear／undo已寫，最新job完成要把未present surface提交；途中維持舊完整畫面，舊job不能蓋新圖，no-op不copy。本次native12 clear／undo×3路徑×2排程RGBA等fresh；第二輪held30樣本whiteAfterInk0、viewer7partial，第一輪錯誤array取樣已排除。背景Audio只resume此次visibility自動pause的同clip，手動暫停／關聲音／拒播／共享暫停／退出影片不可被蓋掉；無聲MP3／FocusEmulation不是喇叭或物理切頁。既有WebGL／checkpoint保持，source／限制見 [最新進度](../PR46-REVIEW-FIX-PROGRESS.md)；下方v1.10與v1.9版本為歷史。

## 2026-10-07：正式v1.10.0車旁粒子

雷霆nitro／smoke／sparks接公開eventId／visual anchor，單次有界、idle停frame，不靠特效結束推進逐格／事件規則。使用者允許更好的新效果取代舊效果；實際畫出kind才遮同類SVG裝飾，標字／bullet／trail／spin保留，空幀／hidden／reduce／loss即復原且不補播。用visibility避免舊keyframes蓋opacity；最終nitro替換8採樣、idle／loss已驗，restore是另一早期cycle。背景採樣不是前景FPS或性能優勢，自然smoke／sparks與完整碰撞trace列後續。見 [進度](../UI-POLISH-WEBGL-PROGRESS.md)，此筆更新下方WebGL「未實作」現況，歷史保留。

## 2026-10-07：正式v1.9.0呈現規則

畫猜viewer可有少量有界延遲按真pointTimes逐步呈現，canonical與artist不延後、artist不重播ACK。snapshot／reconnect／gap／reveal／undo／clear／fill切回完整baseline，取消舊尾巴；原子staging整幅完成才呈現，yield保留上一份完整圖，cache含stage≤8MiB。每輪都查持筆／ACK／換畫者的白底／殘影與queue／rAF／timer，合法clear和新輪空圖分開判斷。

CountdownBar以WAAPI linear scaleX呈現server deadline，hidden／pagehide取消、show／BFCache及epoch／phase重設，既有更新中校正wall drift；不用裝飾動畫推進遊戲規則，也不新增逐frame JS或server broadcast。中途可見frame、Animation控制採样與最終canonical分開驗，不把背景工具trace寫成60fps。契約及證據集中於 [spec](../specs/DRAWING-SMOOTHNESS.md)／[本輪進度](../DRAW-TIMED-PLAYBACK-PROGRESS.md)。

2026-10-07 WebGL評估（未實作）：雷霆煙霧／火花／碎片是第一個局部原型候選，效益可能在提高特效密度而非目前少量SVG必然掉幀。共用特效層沿用已確認eventId、逐格／checkpoint時序與MotionPolicy，名單／骰子／操作／說明保留DOM；送禮彩帶等後續重用，普通卡片transform不先搬進canvas。需限制粒子／貼圖、空閒停ticker、hidden／減動與context loss退回；沒有新的FPS實證或已部署功能。與程式角色的取捨及官方來源見 [WebGL導入評估](../research/WEBGL-ADOPTION-ASSESSMENT.md)。

2026-10-06正式 v1.1.3：雷霆公開事件以`afterMotion`定位於已確認位移之後，最多64筆；一般checkpoint停留1600ms、道路3200ms，同checkpoint批次保留全部連鎖文字。位移FX只在`onMove`開始該段時觸發，presence重繪不隱藏事件、不重播或延長停留。event-only亦可hold；略過／Escape只縮短事件停留，不跳移動或dice。全部位移／事件結束才呈現下一步，鎖遊戲動作但poll／roster／chat不中斷；hidden／reduced／停用／重連不補播。dice／pending後舊route仍丟棄，需重新選路。既有回覆payload增加，沒有新HTTP、伺服器timer或DB。Windows／Linux各625/625；背景Chrome火焰、玻璃→地雷→打滑及油漬→跳台順序已驗。正式受測22a9d6f／本地v1.1.3 tag，current releases/22a9d6f；版本／資源／帳戶驗收通過。配置時長不是FPS證據。詳 [進度及證據](../RACE-MULTI-MOVE-PROGRESS.md)。

2026-10-06 v1.1.2正式，已更新shhuang.cc：雷霆改以公開motions還原所有確認位移，普通／多格／玻璃／油漬／推撞／打滑／暈頭轉向按group順序每格240ms，地震同group車輛並行；跳台／爆炸弧線、淘汰motion ghost、終點視覺落點及直升機部署，車輛抵達後道路平移480ms。移動完成才呈現dice／下一步controls／winner／教學；依使用者指示等待期間鎖遊戲動作，輪詢、名單與聊天繼續更新。hidden／reduced／停用／重連直接同步，不補播。取代v1.1.1及更早「不鎖操作、淘汰不回放、強制位移僅末點」的限制；伺服器規則照常結算。Windows／Linux591/591及引擎／控制器回歸已通過，主agent背景Chrome確認碰撞／推移／玻璃／六車地震出界／道路換片／終點；跳躍、拋飛、直升機仍以回歸驗證。正式API／資源／設定與7帳戶已核對。配置秒數與截圖不是FPS證據，詳 [最新正式進度及證據](../RACE-MULTI-MOVE-PROGRESS.md)。

2026-10-06逐格滑動修正v1.1.1：雷霆movePath每格240ms，移除900ms總長上限；SVG presence重繪恢復elapsed、連續指令接續既有路線，起跑滑入／實際中斷點有回歸。背景／停用／減動不補播，不增加逐格網路或用動畫推進規則。Windows／Linux各554項及背景Chrome八格截圖／改名重繪／一次POST證據見 [移動進度](../RACE-MULTI-MOVE-PROGRESS.md)；不是FPS量測。已更新shhuang.cc並驗版號／資源／帳戶；動畫GIF來自隔離本機實玩。此項取代下方舊多格動畫實作說明。

2026-10-05 U33 實作補充：大廳首次auth成功後對可見標題／大廳／遊戲插圖播放420ms、最多165ms錯開的opacity／translateY入場；無遮罩、不等動畫解鎖。沿用MotionPolicy，背景或減動／停用跳過，一頁一次、回焦／輪詢不補播。Chrome重新整理實際讀到Y9.47→2.03px及opacity0.7347→0.9430；停用後8次皆none／1，再還原偏好未補播。這是DOM樣式觀察，不是GPU/FPS證據。雷霆多格動畫只演server實際走過的步驟、不推進規則；框圖建議靜態九宮格沿用原彈幕移動、僅評估。狀態见 [整合進度](../PARTY-UPGRADE-PROGRESS.md)，未PR／部署。

更新：2026-10-05。角色由 `typography_design` 承擔；這是可續讀的專案記憶，不是正式功能或對下一輪的新增授權。先讀 [共用偏好](MEMORY-LEDGER.md)、[記憶協議](MEMORY-PROTOCOL.md)及當前 [動效／素材方案](../specs/ANIMATION-ASSET-PLAN.md)。

## 已驗證與來源

2026-10-05 後續程式 **93d7a84** 已採用共用政策及小批動效，取代下表送禮 CSS 重建重播、獨立停止控制、race alwaysAnimate 與 PL-01 尚待實作的狀態。`MotionPolicy` 整合五款、右上個人動畫／彈幕開關及舊 off 偏好；四軌8秒，減動靜態5秒，不補播舊訊息。送禮新收禮者700ms、完整結算240ms、確認160ms，沒有用動畫推進規則。雷霆減動仍保留3.2秒事件文字與骰面。402項 Windows／Linux 回歸及 Chrome 操作證據見 [進度](../DRAW-REVIEW-MOTION-PROGRESS.md)，duration是程式配置，不等於實測GPU流暢度或全站WCAG合規。

| 類型 | 本輪結論 | 證據與限制 |
| --- | --- | --- |
| 使用者偏好 | 桌機優先；名單、角色圖、骰子、剩車直接可見；emoji 彈幕不是角色表情，角色原行為保留。 | 使用者指示彙整於 MEMORY-LEDGER U01/U02/U04；不能為做動效把必要資訊藏起來。 |
| 程式事實 | 同頻的玩家聚合已有 420ms 動畫，僅同輪作答→公開 review/reveal、在線可見時觸發，重繪先取消舊動畫。 | `public/majority.js:gatherPlayers/receive/stopGather`。保留事件含義，不換成純裝飾粒子。 |
| 程式事實 | 雷霆車旁 SVG 效果有事件 ID 去重、重建保留 elapsed、wrapper cleanup、hidden 清除；短字實際縮放後至少14px。 | `public/shared/race-vehicle-effects.js`；非所有共用動效都因此符合減少動態。 |
| 程式事實 | 畫猜 live gate 排除首次載入、重連、背景及超過5秒的資料間隔，階段過場約300–470ms；猜中徽章1700ms。 | `public/draw.js:animatePhase/showCorrectFeedback/receive`。畫布筆畫同步不能加等待。 |
| 程式事實 | 送禮由目前收禮者確認才換人，全員收完才顯示總分；卡片到達700ms，動效關閉或減少動態有静態樣式。 | `public/gift.js:render/renderAction/action`、`gift.css:.delivery-gift`。目前 CSS 入場仍隨 renderer 重建觸發，需獨立 live event 閘門。 |
| 實玩觀察（轉述） | 畫猜8秒揭曉時開說明，背後換輪；關閉後上一輪答案／畫作／收藏入口不見。 | 主 agent 2026-10-05 回報，詳見[實玩T2](../research/PLAYER-PLAYTEST-ASSESSMENT.md)；1767×1196背景Chrome角色測試，非真人調查。我未開瀏覽器重現，優先公開結果快照與回看。 |
| 原型實測（轉述＋本地閱圖） | 主agent兩個replay各按一次，觀察播放中→完成、無自動循環；配置700ms、控制44px；390×844內容寬375，無水平溢出，之後還原1767×1196。 | 2026-10-05背景Chrome，私有proof `work/agent-prototype-proof.png`。我僅閱source與本地proof，不操作Chrome；reduced僅source確認，未瀏覽器模擬，200%原型亦未實測。 |

## 方法與設計推論

先問效果要解釋哪個已確認事件、對象在哪裡、文字結果如何留存，再選素材。按下只表現 pending；成功、得分、命中由 server 確認後顯示。`animationend`、音檔播放完成或圖片載入不能決定伺服器規則。雷霆依2026-10-06使用者要求，已確認的位移先呈現完再開下一步，等待期間暫鎖本機遊戲操作；保留輪詢、玩家資訊與聊天更新，取消／減動時直接同步並解除等待。

每項列出 trigger/eventId、duration、target、static fallback、遮擋範圍、failure/reconnect、hidden/reduced-motion、cleanup。初次 hydration／重連只恢復最新狀態；重播必須本機手動，不推進房间。取消 Web Animations 時處理 `finished` 的 AbortError；避免用極短 duration 讓必要文字瞬間消失。

桌機1280×720、820px賽道、200%文字放大是驗收情境；秒數及密度上限是專案假設，不是通用標準。動效不能遮住姓名、骰面、車損、合法落點、自己答案或確認按鈕。動效層 `pointer-events:none`，真正的跳過／重播入口另保留44px控制與焦點。

## 假設與待驗證

- 共用8秒文字／emoji彈幕需要獨立停止／隱藏控制；本輪僅source audit，未判定全站WCAG符合。
- `GameImmersion.mount('race',{alwaysAnimate:true})` 的 allowsMotion 繞過 OS reduced-motion；車輛／骰子模組另外尊重設定，不可把局部合格寫成全站合格。下一輪統一「必要資訊直接顯示、非必要動態可減少」的政策，保留使用者要看的骰面／文字。
- 700ms入場、每畫面最多3個裝飾焦點、成就私人700ms展示為設計初值；真人觀察後再改，不強加同步等待。
- 關閉動畫不應改既有角色表情 API；GIF靜態封面屬獨立未授權功能研究。

## 後續與取代舊記憶

P0由程式／玩家方先定義畫猜公開回合快照、答案／畫作／收藏回看；動效方等可靠event contract。P1核對送禮live入場、共用停止控制與各模組reduced-motion，之後才選Kenney粒子小樣。原型只在 `docs/prototypes/`，上述研究批次未改正式遊戲程式、未部署。

2026-10-02沉浸研究的「完整送禮結果立即可讀、自動2–3焦點」不是現在送禮階段規則；本輪以使用者收禮者確認／全員收完後結算為準。後續更新須寫版本與重現，不沿用過期房碼或此段的授權推論。

2026-10-05彈幕修正已實作及部署（`15af1dd`、U16）：使用者明確要求文字飄過，共用文字／emoji沿舞台右向左8秒線性移動，opacity維持1；移除原有reduced-motion原地淡出替代，其他效果的設定處理未改。公開站連續20畫面X座標837.08→722.21，本地亦確認移動；角色表情未變。詳見 [驗收進度](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)。停止／隱藏控制仍是前述待研究事項，不能把本次移動修正宣稱為全站無障礙完成。

同日後續使用者回報另一台卡頓。控制端Chrome八人畫猜1／8則及作畫同步量測沒有持續停頓；rAF中位7.7ms，作畫最長31ms，無>50ms長任務／長動畫幀，未改動畫。此結果不是GPU畫面幀率，也不代表已排除其他電腦的問題；不可直接用transform、will-change字樣宣稱已硬體加速或流暢。取樣與限制見 [效能檢查](../BARRAGE-PERFORMANCE-CHECK.md)。

### 2026-10-13 追加：郎中大釜與配書／結算

新增分色真人藥材書投票與房主平票裁決；測試 AI 不投票。原創九色藥材 SVG 共用在書卡、袋中、購物及銅釜落點；可切換公開大釜，提示支援指標、點擊與鍵盤，切換不改自己的操作對象。輪值起始玩家親自抽占卜牌，結算新增手動獎勵骰及綠黑紫效果確認，第二機會恢復記錄的回合起點。

完整回歸2055、最終相關27均通過；實際 UI 驗證投票、抽牌、抽藥／停止、公開大釜切換、藥材提示、擲骰與效果確認。1280視窗專注大釜寬672.4→742.95；390手機模擬無橫向溢出。動畫為在線新揭曉觸發、重連不重播，減少動態靜態卡；未驗證實機手機或原生全螢幕。此項取代早先整套配書／自動骰流程；未部署。細節與證據見 [郎中進度](../QUACKS-PROGRESS.md)。

### 2026-10-13 最新：郎中沉浸介面與成就
取代前述整套預設和整場一次藥袋配額；每輪私有快照一次、逐色隨機票、唯一鍋色／公開鍋名、白色炸彈、召喚翻牌與公共骰動畫／結果、原創資源和爆炸WAV、回合火焰與尾巴格、永久液滴／老鼠石分離。五枚郎中徽章由固定開局帳號及合法九輪操作伺服器判定，交易回滾與刪房後同程序重試、AI/test/tutorial排除；既有schema/單位帳本不變。完整2078通过，SVG排版渲染檢視；本輪沒有新增真瀏覽器或喇叭聽感驗證。來源、範圍、跨程序及跨桌限制見 [最新郎中進度](../QUACKS-PROGRESS.md)。未發PR／部署，候選仍1.29.0。

## 2026-10-14 Stitch 動態模板
保留原扇形卡牌与角色素材，選題以 MotionPolicy 演出 400ms 題卡，原答對及頒獎演出沿用；角色泡泡依新事件更新，首載／重連不補播。原生持筆／放筆及換輪取樣見 STITCH-UI-IMPLEMENTATION.md，沒有跨裝置／弱網／60fps 結論。


## 2026-10-14 Stitch 功能與版面 2.5.0

2.5.0 取代上節 400ms 題卡轉場：依匯出稿使用 150ms 轉場、1200ms 鎖題、bounce 1s／spin 1s，MotionPolicy 新事件與減少動態限制保留。動畫開關實際關閉後還原；15 個持筆畫者及4個途中觀看者取樣、5批成功回應與放筆／換輪觀察記於驗收。不推論逐幀 FPS、實機或弱網。 詳 [本輪證據與限制](../STITCH-UI-IMPLEMENTATION.md)。

### 2026-10-14 人物按鈕與全桌爆鍋
本輪取代原創手勢按鈕：使用者圖輕微Q化，喝啤酒字幕還要爽爽；停止保留食指打叉。哭哭橫幅按公共explosionId在全桌呈現，靜態縮減動態仍可見，音效沿用共用原創WAV。受影響88及真Edge雙視窗每端1次原生playing、重複／重連抑制、390px專注通過。來源、完整提示詞、證據与限制見[素材與橫幅規格](../specs/QUACKS-PORTRAIT-ASSETS.md)。候選2.4.0同批未推送／發布／部署。

### 2026-10-14 特效藥自動格數、分明圖示與抽藥／抽卡音效
特效藥結算自動推到本輪上限但須本人確認，可選低格，瓶身顯示公式及凍結加總；抽停照片縮小，分數星星／藥材杵臼／占卜卡牌分開，哭哭圖大、文字小、卡片字體更清楚。私有draw事件逐個排隊播原創音效，爆鍋提示優先且同批合併。完整2181及最後35／真Edge每端8抽藥＋1抽卡＋1爆炸原生playing通過。新3006隔離站保留3005牌局；詳[本輪規格與證據](../specs/QUACKS-ESSENCE-AUDIO-REFINEMENTS.md)。候選2.4.0本機未發布。


### 2026-10-14 共選效果、鍋邊視野、溢出盆與樹脂骰
使用者取消投票，所有真人直接選共享藥材效果（最後成功指令採用），圖示逐面、提示與雙方即時同步；房主設定後可原生開始。購物grid、鍋邊左右控制／小女巫幣、整口鍋可見、特效藥縮整、記分板放大、結算圖示、補瓶／水滴圖示與水滴術語、本人600ms喝藥水聲已完成。第52格之後的擴充溢出盆按既有引擎計分，隐藏他人盆；樹脂骰按擲骰當時鍋色。完整2196及最後25、真Edge選書同步／開局／購物／喝藥水playing／大釜視野／記分板／390px／專注通過；材質fixture與真雙人爆鍋複验、限制見[本輪紀錄](../specs/QUACKS-KETTLE-SHARED-EFFECTS.md)。仍同批2.5.0本機未發布，舊試玩牌局保留，另建新版3008。

2026-10-15：v2.9.0本機候選加入下一格結算框、左上釜名自適應置中、起始玩家中央自動抽牌、哦是哦照片及同頻指定結算錄音。原生1440／390與音效事件證據、範圍及限制見 [本批規格](../specs/QUACKS-AUTO-FORTUNE-AND-MEDIA.md)；未發布／部署。

2026-10-15增量：v2.10.0改為中央牌背本人點擊、全桌3600ms翻牌及青色結算格；各遊戲新局隨機首位輪替角色，房主／座位不變，原同步玩法保留。取代2.9.0自動發送及僅本人演出描述；見[隨機先手規格](../specs/RANDOM-MATCH-STARTER.md)與[占卜修正證據](../specs/QUACKS-AUTO-FORTUNE-AND-MEDIA.md)。本機候選未發布。

2026-10-15整合交付：候選2.11.0已整合main05640c9（#124/#125），UI以Stitch main為主並保留使用者題庫／媒體、照片質疑、中央點牌全桌慢速翻牌、青色結算格及隨機先手。完整2261／2261，真HTTP雙席1280／390開局至購物回朔與音效邊界、其他遊戲有限回歸通過；證據與限制見[本批整合](../specs/MAIN-USER-CHANGES-INTEGRATION.md)。本機試玩3017，未推送／PR／部署；此筆取代前筆尚未整合main現況。

2026-10-15候選2.11.1：依使用者新圖放大釜、縮小抽停區／開始控制、改善書頁對比、釜名移左及記分板移頂；777原圖與要拚／不要錄音、抽停無提示。39受影響音效回歸與Edge真HTTP1280暗／390亮（對比最小5.17:1、無水平溢出、原生playing）通過，另女巫1440／390取樣通過；完整結果／來源／限制見[本批紀錄](../specs/QUACKS-SIZE-AND-ACTION-MEDIA.md)。本機3018試玩，未推送／PR／部署。

本批2.11.1最終驗證：Windows完整2263／2263，版本及diff檢查通過，本機試玩仍3018；無推送／PR／部署。

2026-10-15候選2.12.0：郎中2–8人親友加大桌、要拚尾音640ms、抽藥清理後短停頓再爆炸，以及金邊占卜卡正面；整合main2d53f00彈幕框。六／八人四種模式九輪回歸及Edge真HTTP八席1280暗／390亮取樣通過，完整驗證、原生時序與限制見[本批紀錄](../specs/QUACKS-PACING-EIGHT-PLAYERS.md)。3019另建試玩保留舊桌，未推送／PR／部署。

本批2.12.0最終：Windows完整2273／2273、release minor與diff檢查通過；3019公開6資源精確比對通過。主觀喇叭聽感與真手機仍待使用者試玩，未推送／PR／部署。

2026-10-21：#138 本機 2.19.0 候選新增約三秒進頁開場，沿用初華圖片放大淡出；依使用者追加改為圖片無外框，登入／註冊頁不先播，成功後從原圖位置放大。Vue 與 legacy 共用入口，保留 session、背景載入、skip/Esc、減少動態與 BFCache。桌機／390px原生驗證與未驗項目見 [開場紀錄](../specs/ENTRY-INTRO.md)。本機預覽14998，尚未合併／部署。

2026-10-21 #138 同輪修正：取代前輪跨頁原位重建。登入成功後留在登入文件，其他 UI visibility 隱藏，原本 img 不換 src、不換父容器，以 transform／opacity 放大淡出三秒後才導航；目的頁在 head 消費一次性完成記號，避免二次閃現。桌機與390亮色原生驗證、Esc及全套2522通過；詳開場紀錄，僅本機未合併。

2026-10-21 #138：使用者確認同頁原圖動畫可接受，授權推送並合併；此筆取代前筆先不合併的階段限制，不包含部署。正式合併狀態及CI證據以PR紀錄為準。

2026-10-23：本機候選2.28.0接入使用者Stitch匯出20款進場、11款共用背景與成就、獨立屍魂界網站開場、即滑即送Ping及管理員重設隔離。來源缺失修補、試用音效政策、驗證與發布限制見[本批整合](../STITCH-COSMETICS-20261023.md)。本筆取代較舊「背景僅本機」及「屍魂界是角色特效」描述。

2026-10-23後續：大廳隨機換位依最新指示改按 R，點角色仍立即開表情。獨立試玩初始化預設全成就／獎勵解鎖，正式資料不變；新介面與完整驗證見[本批整合](../STITCH-COSMETICS-20261023.md)最後一節。

2026-10-23 補充：Ping 原生圖示與音效分開保存；千本櫻新增中央花瓣飄落；網站開場維持原樣。詳見 [本次改動清單](../CHANGES-2.28.0.md)。

2026-10-23 同批追加：只更新特效.zip 中指定五款、保留千本櫻落花；成就及獎勵卡發光、帳號獎勵兌換與重設隔離、Ping 圖示同色光暈。具體範圍與證據見 [修訂與兌換](../EFFECTS-REDEMPTION-20261023.md)。

2026-10-23 最新：截圖指定九款卡片背景動態、法院灰藍石材與日夜文字對比、全廳 30 秒；四組兌換分開開獎勵，試玩不再預填成就。Issue #204 四向跨邊界僅開票；詳 [來源及驗證](../BACKGROUNDS-REWARD-CODES-20261023.md)。

2026-10-23 最新調整：[介面與新開場](../LOBBY-CLEANUP-OPENING-20261023.md)。


## 2026-10-23：虛式茈新版補正

第 6 格已改用使用者確認的 666.zip／24_3 原稿，取代前述保留原版的例外：紅藍漩渦合成紫色奇點，中央白邊「茈」與 MURASAKI 標籤。僅替換 stitch-purple，其他 23 款及既有解鎖 ID 保留。新增隔離樣式與 9 組動畫定義，維持有限播放、SVG 唯一 ID 與減少動態設定。

Edge 實測設定預覽有 12 個動畫，1.7 秒中央字樣可見；大廳 R 播放並在結束清除，390px 無橫向溢出，減少動態時不建立動畫節點，無頁面執行錯誤。畫面與結果保存在 ignored work/playtest/purple-*。本機測試站使用新連接埠 3022，不重啟原 3021；尚未發布。
