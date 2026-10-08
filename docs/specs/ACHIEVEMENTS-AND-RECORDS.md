# 趣味成就與獲勝紀錄 spec

更新：2026-10-08。**v1.16.0 候選已實作單位成就，正式部署／最終整合驗收待主 agent**；正式基線 v1.15.1。B02 成就目錄／分類、B04 畫猜入門、B05 六枚趣味與 B06 跨遊戲探索已有程式；B03 僅完成下述 unit 支線，永久勝場、完整 match ledger 與持久 outbox 尚未實作。發行 source、最終測試與正式狀態集中於 [本批進度](../ACHIEVEMENTS-UNIT-PROGRESS.md)。下方 2026-10-05 的未實作盤點保留為歷史，不能當成當前功能缺口。

## 2026-10-08：本批有限實作

目錄有 **13 枚**：保留原 5 枚 ID／名稱及既有取得日期／來源，加入本文件列出的 8 個新 ID。`src/achievements/catalog.js` 提供完整 metadata；API 保留 `id`／`unlockedAt` 相容欄位，收藏冊依 draw／gift／majority／poker／thunder／all 分類。新定義為 `rule_version=1`、`visibility=private`、`status=enabled`；不提供公開展示設定、永久勝場或排行榜。

draw／gift／majority 引擎在開輪凍結 canonical 帳號／座位映射，正常結算只發最小參與旗標與 metrics，不傳原答案、畫布或喜好內容。`processUnit` 同一 SQLite transaction 寫入 `processed_unit_events`、`achievement_progress` 與 `user_achievements`。同 UUID 異內容、同 match／game／unit／number 換 UUID 皆硬衝突；已提交同內容重播及重新開啟 store 為 no-op。畫猜合法 stroke／guess 證據不因 clear／undo 消失，具體授予仍依下方條件。

`rules_completed`、`production`、`game_server` 且有效參與才授獎。`interrupted`／`abandoned`、test／tutorial 只留 receipt，不授舊／新徽章或探索進度；身份映射缺失／不完整的單位保守降為 interrupted、只計可驗身份，不晚補或按名字推斷。poker／thunder 保留原合法人為操作條件，由開局凍結身份的新單位累積探索；不從既有徽章或歷史回填玩過哪些遊戲。

RAM pending 保留未提交的 immutable 單位，處理失敗不 ack；同一存活程序即使刪房仍由全域 queue 重試。**未提交資料在程序崩潰後仍不能恢復**，也没有把 history JSONL 與 SQLite 做成原子交易；B03 持久 outbox／跨程序 reconciliation 留後續。已提交 receipt 的重啟去重與這個未提交限制分開描述。

schema **17** 新增兩張表；舊 schema 16 遷移只加空表，不改舊徽章／帳戶，不 backfill。完整移轉驗 canonical facts／指紋、引用及全列成就 digest，schema 17 匯出還原保留 receipt／progress／舊日期；舊 bundle 可合法升級。原永久 `game_results`／`match_participants`／`processed_results`／勝場 UI 仍未完成，不以這兩張表替代。

已執行的有限回歸來源：`tests/achievement-units.test.js`、`tests/immersion-achievements.test.js`、`tests/achievement-pending-retry.test.js`、`tests/achievement-migration.test.js`。涵蓋原條件／舊紀錄、六枚趣味 predicates、探索、重播／硬衝突、整筆回滾、真 HTTP 折牌後 DB 失敗／刪房／存活程序補寫，以及新舊 bundle；引擎身份失敗與資格見 `tests/achievement-unit-engines.test.js`，API／呈現另見 `tests/achievement-http.test.js`、`tests/achievements-ui.test.js`。這些 focused 證據不是完整發行測試或正式部署證明，亦不是真人誘因／多設備／讀屏驗收。

## 目的與既有基線

讓玩家記得玩過、學過、自然發生過什麼，留下按原遊戲規則認定的獲勝記錄；名稱可以無厘頭，條件不鼓勵傷害同桌體驗。私人永久徽章與勝利帳本分開，不發 XP、能力、每日任務、連續登入壓力或勝率排行榜。公開展示由本人自選。

2026-10-05 歷史程式查核（unit／目錄缺口已由上方候選更新；永久 wins 缺口仍有效）：

