# 設計師角色記憶

2026-10-09 #80 候選：独立生活／奇想原創情境題庫，不共用畫猜唯一答案與禁題票；同步私人畫猜、固定傳遞、完局選本回顧。三到八人短局是本站變體；離席中止明确標示，不能重排造成錯鏈。送出明確按鈕與就地提示取代每頁打斷，草稿／上一頁／已送出名單保清楚。真人樂趣及手機待驗；[設計](../specs/TELEPHONE-FIRST-EDITION.md)、[證據](../TELEPHONE-FIRST-EDITION-PROGRESS.md)。未合併／部署。

2026-10-09 #59 候選：原創霧港六幕，規則主持／不耗 token。以公共難度／代價與三專長、協助／整備建立決策；領隊整備失去專長，避免免費回復支配選擇。六席六幕輪替，不設淘汰或倒數；風格沿用共用 Playful Paper。上述為設計推論，真人平衡／樂趣與手機仍待驗；[設計](../specs/TRPG-FIRST-EDITION.md)、[工具證據](../TRPG-FIRST-EDITION-PROGRESS.md)。未合併／部署。

2026-10-08最新正式 **v1.15.1／c1e59d4**：使用者要求先撤回不一致的局部手繪風格，已恢復原大廳及四房標題外觀；保留v1.15彈幕框與既有功能，SVG/credits僅歷史留存。双平台各1,432、公開27資源、原生首頁／四房waiting通過，9帳戶allfields及21non-session表/BLOB保留；詳細source/部署SIGTERM逾時與proxy drain/不可覆寫receipt修正/備份/有限native/own cleanup見 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)。下面手繪與候選狀態屬歷史；後續局部美化须驗整體一致性，不由素材研究直接推定成熟全站方案。沒有新PR/push。

2026-10-08使用者回饋：局部手繪畫風造成網站整体不一致，先撤回手繪主題。候選 **v1.15.1／c1e59d4**恢復大廳及四房導入前的外觀，v1.15彈幕框及既有WebGL/共看/排版功能保留；素材與授權只作歷史留存。後續變更須以大廳、房間、設定、其他頁面的整體一致性評估，不把素材研究或局部preview當成全站成熟方案。Windows1,432／有限native與正式結果以 [還原進度](../UI-STYLE-ROLLBACK-PROGRESS.md)最新節為準；下面v1.14.2的「正在使用手繪」是歷史。

2026-10-08最新正式 **v1.15.0／f4cbdfa**：彈幕框Stage A發布，雙平台完整各1,432、公開25資源與五款三席frame/avatars通過。PNG上傳收藏／成就與勝場ledger仍缺；完整source/首輪Linux暫存I/O失敗與重跑/備份/native scope/9帳戶及21non-session表保留/own cleanup見 [最終進度](../BARRAGE-FRAMES-PROGRESS.md)與 [backlog](../SPEC-BACKLOG.md)。下方候選及1.14.2是歷史；tag固定受測程式，沒有新PR/push，不把有限取樣當全phase/讀屏/200%/FPS。

2026-10-08內建彈幕框候選 **v1.15.0／f4cbdfa**：paper／comic／pixel與default同12/16padding、1px outer預留和16px字級，decor必須inset，不用外伸尾巴／陰影造成碰撞漏算。關框只清框飾且改回default palette，picker仍能比較款式。原生group四choice以aria-pressed表達選中，不為外觀假tabs；Escape返回44px圖示trigger。五waiting入口＋1280/390與40字/16字名字fixture有限驗收，未認證全phase/讀屏/200%/FPS。發布證據與未做上傳收藏見 [進度](../BARRAGE-FRAMES-PROGRESS.md)，下方歷史以最新發布節取代。

2026-10-08最新正式 **v1.14.2／8ae5c4f**：Freehand官方SVG／紙卡大廳發布，最終Windows/Linux各1,415通過；v1.14.1 archive行尾失敗留歷史未部署，tag不移。紙白home/低飽和面/薄邊影/手繪圖槽與固定grid分離；1280三欄、1024兩欄、390單欄，正文16/次14、controls≥44。遊戲只32badge/24圖，不重排玩家/車隊/骰/畫布/倒數/聊天室；小操作registry保原辨識，不為手繪大圖藏重要資訊。 正式22資源exactbytes/no-store/MIME、21non-session表rows+BLOB/9帳戶allfields保留；sessions232→238為6次測試登入，都已revoked，own4房/代理/tabs已清理。精確source/備份/例外與限制見 [本批進度](../FREEHAND-UI-PROGRESS.md)、[spec](../specs/FREEHAND-UI.md)、[資產評估](../research/FREEHAND-UI-ASSETS-ASSESSMENT.md)、[視覺參考](../research/FREEHAND-UI-VISUAL-REFERENCES.md)。下方1.14.0/候選狀態為歷史，沒有新PR/push；不宣稱全playing/200%/讀屏/FPS完成。

