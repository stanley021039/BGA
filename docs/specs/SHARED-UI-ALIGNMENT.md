# 共用圖示、佔位符與徽章對齊

查核日期：2026-10-07。角色：程式設計師，與主 agent 討論設計取捨。

本次基線唯讀盤點 `public/` 的 **20 份 HTML、23 份 CSS、46 份 JS**，重點為實際 renderer、共用 helper 與單字元／圖示槽。問題基線為 `v1.5.2`；查核開始時分支為 `fix/draw-desktop-layout`、HEAD `2f090a1`。主 agent 同時實作後續修正，所以表中的「必修」指基線缺口，不表示最新工作區仍有同一問題。

本文件是已討論採用的元件契約與盤點；本 agent 沒有修改程式、啟動瀏覽器或操作正式資料。主 agent 負責實作與背景畫面驗收。未有畫面證據的項目不宣稱已錯位，也不宣稱已上線。

## 問題根因與最小元件

`draw.js:89` 的非畫者選題背面只有 `?`；`draw.css:8` 讓 `.stage-pick,.stage-pick-back` 共用 `display:grid;align-content:space-between`，背面再加 `place-items:center`。這只把內容置中於自己的 grid 區域，沒有改掉整組區域的垂直分佈。背面應重設 **place-content 與 place-items**；正面仍保留類別、題目與操作提示的分佈。

基線 [ui-foundation.css](../../public/shared/ui-foundation.css):19–26 已有 SVG、icon wrapper、button 與 pending 樣式，但 button／icon-button／pending 限於 `body[data-game-kind]`。因此非遊戲頁無法直接得到相同的最小布局契約。將這些 primitives 移到全頁載入的獨立 CSS，遊戲 foundation 保留色彩、字級與版面 tokens，不把整套遊戲布局帶進非遊戲頁。

| 元件／合約 | 責任 | 不負責的內容 |
| --- | --- | --- |
| `.ui-center-content` | 明確使用 grid，`place-content:center;place-items:center`，置中一個內容群組。 | 不決定卡片大小、padding、顏色；不套到需分佈標題／說明／按鈕的整張卡片。 |
| `.ui-timebar`（2026-10-07追加） | 共用progress軌道、可調高度／顏色token、urgent色與減少動態；opt-in使用。 | 不計算deadline、不增加timer／poll、不決定所在欄位；畫猜与畫布同寬的布局由draw.css處理，實作證據見[倒數進度](../DRAW-TIMER-VISIBILITY-PROGRESS.md)。 |
| `.ui-symbol` | 獨立文字／圖示槽，inline-grid、雙軸置中、`flex:none`、`margin:0;padding:0`、`line-height:1`、`letter-spacing:normal`、`text-indent:0`。 | 不強制 44px，不取代姓名、長文、角色圖、emoji、禮物素材或場景插圖。 |
| `.ui-symbol > .ui-icon` | SVG `display:block`，尺寸為 `--ui-symbol-size` 或 `1em`；保留 24 viewBox 與現有 stroke 風格。 | 不為每個字形加 translate／top／margin 偏移；不重畫 Paint 工具、骰點、地形或牌面。 |
| `.ui-icon`／`.ui-button-icon` | SVG 固定槽、`currentColor`、1.8 stroke、round cap/join；wrapper 使用明確 flex 置中與 `margin:0;padding:0`。 | 圖示尺寸不等於操作命中區；不規定所有遊戲內容素材都使用同一圖示庫。 |
| `.ui-button-label` | 文字 wrapper 的 `margin:0;padding:0`，圖文間距由父按鈕的 gap 管理。 | 不全局重設 span，不清除文章、資料列或素材的原有間距；不擅自壓縮文字行高。 |
| `.ui-button`／`.ui-icon-button` | 保留既有 GameUI.decorateButton 合約；icon-only 控制的寬高／最小尺寸為控制 token，fallback 2.75rem。 | 不把 D 莊家徽章、分數或非互動圖案放大成 44px 按鈕。 |
| pending 與 visibility | 保留按鈕尺寸、名稱與 spinner 色彩；明確 `[hidden]` 的以上元件必須仍 `display:none`。 | `aria-hidden` 是可及性語意，不能代替視覺 hidden；不能重置原 disabled／選取狀態。 |

