# DES13 文章與本站 UI 美化評估

查核：2026-10-07。研究來源為指定的 [DES13 AI網頁設計工具文章](https://des13.com/news/ai/1618-webdesign.html)，頁面標發布2025-03-22、更新2026-08-08；已讀原網址正文，後半因web工具再取timeout，改同網址唯讀HTTP補讀。本文件是後續美化提案，沒有依文章安裝外部工具或替換專案架構；研究不代表整批視覺方向已實作。使用者另外指定的播放／表情修正，依各實作進度文件驗收。

本次直接檢視兩張ignored截圖`work/media-icon-window-compact-final.png`／`work/media-icon-window-split-final.png`及少量`ui-foundation.css`／`table-media.css`。它們是媒體特定狀態的證據，不是五款遊戲所有phase的完整視覺稽核。沿用 [設計師記憶](../agents/DESIGNER.md)、[共用對齊](../specs/SHARED-UI-ALIGNMENT.md)及 [媒體八項規格](../specs/MEDIA-ICON-WINDOW-UI.md)；不抄錄本機偏好、帳號、房號或原封包。

## 文章實際建議與本站推論

文章主要是建站／原型工具評比。可取的是具體brief、迭代預覽、人工收斂、適量動效與技術棧相容；工具排名、價格與趨勢屬作者評述，本研究不當作官方能力或本站需求。[原文](https://des13.com/news/ai/1618-webdesign.html)。

| 來源類型 | 可以採用的方向 | 本站推論／邊界 |
| --- | --- | --- |
| 文章工作法 | 先說清楚需求，再逐步調整視覺稿。 | 原型brief必須帶目前畫面、tokens、玩家資訊及完整操作；每輪只改一類視覺變數，方便比較。這個限制是本站推論。 |
| 文章角色分工 | AI協助原型，設計與工程仍需收斂成品。 | 生成畫面用來討論，不直接替換既有DOM／GameUI或async流程；工程保留權限、epoch與清理契約。 |
| 官方設計系統 | 用規律字級／key lines／表面層次組織介面。 | 調整本站既有token而不是重新買一套模板；具體數值由本站桌機、中文與長名驗證。 |
| 本站使用者與既有契約 | 重要資訊可見，操作優先圖示＋可達說明，桌機優先。 | 美化不增加大型Hero、不再折疊玩家／車隊／骰子，不自動依行為重排常用入口。 |

第三列的具體技術依據來自官方來源：Carbon區分工作介面與展示介面的字體用途，並用grid key lines和spacing組織版面；Fluent以elevation區分表面。[Carbon typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview)、[Carbon grid](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/overview)、[Fluent elevation](https://fluent2.microsoft.design/elevation/)。本站不需要採用它們的品牌字型、顏色或整套元件庫。

## 直接看到的畫面與程式基礎

| 證據 | 觀察 | 判斷與限制 |
| --- | --- | --- |
| compact截圖 | 淺色房間、完整玩家列、獨立點播窗、單行queue及右側媒體窗；左把手／右移除清楚，名稱被截斷時保留操作空間。 | 緊湊queue和雙窗方向符合使用者要求，應保留；進一步美化著重視覺群組，不能再把名字縮得更小或增加行距破壞密度。 |
| split截圖 | 影片占大面積，點播窗在前；浮窗表面與底下卡片相近，陰影是主要層次線索。 | 可比較較輕的陰影與明確titlebar／surface層級。截圖有移動過的窗，不足以證明初始位置錯誤；不能因此擅自自動縮影片或改使用者位置。 |
| 截圖控制列 | 全桌與個人均有播放操作，僅看三角圖意不容易辨認影響範圍。 | v1.8.3已依使用者追加要求做同列group、輕分隔與playLocal；這是獨立UI修正，見控制與表情進度，不把它重列為本研究的新工作。 |
| foundation tokens | 已有14／16／20／28／32字級、4／8／12／16／24／32／48間距、44px預設控制槽及共用中文font stack。 | 美化已有基礎；優先收斂caller的15／18px等變體與局部硬編尺寸，不新增十幾種字級或全站換字型。特殊數字仍可用32，但要有資訊層級理由。 |
| media CSS | queue gap4、內部gap6及小padding，控制寬採token；浮窗shadow為`0 10px 36px #0006`，多處border／surface共用。 | 密度保留使用者指定的4／6px節奏；陰影／surface可做少量共享token候選，先比較，不宣稱目前樣式失敗。 |

### 色彩的可重現小盤點

以讀到的CSS原始sRGB token、WCAG相對亮度公式做靜態計算（未讀螢幕像素）：light body`#263b36`／surface`#f9f8f2`約11.21:1、muted`#58685f`約5.54:1、accent/focus`#654575`約7.42:1；dark body／surface約13.05:1、muted約9.18:1。這幾組文字色没有顯示必須整體換色的理由，還須驗各caller實際背景、透明度與狀態。

light border`#b4bfaf`／surface約1.79:1。它可當裝飾分隔，但若某控制的辨識或選取狀態只靠此邊界，需另驗必要視覺線索；不能把這個數值直接判成所有按鈕不合格。文字一般最低4.5:1、大字3:1；必要控件／狀態線索3:1，條件與例外依官方說明。[W3C文字對比](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[W3C非文字對比](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)。數值為四捨五入展示，合格判斷不能把未達門檻的值向上捨入。

## 桌機優先的具體美化候選

P0先做共用層級／可讀性，P1才套遊戲場景，P2需原型證據。以下全是研究候選；除媒體截圖所見之外，其他遊戲要先補最新版畫面，不宣稱目前有缺陷。

| 優先序／區域 | 美化方向 | 可行實作方式 | 保留資訊／驗收 |
| --- | --- | --- | --- |
| P0 整體：字體 | 以16px正文／操作、14px次要、20px區段、28px頁標形成少數層級；600標題／400正文，數字不用裝飾字型。 | 收斂到現有rem tokens及inherit family／line-height；房號／時間／金額用`lining-nums tabular-nums`並同槽對齊。 | 玩家姓名、狀態、車／骰子與輸入label可讀；中文／英數混排、不同OS字型及200%文字需驗，不逐glyph位移。 |
| P0 整體：對齊與間距 | header、玩家列、主遊戲與工具列共享key lines，群組間有層級間距。 | 容器grid／flex負責gap與align-items，元件槽不加外部margin；大區域用16／24，操作群組8，compact queue沿用4／6。 | 不統一強塞每處16px、不壓掉重要資訊；1280×720與寬桌機能看完整主要內容，空間不足才自然流。 |
| P0 整體：表面 | 建立背景／卡片／浮窗三層，輕邊框配一致radius；只給浮窗較高elevation。 | 在theme tokens提出surface-base／panel／floating、radius-control／panel、shadow-floating，遊戲各自accent不改資訊架構。 | light／dark都驗字與focus對比；不以透明或低對比把非當前玩家變成看不見。 |
| P0 共用媒體：群組識別 | 保留大影片與緊湊清單；全桌／自己操作以分組及不同圖意辨識，本站圖示仍是主操作。 | 使用中文aria／hover提示、細分隔與同列控制；playLocal圖意與全桌play有語意區別，titlebar、meta、表單label少數字級。 | 同列與playLocal已於v1.8.3驗收；不刪原生播放器恢復出口、不把個人操作當全桌控制，重要錯誤與權限提示可見。 |
| P0 共用媒體：浮窗層次 | 現暖白／綠系可保留，減少兩個大窗陰影彼此搶焦點。 | 試一組較輕共享floating shadow與略不同titlebar surface；focus窗保留清晰輪廓，tooltip用獨立層级。 | 保留可移動／resize／個人位置，不自動折疊玩家或改影片尺寸；驗overlay、tooltip、focus、sameiframe、零幾何mediaPOST。 |
| P1 你畫我猜 | 白色畫布是視覺主角，左工具像一組熟悉的畫具；正確猜中標記／輪次／玩家狀態整齊。 | 只調畫布框、工具群組的padding／selected狀態／表面；倒數、房號共用數字槽，卡片等尺寸。 | 畫布backing／比例、填色與權威畫作完全不動；猜題／畫者角色資訊常駐，reduced motion與工具title保持。 |
| P1 送禮達人 | 以目前收禮者和禮物卡建立焦點，卡片圖／名稱／選取狀態有清楚層級。 | 現有格線內统一image box、卡片padding／radius與選取icon；階段列用少數字級／數字槽，結算圖表同palette。 | 不用大插圖壓掉房員、選擇／排序；不為美化改送禮／确认時序或提前展示未揭曉資料。 |
| P1 雷霆之路 | 路線、車子、骰子與可行動狀態優先；地形圖例像一致的一組小元件。 | 統一圖例框／圖示槽／文字基線，active route／可到達格用邊框＋圖意；crew metrics靠共同欄對齊。 | 其他玩家車／骰子／角色可見，地形hover效果说明保留；不改移動／檢定時序、不把重要檢定變裝飾動畫。 |
| P1 同頻俱樂部 | 題目、選项與揭曉結果有明确主次，等待也有可辨認狀態。 | 等尺寸選项卡、selected icon＋輪廓；結果bar／數字／玩家列同色義與token，不增加大型等待Hero。 | 不洩漏未公開選擇或提早結果；個人選取、倒數、房員状态與錯誤可見。 |
| P1 撲克房 | 桌面可有牌桌風格，但底池、個人籌碼、行動金額與當前玩家先可讀。 | 以現有surface／accent定義牌桌、玩家席與操作層；數字tabular，fold/check/call/raise語意依shared registry和可讀提示。 | 金額與角色／輪次常駐，不因图示偏好省略下注影響；原規則／權限、長名及大字布局需驗。 |
| P2 共用動效／插圖 | 成功／選取／drag target有短反馈；靜態原創圖案增加桌遊感。 | 先試120–180ms的opacity／小transform候選及一種靜態紋理，沿MotionPolicy；藝術放非重要空白區。 | duration是候選不是量得最佳值；不阻input、不無限背景動，不加scroll敘事／大型Hero；額外素材只放已確定用途。 |

數字規則的技術依據：`lining-nums`讓數字採共同基線，`tabular-nums`採同寬數字形式；實際字型支援與布局仍需驗。[MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric)。動效需尊重OS偏好及本站策略，不將減動態只當慢一些。[MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)。手機震動也不是所有瀏覽器普遍功能，不列本輪美化必要條件。[MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)。

## AI視覺／code生成的務實用法

可以用本站去敏截圖＋tokens產出兩個局部風格方案：A保持現有暖白／森林綠／少量紫色，B只調表面／陰影對比；先比較同內容／同尺寸，而不是先改流程。圖示優先使用現有SVG registry，模型图片只用於確定需要的原創插圖／紋理；不把文字／遊戲状态畫進bitmap。

v0官方支援以截圖分析layout／色彩／元件，也會推測可見元素的功能，並指出其常用技術偏向Next.js／Tailwind／shadcn。因此截圖原型可作視覺提案，async、權限、播放器／輸入行為必須另外提供；本站要由既有GameUI及CSS adapter落地，不為美化新增整套框架。[v0官方截圖文件](https://v0.app/docs/screenshots)。本次沒有使用該服務、上傳截圖或購買方案。

可用brief（提案，尚未执行）：

> 請以附上的本站去敏桌機畫面、現有字級與spacing tokens做兩份局部視覺方向。保持DOM資訊與操作數、完整玩家名單／狀態、canvas／影片空間、目前左右布局及icon registry。只調surface／border／shadow／字級權重與對齊，不加Hero、不收合重要內容、不新增React／Tailwind／icon套件。另列390px與200%文字如何維持可用、hover／focus／reduce狀態，以及每項改動的token差異；不要自行推測共享播放／權限或遊戲規則。

設計師先選視覺差異，玩家核對資訊是否更快找到，程式方檢查token／selector作用範圍、既有listener／disabled／hidden／motion及renderer；截圖不可能證明所有互動、SSE、權限或收藏流程正确。

## 建議下一步與優先順序

1. **P0：共用tokens小原型**。先對媒體與整體header產出同資料／同尺寸的字體、surface、shadow兩個局部方案；不動布局、流程或已保存位置。驗正文／meta、數字基線、focus／hover與完整重要資訊。
2. **P1：各遊戲套相同元件契約**。先補最新版不同phase截圖，用表格逐項核對；已符合的項目保留。以圖例／卡片／數字槽作小修改，不以一張媒體圖推論整站都需要重畫。
3. **P2：只在需要的地方加動效／原創圖案**。先量辨識與干擾，再決定範圍；WebGL與3D維持 [既有研究](WEBGL-ADOPTION-ASSESSMENT.md)的條件式原型，不納入本批美化必要條件。

驗收建議（全部未在本研究执行）：1280×720／1794寬桌機、390px及200%文字；短／長／中文英數名稱、八席、empty／waiting／active／result、disabled／pending／error、keyboard／touch与reduce／hidden。記錄資訊位置、误點、overflow與對比；相同資料的新舊截圖由使用者或玩家評估，不用「看起來高级」當唯一完成標準。

暫結論：文章可改善我們的**提案流程**；本站最值得先做的是少數字級、key lines與小間距、表面／浮窗層級及可辨認的共用操作。這些方向建立在现有UI，整體美化仍是研究候選；獨立完成的使用者播放／表情修正不算成這份美化方案已套用。
