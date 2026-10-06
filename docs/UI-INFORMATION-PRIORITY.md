# 遊戲資訊優先級與數字排版審查

審查日期：2026-10-04。舊版基準為 `7346c0f^`（`f3588ff`），新版基準為 `a37bf95`（包含 `7346c0f` 的桌機改版及返焦修正）。本報告比較這兩個固定版本；本輪同步進行的恢復常駐修改另行驗收，不能先算成已完成。

審查包含 HTML、遊戲 renderer、共用 shell 的 runtime 搬移及 CSS，並參考背景截圖。資料仍存在 DOM 或仍有 API，不代表使用者能直接看到它。720p 免捲頁是配置目標，不能據此把名單、角色、骰子或剩車藏進管理選單。

## 評分規則

三個分數皆為 1–5，按資訊相關的遊戲階段評分；同一項若在關鍵階段變重要，以該階段較高需求決定配置。分數是專案的產品判斷，不是假稱正式設計標準或量測使用頻率。

| 分數 | 重要性 I：看不到的影響 | 使用頻率 F：何時需要看 | 決策需求 D：是否直接影響下一步 |
| --- | --- | --- | --- |
| 1 | 裝飾或補充背景 | 偶爾／局外才查 | 不影響操作 |
| 2 | 有助理解，但不妨礙遊玩 | 入門或少數情境 | 用於理解說明 |
| 3 | 有用的輔助或回顧 | 每局或每輪看幾次 | 有助比較／確認 |
| 4 | 缺少會增加錯誤或失去重要體驗 | 一輪中多次查看 | 影響選擇或下一步 |
| 5 | 核心狀態、結果、對象或玩家身分 | 持續或每次行動查看 | 當前選擇不可缺少 |

**常駐門檻**：使用者指定不可藏的資訊優先；其餘只要 `I=5`、`D>=4`、`F=5`、或 `I>=4 且 F>=3` 任一成立，在相關階段就須直接可見。總分可用於排序，但不能平均掉低頻高風險資訊，例如確認收禮、盲注或碰撞選擇。

**折疊門檻**：僅在 `I<=3 且 F<=2 且 D<=2`、未被使用者指定常駐、且有明確入口時，可將完整內容放在 dialog／按需區域。介於兩者的項目至少留常駐摘要和狀態，次級明細才按需。emoji 選項依原要求按按鈕後挑選；這不等於可以藏住當前玩家／車隊狀態。

常駐包含舞台旁可見的有界清單、並列卡片或具明確捲動區的名單；不包含預設關閉的 details、管理 dialog、只靠 hover title、或必須先開另一個選单的入口。名單若局部捲動，區域要能看到完整人列與捲動線索，不能只露半列；四車隊優先全列展示。暱稱／狀態維持 16／14px，角色圖可按用途縮至 24–32px，但不能移除角色或姓名來換首屏高度。

## 整體共用資訊

| 資訊 | I | F | D | 舊版 → 新版 | 建議 |
| --- | --- | --- | --- | --- | --- |
| 玩家姓名、角色、自己標記、在線／離線 | 5 | 5 | 4 | 四款原生名單常駐 → 三款收合、賽車雙層收合；撲克仍常駐 | 恢復原生可見名單；管理只處理踢人等管理動作 |
| 誰正在畫／出題／操作、自己是否可動 | 5 | 5 | 5 | 共用 turn + 個別提示 → static slot 隱藏重複 turn | 可去重，但個別提示必須完整涵蓋身分與狀態；名單也標當前人 |
| 完整角色表情選項（不是玩家當下角色圖） | 3 | 2 | 1 | 桌機原角色按鈕列 →「角色」details | 入口常駐、選項按需；此頻率是專案判斷，沒有使用紀錄證據。本批依「角色表情不用改」只修浮層定位與可用性，不新增常駐選項列 |
| emoji 彈幕選擇 | 3 | 4 | 2 | 原 emoji 按鈕／選單 → 同一位置入口與選單 | 入口常駐，選項按下後顯示，符合原要求 |
| 文字彈幕、發送及 pending／錯誤 | 4 | 4 | 3 | 原互動區 → 固定側欄 dock、可見回饋 | 常駐；文字草稿及焦點不能因輪詢消失 |
| 回合、階段、倒數 | 5 | 5 | 5 | 原遊戲資訊 → 仍在頁面／slot | 常駐，避免跨遊戲將同功能放不同角落 |
| 房號／邀請 | 3 | 2 | 2 | 原頁面／toolbar → 仍存在 | 保留短常駐識別即可，優先修字體而非藏進選單；等候入座階段頻率更高 |
| 離房入口 | 4 | 2 | 4 | 原房間工具 → utility row | 常駐可見；不能用房主管理取代普通玩家入口 |
| 房主管理／完整歷史／音量細項 | 2 | 1 | 1 | 原工具或導覽 → 工具／導覽與按需設定 | 可按需，不能把玩家資訊一併搬入管理 |
| 題庫新增內容 | 3 | 2 | 2 | 原頁面／題庫 dialog →具名稱 dialog | 入口可辨識，內容 dialog；保存遊戲草稿，close／Escape 正確返焦 |

