# 程式架構 agent 記憶

更新：2026-10-05；角色文件是可更新的專案知識，不授權對正式服務操作。

## 93d7a84：公開結果與共用動效

2026-10-05 已實作，取代本批以前的 PL-01／PL-02 提案狀態。DrawGuessRoom 的 `publicResults`、`roundStartScores` 為 non-enumerable Map，最多八份凍結結果＋畫布，view 僅 metadata；收藏依 user/resultId 去重，不能再取 live canvas。當輪基準收錄所有保留座位，避免復座者重算舊分；early finish 不自動公開秘密。完整權限、配額與 PNG 客端信任邊界見 [契約與驗收](../DRAW-REVIEW-MOTION-PROGRESS.md)。這不是 persistent match ledger，尚不支援新勝場統計。

`MotionPolicy` 的同版本 snapshot 仍更新 live heartbeat（social 不一定加 game version），但首次／重連／visibility 恢復先建基準；seen／Animation／lane 必須有界。BFCache persisted pagehide 只暫停、重建基準及 preview，不能永久 dispose gate；離頁清 renderer 時也要清對應 job 指標。新 DrawResults generation/selection 隔離晚到載入，獨立 encoder 保存固定 snapshot，關 dialog 不取消已送出的收藏。Windows／Linux 各402項＋Chrome背景驗收，細節及未測限制見同一進度文件。

## 責任與接手入口

此角色負責API/state、server權威／身份／同步、功能模組邊界、資料與效果的時序、可測性。先讀root AGENTS與角色索引，再按任務讀檔；與玩家agent確認遊戲規則／判定，與美術agent協商資訊階層和原創圖示，與server/data agent確認持久化及切換。

最近規格：[YouTube共看](../specs/SHARED-YOUTUBE-PLAYER.md)、[多環境資料](../specs/MULTI-ENV-DATA-MIGRATION.md)、[成就與戰績](../specs/ACHIEVEMENTS-AND-RECORDS.md)。YouTube／成就仍為提案；多環境資料的完整備份還原子集已本地實作，未上線或執行正式資料切換，見 [工具](../SERVER-DATA-TRANSFER.md)。

## 已確認架構

- `src/app.js`建立rooms、seats與music/social maps。users UUID、room seat UUID、6位room code是三種身份；永久結果用match UUID／result unit，不能從名字回推canonical user。
- `src/db/index.js`Node DatabaseSync、WAL、同步BEGIN IMMEDIATE migration／transaction，schema上限12。async repository升級要重設transaction契約。
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