共用樣式採 [ui-primitives.css](../../public/shared/ui-primitives.css)，**20 個 HTML 入口都載入**，`src/app.js` 同步加入資源白名單。遷出後移除 foundation 的重複定義，使用 `var(token,fallback)` 支援非遊戲頁；style 的載入順序與 selector specificity 要保證 opt-in 元件不再被舊分佈規則覆蓋。

`GameUI.icon(name)` 繼續回傳 SVG；新增 `GameUI.symbol(name)` 只包裝圖示槽，不做頁面查找或自動搬 DOM。`decorateButton` 仍只用於簡單控制，保留按鈕本身與 listener；複雜卡片只在適當子節點使用 symbol，不置換整張卡片。

### 未知題卡與字形的界線

本輪採用 **獨立問號形狀 SVG `unknown`**，保留 `?` 的未公開題目語意，不使用帶圓圈的 `help`，避免把資訊佔位符誤認成求助操作。外層提供「未公開的題目」可及名稱，SVG 為裝飾。若 helper 不可用，文字 `?` 放進同一 `.ui-symbol` 槽作安全 fallback。

CSS 的幾何置中與字型的可見 ink 光學置中不同。文字 fallback、emoji、玩家姓名首字及素材圖都可能因字型或透明邊界顯得不同；先修布局與槽，再用畫面驗證。不能以逐個字元的 `translateY(1px)`、`top` 或負 margin 當全站規格。

### 外部樣式污染與中性間距

背景查核找到另一個真實成因：`history.css:1` 的全域 `header span{margin-left:auto}`，會選中設定視窗 header 內按鈕的圖示 span。這不是 CSS 繼承，而是過寬的 descendant selector 直接命中內部 wrapper。主 agent 量得該 span 的 **computed 左 margin 為18px、圖示中心右偏9px**；source 宣告是 `auto`，不是寫死18px。

flex 的 auto margin 會吸收可用空間，僅有 `align-items/justify-content:center` 不能消除這個偏移。shared symbol／button-icon／button-label 明確重設 `margin:0;padding:0` 是元件的中性預設；外部間距由父元件的 gap 與控制本身的 padding 管理。這個 class 契約只作用在 opt-in wrapper，不去改所有 span，也不刪掉圖片、角標、牌面、動畫或主題的有意布局。明確的語意 modifier 若調整外框，仍需維持內部槽的置中與命中區。

## 全頁盤點

「保留」表示未發現相同的內容分佈衝突，仍需在整合中防止回歸；「待驗」表示只有 source 風險，尚無本輪實際畫面錯位證據。