共同來源：`public/shared/game-shell.js`、`game-shell.css`、`ui-foundation.css`；各遊戲 `#players`／`#crews` 的 renderer。新版 `shared-turn` 被隱藏與重複 `shared-players` 被隱藏需分開看：原生名單也收合時，刪掉重複名單並沒有留下等效的常駐版本。

## 送禮達人

| 資訊 | I | F | D | 舊版 → 新版 | 建議 |
| --- | --- | --- | --- | --- | --- |
| 全員姓名／角色、房主、在線、送／收分數 | 5 | 5 | 5 | `#players` 常駐 → `#playerList`；桌機高度<=800 預設關閉 | 恢復常駐有界名單；送分／收分須有可見短標記，不能僅 title |
| 每位朋友已指派哪個禮物、自己的四順位心願 | 5 | 5 | 5 | 送禮／心願兩區同見 → 切 panel 會藏住另一任務內容 | 保留兩任務常駐摘要：每位收禮者的指派、四順位、完成狀態；大禮物 grid 可切換 |
| 送禮／心願是否鎖定及全員完成進度 | 5 | 5 | 5 | 原兩區進度 → 右側雙 progress | 保留；不能只用同一個總完成數掩蓋誰尚未完成哪一項 |
| 可選禮物的圖像／名稱／已被使用 | 5 | 5 | 5 | grid → 單 panel grid | 保留全套可選內容，選中態同時有圖形／文字標記 |
| 當前收禮者、收禮序號、禮物與確認權限 | 5 | 5 | 5 | 原逐人收禮 → 仍常駐 | 保留收禮者名字／角色與收禮內容；確認後再換人 |
| 全員送／收總分、目標及得分結果 | 5 | 5 | 5 | 完整結果分數 → 仍常駐圖表 | 保留全員分數，不靠展開名單才能比排名 |
| 全員收到什麼／每人的完整收禮明細 | 4 | 3 | 3 | 原 recipient tabs + 常駐明細 panel → 外加 closed result-details | 移除外層收合，保留原收禮者 tabs 與常駐明細；可另加全桌禮物縮圖摘要 |
| 投稿比例的長解釋 | 2 | 1 | 1 | 說明常駐 → setting-details | 可按需；比例目前值及房間設定仍直接可見 |

來源：`public/gift.html`、`gift.js` 的 `playerRow/progress/resultPanel/render`、`gift.css`。新版 `playerList.open = innerWidth<=1000 || innerHeight>800` 明確使一般 1280×720 桌機收起名單。

## 你畫我猜

| 資訊 | I | F | D | 舊版 → 新版 | 建議 |
| --- | --- | --- | --- | --- | --- |
| 全員姓名／角色、画者、在線、下輪加入、分數 | 5 | 5 | 5 | `#players` 常駐 → closed draw-friends | 恢復常駐；畫者／猜中／等待須用文字或圖案明確區分 |
| 當前畫者、輪次、公開提示／字數 | 5 | 5 | 5 | 舞台／board heading → 保留 | 保留，不用名單收合做交換 |
| 畫布與目前工具／色彩／線寬 | 5 | 5 | 5 | 畫布／左工具列 → 保留且放大控制 | 保留。工具可以熟悉圖示，但目前選中狀態不能只靠 hover |
| 猜題輸入、剩餘秒數、已猜中狀態 | 5 | 5 | 5 | 原輸入／倒數 → 右側 slot／固定寬倒數 | 常駐；繪畫者不顯示猜題輸入是玩法權限，不是任意藏資訊 |
| 最近猜測與猜中者 | 4 | 5 | 5 | 原紀錄 → 獨立 guessChat／有界 log | 保留常駐最近紀錄及猜中狀態；不要把全部移進更多選單 |
| 揭曉答案、畫作、個人分數／最終名次 | 5 | 4 | 5 | 揭曉／名單 → 主結果仍在，名單分數被收起 | 主結果及玩家分數皆直接可見；加入素材庫按鈕保留 |
| 投稿比例等房間設定說明 | 3 | 2 | 2 | 原設定卡 → 房間設定 details | 等候階段設定目前值至少可見；完整長說明可按需 |