| 位置 | 已有功能 | 缺口 |
| --- | --- | --- |
| `src/achievements/store.js` | 五枚定義：gift-first-gift、majority-first-vote、poker-first-hand、thunder-first-drive、all-first-table；`user_achievements`主鍵 `(user_id,achievement_id)`，重複授予 INSERT OR IGNORE | 沒有 draw hook、事件型趣味條件、統一成就進度或勝利ledger；`processed`為WeakSet，不是跨重啟處理紀錄 |
| `src/app.js` | 在狀態流程呼叫gift／majority／poker／thunder發放；GET `/api/achievements`可讀帳號成就 | 沒有畫猜發放入口；必須以結算事件取代依當下room反覆推測 |
| `public/achievements.html/js` | 可查看已解鎖日期與説明 | 頁首仍說送禮一枚、其他規劃，與五枚store不一致；應由metadata渲染實際遊戲範圍 |
| `src/history/store.js` | session／match UUID、JSONL意圖與結果、engine hash、finished/interrupted metadata | 玩家只存座位／名字，沒有不可變帳號映射；不能靠暱稱從歷史補勝。整份history不直接當公開戰績資料 |
| 遊戲 engine | draw／majority有winner.ids，gift有雙軌達標winner.ids，race有winner.id，poker results按人聚合 | 各遊戲結算單位與平手不同；部分玩家不足也phase finished，不能當正常競技勝利 |

原五枚已取得者保留 ID 與取得日期，不撤銷、不重新刷一遍。五枚條件沒有因本文件而更改。既有資料與新ledger的遷移見 [多環境資料 spec](MULTI-ENV-DATA-MIGRATION.md)。

## 先處理的玩家缺口

下表保留原驗收要求；P0 回看已有既有實作，入門／metadata／安全趣味及探索已有本批候選程式。永久 result ledger 與 P2 仍待，逐項現況見 [backlog](../SPEC-BACKLOG.md)，不重排已做功能為缺口。

| 優先 | 工作 | 可驗收條件 |
| --- | --- | --- |
| P0 | 畫猜每輪公開結果與畫布不可變快照、固定回看入口、收藏context | reveal開說明、跨8秒換輪、關dialog後仍能回看舊答案／畫作；保存該快照不讀現在新畫布。一人開dialog不暫停全桌。尚未實測錯存，不把它當已證實bug |
| P1 | 畫猜入門與共用第一桌補齊 | `draw-first-round`：本人至少一次server確認的合法stroke或guess，該參與單位正常揭曉；不需猜對／獲勝。artist離線／被移除造成的中斷單位不發，但此前已合法完成單位不抹除。同步授all-first-table；重連／重送／重啟只一次 |
| P1 | 成就頁metadata一致 | 由store metadata或共用定義列出各遊戲，不再說只有送禮；名稱／ID／規則版本／日期可讀 |
| P1 | 持久、帳號綁定、凍結的result ledger | 正常結算一次寫入，退出房間不重算已保存winner；重啟／重送／多環境archive匯入不重增win |
| P1 | 第一批安全趣味候選與中性探索 | 先做下表標「採用候選」者；每項逐個有事件／資格／去重與測試，不以icon點擊次數解鎖 |
| P2 | 自然偶發骰運與多人共同徽章 | 補server metric後小批真人試玩；是否誘導亂玩、同桌壓力比解鎖率更重要 |

「正常揭曉」須由server明確標 unit outcome；不是任意的 `phase==='reveal'`。draw的全員猜中／正規作畫時間用盡是完成，artist斷線／離開是中斷品質旗標，不能把僅觀看或保活算有效作畫。

## 候選攻防與採否

下方 8 個 ID 已進 v1.16.0 候選實作，授予與正式狀態依上方範圍及最新進度；其餘 P2 研究／暫緩／否決項不因本批而啟用。首批能包含不同遊戲，但不為每款湊相同枚數降低條件品質。精確門檻屬 spec，趣味偶發徽章不提前展示桌上目標進度；入門規則透明。

新增 metadata 契約：`achievement_id`永久穩定、`game`用engine type（race為thunder）、`title`、`description`、`rule_version`、`condition_key`、`icon_key`、`visibility`、`status`。文案或圖示修改不換ID；條件重定義提升rule_version且有既得權策略，不能悄悄重算舊日期。`status=proposed|enabled|paused`不與個人locked/unlocked混用。