| 頁面／遊戲 | 基線程式證據 | 判定與可落地動作 |
| --- | --- | --- |
| 畫猜 `draw.html` | `draw.js:89`／`draw.css:8`，三個 stage-pick-back；畫具由既有 SVG renderer 接管。 | **必修**：背面 center-content＋unknown symbol；正面 stage-pick 保留 space-between，工具保留 Paint SVG／描邊與實心差異。玩家角色、倒數與畫布不套本 utility。 |
| 送禮 `gift.html` | `gift.js:25` giftThumb，`gift.css:19` story-gift-fallback、`:29` choice-art／choice-placeholder、`:85` 圖片槽。 | **保留＋待驗**：父 story-gift-card 已 align-content:center，choice-art 是独立置中槽，沒有畫猜的 space-between 衝突。glyph 可使用 symbol；整張 gift-choice 的圖／標題／選取狀態不改分佈。**必驗 hidden**：圖片存在時 fallback 不顯示，壞圖後才顯示；小序號是角標，不能搬到圖示中心。 |
| 同頻 `majority.html` | `majority.css:6` note-seal、`:34` group-player-avatar；`majority.js:121` 姓名首字 fallback。 | **保留＋待驗**：seal 與首字已有 grid center，適合獨立 symbol 槽；二／三選一答案含選項代號與文字，不能把整張 answer 卡套 center-content。 |
| 雷霆 `race.html` | `race.css:139` mini-die／used i、`:166` terrain-help-icon、`:176` die-button SVG；`shared/race-dice-dialog.js:8` face grid。 | **保留＋待驗**：數字骰沿用專用 SVG，不能換成字型骰子；地形圖示可沿用槽但完整名稱保留。已用 ×、未知 face 與地形 glyph 的光學對齊要實測；判定說明、角色／車隊與場景動畫不套 utility。 |
| 撲克 `poker.html` | `app.js:32` D badge；`style.css:2` `.seat .badge` 21×21、padding4、font-size10，無 grid/flex center。 | **必修**：D 使用 symbol 槽與明確可及語意，保留小徽章尺寸；不能強制44。牌面點數／花色／背面、籌碼與牌桌插圖保留原布局。 |
| 大廳 `index.html` | `index.html:1` tile-badge／market-mark；`lobby.css:14–18` 角色、名稱與對話泡泡、`:27` 表情選項。 | **保留**：文字 badge 非固定單字元，角色／對話框是内容，不替换emoji或人物表情；只沿用全站 header 的控制修正。 |
| 禮物題庫 `gifts.html` | `gifts.js:17` library-gift-art fallback、`gifts.css:1` grid/place-items，`:6–9` 圖庫選擇含圖與名稱。 | **保留＋待驗**：藝術槽已置中，无同类分佈衝突；可包 fallback glyph，不能重置完整圖庫選項布局。 |
| 畫猜題庫 `draw-words.html` | `draw-words.html:8` 載入更多；`draw-words.js:9` 題目、類別與來源文字。 | **保留**：本地主要為文字與資料列，没有同類未知題卡；共用 header 控制適用，不能全列置中。 |
| 社群 `community.html` | `community.js:7` 遊戲／處理狀態 tag；`community.css:1` padding badge。 | **保留**：狀態 tag 依文字自然高度，不是單字元槽；不替換題目選項、留言或投票狀態。 |
| 素材庫 `collection.html` | `collection.css:156` collection-badge inline-flex/align-items:center、`:82/:168` 操作；`collection.js:14–15` 素材圖及 metadata。 | **保留＋待驗**：文字 badge 已對齊，无固定單字元衝突；素材圖不作通用 icon。較小操作尺寸為獨立 hit-area 盤點，不混入本次幾何修正。 |
| 工作室 `studio.html` | `studio-editor.js:69` studio-icon-button；`club-pages.css:141–142` flex center／SVG block，`:189/:241/:267/:288` 40／38／34／39px override。 | **保留＋待驗**：工具已有明確 center，不逐個補偏移，不換掉 Paint icon。多種命中區尺寸需另測工具列與手機，不能用全局44強撐而擠壞畫布。 |
| 個人角色 `profile.html` | `profile.html:23–24` 音效 SVG＋文字；`club-pages.css:118–120` flex row與24px SVG。 | **保留**：音效圖示可用共用槽，既有圖文按鈕／人物與表情預覽保留；不改主角色素材的透明邊界。 |
| 設定 `settings.html` | `settings.css:1` settings-characters，`:2` 暱稱控制／status。 | **保留**：角色選項是圖文內容卡；全站 settings close 適用，其餘表單不整區置中。 |
| 股市 `market.html` | `market.css:1` free-tag 已 align-content:center，`market.html:5` 為多行貼紙。 | **保留**：free-tag 文字與旋轉是有意的視覺布局，不用單字元 utility 改掉；交易／投票表單與狀態保留。 |
| 音樂 `music.html` | `shared/table-music.css:4` controls inline-flex center、21px SVG；`:16/:20` 遊戲44／24px版本。 | **保留＋待驗**：共用 media controls 可包 symbol 保留局部SVG；獨立音樂頁較小命中區另驗，不偷套遊戲側欄或所有44px規則。 |
| 歷史 `history.html` | `history.css:1` 全域 `header span{margin-left:auto}`；`history.js:10` SVG text-anchor、`y="4"` 未知地形標記；`history.html:1` 前／後文字按鈕。 | **已驗修正**：全域selector污染設定close的symbol，computed margin18／中心右偏9，wrapper margin／padding reset後重載中心dx/dy0。**保留＋待驗**：歷史SVG文字仍由SVG座標管理，不套HTML utility；本輪未完整實玩歷史回看，隱私契約不因圖示更動而改寫。 |
| 成就 `achievements.html` | `achievements.css:1` achievement-mark grid center＋clip-path＋Georgia。 | **保留＋待驗**：徽章是內容美術，不假稱已有偏移；可用獨立 symbol 槽但不全換工具圖示、不強44。 |
| 登入 `login.html` | `login.html:20/:26` art-chip／card-symbol；`club-pages.css:35/:42` 已 grid center。 | **保留**：品牌籌碼與花色插圖無同類分佈衝突；表單與全站 header 保留語意。 |
| 規則 `rules.html` | `rules.html:1` 全站 header 與規則文章。 | **保留**：source沒有本地單字元控制布局；只繼承共用控制契約，段落／列表不能置中。**驗證界線**：實際 `/rules` 入口進入 `/race` 教學，入口geometry證據來自該教學頁，不能稱rules文章頁已完整驗收。 |
| 管理 `admin.html` | `admin.html:10` 全站 header；`admin.js:6–7` 資料表與文字操作。 | **保留**：沒有本地未知／單字元卡片；不改資料表、密碼與管理操作流程。 |

