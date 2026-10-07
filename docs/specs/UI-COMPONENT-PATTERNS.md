# 五庫模式的原生元件實作

2026-10-07最新狀態：**正式v1.12.0已發布**，固定83ffcab／annotated tag、Windows／Linux各1,386與有限native／公開／資料驗收完成，9帳戶／13市場圖片保留。PR46外部合併，其1.9.3雙平台1,300與本批UI分開，沒有新UI PR；source／備份／scope與未驗限制以 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)為準，下方提案階段不是當前發布狀態。

初始規劃：使用者要求把 [Threads五庫研究](../research/THREADS-UI-COMPONENTS-ASSESSMENT.md) 的適合方向實作，本批在 `feat/ui-polish-webgl` 以v1.11.1為基線，現已正式v1.12.0。詳細結果依 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，PR歷史見 [PR證據](../PR46-REVIEW-FIX-PROGRESS.md)；本批不加入PR46，也未建立新PR。

五庫提供設計模式與互動參考，本站以原生DOM／CSS、GameUI與已有GameFxLayer原創實作，不安裝React／Next.js／Tailwind／OGL，也不複製元件／shader或受限授權code。來源與授權詳研究；採用模式不代表取得各庫整套可達性或效能。

## 五庫分類與真實落點

表中區分source／focused、有限native與正式整合實績；局部證據不外推成所有玩法／裝置認證。

| 研究庫／分類 | 本站落點 | 共用契約與首批方式 | 狀態／驗收 |
| --- | --- | --- | --- |
| Magic UI／有限通知列表 | 五款遊戲toast、四款既有earned checks | `ui-notifications.js/css`：共享圖示／正文／dismiss，finite visible／queue／seen；中央tracker按request baseline／差集，8jobs／10s timeout。 | 已正式1.12、focused83／有限真earned／雙平台完整已有證據；完整玩法矩陣不宣稱全驗，重要inline保持，不加poll。 |
| Aceternity UI／tabs與卡片選取 | 收藏3tabs／query／popstate／使用中card，市場4tabs／hash／admin限制與審核選卡 | `ui-widgets.js/css`：manual tab／panel、選取表面與named group，rapid Arrow同步位置；收藏離music pause、profile讀一次無poll。 | 已正式1.12、focused72／有限keyboard／卡片與公開runtime函式通過，不加Hero／3D傾斜。 |
| shadcn/ui／按鈕群組與dialog結構 | 收藏卡片動作、市場篩選／兩個既有確認dialog | GameUI命名group與圖示，market dialog共用focus／busy，收藏window.confirm保留。 | source已實作、有限Escape／返焦通過；不聲稱完整trap，原批次／確認意圖維持。 |
| React Aria／鍵盤、焦點、表單錯誤 | 收藏／市場manualtabs、各4forms／市場2dialogs | roving focus／panel關聯，shared invalid batch單microtask首錯欄，保其他describedby、reset／destroy取消。 | source／focused與有限native已驗；不是套用React程式碼／讀屏認證，200% glyph simulation不當真zoom。 |
| React Bits／短粒子概念 | 原雷霆特效＋真正新earned通知旁慶祝 | `ui-celebrations.js/css`＋原創GameFxLayer，24sparks、960ms／1100ms清理、active≤3／seen256，不畫語意或加OGL。 | 已正式1.12／雙平台；有限GL shader probe與server-earned tracker證據分開，新earned由tracker決定，不補播舊badge，完整矩陣／FPS不宣稱。 |

## 共用元件邊界

| 元件 | 必須保持的契約 | 防止的倒退 |
| --- | --- | --- |
| Tabs | tablist有名稱，每tab對panel；一個selected與一個tab stop。水平箭頭／Home／End只移焦，Enter／Space明確commit，disabled／hidden跳過；hash／deep link更新同步selected與panel，admin權限仍由既有頁面判定。 | 不把點擊前focus當選擇，不用箭頭發GET／POST；使用者輸入草稿、收藏預覽Audio與市場approval狀態不被tabs helper重建。 |
| Buttons／cards | 同group共用名稱／間距／SVG registry；動作仍一般button，toggle才`aria-pressed`。hover／focus表面或短transform不能改hit area，選中／disabled／pending優先。 | 不把所有群組都套tablist，不隱藏內容name／作者／status／score，不延遲列表DOM排序。 |
| Form feedback | 保留inline status與錯誤文字；只對實際不合法欄位標`aria-invalid`，錯誤節點與欄位關聯；修正後清自己的錯誤描述，不刪其他`aria-describedby`。 | 不用toast取代必要錯誤，不把伺服器整體失敗任意標所有欄位無效；validation不是API權限／額度裁決。 |
| Modal confirm | 原生`dialog.showModal()`、中文標題與明確取消／確認；開時focus入內、Tab留modal，Escape遵循原busy保護；關閉返回仍存在、可用觸發點或合理替代。非modal播放器保留原移動／resize流程。 | 不對所有dialog加同一手工trap，不把媒體窗變modal；Promise確認未完成不能先delete／share／approve，晚到response不能解鎖新操作。 |
| Notifications | 最多3 visible／12queue／256seen，3–12s expiry，hover／focus暫停；`textContent`、安全same-origin link、polite status與kind樣式、不偷焦。hidden暫停expiry並保留可讀內容，取消入口／粒子與禁止queued補motion，pagehide清理。 | 不隱藏重連／history warning／設定保存／房間權限／猜題聊天室或重要inline；不排無限queue或延遲決策內容。 |
| Newly earned | `GameUI.createAchievementTracker`沿既有check，不加interval／HTTP；同一tracker按request順序drain完整snapshots、known union去重，首成功資料作baseline；最多8jobs／10s timeout，保head與最新、滿額discard中間而不retry。 | 初次／重連／既有badge不通知；destroy／BFCache取消pending／generation，timeout釋放卡住head，亂序不覆蓋較新狀態。未知id也用server title，不硬編新成就判定。 |
| Celebration | 消費真正新通知／新earned事件；在實際通知anchor可見時短時播，canvas pointer-events:none／aria-hidden；尊重GameFxLayer caps與MotionPolicy，字與語意保DOM。 | 不加全桌長動畫、無限背景或每幀封包；空幀／loss／hidden／reduce不遮靜態內容，destroy清frame／buffer／監聽器，不補播舊慶祝。 |