| 本批新 ID（候選已實作） | 顯示名稱／對應條件 |
| --- | --- |
| draw-first-round | 畫猜初登場／P1中性入門 |
| draw-soul-artist | 靈魂畫手，有人懂／合法作畫且有人猜中 |
| draw-first-correct | 字幕組準時上班／合法猜中 |
| gift-coincidental-twins | 心意撞車／同giftId>=2 |
| gift-wishlist-echo | 願望清單有回音／正向心願rank |
| majority-one-channel | 同頻不用 Wi-Fi／全員同組 |
| majority-tied-signals | 訊號撞成平手／並列最大組 |
| all-two-tables | 跨桌搬零食／兩種有效遊戲單位 |

這8個新ID包括1枚補齊入門與7枚首批趣味／探索。P2研究候選尚不註冊正式ID；既有五個ID維持原名與取得紀錄。

| 候選／遊戲 | 可判定條件 | 玩家攻防與決定 | 實作依賴／優先 |
| --- | --- | --- | --- |
| **靈魂畫手，有人懂**／draw | 本人是artist；server有本人合法stroke；正常輪揭曉中>=1其他帳號合法猜中 | 不判畫技好壞，笑的是抽象創作而非評他人；不要求全桌答對，不逼朋友配合。採用候選 | `draw.round_completed`＋stroke／guessed帳號映射，P1 |
| **字幕組準時上班**／draw | 本人server記錄合法猜中且該輪正常揭曉 | 不設速度或錯猜數門檻，慢輸入者仍可拿；名稱只是梗，不加加速要求。採用候選 | guess.correct與round完成，P1 |
| **心意撞車**／gift | 本人收禮條目中，同一giftId>=2份，整輪完成所有收禮確認並正式結算 | 原3份需4人桌，改2份讓3人桌也可自然發生；只授收禮者，沒有「请其他人送同款」桌上目標。採用候選 | entries／recipient canonical user ID；不看收禮動畫，P1 |
| **願望清單有回音**／gift | 本人正式收禮中有自己的great／good／ok之一 | 不把noWay當成滿足心願；不依朋友給自己的低分授辱罵徽章。易達成也合理。採用候選 | 結算entries rank，P1 |
| **同頻不用 Wi-Fi**／majority | 正常揭曉時全部有效參與者均作答且同一組，參與者>=3；本人有有效答案 | 自然共同時刻，不顯示未達成者或「就差你」；不增加題中進度。採用候選 | 正式分組結果／participant snapshot，P1 |
| **訊號撞成平手**／majority | 正常揭曉有>=2個最大組，每組count>=2；本人有有效答案，授所有有效作答者 | 從「唯一清醒／非最大組」改成全桌中性巧合，沒有誰拖累；保留原並列不得分規則。採用候選 | 引擎正式groups而非前端合併預覽，P1 |
| **跨桌搬零食**／all | 本人以有效操作完成兩種不同遊戲的既定有效單位 | 不是每日重置，與第一桌門檻不同；新手／輸家同樣可累積。不宣稱今天必須玩。採用候選 | 持久探索進度／帳號映射，P1 |
| **這桌訊號滿格**／all | rules-completed局，全體eligible帳號各有>=1合法核心操作；本人在該全桌 | 設計要共同榮譽，玩家反對公開差誰；改私人結算解鎖。暫採研究候選，不能以all finished推定大家有操作 | 完局participants與participation_evidence，P2 |
| **骰子開了一家一元店**／race | 正式accepted round snapshot本人4顆原始移動骰全1；本人完成合法手動turn並正常完賽 | 原「同結果重擲」會誘導多擲一次；改純自然骰運，永遠不因此額外重骰。採研究候選 | 需持久accepted round metrics；不是動畫面，P2 |
| **公路也幫忙踩油門**／race | 正式round roadDie為當前rules_version最大合法值；本人有效完整turn且正常完賽 | 無增加掷骰誘因，但趣味偏弱、與一般完赛差异小；待真人比較，不為湊數首發 | 確認不同road die版本與accepted metric，P2 |
| **橡皮擦不是白買的**／draw | 本人server接受erase操作，正常輪有人猜中 | 為了工具徽章可能刻意擦一下；點選工具不能證明使用。暫緩，先觀察是否妨礙創作；不能排除從不需要橡皮擦的玩家 | 可信工具事件，P2研究，不首批 |
| **維修站今天有人**／race | 合法repair降低己方另一可修且未淘汰車的damage，正常完賽 | 只能修自己車隊，不是他人隊伍；可能誘導先撞壞再修。暫緩，首版不做對局中任務 | repair before/after、正式finish，P2研究 |
| **我把底牌帶回家**／poker | 本人合法fold且該手正常完成 | 與第一手牌重複，也可能鼓勵無謂棄牌；暫緩。不能公開本人未攤底牌 | hand操作／final result unit；隱私測試 |
| **這桌有分身**／poker | 同一pot實際split的winner包含本人與另一帳號，不是不同side pot各有winner | 現有results依人聚合，不能可靠辨出同pot平手，也不能用同名。暫緩到新增per-pot權威資料 | 每pot winner IDs、refund／tie分類 |
| **零食吃完，這局也玩完**／all | 本人有效操作且正常完成 | 與現有第一桌重複；可作收藏冊友善文案／皮膚，**不新增同條件第二枚** | 既有metadata，非新授予 |
| **我按下去了，真的**／all | 第一次合法主操作server確認 | 只操作尚未完成，不符合參與裡程碑；而且與入門重複，否決獨立徽章 | 不新增 |
| **全村唯一清醒／我的頻道也開著**／majority | 本人有效答案非最大組 | 私人事後發也無法消除已知條件誘導離群，且可能標記輸家；**否決**，改平手共同候選 | 不新增 |
| **本店不退貨**／gift | 禮物低分或0分 | 既有單件分數不是0而是3/2/1/-4/-1；更重要是可能羞辱收／送禮者並誘導送討厭物，**否決** | 不新增 |
| **保險公司關注你**／race | 碰撞三次 | 明顯鼓勵故意亂撞和拖時間，**否決**，改自然骰運 | 不新增 |
| **骰子今天不聽話**（相同重擲版本）／race | 重擲且相同結果 | 即使只記合法accepted event仍可能鼓勵沒必要重擲，**否決此條件** | 不新增；可把名稱用在非授予事件文案 |

