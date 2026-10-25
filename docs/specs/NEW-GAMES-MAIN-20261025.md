2026-10-25 後續整合：本輪再接入 main 4d9bc79（3.2.0），候選改3.3.0，歷史功能依main移除；#227補入初代36與可選牌庫。此結果取代下方2.47.0／4982cf8的最新狀態，詳 [本輪實作及驗證](SECOND-WIND-BASE-227.md)。未部署。

# CEO／運動員整合最新 main（2026-10-25）

最新接續：557422a推送後再次核對遠端，main已前進至4982cf832ee8716ba281c8449183f6c6d75c262f（#271，媒體自動開窗／已同意影片加入，正式歷史2.46.0）。追加整合這段更新，只有CHANGELOG與PROGRAMMER兩處文字衝突，程式無衝突；保留main媒體行為。release工具將新遊戲候選順延為2.47.0，取代下方第一輪整合的2.46.0候選；所有已發版歷史保留。最新前端149/149、31入口build、模組／UI／perf／minor版號檢查通過，完整結果及瀏覽器證據於本輪補記。下文保留前一個main快照的處理紀錄，不把舊head測試冒充本輪結果。

本輪最終Node24.22.1 test:affected保守回退235檔，全套1970/1970（251664.4263ms，無失敗／取消／略過）；前端149/149，902檔format／format:check、build、模組邊界、相對4982cf8的UI與minor版號、perf預算通過。真Edge再驗運動員四場38項、CEO24項、同格hover25項（行動請求0）、大廳施工圖12組、等待／開局全螢幕及背景24組，皆通過。另兩款390px真HTTP／Vue首次點播自動開compact窗、拒絕不建YouTube iframe、關窗後非空清單再加入不重開，2組通過；沒有宣稱真YouTube或喇叭播放。媒體QA第一次因關閉鈕名稱少了「繼續播放」逾時，改正選取器後通過，未改產品。此輪證據在ignored main-media-*、latest-*與media-latest-*，取代前一快照的結果作為最新本機交付證據。

截圖覆核再抓到RoomMedia的`.ui-sr-only`說明在新頁直接露出；UiButton自己的scoped裁切只涵蓋按鈕，無法取代其他共用元件的無障礙工具類。改由Vue全站共用ui-components.scss提供同等裁切，保留DOM、文字與aria-describedby，不載入舊CSS。補共用樣式回歸，前端150/150；重新build／UI／perf與902檔format／format:check通過。真Edge兩款媒體視窗說明保留可讀文字、非display:none且尺寸不超過1×1px，2組通過；24組模式複驗也通過。Node24.22.1完整235檔再跑1970/1970（335676.7966ms，無失敗／取消／略過），證據在main-media-a11y-*、media-a11y-*。此筆取代上一段149項前端與上一輪全套作為最終本機結果。這是本次新遊戲整合所需的共用相容修正，不改main媒體的自動開窗或影片同意條件。

使用者要求先完成施工圖階段，再抓最新main檢查衝突。施工圖及同格人數先推送至b1538c9；接續整合origin/main `3ddf7c0d9b45182349597caaede52fa48dacf599`（正式歷史2.45.0）。沿用#226／#227與codex/second-wind-227；本次未開PR、CI、合併到main或部署。

## 衝突及相容處理

- 文字衝突共5檔：CHANGELOG.md、docs/agents/PROGRAMMER.md、frontend/pages.json、package.json、package-lock.json。開發紀錄保留兩邊；入口清單保留main的音效工具頁及兩款新遊戲，共31份文件。
- main已使用2.44.0～2.45.0，保留其版本歷史；新遊戲候選由release:bump工具從2.45.0升minor為2.46.0，日期2026-10-25，取代先前新遊戲2.44.0候選。舊候選測試／截圖紀錄保留原來源版本，不改寫成新版證據。
- main的#233共用ESM與舊前端清理接入：兩款HTML移除classic腳本，保留實際頁面、掛載區、樣式與唯一module入口。首次繪製沿用HTTP prepaint，共用API由既有模組owner提供，沒有重建window API或把退役腳本放回public。
- 清理腳本時一度錯誤移除整個頁面內容；實際瀏覽器與資源整合測試抓到空白入口。已從完整原頁重做移除並新增兩款掛載／頁首／title／單一module入口回歸，不把單純沒有classic script視為頁面完整。
- 兩款UI測試fixture改為隔離icon registry的observer，保留真正場景與操作驗證；不因VM缺document／MutationObserver而改產品。共用icon本身由原共用元件測試負責。
- main的#251全螢幕／背景入口與標題列側欄、#246場景戰鬥、#235回呼持久化修正保留。兩款原遊戲邏輯、測試獎分、英文卡面、中文hover、同格人數、收合積分與共用施工圖保留。這不是補做兩款遊戲尚未支援的跨重啟持久化。

## 本機驗證

模組邊界檢查、型別／31入口正式build、前端142/142、入口回歸3/3、相對main的UI防倒退、build媒體預算與相對main minor release check通過。完整test:affected採隨附Node24.22.1；235檔全套首輪1966/1968，兩項為修正前的空白入口及Windows動態埠觸發Fetch bad port，已重建後重跑整套，完成結果另補。

第二輪1966/1969，失敗為兩項main固定頁面總數未納入新增兩頁，以及頁首測試強制所有頁面載入舊ui-primitives.css。頁數改為28個頁首／30個playful頁面，保留逐頁檢查；頁首回歸保留舊頁head樣式檢查，新頁另驗module→mountPage→SiteHeader→UiButton鏈及元件scoped可讀caption裁切，不新增AGENTS禁止的舊CSS依賴。六個相關測試檔36/36通過，包含入口、主題／框飾、全部建置資源及room-watch。修正後第三輪235檔全套1969/1969通過（235261.728ms，無失敗／取消／略過），取代前兩輪作為本機最終結果，不能代替最終SHA的Linux CI。格式／format:check共900檔通過，未調高baseline。

真Edge三名隔離玩家：運動員四場完整38項、CEO24項（買股、503同筆重試、重載、最後一輪與結算）通過；新版兩款側欄、背景R／W／Q／E與原生全螢幕／Esc共14項通過。兩款×等待／開局×1920／390／320×深淺色24組，實際進出原生全螢幕、背景不要求全螢幕、兩入口相鄰、Esc恢復、中央寬度與無溢出皆通過；無JS錯誤、JS／CSS失敗請求。同格2／3／6／12位、三寬度深淺色與觸控fixture共25組通過，行動請求0；大廳施工圖12組亦通過。模式驗證第一次被正常媒體同意對話框擋住，改為實際點略過再驗，沒有停用產品同意流程。這是操作及既定流程的覆驗，不宣稱所有角色能力／所有實機均測過。

證據皆在本機ignored work/second-wind-227/main-20261025-*、main25-*。隔離測試帳號僅開放全部成就獎勵，不預填達成紀錄；未操作正式資料。實體手機、Safari、最終Linux CI及人工驗收仍待完成。