keyboard與關聯採本站manual tabs選擇，參照 [W3C Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)；modal focus與返回觸發點參照 [W3C Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。表單錯誤必有文字辨識，參照 [W3C Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)。這些是互動契約，原生實作仍須實測，不能借外觀宣稱整套合規。

## 按遊戲／頁面驗收

| 區域 | 實作／保留 | 必驗 |
| --- | --- | --- |
| 整體遊戲 | 共用widgets／notifications／celebrations，既有GameUI／tokens／MotionPolicy | 全部新assets路由；hidden／pending／disabled、無雙重handlers、cleanup、中文名稱與touch；不污染其他入口。 |
| 你畫我猜 | 原toast wrapper接共享；本批不新增畫猜成就query，Canvas2D與最新surfaceRevision保持 | 持筆／ACK／clear／undo／換輪不閃，viewer逐點與倒數連續；人物常駐、聊天室input最後，不恢復已刪成功文字。 |
| 送禮達人 | toast／新earned統一，原送禮確認與結果節奏保持 | 同時送目前收禮者，確認才下一位，全員收完才完整結果；名單與選取常駐，通知不遮確認。 |
| 雷霆之路 | toast／新earned統一，原車旁WebGL／fallback不改 | 車／骰／角色、逐格／checkpoint／地形hover與keyboard、dice dialog保持；新慶祝不能拿到舊event重播。 |
| 同頻俱樂部 | toast／新earned統一，選項與公開結果保持 | 不洩漏未公開答案、selected不被hover蓋掉，玩家名單／倒數／結果可讀。 |
| 撲克 | toast／新earned統一，原下注／輪次／籌碼DOM保持 | 金額／當前玩家／操作權限可見，結算先呈現，慶祝不延遲下一步或改判勝者。 |
| 收藏庫 | 頭像／角色／音樂manual tabs、卡片group／field feedback，原window.confirm保留 | querystring直達、keyboard、離開music暫停preview；1MiB頭像、4MiB角色、分享／upload額度與API保持。 |
| 市場圖片 | daily／uploads／records／admin tabs、原核准dialog／欄位錯誤／選卡 | hash／admin限制、焦點、空庫與有圖、上傳／核准不重送；schema16／MarketImageStore／配額／不可回復操作契約保持。 |

## QA矩陣與交付證據

P0：同資料桌機1280×720／寬高桌機、390×844、200%文字；長名稱、錯誤／busy／disabled／empty／新增成就／通知burst、keyup／keydown、Tab／ShiftTab／Escape／箭頭／HomeEnd／EnterSpace。focus與hover提示不能被popover／dialog遮住；通知所有文字可讀、card不額外搶重要空間，必要內容不裁切。空間不足允許自然流或局部scroll到尾。

元件測試驗tabs不誤commit、panel／hash／roles、describedby保留、confirm Promise／busy／晚到job、通知queue／seen／TTL／cleanup、成就baseline與重送、particles可用／失敗／hidden／reduce。原生驗收須實際鍵盤與dialog焦點、長文、通知dismiss、真GPU可見／fallback／idle、畫猜途中無白，不能只看test總數或終點PNG。

正式狀態只在受測source與版本固定、備份／schema副本預演、即時房間guard、公開asset／API／資料保全與測試收尾後記錄；本規格不寫私有偏好、帳密、房號或rawHAR。其他硬體／讀屏／所有phase／自然多輪與前景FPS未實測者明列限制。

## 分工與交付狀態

目前API契約（固定83ffcab，focused／有限native與正式整合scope見進度）：`mountTabs(tablist,{initial,activation:'manual',onChange,selector})`回傳select／refresh／value／destroy；`bindForm(form)`回傳validate／clear／destroy，invalid／input／change／reset監聽不接管submit，invalid batch一microtask首invalid focus，validate focus:false／reset／destroy取消排程；`bindDialog(dialog,{label,onRequestClose,canClose})`回傳update／open(trigger)／close／destroy，WeakMap重用，bind不自行open以免共用hook遞迴，不更換非modal mode。`GameUI.notify(text,{kind,key,href,label,durationMs,celebrate})`回傳element／dismiss或null；append後才optional celebrate(node,{id})，dismiss／hidden／reduce執行取消。四款既有成就檢查（撲克／送禮／同頻／雷霆）使用server完整id／title差集，畫猜只接toast。

| Owner | 檔案／責任 | 狀態 |
| --- | --- | --- |
| widgets agent | `ui-widgets.js/css`、收藏庫／市場原生tab／group／field／dialog／card | source／focused72／有限native與整合已完成，scope見進度。 |
| notifications agent | `ui-notifications.js/css`、五款toast與既有new earned差集 | source／focused83／tracker與整合完成，不加poll。 |
| 主agent | `ui-celebrations.js/css`、GameFxLayer接點、routes、整合／版本／QA／交付 | 固定source／tag、雙平台1,386、正式公開／資料／QA收尾完成，無新UI PR。 |
| docs agent | 本spec／進度／角色記憶與研究status連結 | 已按實際source／finite scope更新，不從舊PR或庫demo推定全站／FPS。 |