成就可以容易，不靠勝率也合理；不能為證明「難」就要求反常或連續失敗。每個名稱／圖示需避免人格或友情評價。美術使用同一筆畫與留白的原創圖示；候選可用畫筆＋燈泡、對話框＋勾、雙禮盒、清單＋禮盒、波紋、雙訊號、兩桌與碗。是否從素材庫取得、以Node產SVG或模型做圖依動畫／美術spec另行決定，這份文件沒有已產圖的宣稱。

## 永久勝利與戰績的規則（後續，尚未實作）

保存 server **第一次權威結算的不可變結果**，不從當下名單／房間最高分推測。房間完成後有人離開、改名、換角色或刪房，都不修改已結算winner。舊history沒有可靠account映射的標 `unverifiable`，不按暱稱回填勝利；五枚舊成就保留已授事實。

| 遊戲 | 正式戰績單位 | 勝者來源與平手 | 參與／品質說明 |
| --- | --- | --- | --- |
| draw | 一局完成原roundLimit的輪替，`result_unit=match` | 原engine `winner.ids`；相同最高分共享勝利 | 全員合法參與snapshot，不要求每輪都猜中。timeout、artist_disconnected記round品質；按規則走完quota仍保存原winner，但玩家不足提前finish是abandoned |
| gift | 正常達到雙軌目標的整局，`match` | `winner.ids`；送／收都達target才勝，可以多人 | 不把單輪最高送分當整局勝；每輪entry成就另計；未達勝條件中止不計loss |
| majority | 完成roundLimit的整局，`match` | `winner.ids`；同分共享勝利，包括原規則全員同最高分 | 單題沒最大組不得分不是整局draw；房主合併／還原需結算事件記錄；離房不能改ledger名次 |
| race／thunder | 一場正常比賽，`race` | `winner.id`非null，按越線或最後可行隊伍等原規則 | winner.id null的「無人生還」記draw／無勝者；不同真人／AI配置分桶；僅保活或全程AI代打不符入門手動條件 |
| poker | 一手完成，`hand` | 依實際pot分配給勝者；純退回未跟注款不是勝利，side pots有獨立winner與split | 不把籌碼最多／多筆results等同win或tie。需補per-pot canonical winner與refund分類才發布精確wins，先只保可驗證參與記錄 |

結果狀態分兩個軸：

- `status='rules_completed'|'abandoned'|'interrupted'`：是否依規則到正式終局。只用phase finished不足以判定。提前玩家不足、管理終止為abandoned；程序／資料寫入中斷為interrupted。後二者不算勝／負或把缺席記0分。
- `quality_flags`：保留timeout、artist_disconnected、participant_absent、AI接手、測試用途等可解釋狀況。**某輪合法timeout不自動抹掉全局原winner**。本輪draw正好有round2 timeout與round3缺席揭曉，是此區分的實例。