來源：`public/draw.html`、`draw.js` 的 `playerRow/stageScene/render/updateFeed`、`draw.css`。答案在作畫階段對猜題者保密是既有玩法，不屬於此審查要移除的收合。

## 雷霆之路

| 資訊 | I | F | D | 舊版 → 新版 | 建議 |
| --- | --- | --- | --- | --- | --- |
| 四車隊姓名／角色、自己／AI／在線、當前車隊 | 5 | 5 | 5 | `#crews` 常駐 → resources + race-crews 雙層 details | 四隊常駐，直接看見姓名／角色與當前車隊 |
| 各隊骰點、已用／未用、回合進度 | 5 | 5 | 5 | crew mini-dice 常駐 → 隨 crews 隱藏；己方選骰仍可見 | 所有車隊骰子常駐；己方操作骰不能替代對手骰資訊 |
| 各隊剩車／可用車、己方各車損傷／淘汰 | 5 | 5 | 5 | 全隊摘要 + 己方 carDash → 對手摘要隱藏、己方仍在 | 恢復全隊摘要；區分「存活」與「需維修而不可用」，不能混稱剩車 |
| 場上車位置／地形／可走格／射擊目標 | 5 | 5 | 5 | 棋盤 → 保留 | 常駐，事件演出可略過，不永久蓋住決策位置 |
| ROUND、ROAD BONUS、倒數、剩餘移動點 | 5 | 5 | 5 | 頁首／dashboard → 仍常駐 | 保留並修一致數字字形與 baseline |
| 核心地形圖例／代價／岩壁危險 | 4 | 4 | 5 | 常駐 legend → terrain-legend details | 恢復核心圖例；擴充長解釋可分開按需 |
| 可用指令入口、當前指令／指令骰／已用狀態 | 4 | 4 | 5 | 原指令區 → race-command-options | 選骰階段可見可用指令與狀態；複雜修車／指令設定可按需，但不要加雙層收合 |
| 最近事件／碰撞結果 | 4 | 5 | 4 | lastEvent 常駐 → 保留 | 保留最近事件短摘要，碰撞選擇與骰結果需直見 |
| 完整事件 log | 3 | 3 | 3 | 舊 shell 已改為 closed details → 新增 resources 外層 | 不是本次首度隱藏；移除重複外層，常駐近期有界 log，完整歷史可另查 |
| 新手长教學／擴充素材說明 | 2 | 2 | 2 | 舊教學／說明 → resources／教學 | 可按需；當前一步最短操作提示留在主操作旁 |

來源：`public/race.html`、`race.js` 的 `render/renderDashContent/usedCommandUI`、`race.css`、舊新 `shared/game-shell.js`。不能只比較 HTML：舊版 shell 已把 `.race-feed` 轉成 details，所以 log 的新問題是多加外層，不是本次第一次收合。

目前 `crew-detail` 的可用車數計算為 `!dead && damage.length<2`；這不是所有存活車數。修正文案或同時展示「存活／可用」時需沿用正確規則，不因 UI 重排改變遊戲計算。

## 同頻俱樂部

| 資訊 | I | F | D | 舊版 → 新版 | 建議 |
| --- | --- | --- | --- | --- | --- |
| 全員姓名／角色、在線、出題者、總分 | 5 | 5 | 5 | `#players` 常駐 → playerList 在720p收合 | 恢復常駐名單與分數；不能只留下全員人數 |
| 題目／選項、自己的選擇／答案 | 5 | 5 | 5 | 題目常駐；提交後自答原已details → 新沿用 | 題目常駐；自己的已鎖定答案可直接確認。別人的答案仍按既有揭曉權限保密 |
| 已交卷人數、自己已交卷、倒數 | 5 | 5 | 5 | 原操作／progress → 右 slot | 保留，並在名單呈現每位交卷狀態 |
| 各答案組、玩家分組、票數／同頻結果 | 5 | 5 | 5 | 原舞台 → 保留 | 常駐，不把分組藏在合併工具內 |
| 合併兩組／還原／確認計分 | 5 | 4 | 5 | 原 review 操作 → 右 slot | review 階段常駐；先顯示兩組名稱再操作 |
| 本題每人加減分／總分 | 5 | 5 | 4 | 舊 scoreRows 常駐 → closed score-details | 恢復結果表，或在常駐名單同時呈現本題變化和總分 |
| 預備題目入口／queue count | 4 | 4 | 3 | 原預備題 → 右側入口／dialog | 入口及題數常駐，完整編輯可 dialog |
| 提前結束作答／投稿比例長說明 | 3 | 2 | 2 | 原操作／說明 → details | 可按需；提前結束後果須在操作附近可讀，不隱藏已交卷資訊 |

