# 設計師角色記憶

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