`outcome='win'|'shared_win'|'loss'|'draw'|'participated'|'abandoned'`。勝利總數為符合資格的rules_completed參與列中win+shared_win，另分列單獨／共享；不把shared_win算半勝。若是共同無勝者draw，所有有效參與者draw。未參與有效單位的旁觀／等待下一輪者是participated，不算loss。

競技資格分 `match_format='human'|'mixed_ai'|'solo_ai'`；畫猜至少2真人帳號、送禮／同頻至少3、race至少2真人帳號才列真人勝利；mixed／solo AI另列练習成果。實名、設備或IP不能證明不同真人，文件以已驗證帳號及bot旗標為基礎，不宣稱能抓全部分身。新資料需server標用途 `production|test|tutorial`，既有專用測試帳號的驗收局不增加對外競技統計；不用登入／點擊／動畫當有效核心參與。

第一版呈現「已完成N局、勝利N次（其中共享M次）／有效參與紀錄」，不主推勝率或連勝。若將來加勝率，分母必須明示：同遊戲、同rules version可比範圍、同format、rules_completed且eligible的決勝局；draw／abandoned與不可驗身份舊史分開，不悄悄算loss。

## 持久資料與事件契約

完整多環境遷移、備份與回滾策略只在 [MULTI-ENV-DATA-MIGRATION.md](MULTI-ENV-DATA-MIGRATION.md) 定義；此处規定成就與玩家結果的需求，沿用相同表名與權威規則。

| 資料 | 必需內容／唯一約束 |
| --- | --- |
| `game_results`（後續） | `match_id` UUID主鍵、`result_event_id` UUID唯一、env_id、game_type、rules_version、result_unit、status、quality_flags、finished_at、source_sha256、match_format。room code只作人可讀索引 |
| `match_participants`（後續） | 主鍵 `(match_id,user_id)`；outcome、score_breakdown、tie_rank、participation_evidence。帳號UUID來自認證／server seat mapping，不能由name推測 |
| `seat_user_mapping`（尚無獨立表） | 本批在 unit 開始凍結映射、receipt 保存 minimal user／seat 事實；完整 match／join 映射與獨立表仍屬後續。中途離房不抹掉已完成單位 |
| `processed_results`（後續） | result_event_id主鍵，match_id唯一；rule_version、processed_at；在權威整局finalize transaction去重 |
| `processed_unit_events` | **schema17 unit 支線已實作**：unit_event_id 主鍵、match／game／unit／unit_number 唯一、status／purpose／source、完成時間、規則版本、canonical minimal facts 與指紋。round／hand／race 的參與成就紀錄，**不能第一題就把整場 match 設成已 finalize** |
| `user_achievements` | 原主鍵／四欄位保留；本批新授予 source_key 用 unit:UUID 引用 receipt，規則版本在 catalog／receipt，不宣稱此表新增 version 欄位。舊來源／日期不改，授予只一次 |
| `achievement_progress` | **schema17 探索支線已實作**：主鍵 `(user_id,achievement_id,rule_version,game_type)`，achievement_id 固定 all-two-tables／version1，只存首次有效單位引用與時間。不同遊戲一列，沒有勝場或秘密內容；同 transaction 累積，archive 不補算 |

完整 match／wins 的後續 game event 需有 `event_id`、match_id、unit_event_id（如適用）、game_type、rules_version、server時戳、outcome、eligible participant snapshot與足夠metrics；這不代表本批已寫全部欄位。現有room.version只在記憶體局部有意義，不能當跨环境全域event ID。手牌／輪次若屬parent match，另存parent_match_id＋unit_index唯一關系，不混用room session識別。

處理順序：server確認玩法結果 → 建立／讀取權威immutable結果 → 同一SQLite transaction寫result／participants／processed記錄、成就INSERT OR IGNORE與必要進度 → commit → 客戶端收到既定結果及本人成就提示。history JSONL與SQLite無法一筆atomic commit；採server持久outbox／可重入reconciliation，見DB spec；不能在JSONL失敗時先無條件展示勝利計數成功。

`production`為唯一正式勝利／授予authority。dev/staging使用隔離帳號／匿名fixtures；匯入的history只作唯讀archive，不觸發成就或win。相同UUID不同payload硬衝突；不同origin同username須重新驗證身份或人工連結，不能默默合併。舊成就來源roomcode雖不是強識別，仍保留已授取得事實，不捏造精確舊對局。

