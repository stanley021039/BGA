# 最新main與使用者功能整合

2026-10-15，本機v2.11.0。整合origin/main 05640c9（#124、#125），本機功能檢查點81cb8a7；不推送、不發PR、不合併遠端、不部署。

## 介面與功能取捨

採用main的Stitch大廳、畫猜模板與郎中完整三欄版型、等待室、房間邀請、寶典分頁、對話框、圖像購物及迷因抽停卡；保留其字級、配色與響應式規則。沒有用舊版HTML覆蓋新模板。

接回使用者的96張殘酷雙圖題、單人玩法、擴充題庫、指定抽卡／抽藥／喝瓶／停止／結算／fish爆炸素材；保留main新增購物、紅寶石、女巫與危險提示。共用音效registry及靜態路由取聯集，沿用全站預設開啟與手動靜音保存。

瞎掰王哦是哦照片、多人質疑堆疊、老實人詳細解釋保留。同頻結算使用指定660ms錄音。郎中青色結算框、52格後終點、中央牌背點擊／全桌3600ms翻牌、隨釜名長度的置中名稱牌、特效藥與圖示效果、藥材購買回朔保留。名稱牌改放新版釜區上方中央，避免main左上HUD遮住；既有SVG名稱只在Stitch皮膚隱藏，其他皮膚仍可使用。

隨機先手保留在新引擎；房主與座位、同步遊戲不變。雷霆保留main的骰點先手及房主骰子確認，避免提前透過確認者身份洩露尚未揭曉的先手。詳細範圍見RANDOM-MATCH-STARTER.md。

## 驗收與證據

- Windows Node24完整2261／2261通過，fail／skip／cancel／todo均0。記錄work/playtest/main-integration-final-tests.log。release check、race教學原始碼同步檢查及diff檢查通過。
- Edge真HTTP雙真人合成帳戶，1280與390：等待室、朋友共選綠藥第2面、兩步開局、隨機抽到非房主、點擊前不自動送牌、全桌演出、兩次同步抽藥、停止、結算至購物，買後再次點擊回朔預算。原生Audio playing確認購物音，購物／回朔未新增結算錄音；無頁面錯誤與水平溢出。tools/qa/main-quacks-integration.cjs及work/qa/main-quacks-integration/evidence.json。
- Edge1440／390真DOM＋引擎快照傳輸替身：非房主抽牌者、點擊一次一張、全桌翻牌／重連不重播、結算格9與終點53、釜名中心與框寬、青色框。work/qa/quacks-click-fortune/evidence.json。不能當完整網路多人實玩。
- 瞎掰王1440／390：照片載入、九人質疑、音效一次、專注與刷新無重播。work/qa/bluff-reaction-stack/evidence.json。
- 同頻真HTTP題局：四人隊伍十題、單人十題、一般模式；原生Audio playing確認單人及一般模式各一次指定結算聲、刷新不補播。新隨機出題者由實際座位識別。tools/qa/majority-settlement.cjs及work/qa/majority-settlement。
- 獨立3017測試站API版號2.11.0，12個模板／遊戲／素材路由HTTP200且exact bytes符合本機。work/qa/main-integration-preview-assets.json。原試玩程序及資料未重設；新站使用一致性資料快照及獨立測試房，不操作正式資料或外部服務。

先前紅燈包括舊fixture寫死房主先出題／作畫、固定亂數超出新候選席位上界、共用控制fixture缺main新增依賴；已調整fixture使用合法可重現起始席位或實際actor，沒有放寬伺服器權限。預備題首輪保留隨機出題者，後續仍可輪至作者。Thunder歷史隨機對局事件數門檻曾偶發失敗，後續通過，不宣稱已消除該測試原有隨機性。

## 兩輪本機核對

第一輪對main05640c9與本機檢查點的功能清單：新介面為基底，題庫、指定媒體、互動與先手逐項核對，以上原生樣本通過。第二輪核對合併衝突：靜態路由／音效聯集、JS語法、房主權限、receipt去重、busy／hidden／重連、單人最小席位、幫助模板源碼、記憶排除規則；無已知重大問題。這是本機自審，不是遠端CI或第三方審查。

實體手機觸控／Safari、完整九輪所有特殊藥材、讀屏、主觀音質、Linux及正式部署未驗；390px viewport取樣不代替實體手機。永久記憶只留本機ignored，沒有放進提交。
