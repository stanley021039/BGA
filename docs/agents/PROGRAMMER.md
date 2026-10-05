# 程式架構 agent 記憶

更新：2026-10-05；角色文件是可更新的專案知識，不授權對正式服務操作。

## 責任與接手入口

此角色負責API/state、server權威／身份／同步、功能模組邊界、資料與效果的時序、可測性。先讀root AGENTS與角色索引，再按任務讀檔；與玩家agent確認遊戲規則／判定，與美術agent協商資訊階層和原創圖示，與server/data agent確認持久化及切換。

最近規格：[YouTube共看](../specs/SHARED-YOUTUBE-PLAYER.md)、[多環境資料](../specs/MULTI-ENV-DATA-MIGRATION.md)、[成就與戰績](../specs/ACHIEVEMENTS-AND-RECORDS.md)。前兩者由此角色執筆，皆待實作，不能說已上線。

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

## 共用聲音接手補充

2026-10-05、來源 `2e8dc4d`：`AudioSettings.get/set/subscribe/playEffect/stopEffects/bindPreview`集中個人music/effects偏好與音效生命週期。所有頁面先載入模組，靜態路由白名單也要更新。不要再加入遊戲自己的sound flag、volume或下方控制；右上角site-header設定是共用入口。

`ah-audio-settings` version 1是該瀏覽器／網站來源的個人偏好，storage同步其他頁，不是DB跨裝置設定。音樂transport仍由RoomMusic管理；TableMusic只套用個人音量／收聽，保存opt-in等可信手勢才能播放，拒播可恢復。靜音音效立即停止且不重播；隱藏／離頁釋放。音樂庫重繪需釋放bindPreview監聽，原生控制與共用偏好雙向同步。

Windows／Linux各239項通過；實際Chrome解碼／播放／個人暫停、五款設定一致與浮層邊界已驗。限制及證據見 [共用聲音進度](../SHARED-AUDIO-PROGRESS.md)，不要宣稱量測過實體喇叭或主觀聽感。