2026-10-07最新正式 **v1.12.0／83ffcab**：雙平台各1,386、有限native／公開38media＋37draw資源／ACL／資料驗收完成；schema16／22表、9帳戶allfields／13市場圖片／21non-session rows與BLOB保留，sessions210→217為驗證登入變動。code／tag固定、own QA清理完成，沒有新UI PR。PR46外部已合併，其1,300項與本批分開；完整source／備份／限制見 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)。下方候選／待驗為歷史，不宣稱全讀屏／200%zoom／FPS／真YT公開實播。

2026-10-07 patterns有限畫面：收藏／市場manual Arrow只移焦，Enter／Space才換內容；review卡selected邊界／shadow保持同120px高，收藏1280／390／1600與member市場1280／390無橫溢、44px控制。controlled glyph double只是字型模擬，不稱真200% zoom／全站認證；兩dialog Escape返焦已驗，Tab採樣未證fulltrap。真earned持久inline與短粒子不互相替代，source／native限制集中 [進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，正式仍1.11.1，本批1.12未發布。

2026-10-07五庫模式實作中：以收藏／市場manual tabs、group／card／form／dialog、五款有限toast与四款既有new earned、通知旁短粒子作真落點。tab focus≠activation、group≠tabs；保重要玩家／車／骰／角色與inline，hover不蓋selected，通知hidden保可讀正文而取消動態。原生元件契約／pending證據見 [spec](../specs/UI-COMPONENT-PATTERNS.md)／[進度](../UI-COMPONENT-PATTERNS-PROGRESS.md)，目前正式基線1.11.1，本批未發布；不套React外觀即宣稱整套可達性。

2026-10-07恢復基線：PR46第三P2已推送、Ready並再次請Stanley審查；正式v1.11.1的source／測試／清理見 [PR最新證據](../PR46-REVIEW-FIX-PROGRESS.md)。patterns候選1.12.0恢復實作但未驗／未發布，前批結果不替代本批。

2026-10-07正式 **v1.10.0**：六份CSS共用背景／panel／floating、8／12／16radius、必要邊界／選取與lining／tabular數字，保留grid／padding／重要字級／操作尺寸與玩家／車隊／骰子／角色。換surface須配caller foreground，hover不可蓋selected；裝飾border不能當唯一必要線索。四遊戲桌機／390／200%與媒體sameiframe有有限證據，synthetic gift dark不是產品theme，不宣稱全部phase／全站對比。新粒子實際畫出才替換同類舊裝飾，fallback／文字保留。見 [進度](../UI-POLISH-WEBGL-PROGRESS.md)；[Threads五庫](../research/THREADS-UI-COMPONENTS-ASSESSMENT.md)只是模式參考未安裝；下方v1.9.0與美化候選保留為歷史。

2026-10-07正式v1.9.0媒體補充：影片主區使用可用高度，底列桌機compact而手機／coarse保操作尺寸，toolbar保持；本機原生控制與「同步我的播放進度」分清，只有有權席位可發布全桌。移除本站外開入口／共用seek不等移除YouTube原生branding、letterbox或所有控制；重要狀態與clock保持可見。最新規範／scope見 [spec](../specs/MEDIA-ICON-WINDOW-UI.md)／[進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)。

2026-10-07補充：語意不同的播放操作使用三角／裝置圖示區分，桌機同列按鈕以輕分隔分組；角色表情圖卡保持方形，省掉可見名稱並用共用提示。美化研究優先收斂字级／keylines／表面層次，詳 [研究評估](../research/UI-POLISH-DES13-ASSESSMENT.md)。

2026-10-07媒體設計準則：操作盡量只用圖示與hover／focus提示，共用GameUI registry；中文可讀名稱與keyboard／touch操作保留，重要資訊不能因減字隱藏。清單與點播放獨立較寬視窗，媒體entry單行、小gap、左把手／右移除；主播放器保留影片空間，從邊緣縮放。音樂下拉第一個文字選項「上傳歌曲」屬導航，不能作為歌曲送出。長名稱只在hover跑馬，減少動態或背景時靜止；字體放大時用共用控制尺寸token避免遮擋。見 [spec](../specs/MEDIA-ICON-WINDOW-UI.md)／[進度](../MEDIA-ICON-WINDOW-UI-PROGRESS.md)，全站圖示化按後續功能逐步套用。

2026-10-07：單一內容群組的置中要同時定義 items 與 content 分佈；畫猜未公開題卡的 `place-items:center` 仍承接正面 `align-content:space-between`，不能用逐glyph像素偏移修正。與程式方討論後採全頁共用 primitives、独立symbol槽及不帶help圓圈的未知問號SVG；正面題卡、禮物圖文卡與其他多區內容保留原布局。小D徽章不等於44px按鈕，文字／圖示槽也不替換人物表情或emoji內容。

本輪唯讀盘點20HTML／23CSS／46JS及實際提案、質疑、收斂見 [共用對齊規格](../specs/SHARED-UI-ALIGNMENT.md)。送禮fallback沒有同類space-between衝突，但布局utility必須維持明確hidden；基礎元件的幾何槽與字形ink／素材透明邊界分開驗。此筆是已採用契約與source盤點，程式及背景畫面驗收由主agent記錄；不宣稱本輪已上線，studio小尺寸控制與跨平台字型仍待驗。

同日後續：主agent背景Chrome發現history全域 `header span{margin-left:auto}` 直接污染設定close的symbol；18px是computed margin，圖示中心因此右偏9px。symbol／button-icon／button-label採 `margin:0;padding:0` 中性預設，间距交給parent gap與控制padding，不能全局清掉所有span或內容布局。重載後全20入口close中心0，題卡正常桌機／390手機中心0，D仍21×21且Range偏差(0,-0.5px)，200%文字close88×88中心與四個象限內部採樣命中；完整來源及範圍見同一規格。這是入口與特定元件驗證，不是全玩法／壞圖／所有emoji驗收；/rules實際導向/race教學，字體及viewport已還原，未在此宣稱正式部署。

2026-10-06：可捲動工作區不應使用固定560px上限或估算扣420px，否則高視窗仍出現捲軸。送禮桌機改為flex扣實際導覽列、grid保留實際玩家列，再分配剩餘高度；窄高差異測試須檢查操作區不與玩家列重疊。高視窗、八席與手機證據見 [高度驗收](../GIFT-VIEWPORT-HEIGHT-PROGRESS.md)。

2026-10-06：重要操作區與輸入框需要最小間距，不可只依靠 flex 的 `margin-top:auto`；視窗較矮時剩餘空間會變成0。送禮側欄已用共用16px spacing token補操作區後的 margin，並在矮桌機、一般桌機及手機量測，見 [實際驗收](../GIFT-WAITING-SPACING-PROGRESS.md)。

2026-10-05 U33：成人禮物以獨立可選分類開局，非房主能看摘要；迷因題庫区分既有模板與本站原創情境，既有ID和品質禁題功能保留。改名是帳戶外觀資訊，設定页就地反馈、1–16字，不能把username跟著改掉。大廳小幅入場不遮內容／阻擋按鈕，尊重共用個人動畫設定。框收藏首選單張靜態PNG＋九宮格表單，DOM文字与圖框分離；可分享／私人受眾、壞圖回退、個人隱藏及移轉都在 [規格評估](../specs/CUSTOM-BARRAGE-FRAMES.md)，尚未接入遊戲。前五項及觀察限制见 [整合進度](../PARTY-UPGRADE-PROGRESS.md)，本批未PR／部署。

更新：2026-10-05。先讀 [共用偏好](MEMORY-LEDGER.md)、[記憶協議](MEMORY-PROTOCOL.md)、[玩家成就spec](../specs/ACHIEVEMENTS-AND-RECORDS.md)及 [實際攻防](../research/AGENT-DESIGN-DEBATE.md)。玩家方執筆正式候選採否，設計方提出樂趣、反例修訂、圖案與可判定事件。

## 已驗證與來源

| 類型 | 結論 | 證據／限制 |
| --- | --- | --- |
| 程式事實 | 現有僅gift/majority/poker/thunder四入門徽章及all-first-table；沒有draw hook及持久勝場總計。 | `src/achievements/store.js`。INSERT OR IGNORE持久防同一徽章重發，WeakSet僅runtime處理去重，不能用作新多次紀錄的完整設計。 |
| 程式事實 | 雷霆repair僅己方未淘汰受損車；擲骰按鈕與確認不等同完成駕駛回合。 | `src/games/thunder.js:begin/newRound`；成就需合法before/after及completedHumanTurn，不以UIclick判定。 |
| 程式事實 | poker results聚合不同side pot後只保留name/amount/hand；多結果不是同pot平手證據，暱稱也不是持久identity。 | `src/games/poker.js:settle/view`。共享勝利須server保留per-pot winnerIds、返還／平手分類，未實作。 |
| 討論結果 | 0分羞辱、碰撞次數、少數答案、非必要重擲相同值不列首版；禮物巧合從3份改2份讓3人桌也可成立。 | player_research實際v2及設計回應；gift單件無0分（3/2/1/-4/-1），錯誤初稿保留補正；每項採否／未定在攻防文件，不虛構一致投票。 |
| 實玩觀察（轉述） | 畫猜錯過8秒揭曉後沒有上一輪回看／收藏入口。 | 主 agent2026-10-05回報；結果快照P0先於成就演出。 |

## 設計推論與方法

趣味来自正常遊玩中的巧合、自嘲與共同時刻；不用別人輸掉、故意拖延、断線、灌投稿、隱私披露或不利操作換徽章。條件即使只在解鎖後公開，仍可能被看見後誘導策略，不能把「私人」當萬用免責。

先提出名稱＋預期樂趣＋權威predicate＋誰獲得＋圖案，再交玩家找反例、程式核對證據。記錄提案→反駁→修訂→採否，不以agent人數投票。正常勝場／共享勝利與幽默徽章分開，不增加XP、排行榜、能力、每日任務或催促同桌的桌上進度。

入門正常有效參與先補齊畫猜；同條件不塞兩枚徽章，趣味名稱可作皮膚或收藏描述。玩家v3補正「跨桌搬零食」為2款不同遊戲正常有效完成，門檻不同於第一桌，可列P1探索候選；設計方接受。低信心的erase/repair/特殊fold留P2真人觀察；不為每款必須有兩項就把兩項都排成實作。新圖案不能暗示還未確認的condition已成立。

## 假設與待驗證

- 2份同禮物、全員同頻是P1採用候選；4顆原始骰全1及全桌有效操作列最終玩家spec的P2研究，尚無真人偏好／頻率數據。
- 幽默名可能因不同朋友群語境讓人尷尬，玩家可選靜音／不展示是提案，現有store沒有此設定。
- 畫者有效stroke、guess.correct、dice accepted snapshot、per-pot winnerIds、持久gameRunId等predicate需求要程式方定義，不接受客户端或暱稱回推。

## 後續與授權界線

2026-10-05畫猜房間修正已實作：玩家名單取代等待插圖、完整角色優先；類別改多選，自定義作獨立來源。房主設定草稿與名單更新分開，不能因朋友入座重設勾選。實際computed尺寸需核對共用foundation覆蓋；本輪1280×720八人、64×80角色及390單欄已驗，版本／正式測試範圍見 [進度](../DRAW-ROOM-SETUP-PROGRESS.md)。

玩家方完成 [成就與紀錄](../specs/ACHIEVEMENTS-AND-RECORDS.md)，主 agent整合roadmap。程式方先做權威資料／冪等／正常結算，再由美術與動畫方套展示。原型與研究文件不表示已整合、已上線或獲得新的發布授權；引用Steam等平台資料也不是替本專案決定遊戲規則。

2026-10-05共用聲音已實作（`2e8dc4d`）：右上角44px齒輪放個人背景音樂／遊戲音效開關及音量，各遊戲入口一致；它適合設定選單，玩家／車隊／骰子仍需常駐。聲音設定正文16、次要14、百分比tabular、滑桿操作44，使用共用popover保持可見；手機導覽需換列容納齒輪。桌上房主播放控制保留，不能混成全桌靜音。驗收見 [共用聲音進度](../SHARED-AUDIO-PROGRESS.md)。

2026-10-05房間設定整合已實作（`15af1dd`、U16）：畫猜／送禮／同頻的欄位、儲存與結果提示放同區，避免跨舞台與側欄尋找按鈕。畫猜八人桌展開表單會推長頁面，改用入口旁且限制視窗的設定浮層；玩家名單仍常駐，關閉／Escape返焦。送禮／同頻保持同容器的設定區與44px儲存按鈕，1280×720整頁不捲、舞台局部捲動。重要玩家資訊不能套用這種低頻設定的收合方式；位置、尺寸及公開站驗收見 [本批進度](../BARRAGE-ROOM-SETTINGS-PROGRESS.md)。


## 2026-10-08 紙卡大廳 Draft

已確認 shhuang.cc 是 Linux 部署 8a9cbfd 的六款遊戲專案；Windows BGA-main 舊版不是改動目標。獨立分支 codex/playful-board-game-ui，使用者接受紙卡範本並要求原角色移動功能保持原樣。這輪僅大廳啟用 tokens／六卡輪播／建立房間 dialog，hub.js、lobby.js、遊戲／房間／帳號／資料庫模組未改。五款房間遊戲實際 UI 建立與等待頁、market直接導航、兩帳號移動／表情同步及Chromium觸控驗證通過。完整測試1,519項、1,518通過、原版同項SQLite I/O失敗。其他頁面仍待視覺確認；未部署、未完成全站實玩驗收、未打發行tag。证据見 docs/playful-ui/README.md 與 test-results.md。此紀錄取代本輪將 Windows 舊三款遊戲來源視為正式專案的假設，不代表撤銷既有其他功能契約。


### 2026-10-08 授權部署更新

使用者明確要求更新 shhuang.cc 測試，1.17.0／6be11b4／v1.17.0 已部署。原先 SQLite I/O 測試失敗因 /tmp 空間不足，改用磁碟 TMPDIR 後 1,519/1,519 全部通過；未改測試或 storage。正式瀏覽器驗證登入保留、輪播／建立 dialog／六張插畫與設定版號，origin八資源驗證、DB完整性/schema/四資料表指紋保留通過。此筆取代前一筆未部署／原版測試仍失敗狀態；其餘頁面尚未改造。證據 docs/playful-ui/deployment.md。


## 2026-10-08 全站紙卡延伸，候選1.17.1

使用者要求登入、等待房及遊戲頁也要改，並明確說各遊戲可保留不同布局，只要區塊對齊；開房不得要求暱稱，改用帳號設定的displayName。21HTML共享主題，四款等待内容／操作top差0、gap16px，75最新viewport无水平溢出/pageerror。原布局與core/API/DB/畫猜renderer未改；撲克漏type直接開桌已測舊版失敗並修正，五款權威名稱回歸與三入口實際settings→create通過。完整Linux1,526/1,526，focused13；實際限定遊戲操作與五款200%/reduce通過，非全規則／真手機／全讀屏／FPS。完整檔案與證據 docs/playful-ui/full-site/README.md；部署完成另記該目錄deployment.md，不把候選自稱上線。

Full-site UI deployed to shhuang.cc on 2026-10-08: v1.17.1, frozen commit 35c1e51. Distinct game layouts retained with aligned panels. Deployment evidence: docs/playful-ui/full-site/deployment.md.

## 2026-10-08 風格命名及保存

完成風格命名 Playful Paper／繽紛紙卡，分支 style/playful-paper，複製保存 archive/playful-paper-v1.17.1。使用者希望未來提供多種風格供玩家挑選；已記錄全站主題、一致元件與各遊戲不同布局的方向，選單尚未實作。見 [風格分支策略](../playful-ui/STYLE-BRANCHES.md)。

## 2026-10-08 深色亮色對比方向

繽紛紙卡深色變體使用近黑背景與鮮綠主要操作、粉紅／橘黃／藍紫選取強調；亮色填滿區用深色文字。保留插畫、撲克牌紅黑花色與白色作畫畫布。各遊戲不同布局及對齊維持；設定旁太陽／月亮按鈕及三模式select，非多風格選單。驗收詳 [深色模式](../playful-ui/DARK-MODE.md)，正式狀態以發布證據為準。

2026-10-08 深色變體正式v1.18.0已部署；設定旁亮暗控制、鮮明操作色與auto/light/dark已公開驗證。完整矩陣及有限玩法／對比範圍见 [發布證據](../playful-ui/full-site/dark/deployment.md)。不代表未來多風格選單已完成。

2026-10-08 PR57複查：保留不同遊戲布局與全站紙卡語言，main新增的市場曲線／行情／排行也共用tokens；1726全通過、深色矩陣與light/dark數值預測通過。見 [PR57複查](../playful-ui/PR57-INTEGRATION-REVIEW.md)。本輪候選非新的正式發布。


2026-10-08 PR57 追加：雷霆賽道紀錄 16px 內距／標題 8px 間距，撲克未入座使用 hidden 槽位保留 nth-child，雷霆不產生空車隊。離線／出局實際玩家保留，API／同步未改。Linux 41 項、release check、36 組亮暗／三尺寸／2、3、滿席與兩人 playing 通過；前後截圖、範圍及兩回合審查見 [本輪證據](../playful-ui/seat-spacing/README.md)。候選 v1.19.0 未合併／未部署，正式仍 v1.18.0；既有 archive 與 tag 不動。


2026-10-08 PR57評論修正：滑動防護只豁免controller同步選中的卡片，避免鍵盤／前後切換與create type不同步；承接PR53 bf545ae混合真人AI成就。69項與原生Chromium滑鼠／瀏覽器鍵盤事件／真create通過；固定head與兩回合審查見 [證據](../playful-ui/PR57-COMMENT-FIXES.md)。未部署／未合併main，舊收據不修補。