來源：`public/majority.html`、`majority.js` 的 `receive/progress/render/revealMarkup`、`majority.css`。自己的答案原已收合，因此是既存行為的重新評估；本題得分表是本次明確可見性退步。

## 德州撲克

| 資訊 | I | F | D | 舊版 → 新版 | 建議 |
| --- | --- | --- | --- | --- | --- |
| 全員姓名／角色、籌碼、在線、棄牌、操作中 | 5 | 5 | 5 | 舊新 poker shared list 皆常駐 | 保留；不要誤報成此次收合名單。牌桌座位也須可讀 |
| 自己手牌、公共牌、底池、每人下注／棄牌 | 5 | 5 | 5 | 原牌桌 → 保留，桌面大部分未改 | 常駐；720p 下手牌／主操作出框是另需處理的幾何問題 |
| 當前動作者、跟注額、下注選項／時間 | 5 | 5 | 5 | 原 action panel／turn → 保留 | 操作附近直接可見；放大文字不能犧牲牌桌決策資訊 |
| 盲注 | 5 | 4 | 5 | 舊新 sidebar 皆 room-game-info details；牌桌頂仍有10/20但字10px | sidebar 盲注改常駐並具短標籤；不能只靠極小 NO LIMIT 行 |
| 每步操作時間 | 4 | 3 | 4 | 舊新皆在 room-game-info details | 常駐設定摘要，與實際剩餘秒數分開標示 |
| 買入籌碼 | 3 | 1 | 1 | 舊新皆在 room-game-info details | 可按需；為少一層入口也可與盲注／時間並列短摘要 |
| HAND／ROOM | 4 | 3 | 3 | 保留；原低字級／monospace 未統一 | 可見短資訊，統一系統字型、lining/tabular，字級至少14 |
| 完整牌局動態／重播／音量細項 | 3 | 2 | 2 | 舊新仍存在 | 保留最近動作摘要，完整歷史／音量可按需 |

來源：`public/poker.html`、`app.js`、`style.css`、`shared/game-shell.js`。此批改版未全面改牌桌玩法及舞台，不能把既存座位裁切或牌桌字太小誤算成 `7346c0f` 新引入；它們仍應依最新要求修正。

## 字體、數字與 baseline 具體修法

字體三件事須分別驗收：`lining-nums` 選擇以一致基線排列的數字字形，`tabular-nums` 選擇等寬數字以穩定換值寬度，`align-items:baseline` 處理不同字級的文字盒對齊。單設 tabular 不會統一字體、字形高度或清掉 margin；用 center 對齊盒子也不能保證 label 與數字對齊。[MDN numeric 字形](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric)、[MDN align-items](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/align-items)。字體缺少相應 OpenType 字形時仍需測 fallback。

