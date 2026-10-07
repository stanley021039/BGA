# 動畫角色記憶

2026-10-07本輪最新候選minor1.9.0：真背景CDP25move artist56frames／26ink增長／whiteAfterInk0、26batches51anchors點；viewer62frames中25partial／drainempty，單trace不代表每輪或60fps。timer手動animationseek linear且已還原，但背景自然曾1.5s drift，新增Animation.currentTime vs wall漂移≥100ms才校serverdeadline／1test。Windows1131第二次全pass37700.4126ms只是此校正前source，最新1132／Linux／tag／正式待root。controlled renderer4 strict0與41／backend30各scope保留；不外推別台PC、不寫新功能已正式。

2026-10-07同輪追加平滑時間條（待驗）：共用CountdownBar用WAAPI linear scaleX，native progress／秒數保server deadline，不每frame JS／新增poll。hidden/pagehide取消、show/BFCache baseline、epoch／phase／newdeadline重設；動畫不推進規則，也不能因停動效讓倒數不可讀。viewer新strokebuffer60ms、gap300／batch700／總lead900ms，極端backlog canonical，長停頓可壓縮不是完整錄影。C／timing仍待整體/native；renderer保留caller原creation options後最終41scoped与4 controlled nativeRGBA0只其scope（兩dense無yield觀察）。

2026-10-07畫猜逐點呈現（實作候選／待驗）：使用者允许接收端少量延遲，以真採樣時間重現brush／erase，取代下方舊「畫布同步不能加等待」在viewer呈現的適用範圍；server接受／score／deadline、artist跟手仍不延後。root確認clear／copyBase後yield與ACK mutable→classic露白，candidate opaque staging完整job才present；renderer cache含stage≤8MiB。viewer live client rAF播放optional pointTimes，不能用收包時間造等間隔，無逐frame網路／server timer；snapshot／reconnect／reveal／undo／fill與非brush立即canonical，不重播artist ACK。hidden／減動與追趕策略按最终source核定，畫作不可因關装飾動畫而消失。**每輪结束／下一畫者必查**中途frame無閃、舊尾清理、終點canonical與queue/rAF/timer為空；配置時長不是FPS，fake canvas／最後同pixels不證每frame不閃。renderer41／backend30与4controllednative僅各scope，完整／實際多輪／正式待root，見 [進度](../DRAW-TIMED-PLAYBACK-PROGRESS.md)。

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
