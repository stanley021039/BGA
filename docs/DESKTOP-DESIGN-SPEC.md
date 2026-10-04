# BGA 桌機介面設計規格

日期：2026-10-04。此規格把跨來源設計研究、程式審查與本次背景畫面檢查轉成實作及驗收項目。桌機優先，手機維持基本可用；本輪包含整體遊戲、送禮達人、你畫我猜、雷霆之路、同頻俱樂部。進度與測試證據見 [桌機設計進度](DESKTOP-DESIGN-PROGRESS.md)。

## 設計理念與研究依據

以下數值為 BGA 的專案決策，不是所有設計系統的共同標準，也不代表整站已符合 WCAG。

| 類別 | 理念與實作規則 | 研究來源及可用範例 |
| --- | --- | --- |
| L 桌機優先 | 1280×720、1440×900 的 100% 縮放優先。舞台彈性寬、控制側欄約 320px；當內容最低寬不足才重排。200% 放大及低高度允許捲動，不裁切內容或縮字。 | [Fluent Layout](https://fluent2.microsoft.design/layout)、[MDN Grid 範例](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts)、[Bootstrap Sidebars](https://getbootstrap.com/docs/5.3/examples/sidebars/) |
| T 字級與可讀性 | 常規 14／16／20／28px：次要／正文與操作／區塊／頁面標題；32px 用主要數據。正文行高 1.5；rem 尊重使用者字體設定；倒數採等寬數字及固定字槽。 | [GOV.UK](https://design-system.service.gov.uk/styles/type-scale/) 正文19、[Fluent](https://fluent2.microsoft.design/typography)正文14、[Carbon](https://www.carbondesignsystem.com/building-blocks/foundations/typography/type-sets)固定token；數值因情境不同 |
| A 對齊 | 標題、說明、欄位共用邊界。玩家頭像固定欄、姓名可伸展、數值靠右。布局用 Grid／Flex，不用任意絕對定位排一般控制。 | [Carbon Grid](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/overview)、[MDN Alignment](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Box_alignment) |
| S 間距與點擊區 | 間距4／8／12／16／24／32：微調／icon-label／控制群／卡片內距／區塊／大區隔。gap 管同層、padding 管容器。主要控制44px點擊區，圖示視覺20／24px。 | [Atlassian Spacing](https://atlassian.design/foundations/spacing)、[Carbon Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview)、[Fluent Layout](https://fluent2.microsoft.design/layout) |
| I 資訊密度與圖文 | 熟悉的畫具、關閉、音量可純圖示；确认收禮、提交、計分、離房等保留短字。去重狀態與冗詞，不以全部藏文字降低資訊量。 | [NNGroup Icon Usability](https://www.nngroup.com/articles/icon-usability/)、[USWDS Icon](https://designsystem.digital.gov/components/icon/) |
| V 圖示一致性 | 共用registry，24 viewBox、1.8 stroke、round、currentColor。保留小畫家式工具語意。角色、emoji、禮物和車輛是內容素材。 | [Lucide Vanilla JS](https://lucide.dev/guide/lucide)、[Material Symbols](https://developers.google.com/fonts/docs/material_symbols)、[Fluent Iconography](https://fluent2.microsoft.design/iconography)；比較後採現有SVG風格 |
| C 共用元件與位置 | 共用tokens、Icon、Button／IconButton、Field、PlayerRow、Status、Dialog、GameLayout與InteractionDock。各遊戲HTML提供靜態action slot，共用shell不反覆搬新render按鈕。 | [USWDS Tokens](https://designsystem.digital.gov/design-tokens/)、[Web Awesome Button](https://webawesome.com/docs/components/button/)、[Fluent Text demo](https://storybooks.fluentui.dev/react/?path=/docs/components-text--docs) |
| P 漸進揭露 | 當前操作、進度與下一步常駐。完整紀錄、長規則、次要選單按需展開。Tabs只分隔不必同時比較的內容，切換保留draft與進度。 | [NNGroup Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)、[GOV.UK Details](https://design-system.service.gov.uk/components/details/)、[GOV.UK Tabs](https://design-system.service.gov.uk/components/tabs/) |
| F 狀態與錯誤回饋 | 區分未選、已選、送出中、已鎖定、等待、成功、失敗。pending可見且防重複，保持尺寸；錯誤接近操作並保留draft，固定回饋區避免跳動。 | [Carbon Inline Loading](https://www.carbondesignsystem.com/building-blocks/core/components/inline-loading/guidelines)、[USWDS Alert](https://designsystem.digital.gov/components/alert/)、[W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) |
| K 焦點與色彩辨識 | 普通文字4.5:1；必要圖示、選取提示與焦點3:1。狀態同時有文字／標記。Tab／Enter／Escape可用，彈窗具名稱及返焦，輪詢不搶焦點。 | [W3C Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)、[Xbox UI focus](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113)、[USWDS Modal](https://designsystem.digital.gov/components/modal/) |
| M 動效與結果呈現 | 動效解釋局部事件，舞台與操作位置穩定；可略過，文字結果仍可讀。結果摘要讓人能同時比較，詳情另展開。既有動畫設定與角色表情行為保留，不新增動畫開關。 | [Fluent Motion](https://fluent2.microsoft.design/motion)、[Xbox UI context](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/114)、[Xbox Motion](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) |

## 審查基準與共用合約

本次隔離背景瀏覽器的1280×720初始檢查：共用頁首105px；八人送禮主舞台底815px、互動輸入底約1300px；同頻主操作與互動區超出720px；賽車互動區底約858px。這些測量證明問題不只在字級，還包含內容分工與高度配置。原始證據在已忽略的 `work/desktop-before-*.jpg`、`work/desktop-before-metrics.json`。歷史截圖不算本次驗收。

- 頁首僅在遊戲頁壓到48–64px，仍可使用導覽／帳號。
- 靜態 `.game-action-slot[data-game-action-slot]` 放右侧欄上方；各遊戲負責render其內容及事件，原舞台表單可由button的 `form` 属性提交。
- 玩家／紀錄有界局部捲動，主要操作與 `.shared-game-ui.integrated` 互動區保持可見。角色表情可改善呈現，但原API及切換行為不變；emoji彈幕使用獨立入口。
- 共用樣式集中於 `public/shared/ui-foundation.css`，在遊戲既有樣式後載入；圖示與操作工具集中共用，不新增UI framework。
- 所有改動保留遊戲規則、房間生命週期、重連、填色與素材存取權限。

## L 桌機布局

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| L-ALL | 整體遊戲 | site-header.css頁首105px，舊shell角色選單常駐使dock沉底；共用compact header與stage/sidebar布局。 | 1280×720主要操作及互動區可見；1440×900利用寬度；200%合理reflow。 |
| L-GIFT | 送禮達人 | gift.css八人壓縮仍超出視窗；主舞台一個選擇panel，右側常駐兩項進度／鎖定操作，名單局部scroll。 | 八人長姓名，兩項鎖定與互動可見；禮物可完整瀏覽。 |
| L-DRAW | 你畫我猜 | draw.css/tools與guess panel過長；左畫具、中畫布、右猜題／主操作／玩家。 | 常用畫具與猜題提交可見；畫布保持比例和座標正確。 |
| L-RACE | 雷霆之路 | race.css壓縮9–12px仍使社交區沉底；道路左側，dashboard右上，車隊／紀錄局部展開。 | 四車隊，主指令及車旁事件可見；賽道pan不變。 |
| L-MAJ | 同頻俱樂部 | majority.css/js各階段縱向堆叠；問題／答案／分組在舞台，提交／合併／計分／下一題在右側。 | 出題、作答、審核、揭曉主要操作不沉底。 |

## T 字級

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| T-ALL | 整體遊戲 | 共用彈幕12、角色標籤8、離房12px；共享rem字級、system中文字體、line-height與tabular數字。 | 主要資訊／欄位／操作16，次要14；長中文字不裁切。 |
| T-GIFT | 送禮達人 | 禮物／朋友8–11px；名稱16、輔助14，摘要20/28，送收數字使用數據token。 | 八人仍達可讀門檻；不為塞畫面縮字。 |
| T-DRAW | 你畫我猜 | 題材、猜題、工具欄10–13px；統一字級並保持倒數32及固定字槽。 | 100→99、10→9倒數不變字級／推動布局。 |
| T-RACE | 雷霆之路 | 車隊名與指令9–12px；一般UI16/14，地圖實體標记另保留比例。 | dashboard與圖例可讀；SVG地圖例外有文字上下文。 |
| T-MAJ | 同頻俱樂部 | 題型、進度、預備題12–13px；題目20/28、表單16、輔助14。 | 長160字題目可瀏覽，倒數不推動其他元件。 |

## A 對齊

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| A-ALL | 整體遊戲 | 玩家狀態與分數各遊戲各排；共用PlayerRow頭像／姓名／指標欄及對齊線。 | 長姓名不盖分數，送／收兩指標可比較。 |
| A-GIFT | 送禮達人 | 玩家名、禮物名與進度邊界不一；禮物等列網格、右側主操作共用左邊界。 | 長禮物名可換行，選取標記位置固定。 |
| A-DRAW | 你畫我猜 | 工具組、色盤、canvas與猜題區分散；共用grid與欄內對齊。 | 工具對齊、畫布固定、猜題欄與按鈕基線一致。 |
| A-RACE | 雷霆之路 | 多段CSS覆寫車隊／dashboard；建立明確stage/controls區域與控制欄。 | 車型、骰子、主操作對齊，事件卡不越舞台。 |
| A-MAJ | 同頻俱樂部 | 進度／題目／結果各自堆疊；答案等寬、from/to/select與button對齊。 | 三選一及合併控制均可掃讀，不互相遮蓋。 |

## S 間距與點擊區

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| S-ALL | 整體遊戲 | 3/5/7px多種gap、36px離房、38px emoji；統一spacing／44px主要控制。 | DOM幾何確認44px；控制群gap12、卡片padding16。 |
| S-GIFT | 送禮達人 | grid gap3、recipient25px；recipient與panel控制44，禮物間距8/12。 | 選取／取消不易誤點；長姓名可操作。 |
| S-DRAW | 你畫我猜 | 工具42px、色塊25px；工具44、色塊擴展點擊區，工具分組。 | 畫筆／填色／各形狀／復原可鍵盤或滑鼠操作。 |
| S-RACE | 雷霆之路 | 指令30–32px、車隊gap4/6；骰子／車卡／主要操作44且合理留白。 | 正常UI不擠；地圖格保留玩法尺寸。 |
| S-MAJ | 同頻俱樂部 | 小型tabs／題庫入口與大submit不一致；統一44、gap12、panel16。 | 題型、選答案、合併與題庫都易操作。 |

## I 資訊密度與圖文

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| I-ALL | 整體遊戲 | 重複名單／輪次／長標籤；去重、短label，重要動作保留短字。 | 同類控制名稱一致；純icon有可及名稱。 |
| I-GIFT | 送禮達人 | 兩套相同九件禮物同時呈現；改自由panel切換及常駐雙進度。 | 不强制先後，切換不清draft，两項狀態可見。 |
| I-DRAW | 你畫我猜 | 維持小畫家圖示，工具提示包含用途；猜題與收藏保留短字。 | 不新增填滿checkbox；空心／實心與區域填色仍獨立。 |
| I-RACE | 雷霆之路 | 每步顯示長指令説明／已用控制；当前下一步短提示，詳解進rookieHelp。 | 知道輪到誰及下一步；玩法資訊仍可展開。 |
| I-MAJ | 同頻俱樂部 | 規則腳注及預備工具常駐占舞台；次要說明收合，出題／合併／計分短字。 | 主要任務不可只剩陌生圖示。 |

## V 圖示一致性

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| V-ALL | 整體遊戲 | emoji入口、音效／離房图示風格不同；共用registry映射功能名稱。 | 通用SVG粗細／圓端點一致，emoji內容保留原樣。 |
| V-GIFT | 送禮達人 | 锁定／接受／重播使用共用操作外觀，保留禮物圖片。 | 同功能同icon，禮物圖片不被替換。 |
| V-DRAW | 你畫我猜 | 既有StrokeCanvas24/1.8作为基準；新增收藏等通用圖示沿用尺度。 | 小畫家辨識與既有stroke algorithm不變。 |
| V-RACE | 雷霆之路 | 車型／危險是遊戲內容；只統一靜音、說明、略過等工具圖示。 | 車輛與地形不誤套線框規則。 |
| V-MAJ | 同頻俱樂部 | 題庫／關閉／重播使用共用工具圖示，答案標記保留字母／勾選。 | 選取狀態不用僅顏色表達。 |

## C 共用元件與固定位置

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| C-ALL | 整體遊戲 | game-shell搬DOM且各CSS尾端多層覆寫；共享foundation／icon／status，明確slot contract。 | 同類互動在右側固定順序，兼容舊遊戲，非遊戲頁不受影響。 |
| C-GIFT | 送禮達人 | 主要锁定／接受／next由static action-slot承接；PlayerRow與dock复用。 | state更新不生成重複主操作。 |
| C-DRAW | 你畫我猜 | static drawActions/guess區与sidebar，GameShell不再搬猜題。 | 猜題處理器／输入／錯答紀錄均保留。 |
| C-RACE | 雷霆之路 | HTML静态race-controls與dashboard slot，shell只挂dock。 | 不重复建立controls或每次重新挂载dashboard。 |
| C-MAJ | 同頻俱樂部 | static action-slot與stable action render，主表單用form attribute提交。 | 表單驗證／事件委派作用範圍正確。 |

## P 漸進揭露

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| P-ALL | 整體遊戲 | 角色六表情常驻、歷史说明占位；選單按需顯示、名單／紀錄局部scroll。 | 角色API不變；主進度／操作不被藏起來。 |
| P-GIFT | 送禮達人 | 詳細規則／每人完整禮物結果過長；常駐送收摘要，完整明細展開。 | 全員收完前不顯總分圖；收完能比較每人分數。 |
| P-DRAW | 你畫我猜 | 工具與聊天優先，長說明移到規則；聊天紀錄有界scroll。 | 錯答保留、可回看；目前猜題入口常駐。 |
| P-RACE | 雷霆之路 | legend／電台／車隊與操作同層；低頻內容details或局部scroll。 | 所有事件仍可讀；道路與下一步常駐。 |
| P-MAJ | 同頻俱樂部 | 個人得分明細堆在分組後；摘要常駐、明細details，分組審核保持主任务。 | merge/score不藏；最多8組可完整瀏覽。 |

## F 狀態與錯誤回饋

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| F-ALL | 整體遊戲 | sending只有bool、error空時消失致布局跳；共用busy／固定status／語意颜色，失敗保留输入。 | 慢網路可辨識，防重複，失敗可重試，文字不清。 |
| F-GIFT | 送禮達人 | lock/accept busy不可見；明示選取進度、pending、locked與recipient等待。 | 兩鎖定獨立，逐人accept才前進，快速連點不重送。 |
| F-DRAW | 你畫我猜 | choosing落到finished else；新增明確choosing與finished分支，提交/收藏有回饋。 | 選題中不出现本局完成／再玩一局／錯誤收藏；只真正結束顯示重玩。 |
| F-RACE | 雷霆之路 | busy只擋request；當前阶段／等待／pending／失敗可見，倒數固定字槽。 | 指令失敗可再次操作，不误改phase。 |
| F-MAJ | 同頻俱樂部 | 選答案重render失焦；局部更新選取，pending可見，from/to同組禁合併並給理由。 | 交卷／撤回／merge／score不重送；draft保留。 |

## K 焦點與色彩辨識

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| K-ALL | 整體遊戲 | error原颜色約3.7–4.0:1；dialog無明確名稱contract，emoji選取後返焦不完整。 | 文字4.5／必要狀態3；emoji開啟／選取／Escape與題庫dialog返回入口可驗證。 |
| K-GIFT | 送禮達人 | recipient/panel重render可能失焦；設定aria-pressed、可見選取mark與合理返焦。 | 鍵盤切panel/recipient/禮物/鎖定完整，輪詢不搶焦。 |
| K-DRAW | 你畫我猜 | 工具有aria-label但focus與色塊過小；共用focus ring，保留輸入focus/scroll。 | Tab/Enter操作工具、題庫、猜題；200%不裁切。 |
| K-RACE | 雷霆之路 | 車卡／控制有focus保留機制；復用並統一ring及字／背景對比。 | 狀態更新不丟控制焦點；暗底欄位可讀。 |
| K-MAJ | 同頻俱樂部 | 選答案stage.innerHTML丟focus；預備dialog缺labelledby。 | 選答案不換節點；dialog Tab/Escape/返焦，選取不只靠颜色。 |

## M 動效與結果呈現

| ID | 遊戲 | 現況與修改內容 | 驗收條件 |
| --- | --- | --- | --- |
| M-ALL | 整體遊戲 | 共用barrage／status不应影響主要操作或每秒播報；舞台位置穩定，非阻塞回饋。 | 動畫不挡submit、dialog或焦點；文字結果在動效後仍可讀。 |
| M-GIFT | 送禮達人 | 保留全員送给当前recipient與确认流程；最終摘要／圖表／明細明确。 | 每人收完才計分，全部禮物明細可查；保留既有演出偏好及收禮確認節點。 |
| M-DRAW | 你畫我猜 | 固定canvas節點與選題／作畫／揭曉／结算階段；新布局不重設筆畫。 | 畫一筆、猜錯／猜中、揭曉、收藏與換輪可實玩。 |
| M-RACE | 雷霆之路 | 保留車旁event cue，依新舞台邊界clamp，不遮當前可操作格。 | 移動／碰撞等已觸發事件可見且記錄可查，未觸發事件不宣稱驗證。 |
| M-MAJ | 同頻俱樂部 | 分組聚集／焦點與結果分工；控制不隨動畫位移，結果摘要同時可比較。 | 三選一與填空review/reveal可實玩，略過／重播及分數仍正確。 |

## 驗收與執行順序

1. 共用foundation／icon／status／dialog／dock先實作；四遊戲依各自spec並行調整，沒有跨owner寫檔。
2. 背景本機檢查1280×720、1440×900、200%文字／布局放大、390×844手機輔助；用真DOM幾何、focus與截图驗收，不只靜態CSS。
3. 跑既有完整測試，新增測試只針對實際狀態／焦點等行為問題，不為每個CSS數值建立鏡像測試。
4. 同步shhuang.cc後用既有測試帳號隔離登入，實際開遊戲操作主要流程並記錄看見的動效。測試房最後離房清理，密碼不寫入Git或公開文件。
5. 進度文件每完成一批更新，保留未驗證項的真實狀態；本輪不push、不建立MR。