## 共用動態元件盤點

| 範圍 | 基線證據 | 狀態／動作 |
| --- | --- | --- |
| 全站頁首齒輪與關閉 | `shared/site-header.css:10–16`、`shared/site-header.js:8`。齒輪已有44px grid center；close 只有 width44／font24／padding0，沒有相同的中心槽。 | **必修契約**：close 用 ui-icon-button＋× symbol，保留 aria-label、Escape、開關及返焦；實際字形畫面由主 agent 驗。 |
| GameUI icon/button/pending | `shared/ui-components.js:27–43`、基線 `shared/ui-foundation.css:19–26`。 | **必修**：primitives 移出、避免兩個來源分叉；保留 registry、accessible caption、事件、尺寸與原 disabled。不得做全 DOM 的通用 glyph 替換器。 |
| 玩家首字／圖像槽 | `shared/game-shell.css:68–70`、`shared/game-shell.js:199–200`。 | **保留＋待驗**：已有 player avatar grid；首字可包 symbol，但多字節姓名／emoji 的截字規則是另一議題，本次不改。角色圖與分數常駐。 |
| emoji 彈幕選單 | `shared/game-shell.css:104`，game foundation 提供44px grid center；`game-shell.js:64–65` 將選單入口 decorate 成 emoji SVG。 | **保留**：emoji 是使用者傳送內容，不替換成registry；入口SVG與操作槽共用。要驗縮放與群組hidden，不能用aria-hidden隱藏選單。 |
| 音樂／共看窗控制 | `shared/table-music.css:4/:16`、`shared/table-watch.css:11/:28`、`table-watch.js:21`。 | **保留＋待驗**：已有 flex／尺寸及decorate adapters；遷移後驗toolbar／SVG中心、選單／pending／拖曳與主操作，不能讓 nested SVG 起拖曳。 |
| 控制列、文字狀態與場景動畫 | Game toolbar／PlayerRow／immersion／race vehicle effects 等。 | **保留**：混合內容橫列使用既有 align-items:center；長文行高與動作 transform 是內容布局，不受 line-height:1 或 center-content 全局覆寫。 |

## 實際討論與收斂

| 順序 | 提案／質疑 | 實際回覆／決策 |
| --- | --- | --- |
| 1 | 主 agent 定位選題背面仍承接 space-between，提議全頁 primitives，而非只補問號偏移。 | 程式方確認 place-items／place-content 分工，正面分佈與背面置中需分開。 |
| 2 | 程式方質疑「字元盒已置中」不等於字型 ink 同樣置中，提出未知SVG與文字fallback界線。 | 主 agent 決定使用不帶help圓圈的 unknown 問號SVG，保留?語意；文字fallback放同一symbol槽。 |
| 3 | 程式方發現 game-only button／pending contract，提出 global primitives＋token fallback。 | 主 agent 採用全20HTML載入、foundation去重；不帶入非遊戲頁整套game layout。 |
| 4 | 程式方指出D是小資訊徽章，studio已有center但多種命中區，不能一律44。 | 主 agent 同意D用symbol但保留尺寸；studio尺寸另列待驗，不全局強撑。 |
| 5 | 主 agent 要求查送禮 fallback 是否同類分佈缺陷。 | 程式方確認沒有space-between衝突；選禮卡仍多區內容。提出隱藏fallback加display utility會覆寫UA hidden的風險。 |
| 6 | 程式方提出明確hidden狀態需隨元件契約保留。 | 已唯讀看到主 agent 新 primitives 對 symbol／center-content／button／icon-button 的 `[hidden]` 保留 display:none；實際圖片載入與壞圖仍需背景驗收。 |
| 7 | 主 agent 背景量得history close右偏9px，加入wrapper margin／padding reset後中心歸零，要求程式方評估是否成為共用契約。 | 程式方核對原宣告為全域header span的auto margin，18px為computed值；採用symbol／icon／label中性間距與parent gap，限定opt-in class，保留內容與語意modifier。幾何通過不延伸為所有玩法、素材或emoji已驗。 |