## UI、隱私與提示

收藏冊按遊戲／探索分類，列名稱、短條件、取得日期。2026-10-08 使用者最新指示取代卡片可見解鎖文字：改以高亮區分，移除重複的已／未解鎖字樣與狀態圖示；讀屏保留隱藏狀態文字，篩選選項仍能按取得狀態選擇。主要文字16px、輔助14px；44px操作入口，沿用現有foundation與統一icons。成就頁可按需詳細，不占遊戲核心玩家／骰子位置。

先顯示比分／winner與公開結果，再顯示本人一則合併提示「解鎖N枚」，不挡主操作、不移焦點、不在遊玩中反覆提示「差一步」。短動效、音效各可關，減動／靜音仍能讀結果。重連可看到未讀標記，不補播過去聲光。新入門與勝利透明；隐藏偶發趣味精確門槛不等於隐藏重要玩法資訊。

預設私人收藏與戰績，本人可挑徽章展示；不展示他人的未公開手牌／秘密答案／送禮喜好，不把完整JSONL嵌入公開战绩。公開摘要只用经過權限的既定結果。刪除房間不刪合法個人獲勝紀錄；帳號資料刪除／匯出依既有資料政策另行處理，不在本輪發明新的公開履歷規則。

## 驗收與 rollout

| 測試 | 應通過 |
| --- | --- |
| 同event重送、重連、程序重啟 | 每徽章授一次、每match/user結果一次、計數不重增，提示不重播 |
| 多round授入門後整局finalize | processed_unit_events與processed_results不衝突；win仍能寫入 |
| 平手／同名／改名 | 依canonical user ID與原winner保存；same score不拿陣列順序決勝；正常離房不改winner |
| draw reveal開说明跨輪再收藏 | 可以回看原公開snapshot；保存context不讀新輪畫布；收藏成功與新遊戲deadline互不影响 |
| draw timeout／artist缺席／玩家不足 | 正常quota與品質旗標分離；玩家不足abandoned不能誤算win；單獨中断unit不誤授相應round徽章 |
| gift3／8人、相同禮物與noWay | 2份same gift可自然解鎖；noWay不符合願望成就；所有收禮確認完成才用final entries判定 |
| majority單人异見／最大組並列 | 异見不授被否決徽章；>=2最大組且每組>=2才平手趣味；不公布缺誰 |
| race全1、AI代打、追加擲骰 | 原accepted round metrics判定；不為了徽章额外重骰；valid completed turn才可能授，练习分桶 |
| poker side pot／refund／split | 不把多winner聚合結果等同同pot共享勝利；無法驗證時不假造正式wins |
| prod/dev/staging導入、UUID衝突 | 非正式來源不增加prod win／achievement；硬衝突停止，舊未映射史僅archive |
| 成就誘因真人測 | 至少不同技能小桌／大桌各一場，問是否為了拿徽章亂猜／亂撞／送討厭禮物／要求朋友配合；有可重現行為則改條件或停發候選 |
| 減動、靜音、鍵盤與720p | 結果可讀，提示不搶焦點、不遮關鍵狀態；不讓未解鎖者失去正常遊戲入口 |

2026-10-08 rollout 現況：P0 結果快照已有既有實作；本批採最小 server 身份／unit 交易，補畫猜入門、metadata、六枚趣味及探索，正式驗收仍依最新進度。永久 match／wins／持久 outbox 與 P2 自然偶發另批，不為了完成 backlog 自動啟用。新狀態／條件改版仍需既得權策略；此 spec 不代替部署或 PR 授權。

## 實際攻防記錄

第一輪：設計提出錯誤／低分、碰撞次數、重擲相同與工具使用等趣味名字；玩家反對誘導破壞、標記輸家、朋友配合與錯誤可判定假設。

第二輪：否決非最大組／低分送禮／碰撞次數／重擲相同；同禮物從3改2份、願望只計正向rank、改用平手共同巧合；repair核為己方車、split pot核為現有聚合results不足；draw補guess-only安全候選與合法stroke要求。設計／玩家共同同意不為每款湊兩枚把不可靠條件列首批。詳細逐項提案、反駁與決定見設計方的 [實際攻防記錄](../research/AGENT-DESIGN-DEBATE.md)，不偽稱真人訪談或投票。