| 編號／位置 | 固定新版的實際問題 | 具體修法 | 驗收 |
| --- | --- | --- | --- |
| F01 race ROUND／ROAD BONUS／ROOM | `.race-stats b` 是20px Segoe UI；`#roomCode` 仍16px monospace、margin-top7；label14px，row/cell center 對齊 | 三個值同系統 font、20px、600、line-height1.3、lining+tabular；清 room margin；stats及cell baseline。label14px保持 | `01/+2/818596`、含字母 `A1B2C3`，三值及各自 label baseline差<=1px；100%/200%與換行皆測 |
| F02 poker ROOM／HAND／blind top line | `#codeLabel` 13px monospace，HAND／tabletopline10px；繼承 foundation body 不會覆蓋 selector 的 font shorthand | code系統font、14–16px、lining+tabular、正常字距；HAND及盲注行至少14px；資訊值與短label baseline | `ROOM 818596/ROOM A1B2C3`、`HAND 001/009/010`寬度與基線穩定、盲注可讀 |
| F03 poker pot／座位姓名／下注與籌碼 | 原 pot label12、value21；seat-name12、stack13、action10。旁邊 shared list 放大不會修牌桌上的文字 | 姓名16／狀態14，底池label14／value20；籌碼／下注lining+tabular，label/value以baseline對齊 | 同看座位、籌碼、底池和action，資訊不被裁切；200%合理重排 |
| F04 共用玩家分數／籌碼 | 新 room-player-metrics 已20系统+tabular，但沒有顯式lining；多指標意義部分只有title | 加lining；gift保留送／收可見標记。數字cell穩定寬並靠右，姓名區可換行 | `0/1/8/10/999/1,000`，同列分數baseline一致、兩指標可辨識 |
| F05 gift 禮物编号／心願順位／story數字 | `.gift-number`、舊 `.player-scores` 等仍有Georgia shorthand；正文換font並不覆蓋它們 | 資訊性编号／順位改系統font+lining/tabular；角色fallback符號與純插畫不必當數字資料改 | 1–8／排名1–4對齊，圖像與名稱清楚；不要為對齊刪排名 |
| F06 majority 總分／每題加減分 | 舊 `.score`仍Georgia24，但共用row目前已覆蓋；round-score／result strong沒有一致numeric contract | 在實際資料節點套統一數字class；加減號與分數同font，表格數字欄右齊 | `-1/0/+1/+2/10`與總分同列一致；保留本題gain和total |
| F07 draw 倒數／揭曉命中數／排名 | 倒數Consolas/Cascadia整塊等寬已解寬度跳動；其他stat與label混字級 | 倒數整塊可保留現有等寬字型，加入lining；統一line-height与固定slot。其他stat使用系统numeric contract+baseline | `90/89/11/10/9/0`輪替時外框寬／高不跳，中文單位與數字不錯位 |
| F08 header「302捉猶團」／共享nav | 游戏title28及nav16是層級設計，不要求數字與中文字形頂底完全等高；CJK可能fallback不同font | 維持同font stack與line-height；若title拆span，inline或baseline，不用top偏移補字形。資訊數字勿借裝飾字體 | header正常<=64px；200%可wrap，不用固定height壓住字；不將裝飾字形差誤判成盒baselinebug |
| F09 全專案其他Georgia／mono用途 | lobby wordmark、裝飾05／背景大字、成就符號、撲克牌rank、code snippet均有刻意用途 | 依語意處理：房號／回合／分數套資訊數字；撲克牌Georgia、純插畫、真程式碼不做無差別替換 | 保留卡牌辨識與品牌；不使用全域 `*{font-family:...}` 擦掉語意 |

背景排版證據：`work/agent-information-font-audit.json`。此檢查固定讀 `a37bf95` 的 CSS，所有提案只注入隔離的背景 browser，未修改 source。此 Chrome 中三個 race **值**的 baseline 原已碰巧相同；確定量測到的是 label 與值差 **3.5px**，以及 ROOM 不同字體／大小。提案後 label／value 差 **0px**。因此不能把目測直接描述成「三個值的實際 baseline 一定不同」；需要同時看字形、label 和排版 metrics。

資訊數字範例合約（提案，非本報告已實作）：

```css
.ui-number {
  font-family: var(--ui-font-family);
  font-variant-numeric: lining-nums tabular-nums;
  letter-spacing: normal;
}
.ui-stat-row, .ui-stat {
  display: flex;
  align-items: baseline;
  gap: .5rem;
}
.ui-stat-value {
  font-size: var(--ui-text-section);
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
}
```

後面的 `font:` shorthand 可能重置 numeric variant，因此要把數字 class 的 font／variant 放在最後有效規則，並檢查 computed style，不只搜尋原始碼是否出現 tabular。

## 恢復配置的共同驗收

- 同一角色、同一遊戲階段，以舊新版清單逐項確認資訊；「本輪不適用」與「藏起來」要分別記錄。採API既有保密規則，不因UI資訊恢復揭露他人未公開答案。
- 1280×720 與較寬桌機：主要操作、關鍵數值、玩家／車隊、角色、骰子、剩車直接可見；低頻說明先移到按需區域，不能把重要資訊塞進管理或總「更多」入口。
- 高密度名單使用清楚行列與合理圖像比例；維持16/14文字及44互動目標。若一屏仍放不下，接受局部捲動或必要重排，不壓到8–11px或切掉名字／狀態。
- 200%文字／640×360等效zoom：合理單欄、能捲動查看完整資訊，焦點與主操作不被fixed panel蓋住。大字需求優先於硬性免捲頁。
- 「能展開後找到」不得當作常駐驗收通過。角色API及分數計算未改，也不得當作資訊未損失的證據。

交叉討論：layout owner確認draw名單、race所有車隊／骰／可用車與核心圖例需恢復常駐；components owner確認gift/majority名單與得分、gift雙任務摘要和完整收禮內容需常駐。對race完整log的舊runtime收合已校正。Root另確認poker盲注／操作時間屬必要資訊、牌面Georgia保留；本報告僅寫審查文件，不修改遊戲source。