以上是本輪訊息中的提案與回覆，不推定其他角色未回覆的意見為共識，也不替代測試證據。

## 主 agent 回報的背景 Chrome 證據

2026-10-07來源：主 agent 的實際背景 Chrome 查核回報；本 agent 另唯讀核對 history selector 與最新 primitives reset。此處列明量測內容，沒有把 VM 或本 agent 的source檢查當成同一次瀏覽器操作。

| 驗證範圍 | 回報的實際結果 | 限制 |
| --- | --- | --- |
| 非畫者題卡背面 | 舊內容中心向上38.5px；正常桌機與390px寬手機的新槽中心 dx=0、dy=0。 | 這是該題卡／槽的量測，不是全畫猜每種狀態的全面實玩。 |
| 20個HTML source與20個入口幾何 | 共用CSS／JS各單份；設定close逐入口44×44，history reset並重載後，全20入口中心dx/dy0。 | source盤點涵蓋20份HTML；實際入口可能導向另一頁，如/rules進入/race教學。不能稱20頁的所有玩法／所有控制都已測。 |
| 一般撲克中的D | 實際加入正常撲克UI後仍21×21；文字Range中心dx=0、dy=-0.5px。 | 保留小徽章尺寸。Range量測不是可見ink的逐像素分析，也不是完整牌局驗收。 |
| 200%文字的設定close | root字體32px時控制88×88，中心偏移0；中心與四個四分之一位置採樣點的命中全true。 | 這五點命中不表示按鈕外框每個像素、所有其他互動或所有emoji都已驗。 |
| 測試狀態還原 | 當次頁面字體還原16px、viewport設定還原。 | 不把尺寸測試設定留在後續檢查中。 |

素材正常／壞圖／載入失敗fallback、所有emoji與角色素材的光學邊界、studio小尺寸控制、每款遊戲的全部互動及跨瀏覽器驗收仍未由本輪這組證據覆蓋。以上為本地背景驗證回報，不宣稱正式站已更新。

## 驗收規格與未驗範圍

1. **來源完整性**：20個HTML皆載入資源；HTTP whitelist可讀；game foundation無重複primitive；非遊戲頁無需設定data-game-kind也能使用symbol與icon button。
2. **幾何＋視覺**：選題非畫者三張背面、D、settings close以實際DOM量測槽與目標內容中心差，正常縮放以1 CSS px內為幾何目標；另看截圖核對SVG／文字ink，不只以元素rect聲稱「看起來置中」。
3. **縮放與尺寸**：1280×720、1440×900、390×844及200%文字至少各驗關鍵元件；手機可重排，不能截掉焦點、文字或有效控制。
4. **狀態與語意**：圖片有效／壞圖／fallback隱藏，元件hidden，owner／disabled／pending，已選／未選，設定關閉／Escape返焦均不改流程；測試控制中心與內部四個象限的elementFromPoint命中，保留原buttonlistener。證據要記實際採樣位置，不把內部採樣宣稱為完整邊框覆蓋。
5. **內容卡回歸**：畫者仍能看見完整題目／類別／選題操作；送禮圖／標題／狀態、同頻答案、玩家姓名／角色／分數、Race17骰與D語意完整；不因共用元件丟資料、洩露未知題目或強制素材裁切。
6. **測試的實際限度**：CSS source檢查及VM可驗證markup／API／hidden處理意圖，不能替代真瀏覽器的computed style、字型、SVG bbox、hit test與截圖。Safari／不同平台字型／emoji光學偏移及studio的小尺寸命中區仍列待驗，未做本輪測試不可寫通過。

程式與背景驗收 owner：主 agent。此文件與 [DESIGNER記憶](../agents/DESIGNER.md) 只記穩定契約、範圍與實際討論，不保存帳密、cookie、房號或本機偏好。
